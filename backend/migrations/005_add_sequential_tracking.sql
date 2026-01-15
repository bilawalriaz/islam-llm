-- Migration 005: Add sequential progress tracking and audio analytics
-- This migration adds:
-- 1. is_sequential flag to completed_ayahs for true sequential progress
-- 2. play_sessions table for tracking individual play sessions
-- 3. replay_stats table for aggregate replay statistics
-- 4. quran_play_sessions table for full Quran play mode

-- Add sequential flag to completed_ayahs
ALTER TABLE completed_ayahs ADD COLUMN is_sequential BOOLEAN DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_completed_ayahs_sequential ON completed_ayahs(user_id, is_sequential);

-- Track individual play sessions for analytics
CREATE TABLE IF NOT EXISTS play_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ayah_id INTEGER NOT NULL,
    surah_id INTEGER NOT NULL,
    ayah_number INTEGER NOT NULL,
    audio_edition TEXT NOT NULL DEFAULT 'ar.alafasy',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Aggregate replay statistics per ayah
CREATE TABLE IF NOT EXISTS replay_stats (
    user_id INTEGER NOT NULL,
    ayah_id INTEGER NOT NULL,
    play_count INTEGER DEFAULT 1,
    total_duration_seconds INTEGER DEFAULT 0,
    last_played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, ayah_id)
);

-- Track full Quran play sessions
CREATE TABLE IF NOT EXISTS quran_play_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_surah_id INTEGER NOT NULL,
    start_ayah_number INTEGER NOT NULL,
    end_surah_id INTEGER,
    end_ayah_number INTEGER,
    audio_edition TEXT NOT NULL DEFAULT 'ar.alafasy',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    ayahs_played INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_play_sessions_user_ayah ON play_sessions(user_id, ayah_id);
CREATE INDEX IF NOT EXISTS idx_play_sessions_user_date ON play_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_replay_stats_user_count ON replay_stats(user_id, play_count);
CREATE INDEX IF NOT EXISTS idx_quran_sessions_user ON quran_play_sessions(user_id, started_at);
