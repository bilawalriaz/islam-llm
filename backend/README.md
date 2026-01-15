# Quran Reader Backend

FastAPI backend server that serves Quran data from SQLite database and provides audio file streaming.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure the Quran database exists at `../quran-dump/quran.db` and audio files at `../quran-dump/audio/`

3. Run the server:
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

## Access URLs

The backend is configured to listen on all interfaces (`0.0.0.0`) for both local and Tailscale access:

- **Local**: `http://localhost:8001`
- **Tailscale**: `http://100.115.245.7:8001`

### API Documentation

When the server is running, visit:
- **Local**: `http://localhost:8001/docs`
- **Tailscale**: `http://100.115.245.7:8001/docs`

## API Endpoints

### Quran Endpoints

- `GET /api/quran/surahs` - Get all surahs (returns 114 chapters)
- `GET /api/quran/surahs/{id}` - Get surah metadata by ID
- `GET /api/quran/surahs/{id}/ayahs` - Get ayahs for a surah (with edition filter)
- `GET /api/quran/editions` - Get all text editions and translations
- `GET /api/quran/audio/editions` - Get available audio reciters

### Static Files

- `GET /audio/{reciter}/{ayah_number}.mp3` - Stream audio files directly
  - Example: `/audio/ar.alafasy/1.mp3` plays ayah 1 recited by Mishary Alafasy
  - Served from `../quran-dump/audio/` directory

### Auth Endpoints (Demo)

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

## CORS Configuration

The backend is configured to allow CORS from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Alternative port)
- `http://100.115.245.7:5173` (Tailscale + Vite)
- `http://100.115.245.7:3000` (Tailscale + alternative)
- `http://100.115.245.7:8001` (Tailscale backend direct access)

To add more origins, edit the `CORSMiddleware` configuration in `main.py`.

## Project Structure

```
backend/
├── main.py           # FastAPI application with all endpoints
├── requirements.txt  # Python dependencies (fastapi, uvicorn)
└── README.md         # This file
```

## Database Schema

The SQLite database (`../quran-dump/quran.db`) contains:

- **editions**: Text editions and translations (identifier, language, name, type)
- **surahs**: Chapter metadata (name, revelation type, number of ayahs)
- **ayahs**: Verse text with metadata (juz, manzil, page, ruku, etc.)
- **audio_editions**: Available reciters (identifier, bitrate)
- **audio_files**: Audio file references

## Development

The frontend Vite dev server proxies `/api` and `/audio` requests to this backend.
