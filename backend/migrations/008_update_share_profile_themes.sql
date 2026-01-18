-- Migration 008: Update share_profiles table to support new themes
-- Run this in your Supabase SQL Editor

-- Drop and recreate the check constraint to include new themes
ALTER TABLE share_profiles DROP CONSTRAINT IF EXISTS share_profiles_theme_check;

-- Add updated constraint with new themes
ALTER TABLE share_profiles ADD CONSTRAINT share_profiles_theme_check
    CHECK (theme IN ('classic', 'nature', 'dark', 'minimal', 'ocean', 'royal'));

-- Comment on the theme column
COMMENT ON COLUMN share_profiles.theme IS 'Visual theme for the share profile: classic (warm sunset), nature (forest green), dark (midnight), minimal (monochrome), ocean (calm blue), royal (elegant purple)';
