# Quran Reader

Read and listen to the Holy Quran with multiple translations and audio recitations.

![Quran Reader](https://img.shields.io/badge/Quran-Reader-orange)
![React](https://img.shields.io/badge/React-19-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green)

## Features

- **Complete Quran**: All 114 surahs with 6,236 ayahs
- **Multiple Translations**: Arabic text with English translations (Saheeh International, Pickthall, Yusuf Ali)
- **Audio Recitation**: 30+ reciters including Mishary Alafasy, Abdul Basit, and more
- **Auto-play**: Continuous playback with smooth scroll to follow current verse
- **Smart Scrolling**: Page automatically scrolls to center the playing ayah
- **Multiple Editions**: Switch between different Arabic text styles and translations
- **Responsive Design**: Works on desktop and mobile devices
- **Beautiful Typography**: Arabic fonts (Amiri) for Quranic text
- **Tailscale Access**: Access from your Tailscale network

## Project Structure

```
islam-llm/
├── backend/           # FastAPI backend server
│   ├── main.py       # API endpoints
│   └── requirements.txt
├── frontend/         # React 19 + Vite frontend
│   ├── src/
│   │   ├── api/     # API client
│   │   ├── components/  # React components
│   │   └── pages/   # Page components
│   └── package.json
└── quran-dump/       # Quran database and audio files
    ├── quran.db     # SQLite database
    ├── audio/       # MP3 audio files
    └── download.py  # Data download script
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ and pip

### 0. Download Quran Data (First Time Only)

The Quran database and audio files are not included in the git repository due to their size. Download them first:

```bash
cd quran-dump
python download.py
```

This will download:
- `quran.db` - SQLite database with Quran text and metadata
- `audio/` - MP3 audio files for recitations

### 1. Start the Backend (After downloading data)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend will run on:
- **Local**: `http://localhost:8001`
- **Tailscale**: `http://100.115.245.7:8001`

### 2. Start the Frontend (In a new terminal)

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on:
- **Local**: `http://localhost:5173`
- **Tailscale**: `http://100.115.245.7:5173`

## Access URLs

### Production (Cloudflare Tunnel)
- Frontend: `https://quran.hyperflash.uk`

### Local Access
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8001`
- API Docs: `http://localhost:8001/docs`

### Tailscale Access
- Frontend: `http://100.115.245.7:5173`
- Backend API: `http://100.115.245.7:8001`
- API Docs: `http://100.115.245.7:8001/docs`

> **Note**: Ensure port 5173 and 8001 are allowed through your firewall if accessing from Tailscale.

## Development

### Backend API Endpoints

- `GET /api/quran/surahs` - Get all surahs
- `GET /api/quran/surahs/{id}` - Get surah by ID
- `GET /api/quran/surahs/{id}/ayahs` - Get ayahs for a surah
- `GET /api/quran/editions` - Get all text editions
- `GET /api/quran/audio/editions` - Get available audio reciters

### Static Files

- `/audio/{reciter}/{ayah_number}.mp3` - Stream audio directly (served as static files)

### Frontend Pages

- `/` - Home dashboard
- `/quran` - Quran surah listing with search and filters
- `/quran/:id` - Surah detail with ayahs and audio player

### Using Audio Playback

1. Navigate to any surah (e.g., `/quran/1` for Al-Fatihah)
2. Click the play button next to any ayah to start playback
3. Enable "Auto-play next" to continuously play through the surah
4. The page will automatically scroll to center the playing ayah
5. Switch between reciters using the dropdown at the top
6. Audio files stream directly as MP3s from the backend

### Available Reciters

Popular Arabic reciters include:
- Mishary Alafasy (default)
- Abdul Basit (Murattal)
- Mahmoud Khalil Al-Husary
- Mohamed Siddiq El-Minshawi
- Abdurrahmaan As-Sudais
- Maher Al-Muaiqly

Plus 20+ more Arabic reciters and translations in English, French, German, Spanish, and more.

## Tech Stack

- **Frontend**: React 19, Vite 7, React Router v7
- **Backend**: FastAPI, Uvicorn
- **Database**: SQLite
- **Fonts**: Amiri (Arabic), Inter (UI)
- **Audio**: MP3 streaming

## Data Source

Quran data is sourced from [Al Quran Cloud API](https://alquran.cloud/)

## License

Quran text is public domain. Translation copyrights belong to respective translators.

## Author

Bilawal Riaz - [bilawal.net](https://bilawal.net)
