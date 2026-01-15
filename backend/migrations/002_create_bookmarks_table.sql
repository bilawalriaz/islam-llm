-- Migration 002: Create bookmarks table
-- Run this to add bookmark functionality

CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ayah_id INTEGER NOT NULL,
    surah_id INTEGER NOT NULL,
    ayah_number_in_surah INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, ayah_id)
);

-- Index for faster bookmark lookup
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_surah ON bookmarks(surah_id);
