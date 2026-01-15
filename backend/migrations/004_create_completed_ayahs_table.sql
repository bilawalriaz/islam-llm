-- Migration 004: Create completed_ayahs table for tracking completion
-- This tracks which ayahs each user has fully completed (played/read)

CREATE TABLE IF NOT EXISTS completed_ayahs (
    user_id INTEGER NOT NULL,
    ayah_id INTEGER NOT NULL,
    surah_id INTEGER NOT NULL,
    ayah_number INTEGER NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, ayah_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_completed_ayahs_user_surah ON completed_ayahs(user_id, surah_id);
CREATE INDEX IF NOT EXISTS idx_completed_ayahs_user ON completed_ayahs(user_id);
