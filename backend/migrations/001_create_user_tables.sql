-- Migration 001: Create user authentication tables
-- Run this to add user management to the Quran database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session tokens table
CREATE TABLE IF NOT EXISTS session_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_session_tokens_token ON session_tokens(token);
CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id);
