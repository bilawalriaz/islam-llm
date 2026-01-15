# Quran Reader - Frontend

React 19 + Vite frontend for the Quran Reader application with complete Quran text, translations, and audio recitation.

## Features

- **React 19** - Latest React with hooks and concurrent features
- **Vite 7** - Lightning-fast build tool and dev server
- **React Router v7** - Client-side routing with protected routes
- **Quran Pages** - Surah listing and surah detail with audio player
- **Audio Playback** - Stream MP3 audio with auto-play and smooth scroll
- **Multiple Reciters** - 30+ reciters with beautiful names
- **Multiple Translations** - Switch between different editions
- **Design System** - Complete CSS with Arabic typography (Amiri font)
- **Mobile Responsive** - Touch-friendly interface
- **Authentication** - Login/register flows (demo endpoints)

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.js          # API client with Quran endpoints
│   ├── components/
│   │   ├── Button.jsx         # Button component
│   │   ├── Card.jsx           # Card and StatCard components
│   │   ├── Layout.jsx         # Main app layout with header/nav
│   │   ├── Modal.jsx          # Modal dialog component
│   │   ├── Pagination.jsx     # Pagination component
│   │   ├── Spinner.jsx        # Spinner, LoadingState, EmptyState
│   │   └── Table.jsx          # Table and StatusBadge components
│   ├── contexts/
│   │   └── AuthContext.jsx    # Authentication context
│   ├── pages/
│   │   ├── Home.jsx           # Dashboard/home page
│   │   ├── Login.jsx          # Login page
│   │   ├── QuranHome.jsx      # Quran surah listing
│   │   ├── SurahDetail.jsx    # Surah detail with ayahs and audio
│   │   ├── ProtectedExample.jsx # Example protected page
│   │   └── Register.jsx       # Registration page
│   ├── App.jsx                # Route definitions
│   ├── main.jsx               # App entry point
│   └── index.css              # Design system CSS with Quran styles
├── index.html                 # HTML with Arabic fonts
├── vite.config.js             # Vite configuration (API + audio proxy)
└── package.json
```

## API Endpoints

The frontend communicates with the backend via these endpoints:

```javascript
// Quran data
GET /api/quran/surahs                    // Get all 114 surahs
GET /api/quran/surahs/{id}               // Get surah metadata
GET /api/quran/surahs/{id}/ayahs         // Get ayahs for a surah
GET /api/quran/editions                   // Get text editions
GET /api/quran/audio/editions             // Get audio reciters

// Audio files (static)
GET /audio/{reciter}/{ayah_number}.mp3   // Stream audio directly
```

## Pages

### `/quran` - Surah Listing
- Displays all 114 surahs in a responsive grid
- Search by name, English name, or number
- Filter by revelation type (Meccan/Medinan)
- Shows surah info: Arabic name, English name, verse count

### `/quran/:id` - Surah Detail
- Displays all ayahs for a surah
- Audio playback with play/pause per ayah
- Auto-play mode for continuous playback
- Smooth scroll to center playing ayah
- Switch between reciters
- Switch between Arabic text styles
- Switch between translations
- Ayah metadata (juz, page, sajdah info)

## Components

### Quran-Specific Components

**SurahCard** - Displays surah information in grid layout
```jsx
// Not exported as separate component, but rendered in QuranHome.jsx
```

**AyahCard** - Displays individual ayah with audio controls
```jsx
// Rendered in SurahDetail.jsx with:
- Arabic text with Amiri font
- Translation text (if selected)
- Play/pause button
- Metadata (juz, page, sajda)
- Highlighted when playing
```

### Design System

**Typography:**
- Arabic: Amiri font (with Scheherazade New fallback)
- UI: Inter font
- Code: JetBrains Mono

**CSS Variables:**
```css
--font-arabic: 'Amiri', 'Scheherazade New', serif;
--accent-color: #f97316;  /* Orange accent */
--color-bg: #fafaf9;
--text-primary: #0f172a;
```

## Customization

### Change Accent Color

Edit `src/index.css`:
```css
:root {
    --accent-color: #your-color;
    --accent-hover: #your-hover-color;
}
```

### Add New Reciter Names

Edit `src/pages/SurahDetail.jsx`:
```javascript
const RECITER_NAMES = {
    'your.reciter.id': 'Language - Reciter Name',
    // ... add more
};
```

### Modify Audio Behavior

In `SurahDetail.jsx`:
- `playAyah()` - Handles playing individual ayahs
- `useEffect` for `playingAyah` - Handles smooth scroll
- `audioRef` - Controls the HTML5 audio element

## Development

### API Proxy Configuration

The Vite dev server proxies requests to the backend:

```javascript
// vite.config.js
server: {
    host: '0.0.0.0',  // Listen on all interfaces for Tailscale
    port: 5173,
    proxy: {
        '/api': {
            target: 'http://localhost:8001',
            changeOrigin: true,
        },
        '/audio': {
            target: 'http://localhost:8001',
            changeOrigin: true,
        },
    },
}
```

### Authentication

The app uses token-based authentication stored in localStorage:
- Session token stored as `session_token`
- Auto-includes `Authorization: Bearer <token>` header
- Redirects to login on 401 responses
- Demo endpoints accept any credentials

## Build & Deployment

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

The `dist/` directory contains static files ready for deployment.

## License

MIT

## Author

Created by [Bilawal Riaz](https://bilawal.net)
