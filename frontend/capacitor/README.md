# Capacitor Integration for Quran Reader

Wrap the existing Vite + React Quran Reader web app with Capacitor to enable native Android deployment. This will allow testing on Android devices and enable future native features like prayer alarms, notifications, and offline capabilities.

## Setup Commands

```bash
# Install Capacitor packages
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli

# Initialize Capacitor (already done via capacitor.config.ts)
# Build web assets
npm run build

# Add Android platform
npx cap add android

# Sync web assets to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

## Configuration

- **App ID**: `uk.hyperflash.quran`
- **App Name**: `Quran Reader`
- **Web Directory**: `dist` (Vite build output)
- **Server URL**: `https://quran.hyperflash.uk`

## Development Workflow

After making frontend changes:
```bash
npm run build && npx cap sync
```

## Future Plugins

- `@capacitor/push-notifications` - Prayer time alerts
- `@capacitor/local-notifications` - Alarms
- `@capacitor/preferences` - Offline data storage
- `@capacitor/splash-screen` - Custom app loading
