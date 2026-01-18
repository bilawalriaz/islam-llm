-- Migration 008: Update share_profiles table to support only 3 themes
-- Run this in your Supabase SQL Editor

-- First, migrate any users with removed themes to 'classic'
UPDATE share_profiles 
SET theme = 'classic' 
WHERE theme IN ('minimal', 'ocean', 'royal');

-- Drop and recreate the check constraint with only 3 themes
ALTER TABLE share_profiles DROP CONSTRAINT IF EXISTS share_profiles_theme_check;

-- Add updated constraint with only 3 themes
ALTER TABLE share_profiles ADD CONSTRAINT share_profiles_theme_check
    CHECK (theme IN ('classic', 'dark', 'nature'));

-- Comment on the theme column
COMMENT ON COLUMN share_profiles.theme IS 'Visual theme for the share profile: classic (warm cream), dark (midnight slate), nature (forest green)';
