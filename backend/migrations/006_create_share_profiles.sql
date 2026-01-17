-- Migration 006: Create share_profiles table for public user stats sharing
-- Run this in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Share profiles table
CREATE TABLE IF NOT EXISTS share_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    share_id VARCHAR(8) UNIQUE NOT NULL,
    theme VARCHAR(20) DEFAULT 'classic' CHECK (theme IN ('classic', 'nature', 'dark', 'minimal')),
    show_reading_progress BOOLEAN DEFAULT true,
    show_completion BOOLEAN DEFAULT true,
    show_streak BOOLEAN DEFAULT true,
    show_bookmarks BOOLEAN DEFAULT false,
    show_listening_stats BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by share_id
CREATE INDEX IF NOT EXISTS idx_share_profiles_share_id ON share_profiles(share_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_share_profiles_user_id ON share_profiles(user_id);

-- Enable Row Level Security
ALTER TABLE share_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Users can view their own share profile
CREATE POLICY "Users can view own share profile"
    ON share_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Users can insert their own share profile
CREATE POLICY "Users can insert own share profile"
    ON share_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own share profile
CREATE POLICY "Users can update own share profile"
    ON share_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete their own share profile
CREATE POLICY "Users can delete own share profile"
    ON share_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Public read access for sharing (read-only by share_id)
-- This allows anyone to view a share profile without authentication
CREATE POLICY "Public can view share profiles by share_id"
    ON share_profiles FOR SELECT
    USING (true);

-- Function to generate unique share_id
CREATE OR REPLACE FUNCTION generate_share_id()
RETURNS VARCHAR(8) AS $$
DECLARE
    new_id VARCHAR(8);
    max_attempts INTEGER := 10;
    attempts INTEGER := 0;
BEGIN
    LOOP
        attempts := attempts + 1;
        -- Generate 8-character random string (lowercase letters and numbers)
        new_id := encode(gen_random_bytes(4), 'hex');

        -- Check if already exists
        IF NOT EXISTS (SELECT 1 FROM share_profiles WHERE share_id = new_id) THEN
            RETURN new_id;
        END IF;

        -- Safety: exit if too many attempts
        IF attempts >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique share_id after % attempts', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate share_id on insert if not provided
CREATE OR REPLACE FUNCTION set_share_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.share_id IS NULL OR NEW.share_id = '' THEN
        NEW.share_id := generate_share_id();
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_share_id_trigger
    BEFORE INSERT ON share_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_share_id();

-- Trigger to update updated_at on update
CREATE TRIGGER update_share_profiles_updated_at
    BEFORE UPDATE ON share_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_share_id();

-- Helper function to get public share stats
CREATE OR REPLACE FUNCTION get_share_stats(p_share_id VARCHAR)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_settings JSON;
    v_stats JSON;
BEGIN
    -- Get the share profile and user_id
    SELECT user_id,
           json_build_object(
               'theme', theme,
               'show_reading_progress', show_reading_progress,
               'show_completion', show_completion,
               'show_streak', show_streak,
               'show_bookmarks', show_bookmarks,
               'show_listening_stats', show_listening_stats
           ) INTO v_user_id, v_settings
    FROM share_profiles
    WHERE share_id = p_share_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get user name
    SELECT json_build_object(
        'name', name,
        'created_at', created_at
    ) INTO v_stats
    FROM profiles
    WHERE id = v_user_id;

    -- Get reading stats
    IF (v_settings->>'show_reading_progress')::boolean OR (v_settings->>'show_completion')::boolean THEN
        v_stats := v_stats || json_build_object(
            'total_ayahs_read', (
                SELECT COALESCE(SUM(ayahs_read), 0)
                FROM daily_readings
                WHERE user_id = v_user_id
            ),
            'total_surahs_read', (
                SELECT COUNT(DISTINCT surah_id)
                FROM reading_progress
                WHERE user_id = v_user_id
            )
        );
    END IF;

    -- Get completion stats
    IF (v_settings->>'show_completion')::boolean THEN
        v_stats := v_stats || json_build_object(
            'completion_percentage', (
                SELECT CASE
                    WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) * 100.0 / 6236), 1)
                    ELSE 0
                END
                FROM completed_ayahs
                WHERE user_id = v_user_id
            ),
            'completed_surahs', (
                SELECT COUNT(DISTINCT s.id)
                FROM completed_ayahs ca
                JOIN surahs s ON s.id = ca.surah_id
                WHERE ca.user_id = v_user_id
                  AND (SELECT COUNT(*)
                       FROM completed_ayahs ca2
                       WHERE ca2.user_id = v_user_id
                         AND ca2.surah_id = s.id) = s.number_of_ayahs
            )
        );
    END IF;

    -- Get streak
    IF (v_settings->>'show_streak')::boolean THEN
        v_stats := v_stats || json_build_object(
            'reading_streak', (
                WITH date_series AS (
                    SELECT read_date
                    FROM daily_readings
                    WHERE user_id = v_user_id
                    ORDER BY read_date DESC
                    LIMIT 365
                ),
                streak_calc AS (
                    SELECT
                        read_date,
                        read_date - (ROW_NUMBER() OVER (ORDER BY read_date DESC))::INTEGER as grp
                    FROM date_series
                )
                SELECT COUNT(DISTINCT read_date)
                FROM streak_calc
                WHERE grp = (SELECT grp FROM streak_calc ORDER BY read_date DESC LIMIT 1)
                  AND read_date >= CURRENT_DATE - INTERVAL '1 day'
            )
        );
    END IF;

    -- Get bookmarks count
    IF (v_settings->>'show_bookmarks')::boolean THEN
        v_stats := v_stats || json_build_object(
            'total_bookmarks', (
                SELECT COUNT(*)
                FROM bookmarks
                WHERE user_id = v_user_id
            )
        );
    END IF;

    -- Get listening stats
    IF (v_settings->>'show_listening_stats')::boolean THEN
        v_stats := v_stats || json_build_object(
            'total_play_count', (
                SELECT COALESCE(SUM(play_count), 0)
                FROM replay_stats
                WHERE user_id = v_user_id
            ),
            'total_listen_time_minutes', (
                SELECT COALESCE(CEIL(SUM(total_duration_seconds) / 60.0), 0)
                FROM replay_stats
                WHERE user_id = v_user_id
            )
        );
    END IF;

    -- Merge settings into result
    v_stats := v_stats || v_settings;

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on helper function to authenticated and public
GRANT EXECUTE ON FUNCTION get_share_stats(VARCHAR) TO anon, authenticated;
