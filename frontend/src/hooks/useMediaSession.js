import { useEffect } from 'react';

/**
 * useMediaSession - Integrates with Media Session API for lock screen controls
 * Provides background playback support on mobile devices
 *
 * @param {Object} options
 * @param {React.RefObject} options.audioRef - Reference to the audio element
 * @param {Object} options.currentAyah - Current ayah object being played
 * @param {string} options.surahName - Name of the current surah
 * @param {string} options.reciterName - Name of the reciter
 * @param {boolean} options.isPlaying - Whether audio is currently playing
 * @param {Function} options.onPlay - Handler for play action
 * @param {Function} options.onPause - Handler for pause action
 * @param {Function} options.onNext - Handler for next track action
 * @param {Function} options.onPrevious - Handler for previous track action
 */
export function useMediaSession({
    audioRef,
    currentAyah,
    surahName,
    reciterName,
    isPlaying,
    onPlay,
    onPause,
    onNext,
    onPrevious
}) {
    // Set up media session action handlers
    useEffect(() => {
        if (!('mediaSession' in navigator)) {
            return;
        }

        navigator.mediaSession.setActionHandler('play', onPlay);
        navigator.mediaSession.setActionHandler('pause', onPause);
        navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
        navigator.mediaSession.setActionHandler('nexttrack', onNext);

        return () => {
            // Clean up handlers
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('previoustrack', null);
            navigator.mediaSession.setActionHandler('nexttrack', null);
        };
    }, [onPlay, onPause, onNext, onPrevious]);

    // Update media metadata when ayah changes
    useEffect(() => {
        if (!('mediaSession' in navigator) || !currentAyah) {
            return;
        }

        const metadata = {
            title: `Surah ${surahName}, Ayah ${currentAyah.number_in_surah}`,
            artist: reciterName || 'Quran Reader',
            album: 'Holy Quran',
            artwork: [
                {
                    src: '/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png'
                },
                {
                    src: '/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png'
                }
            ]
        };

        navigator.mediaSession.metadata = new MediaMetadata(metadata);
    }, [currentAyah, surahName, reciterName]);

    // Update playback state
    useEffect(() => {
        if (!('mediaSession' in navigator)) {
            return;
        }

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }, [isPlaying]);
}
