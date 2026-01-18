-- Migration 007: Add enabled column to share_profiles table
-- Run this in your Supabase SQL Editor

-- Add enabled column (default to true for existing profiles)
ALTER TABLE share_profiles ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

-- Update existing profiles to be enabled by default
UPDATE share_profiles SET enabled = true WHERE enabled IS NULL;

-- Add index for faster queries filtering by enabled status
CREATE INDEX IF NOT EXISTS idx_share_profiles_enabled ON share_profiles(enabled);

-- Comment on column
COMMENT ON COLUMN share_profiles.enabled IS 'Whether the share profile is publicly accessible. When false, the share link returns a "profile disabled" message.';
