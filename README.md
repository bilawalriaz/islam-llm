# Quran Reader

Read and listen to the Holy Quran with multiple translations and audio recitations.

![Quran Reader](https://img.shields.io/badge/Quran-Reader-orange)
![React](https://img.shields.io/badge/React-19-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

## Features

- **Complete Quran**: All 114 surahs with 6,236 ayahs
- **Multiple Translations**: Arabic text with English translations (Saheeh International, Pickthall, Yusuf Ali)
- **Audio Recitation**: 30+ reciters including Mishary Alafasy, Abdul Basit, and more
- **Auto-play**: Continuous playback with smooth scroll to follow current verse
- **Smart Scrolling**: Page automatically scrolls to center the playing ayah
- **Progress Tracking**: Track your reading progress, bookmarks, and completion statistics
- **User Accounts**: Personalized experience with authentication via Supabase
- **Multiple Editions**: Switch between different Arabic text styles and translations
- **Responsive Design**: Works on desktop and mobile devices
- **Beautiful Typography**: Arabic fonts (Amiri) for Quranic text
- **Tailscale Access**: Access from your Tailscale network

## Database Architecture

This project uses a **hybrid database architecture** that separates static Quran data from dynamic user data:

### SQLite3 (Quran Content - Read-Only)

**Purpose**: Store the complete Quran text, translations, and audio metadata.

**Why SQLite3 for Quran data?**
- **Bandwidth Efficient**: Quran data is static and large (~40MB). Storing locally on the server avoids repeated API calls to external services.
- **Fast Read Performance**: SQLite is excellent for read-heavy workloads with simple queries.
- **Simple Deployment**: Single file database, easy to backup and migrate.
- **No Network Latency**: All Quran queries are local, ensuring fast response times.

**Tables in SQLite3:**
- `surahs` - Chapter metadata (114 records)
- `ayahs` - Individual verses (6,236+ records per edition)
- `editions` - Text editions and translations
- `audio_editions` - Audio recitation metadata
- `audio_files` - Audio file mappings

### Supabase PostgreSQL (User Data - Read-Write)

**Purpose**: Store user accounts, authentication, and all user-generated data.

**Why Supabase for User Data?**
- **Managed Authentication**: Built-in JWT-based auth with email verification, password reset, and social login support.
- **Row Level Security (RLS)**: Data isolation at the database level - users can only access their own data.
- **Real-time Capabilities**: Ready for real-time features if needed (e.g., sync across devices).
- **Scalable**: Cloud-hosted PostgreSQL with automatic backups and high availability.
- **Bandwidth Efficient**: User data is small (KB per user) compared to Quran data (MB), so API calls are minimal.

**Tables in Supabase:**
- `profiles` - User profile data (extends `auth.users`)
- `reading_progress` - Per-surah reading position
- `daily_readings` - Reading streak tracking
- `completed_ayahs` - Individual verse completion tracking
- `completed_surahs` - Fully completed chapters
- `bookmarks` - User bookmarked verses
- `play_sessions` - Audio play session analytics
- `replay_stats` - Aggregate replay statistics
- `quran_play_sessions` - Full Quran play mode sessions

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (FastAPI)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                     ▼
┌──────────────────────┐            ┌──────────────────────┐
│    SQLite3 (Local)   │            │  Supabase (Cloud)   │
│                      │            │                      │
│  • surahs            │            │  • profiles          │
│  • ayahs             │            │  • reading_progress  │
│  • editions          │            │  • daily_readings    │
│  • audio_*           │            │  • completed_ayahs   │
│                      │            │  • bookmarks         │
│  Read-Only Quran     │            │  • play_sessions     │
│  Content             │            │  • etc.              │
│                      │            │                      │
│  ~40MB data          │            │  User Data (RLS)     │
└──────────────────────┘            └──────────────────────┘
```

## Project Structure

```
islam-llm/
├── backend/                # FastAPI backend server
│   ├── main.py            # API endpoints (Supabase + SQLite)
│   ├── share_image.py     # Social media image generation
│   └── requirements.txt   # Python dependencies
├── frontend/              # React 19 + Vite frontend
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   └── pages/        # Page components
│   └── package.json
├── quran-dump/            # Quran database and audio files
│   ├── quran.db          # SQLite database (Quran content only)
│   ├── audio/            # MP3 audio files
│   └── download.py       # Data download script
├── migrations/            # Database migrations (historical)
├── migrate-to-supabase.py # User data migration script
└── README.md             # This file
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ and pip
- Supabase account (free tier works)

### 1. Supabase Setup (Required)

The application requires Supabase for user authentication and data storage.

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Choose a region close to your users

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy these values:
     - `Project URL` (e.g., `https://xxx.supabase.co`)
     - `anon public` key (for client-side access)
     - `service_role` key (for admin operations - keep secret!)

3. **Set Environment Variables**
   ```bash
   # For backend (create backend/.env)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Only for migrations
   ```

4. **Run Database Migrations**
   - The migrations are applied via Supabase's MCP tools or the migration script
   - See `migrate-to-supabase.py` for the schema

### 2. Download Quran Data (First Time Only)

The Quran database and audio files are not included in the git repository due to their size.

```bash
cd quran-dump
python download.py
```

This will download:
- `quran.db` - SQLite database (~40MB) with Quran text and metadata
- `audio/` - MP3 audio files for recitations (~500MB)

### 3. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend will run on:
- **Local**: `http://localhost:8001`
- **Tailscale**: `http://100.115.245.7:8001`

### 4. Start the Frontend (In a new terminal)

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

#### Quran Data (SQLite - Public, No Auth)
- `GET /api/quran/surahs` - Get all surahs
- `GET /api/quran/surahs/{id}` - Get surah by ID
- `GET /api/quran/surahs/{id}/ayahs` - Get ayahs for a surah
- `GET /api/quran/editions` - Get all text editions
- `GET /api/quran/audio/editions` - Get available audio reciters
- `GET /api/quran/audio/{ayah_number}` - Get audio file info

#### Authentication (Supabase Auth)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout (client-side token discard)
- `GET /api/auth/me` - Get current user profile

#### Bookmarks (Supabase - Requires Auth)
- `GET /api/bookmarks` - Get user's bookmarks
- `POST /api/bookmarks` - Create bookmark
- `DELETE /api/bookmarks/{id}` - Delete bookmark
- `GET /api/bookmarks/exists/{ayah_id}` - Check if ayah is bookmarked
- `GET /api/bookmarks/surah/{surah_id}` - Get bookmarks for a surah

#### Progress Tracking (Supabase - Requires Auth)
- `POST /api/progress` - Update reading progress
- `GET /api/progress` - Get all progress
- `GET /api/progress/stats` - Get reading statistics
- `GET /api/progress/last-position` - Get last reading position
- `GET /api/progress/sequential` - Get sequential progress

#### Completion Tracking (Supabase - Requires Auth)
- `POST /api/completed-ayahs` - Mark ayah as completed
- `GET /api/completed-ayahs/surah/{surah_id}` - Get completed ayahs for surah
- `GET /api/completed-ayahs/stats/{surah_id}` - Get surah completion stats
- `GET /api/completed-ayahs/first-unread` - Get first unread ayah
- `GET /api/completed-ayahs/overall-stats` - Get overall completion stats

#### Audio Analytics (Supabase - Requires Auth)
- `POST /api/analytics/play-start` - Track play session start
- `POST /api/analytics/play-end` - Track play session end
- `GET /api/analytics/replay-stats` - Get most replayed ayahs

#### Full Quran Play Mode (Supabase + SQLite - Requires Auth)
- `POST /api/quran-play/start` - Start full Quran play session
- `GET /api/quran-play/next-ayah/{surah}/{ayah}` - Get next ayah in sequence
- `POST /api/quran-play/end/{session_id}` - End play session

#### Share Images (SQLite - Public)
- `GET /api/share/og` - Open Graph image for homepage
- `GET /api/share/ayah/{surah}/{ayah}` - Generate shareable ayah image
- `GET /api/share/ayah/by-id/{ayah_id}` - Generate image by ayah ID

### Static Files

- `/audio/{reciter}/{ayah_number}.mp3` - Stream audio directly

### Authentication Flow

1. **Registration/Login**: Frontend sends credentials to `/api/auth/register` or `/api/auth/login`
2. **Token Response**: Backend returns Supabase JWT access token and refresh token
3. **Store Tokens**: Frontend stores tokens (localStorage or cookie)
4. **Authenticated Requests**: Include `Authorization: Bearer <token>` header
5. **Token Verification**: Backend verifies JWT with Supabase and extracts user ID
6. **Data Access**: RLS ensures user can only access their own data

### Frontend Pages

- `/` - Home dashboard with statistics
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
- **Databases**:
  - **SQLite3**: Quran content (read-only)
  - **Supabase PostgreSQL**: User data with RLS
- **Authentication**: Supabase Auth (JWT)
- **Fonts**: Amiri (Arabic), Inter (UI)
- **Audio**: MP3 streaming

## Data Source

Quran data is sourced from [Al Quran Cloud API](https://alquran.cloud/)

## Migrating User Data

If you have existing user data in the old SQLite-only format, use the migration script:

```bash
# Set your Supabase service role key
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run migration
python migrate-to-supabase.py
```

This will:
1. Create users in Supabase Auth with temporary passwords
2. Migrate all progress tracking data
3. Migrate bookmarks and engagement data

**Important**: The migration script generates temporary passwords. Users will need to reset their passwords on first login.

## Security Considerations

### Row Level Security (RLS)

All Supabase tables have RLS policies enabled:
- Users can only read/write their own data
- Policies are enforced at the database level
- Even if API credentials are leaked, users cannot access other users' data

### JWT Token Verification

- Backend validates JWT tokens with Supabase on every authenticated request
- Tokens expire automatically (configurable)
- Refresh tokens allow seamless session renewal

### Best Practices

1. **Never expose service_role key** in frontend code
2. **Use HTTPS** in production
3. **Implement rate limiting** for auth endpoints
4. **Validate all input** before database operations
5. **Keep JWT tokens secure** (httpOnly cookies recommended)

## License

Quran text is public domain. Translation copyrights belong to respective translators.

## Author

Bilawal Riaz - [bilawal.net](https://bilawal.net)
