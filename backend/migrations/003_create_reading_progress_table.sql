-- Migration 003: Create reading progress tables
-- Run this to add reading progress tracking

-- Main reading progress table
CREATE TABLE IF NOT EXISTS reading_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    surah_id INTEGER NOT NULL,
    last_read_ayah_id INTEGER NOT NULL,
    last_read_ayah_number INTEGER NOT NULL,
    total_ayahs_read INTEGER DEFAULT 0,
    last_read_date DATE DEFAULT (date('now')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, surah_id)
);

-- Daily reading tracker for streaks
CREATE TABLE IF NOT EXISTS daily_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    read_date DATE NOT NULL,
    ayahs_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, read_date)
);

-- Completed surahs tracker
CREATE TABLE IF NOT EXISTS completed_surahs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    surah_id INTEGER NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, surah_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_date ON reading_progress(last_read_date);
CREATE INDEX IF NOT EXISTS idx_daily_readings_user_date ON daily_readings(user_id, read_date);
CREATE INDEX IF NOT EXISTS idx_completed_surahs_user ON completed_surahs(user_id);
