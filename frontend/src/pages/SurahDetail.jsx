import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    getSurah, getAyahs, getAudioEditions, getEditions,
    checkBookmark, toggleBookmark, updateProgress, getBookmarksForSurah,
    getCompletedAyahsForSurah, getSurahCompletionStats, markAyahCompleted,
    startPlaySession, endPlaySession, startQuranPlay, getNextQuranAyah, endQuranPlay,
    validateSequentialProgress, clearSurahProgress, markAyahsBatchCompleted
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, EmptyState } from '../components/Spinner';
import Button from '../components/Button';
import ShareButton from '../components/ShareButton';
import Modal from '../components/Modal';
import { useMediaSession } from '../hooks/useMediaSession';
import TextHighlighter from '../components/TextHighlighter';

/**
 * Reciter name mapping - converts identifiers to human-readable names
 */
const RECITER_NAMES = {
    'ar.alafasy': 'Arabic - Mishary Alafasy',
    'ar.abdulbasitmurattal': 'Arabic - Abdul Basit (Murattal)',
    'ar.abdulbasitmurattal2': 'Arabic - Abdul Basit (Murattal 2)',
    'ar.abdullahbasfar': 'Arabic - Abdullah Basfar',
    'ar.abdulsamad': 'Arabic - Abdul Samad',
    'ar.abdurrahmaansudais': 'Arabic - Abdurrahmaan As-Sudais',
    'ar.ahmedajamy': 'Arabic - Ahmed Ibn Ali Al-Ajamy',
    'ar.aymanswoaid': 'Arabic - Ayman Swayid',
    'ar.hanirifai': 'Arabic - Hani Rifai',
    'ar.hudhaify': 'Arabic - Ali Al-Hudhaify',
    'ar.husary': 'Arabic - Mahmoud Khalil Al-Husary',
    'ar.husarymujawwad': 'Arabic - Husary (Mujawwad)',
    'ar.ibrahimakhbar': 'Arabic - Ibrahim Akhdar',
    'ar.mahermuaiqly': 'Arabic - Maher Al-Muaiqly',
    'ar.minshawi': 'Arabic - Mohamed Siddiq El-Minshawi',
    'ar.minshawimujawwad': 'Arabic - Minshawi (Mujawwad)',
    'ar.muhammadayyoub': 'Arabic - Muhammad Ayyoub',
    'ar.muhammadjibreel': 'Arabic - Muhammad Jibreel',
    'ar.parhizgar': 'Arabic - Parhizgar',
    'ar.qatami': 'Arabic - Qatami',
    'ar.salahbukhatir': 'Arabic - Salah Bukhatir',
    'ar.saudshuraym': 'Arabic - Saud Shuraym',
    'ar.shatri': 'Arabic - Abu Bakr Ash-Shatri',
    'ar.walk': 'Arabic - Ibrahim Walk (English)',
    'en.walk': 'English - Ibrahim Walk',
    'fr.bouhadana': 'French - Bouhadana',
    'de.khoury': 'German - Koury',
    'es.cortes': 'Spanish - Cortes',
    'ru.kuliev': 'Russian - Kuliev',
    'tr.diyanet': 'Turkish - Diyanet',
    'zh.jian': 'Chinese - Jian',
    'fa.fooladvand': 'Persian - Fooladvand',
    'ha.gummi': 'Hausa - Gummi',
    'th.thai': 'Thai - Thai',
    'ur.jalandhry': 'Urdu - Jalandhry',
    'vi.bulan': 'Vietnamese - Bulan',
};

/**
 * Get display name for reciter
 */
function getReciterName(identifier) {
    return RECITER_NAMES[identifier] || identifier;
}

/**
 * SurahDetail - View a specific surah with its ayahs and audio
 *
 * Features:
 * - Display surah information and all ayahs
 * - Listen to audio recitation with auto-play next ayah
 * - Switch between different text editions
 * - Switch between different audio reciters
 * - Bookmark ayahs (requires login)
 * - Auto-save reading progress (requires login)
 * - Completion tracking with visual indicators (requires login)
 */
function SurahDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    const [surah, setSurah] = useState(null);
    const [ayahs, setAyahs] = useState([]);
    const [translationAyahs, setTranslationAyahs] = useState([]);
    const [audioEditions, setAudioEditions] = useState([]);
    const [textEditions, setTextEditions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingTranslation, setLoadingTranslation] = useState(false);
    const [playingAyah, setPlayingAyah] = useState(null);
    const [autoPlay, setAutoPlay] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showSurahCompletion, setShowSurahCompletion] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [showClearProgressConfirm, setShowClearProgressConfirm] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [pendingAyahInfo, setPendingAyahInfo] = useState(null);
    const [showBookmarkSuccess, setShowBookmarkSuccess] = useState(false);
    const [highlightedAyah, setHighlightedAyah] = useState(null);
    const [searchParams] = useSearchParams();
    const highlightQuery = searchParams.get('highlight');

    // Track the last played/selected/navigated ayah for the UI indicator
    const [lastPlayedIndex, setLastPlayedIndex] = useState(0);

    // Bookmark state - map of ayah_id -> bookmark_id (or null if not bookmarked)
    const [bookmarks, setBookmarks] = useState({});
    const [bookmarkLoading, setBookmarkLoading] = useState({});

    // Completion tracking state
    const [completedAyahs, setCompletedAyahs] = useState([]);
    const [completionStats, setCompletionStats] = useState(null);

    // Play session tracking for analytics
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessionStartTime, setSessionStartTime] = useState(null);

    // Full Quran play mode
    const [quranPlayMode, setQuranPlayMode] = useState(false);
    const [quranSessionId, setQuranSessionId] = useState(null);

    // Editions
    const [selectedAudioEdition, setSelectedAudioEdition] = useState('ar.alafasy');
    const [selectedTextEdition, setSelectedTextEdition] = useState('quran-uthmani');
    const [selectedTranslation, setSelectedTranslation] = useState('en.sahih');

    const audioRef = useRef(null);
    const ayahRefs = useRef({});
    const progressSaveTimeoutRef = useRef(null);
    const progressCardRef = useRef(null);
    const preloadedAudioRefs = useRef({});
    const lastPlayingAyahRef = useRef(null);
    const hasScrolledToHashRef = useRef(false);
    const initialSurahIdRef = useRef(id);

    // Floating progress indicator visibility state
    const [showFloatingProgress, setShowFloatingProgress] = useState(false);
    const [volume, setVolume] = useState(1);

    // Scroll Progress & Reading Tracking
    const [scrollProgress, setScrollProgress] = useState(0);
    const [readingAyah, setReadingAyah] = useState(null);
    const [trackReadingProgress, setTrackReadingProgress] = useState(() => {
        return localStorage.getItem('trackReadingProgress') === 'true';
    });
    const readingProgressSaveTimeoutRef = useRef(null);

    // Simplified reciter options
    const simplifiedReciters = [
        { identifier: 'ar.alafasy', name: 'Arabic' },
        { identifier: 'en.walk', name: 'English' },
    ];

    useEffect(() => {
        // Reset state when surah changes to avoid stale data from previous surah
        setPlayingAyah(null);
        setLastPlayedIndex(0);
        setReadingAyah(null);
        setCompletedAyahs([]);
        setCompletionStats(null);
        setScrollProgress(0);
        setShowSurahCompletion(false);
        setLoading(true);
        setAyahs([]);
        setTranslationAyahs([]);

        // Reset refs
        lastPlayingAyahRef.current = null;
        hasScrolledToHashRef.current = false;
        initialSurahIdRef.current = id;

        loadSurahData();
        loadEditions();

        // Only scroll to top if there's no hash (deep link to specific ayah)
        if (!location.hash) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        // Check if we're continuing Quran play mode from previous surah
        const quranMode = sessionStorage.getItem('quranPlayMode');
        const sessionId = sessionStorage.getItem('quranSessionId');
        const autoPlayState = sessionStorage.getItem('autoPlay');

        if (quranMode === 'true' && sessionId && autoPlayState === 'true') {
            // Restore Quran play mode state
            setQuranPlayMode(true);
            setQuranSessionId(parseInt(sessionId));
            setAutoPlay(true);

            // Clear sessionStorage
            sessionStorage.removeItem('quranPlayMode');
            sessionStorage.removeItem('quranSessionId');
            sessionStorage.removeItem('autoPlay');

            // Start playing first ayah of this surah after a short delay
            setTimeout(() => {
                // Fetch current ayahs to ensure we have them
                setAyahs(currentAyahs => {
                    if (currentAyahs.length > 0) {
                        playAyah(0);
                    }
                    return currentAyahs;
                });
            }, 500);
        }
    }, [id]);

    // Handle pending bookmark after login
    useEffect(() => {
        if (isAuthenticated && ayahs.length > 0) {
            const pending = sessionStorage.getItem('pendingBookmark');
            if (pending) {
                try {
                    const { surahId, ayahId } = JSON.parse(pending);
                    // Check if we are on the right surah
                    if (surahId === id) {
                        const targetAyah = ayahs.find(a => a.id === ayahId);
                        if (targetAyah && !bookmarks[targetAyah.id]) {
                            handleBookmarkToggle(targetAyah);
                            setShowBookmarkSuccess(true);
                            setTimeout(() => setShowBookmarkSuccess(false), 4000);
                        }
                    }
                } catch (e) {
                    console.error('Failed to process pending bookmark', e);
                } finally {
                    sessionStorage.removeItem('pendingBookmark');
                }
            }
        }
    }, [isAuthenticated, ayahs.length, id, bookmarks]);

    // Handle scrolling to a specific ayah based on URL hash (e.g., #ayah-7)
    useEffect(() => {
        if (loading || ayahs.length === 0 || hasScrolledToHashRef.current) return;

        const hash = location.hash;
        if (!hash) return;

        // Parse hash like #ayah-7 to get ayah number
        const match = hash.match(/^#ayah-(\d+)$/);
        if (!match) return;

        const ayahNumber = parseInt(match[1], 10);
        // Find the index of the ayah with this number_in_surah
        const targetIndex = ayahs.findIndex(a => a.number_in_surah === ayahNumber);

        if (targetIndex >= 0 && ayahRefs.current[targetIndex]) {
            // Mark as scrolled to prevent repeat scrolls
            hasScrolledToHashRef.current = true;

            // Highlight the ayah
            setHighlightedAyah(targetIndex);

            // Set as last played (selected) so player is ready
            setLastPlayedIndex(targetIndex);
            lastPlayingAyahRef.current = targetIndex;

            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                ayahRefs.current[targetIndex]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            });

            // Clear highlight after 3 seconds
            setTimeout(() => {
                setHighlightedAyah(null);
            }, 3000);
        }
    }, [loading, ayahs, location.hash]);

    useEffect(() => {
        if (selectedTranslation !== 'none') {
            loadTranslation();
        } else {
            setTranslationAyahs([]);
        }
    }, [selectedTranslation, ayahs]);

    // Load bookmark and completion status for each ayah when authenticated
    useEffect(() => {
        if (isAuthenticated && ayahs.length > 0) {
            loadBookmarkStatuses();
            loadCompletionStatus();
        }
    }, [ayahs.length, isAuthenticated, id]);

    // Detect when progress card scrolls out of view to show floating indicator
    // Also calculate overall scroll percentage for the visual indicator
    useEffect(() => {
        const handleScroll = () => {
            // Floating Indicator Logic
            if (progressCardRef.current && ayahs.length > 0) {
                const rect = progressCardRef.current.getBoundingClientRect();
                const isMostlyOutOfView = rect.top < 100;
                setShowFloatingProgress(isMostlyOutOfView);
            } else {
                setShowFloatingProgress(false);
            }

            // Scroll Progress Bar Logic
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            setScrollProgress(Math.min(100, Math.max(0, scrollPercent)));
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check

        return () => window.removeEventListener('scroll', handleScroll);
    }, [ayahs]);

    // IntersectionObserver to track currently reading ayah
    useEffect(() => {
        if (!trackReadingProgress || playingAyah !== null || ayahs.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the first visible ayah that is near the top of the viewport
                const visibleEntries = entries.filter(entry => entry.isIntersecting);

                if (visibleEntries.length > 0) {
                    // Sort by proximity to top of viewport
                    visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                    // Pick the top-most visible ayah (or the one taking up most space?)
                    // Let's pick the first one that has its top relatively visible
                    const targetEntry = visibleEntries[0];

                    // Extract index from ref check or data attribute if we added one (we rely on ref array index mapping effectively)
                    // Since specific refs are hard to reverse-lookup from element without IDs or data attrs, 
                    // let's assume we can rely on data-index attribute we will add to the card.
                    const index = parseInt(targetEntry.target.getAttribute('data-index'));

                    if (!isNaN(index) && index >= 0) {
                        setReadingAyah(index);

                        // Debounced save progress
                        if (isAuthenticated && ayahs[index]) {
                            if (readingProgressSaveTimeoutRef.current) {
                                clearTimeout(readingProgressSaveTimeoutRef.current);
                            }

                            readingProgressSaveTimeoutRef.current = setTimeout(() => {
                                // Only save if still strictly tracking and not playing
                                if (audioRef.current && !audioRef.current.paused) return;

                                // Backfill Logic: Find unread ayahs up to this point
                                const batchItems = [];
                                const newCompletedNumbers = [];

                                // Check ayahs up to current index
                                for (let i = 0; i <= index; i++) {
                                    const a = ayahs[i];
                                    if (!completedAyahs.includes(a.number_in_surah)) {
                                        batchItems.push({
                                            ayah_id: a.id,
                                            surah_id: parseInt(id),
                                            ayah_number: a.number_in_surah
                                        });
                                        newCompletedNumbers.push(a.number_in_surah);
                                    }
                                }

                                if (batchItems.length > 0) {
                                    // Optimistic update
                                    setCompletedAyahs(prev => {
                                        const unique = new Set([...prev, ...newCompletedNumbers]);
                                        return Array.from(unique);
                                    });

                                    // Call batch API
                                    markAyahsBatchCompleted(batchItems).then(() => {
                                        validateSequentialProgress();
                                    });
                                }

                                // Always update last read position
                                saveProgress(parseInt(id), ayahs[index].id, ayahs[index].number_in_surah);
                            }, 2000); // 2 second dwell time
                        }
                    }
                }
            },
            {
                root: null,
                rootMargin: '-10% 0px -60% 0px', // Active area is top part of screen
                threshold: 0.1
            }
        );

        // Observe all ayah cards
        ayahs.forEach((_, index) => {
            if (ayahRefs.current[index]) {
                observer.observe(ayahRefs.current[index]);
            }
        });

        return () => {
            if (readingProgressSaveTimeoutRef.current) {
                clearTimeout(readingProgressSaveTimeoutRef.current);
            }
            observer.disconnect();
        };
    }, [ayahs, trackReadingProgress, playingAyah, isAuthenticated, id]);

    // Clean up preloaded audio when reciter changes
    useEffect(() => {
        // Clean up previous preloaded audio
        return () => {
            Object.values(preloadedAudioRefs.current).forEach(audio => {
                if (audio) {
                    audio.src = '';
                    audio.load();
                }
            });
            preloadedAudioRefs.current = {};
        };
    }, [selectedAudioEdition]);

    // Set volume on audio element when volume changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // Update playback speed
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed, playingAyah]);

    // Smooth scroll to playing ayah
    useEffect(() => {
        if (playingAyah !== null && ayahRefs.current[playingAyah]) {
            requestAnimationFrame(() => {
                ayahRefs.current[playingAyah]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            });
        }
    }, [playingAyah]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = async () => {
            const endedAyahIndex = playingAyah;
            const endedSessionId = currentSessionId;
            const endedSessionStartTime = sessionStartTime;

            // 1. Fire-and-forget logging & progress updates (non-blocking)
            (async () => {
                // End play session for analytics
                if (endedSessionId && endedSessionStartTime) {
                    const duration = Math.round((Date.now() - endedSessionStartTime) / 1000);
                    try {
                        await endPlaySession(endedSessionId, duration);
                    } catch (err) {
                        console.error('Failed to end play session:', err);
                    }
                }

                // Mark ayah as completed
                if (endedAyahIndex !== null) {
                    const currentAyah = ayahs[endedAyahIndex];
                    if (currentAyah) {
                        try {
                            await markAyahAsCompleted(currentAyah);
                        } catch (err) {
                            console.error('Failed to mark ayah completed:', err);
                        }
                    }
                }
            })();

            // 2. Reset session state immediately
            setCurrentSessionId(null);
            setSessionStartTime(null);

            if (endedAyahIndex !== null) {
                // Check if Quran play mode is enabled
                if (quranPlayMode && autoPlay) {
                    // Start next track immediately if available in current surah
                    // This reduces delay significantly
                    if (endedAyahIndex < ayahs.length - 1) {
                        playAyah(endedAyahIndex + 1);

                        // We still call this in background to update server state if needed, 
                        // but we don't wait for it to play next
                        // (Assuming getNextQuranAyah doesn't have side effects critical for *playback* of next)
                        // Actually, let's keep the logic safe: if we are changing Surahs, we wait.
                        // If same surah, we played already.
                        return;
                    }

                    // If we are at the end of Surah, we MUST query server for next one
                    const currentAyah = ayahs[endedAyahIndex];
                    const nextData = await getNextQuranAyah(parseInt(id), currentAyah.number_in_surah);

                    if (!nextData.is_last) {
                        // Check if we need to navigate to different surah
                        if (nextData.surah_id !== parseInt(id)) {
                            navigate(`/quran/${nextData.surah_id}`);
                            // Note: The new SurahDetail component will need to start playing
                            // We use sessionStorage to pass the play state
                            sessionStorage.setItem('quranPlayMode', 'true');
                            sessionStorage.setItem('quranSessionId', quranSessionId);
                            sessionStorage.setItem('autoPlay', 'true');
                        } else {
                            // Play next ayah in same surah (fallback if index check failed)
                            const nextIndex = ayahs.findIndex(a => a.id === nextData.ayah_id);
                            if (nextIndex >= 0) {
                                playAyah(nextIndex);
                            }
                        }
                    } else {
                        // Quran complete!
                        setQuranPlayMode(false);
                        setAutoPlay(false);
                        if (quranSessionId) {
                            try {
                                await endQuranPlay(quranSessionId);
                            } catch (err) {
                                console.error('Failed to end Quran play session:', err);
                            }
                            setQuranSessionId(null);
                        }
                    }
                    return;
                }

                // Normal Mode: Continue to next ayah if autoPlay is enabled
                const nextAyah = endedAyahIndex + 1;
                if (nextAyah < ayahs.length) {
                    if (autoPlay) {
                        playAyah(nextAyah);
                    } else {
                        // Keep current ayah as the last played, but stop active playback
                        setPlayingAyah(null);
                    }
                } else {
                    // End of surah reached - show completion modal
                    setPlayingAyah(null);
                    setAutoPlay(false);
                    setShowSurahCompletion(true);
                }
            } else {
                setPlayingAyah(null);
                setAutoPlay(false);
            }
        };

        const handleError = () => {
            console.error('Audio playback error');
            setPlayingAyah(null);
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, [autoPlay, playingAyah, ayahs, quranPlayMode, quranSessionId, currentSessionId, sessionStartTime, id, isAuthenticated, navigate]);

    // Save progress when playing ayah changes (with debounce)
    useEffect(() => {
        if (playingAyah !== null && isAuthenticated && ayahs[playingAyah]) {
            const ayah = ayahs[playingAyah];

            // Clear any pending save
            if (progressSaveTimeoutRef.current) {
                clearTimeout(progressSaveTimeoutRef.current);
            }

            // Save progress after 2 seconds of playing
            progressSaveTimeoutRef.current = setTimeout(() => {
                saveProgress(parseInt(id), ayah.id, ayah.number_in_surah);
            }, 2000);
        }

        return () => {
            if (progressSaveTimeoutRef.current) {
                clearTimeout(progressSaveTimeoutRef.current);
            }
        };
    }, [playingAyah, ayahs, isAuthenticated, id]);

    const loadSurahData = async () => {
        try {
            const [surahData, ayahsData] = await Promise.all([
                getSurah(id, selectedTextEdition),
                getAyahs(id, selectedTextEdition)
            ]);
            setSurah(surahData);
            setAyahs(ayahsData);
        } catch (err) {
            console.error('Failed to load surah:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadTranslation = async () => {
        if (selectedTranslation === 'none') {
            setTranslationAyahs([]);
            return;
        }
        setLoadingTranslation(true);
        try {
            const data = await getAyahs(id, selectedTranslation);
            setTranslationAyahs(data);
        } catch (err) {
            console.error('Failed to load translation:', err);
        } finally {
            setLoadingTranslation(false);
        }
    };

    const loadEditions = async () => {
        try {
            const [audioData, textData] = await Promise.all([
                getAudioEditions(),
                getEditions()
            ]);
            setAudioEditions(audioData);
            setTextEditions(textData);
        } catch (err) {
            console.error('Failed to load editions:', err);
        }
    };

    const loadBookmarkStatuses = async () => {
        // Batch load all bookmarks for this surah in one API call
        try {
            const bookmarkMap = await getBookmarksForSurah(id);
            setBookmarks(bookmarkMap);
        } catch (err) {
            console.error('Failed to load bookmark statuses:', err);
            setBookmarks({});
        }
    };

    const loadCompletionStatus = async () => {
        try {
            const [completedData, statsData] = await Promise.all([
                getCompletedAyahsForSurah(id),
                getSurahCompletionStats(id)
            ]);
            setCompletedAyahs(completedData.map(c => c.ayah_number));
            setCompletionStats(statsData);
        } catch (err) {
            console.error('Failed to load completion status:', err);
        }
    };

    const handleBookmarkToggle = async (ayah) => {
        if (!isAuthenticated) {
            // Save intended action for after login
            const pendingBookmark = {
                surahId: id,
                ayahId: ayah.id,
                ayahNumber: ayah.number_in_surah,
                timestamp: Date.now()
            };
            sessionStorage.setItem('pendingBookmark', JSON.stringify(pendingBookmark));
            setPendingAyahInfo(pendingBookmark);
            setShowLoginPrompt(true);
            return;
        }

        setBookmarkLoading(prev => ({ ...prev, [ayah.id]: true }));

        try {
            await toggleBookmark(
                ayah.id,
                parseInt(id),
                ayah.number_in_surah,
                bookmarks[ayah.id]
            );

            // Update local state
            if (bookmarks[ayah.id]) {
                // Was bookmarked, now unbookmarked
                setBookmarks(prev => ({ ...prev, [ayah.id]: null }));
            } else {
                // Was not bookmarked, now bookmarked
                setBookmarks(prev => ({ ...prev, [ayah.id]: ayah.id }));
            }
        } catch (err) {
            console.error('Failed to toggle bookmark:', err);
        } finally {
            setBookmarkLoading(prev => ({ ...prev, [ayah.id]: false }));
        }
    };

    const saveProgress = async (surahId, ayahId, ayahNumber) => {
        try {
            await updateProgress(surahId, ayahId, ayahNumber);
        } catch (err) {
            console.error('Failed to save progress:', err);
        }
    };

    const markAyahAsCompleted = async (ayah) => {
        if (!isAuthenticated) return;

        // optimistic update
        if (!completedAyahs.includes(ayah.number_in_surah)) {
            setCompletedAyahs(prev => [...prev, ayah.number_in_surah]);

            if (completionStats) {
                // Simple optimistic stat update - doesn't handle "first unread" perfect recalculation
                // but good enough for immediate feedback. detailed recalc happens on success or re-fetch.
                setCompletionStats(prev => ({
                    ...prev,
                    completed_count: prev.completed_count + 1,
                    completion_percentage: Math.round(((prev.completed_count + 1) / prev.total_ayahs) * 1000) / 10
                }));
            }
        }

        try {
            await markAyahCompleted(ayah.id, parseInt(id), ayah.number_in_surah);
            // Validate and update sequential progress flags
            await validateSequentialProgress();

            // We can re-fetch or rely on the optimistic update. 
            // For "first unread" correctness, we might want to do the complex logic here
            // or just let the background re-fetch happen if we trigger one.
            // For now, let's just ensure the strict logic runs too to correct any specific edge cases

            // Logic to find new first unread (copied from original to ensure correctness eventually)
            if (!completedAyahs.includes(ayah.number_in_surah)) { // check again in case race condition
                // ... (state update logic is already done optimistically, maybe we skip or just re-verify)
            }
            // Recalculate strict "first unread" just in case
            if (completionStats) {
                let firstUnread = completionStats.first_unread_ayah;
                if (firstUnread === ayah.number_in_surah) {
                    const newCompletedList = [...completedAyahs, ayah.number_in_surah];
                    const completedSet = new Set(newCompletedList);
                    let found = false;
                    for (let i = 0; i < completionStats.total_ayahs; i++) {
                        const ayahNum = i + 1;
                        if (!completedSet.has(ayahNum)) {
                            firstUnread = ayahNum;
                            found = true;
                            break;
                        }
                    }
                    if (!found) firstUnread = null;

                    setCompletionStats(prev => ({ ...prev, first_unread_ayah: firstUnread }));
                }
            }

        } catch (err) {
            console.error('Failed to mark ayah as completed:', err);
            // Revert optimistic update on error
            setCompletedAyahs(prev => prev.filter(n => n !== ayah.number_in_surah));
        }
    };

    const handleClearProgress = async () => {
        if (!isAuthenticated) return;
        try {
            await clearSurahProgress(id);
            // Reset local state
            setCompletedAyahs([]);
            setCompletionStats(prev => ({
                ...prev,
                completed_count: 0,
                completion_percentage: 0,
                first_unread_ayah: 1
            }));
            setShowClearProgressConfirm(false);
        } catch (err) {
            console.error('Failed to clear progress:', err);
        }
    };

    // Helper: Find first gap in completed ayahs (for catch up/backfill)
    // Returns the first missing ayah number, or null if all completed or none completed
    const findFirstGap = () => {
        if (completedAyahs.length === 0) return null;
        const sortedCompleted = [...completedAyahs].sort((a, b) => a - b);
        // Start from ayah 1, find first missing number
        for (let i = 1; i <= sortedCompleted[sortedCompleted.length - 1]; i++) {
            if (!sortedCompleted.includes(i)) {
                return i;
            }
        }
        // All ayahs from 1 to highest completed are complete
        return null;
    };

    // Helper: Find highest completed ayah + 1 (for resume from latest)
    // Returns the next ayah after the highest completed, or 1 if none completed
    const findLatestNext = () => {
        if (completedAyahs.length === 0) return 1;
        const maxCompleted = Math.max(...completedAyahs);
        return maxCompleted + 1;
    };

    const playAyah = (index, edition = null) => {
        const ayah = ayahs[index];
        if (!ayah) return;

        // Use provided edition or fall back to current state
        const audioEdition = edition || selectedAudioEdition;
        const audioUrl = `/audio/${audioEdition}/${ayah.number}.mp3`;

        if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play()
                .then(async () => {
                    lastPlayingAyahRef.current = index;
                    setPlayingAyah(index);
                    setLastPlayedIndex(index);

                    // Track play session for analytics
                    if (isAuthenticated) {
                        try {
                            const session = await startPlaySession(ayah.id, parseInt(id), ayah.number_in_surah, audioEdition);
                            setCurrentSessionId(session.session_id);
                            setSessionStartTime(Date.now());
                        } catch (err) {
                            console.error('Failed to track play session:', err);
                        }
                    }

                    // Preload next 2 ayahs after starting playback
                    // Defer preloading to avoid jank during transition (500ms delay)
                    setTimeout(() => {
                        preloadNextAyahs(index, audioEdition);
                    }, 500);
                })
                .catch(err => console.error('Playback failed:', err));
        }
    };

    const preloadNextAyahs = (currentIndex, edition = null) => {
        // Use provided edition or fall back to current state
        const audioEdition = edition || selectedAudioEdition;

        // Clear previous preloaded audio
        Object.values(preloadedAudioRefs.current).forEach(audio => {
            if (audio) {
                audio.src = '';
                audio.load();
            }
        });
        preloadedAudioRefs.current = {};

        // Preload next 2 ayahs
        for (let i = 1; i <= 2; i++) {
            const nextIndex = currentIndex + i;
            if (nextIndex < ayahs.length) {
                const nextAyah = ayahs[nextIndex];
                const audioUrl = `/audio/${audioEdition}/${nextAyah.number}.mp3`;

                // Create new audio element for preloading
                const preloadedAudio = new Audio();
                preloadedAudio.preload = 'auto';
                preloadedAudio.src = audioUrl;
                preloadedAudioRefs.current[nextIndex] = preloadedAudio;

                // Trigger load to cache the audio
                // Note: Audio.load() doesn't return a Promise, wrap in try-catch
                try {
                    preloadedAudio.load();
                } catch {
                    // Silently fail if preloading fails - playback will still work
                }
            }
        }
    };

    const pauseAyah = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            lastPlayingAyahRef.current = playingAyah;
            setPlayingAyah(null);
        }
    };

    // Media Session API integration for lock screen controls
    useMediaSession({
        audioRef,
        currentAyah: playingAyah !== null ? ayahs[playingAyah] : null,
        surahName: surah?.english_name || '',
        reciterName: getReciterName(selectedAudioEdition),
        isPlaying: playingAyah !== null,
        onPlay: () => {
            if (playingAyah === null && lastPlayingAyahRef.current !== null) {
                playAyah(lastPlayingAyahRef.current);
            } else if (playingAyah !== null && audioRef.current) {
                audioRef.current.play();
            }
        },
        onPause: () => pauseAyah(),
        onNext: () => {
            if (playingAyah !== null && playingAyah < ayahs.length - 1) {
                playAyah(playingAyah + 1);
            }
        },
        onPrevious: () => {
            if (playingAyah !== null && playingAyah > 0) {
                playAyah(playingAyah - 1);
            }
        }
    });

    const togglePlay = (index) => {
        if (playingAyah === index) {
            pauseAyah();
        } else {
            playAyah(index);
        }
    };

    const playAll = () => {
        setAutoPlay(true);
        playAyah(0);
    };

    const stopPlayback = () => {
        setAutoPlay(false);
        pauseAyah();
    };

    const getTranslationForAyah = (ayahNumber) => {
        return translationAyahs.find(a => a.number_in_surah === ayahNumber);
    };

    const handleTextEditionChange = async (edition) => {
        setSelectedTextEdition(edition);
        setLoading(true);
        try {
            const [surahData, ayahsData] = await Promise.all([
                getSurah(id, edition),
                getAyahs(id, edition)
            ]);
            setSurah(surahData);
            setAyahs(ayahsData);
        } catch (err) {
            console.error('Failed to load edition:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingState message={`Loading Surah ${id}...`} />;
    }

    if (!surah) {
        return <EmptyState message="Surah not found" />;
    }

    return (
        <>
            {/* Hidden Audio Player */}
            <audio ref={audioRef} preload="none" />

            {/* Scroll Progress Bar */}
            <div
                className="reading-progress-bar"
                style={{
                    transform: `scaleX(${scrollProgress / 100})`,
                    opacity: scrollProgress > 0 ? 1 : 0
                }}
            />

            {/* Header with Surah Info */}
            <div className="page-header">
                {/* Top: Large Arabic Title */}
                <div className="surah-header-top">
                    <h1 className="surah-title-arabic">
                        {surah.name}
                    </h1>
                </div>

                {/* Bottom: 3-Column Layout (Back | Metadata | Actions) */}
                <div className="surah-header-bottom">
                    <div className="surah-header-left">
                        <Link to="/quran" className="btn btn-secondary btn-small surah-back-link">
                            &larr; Back to Surahs
                        </Link>
                    </div>

                    <div className="surah-header-center">
                        <div className="surah-meta-row">
                            <span className="surah-english-name">{surah.english_name}</span>
                            <span className="surah-translation">{surah.english_name_translation}</span>
                            <span className="surah-verses">{surah.number_of_ayahs} verses</span>
                            <span className={`status-badge ${surah.revelation_type?.toLowerCase() === 'meccan' ? 'primary' : 'success'}`}>
                                {surah.revelation_type}
                            </span>
                            {/* Completion Indicator */}
                            {completionStats && completionStats.completion_percentage === 100 && (
                                <span className="status-badge success" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>
                                    </svg>
                                    Completed
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="surah-header-right">
                        <div className="page-header-actions">
                            <div className="split-btn-group">
                                {!autoPlay ? (
                                    <Button variant="success" onClick={playAll} className="split-btn-main">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                        </svg>
                                        Play Surah
                                    </Button>
                                ) : (
                                    <Button variant="danger" onClick={stopPlayback} className="split-btn-main">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="6" y="4" width="4" height="16"></rect>
                                            <rect x="14" y="4" width="4" height="16"></rect>
                                        </svg>
                                        Stop
                                    </Button>
                                )}
                                <button
                                    className={`split-btn-arrow ${showOptions ? 'active' : ''}`}
                                    onClick={() => setShowOptions(!showOptions)}
                                    title={showOptions ? 'Hide options' : 'Show options'}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="3"></circle>
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                    </svg>
                                </button>

                                {showOptions && (
                                    <div className="settings-dropdown">
                                        <div className="settings-dropdown-header">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="3"></circle>
                                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                            </svg>
                                            Settings
                                        </div>
                                        <div className="settings-group">
                                            <label className="settings-label">Reciter</label>
                                            <select
                                                className="form-select"
                                                value={selectedAudioEdition}
                                                onChange={(e) => setSelectedAudioEdition(e.target.value)}
                                            >
                                                {simplifiedReciters.map(reciter => (
                                                    <option key={reciter.identifier} value={reciter.identifier}>
                                                        {reciter.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="settings-group">
                                            <label className="settings-label">Translation</label>
                                            <select
                                                className="form-select"
                                                value={selectedTextEdition}
                                                onChange={(e) => handleTextEditionChange(e.target.value)}
                                            >
                                                <option value="quran-uthmani">Original Arabic</option>
                                                <option value="en.sahih">English (Sahih International)</option>
                                                <option value="en.pickthall">English (Pickthall)</option>
                                                <option value="ur.jalandhry">Urdu (Jalandhry)</option>
                                            </select>
                                        </div>
                                        <div className="settings-group">
                                            <label className="checkbox-label" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={trackReadingProgress}
                                                    onChange={(e) => {
                                                        const newValue = e.target.checked;
                                                        setTrackReadingProgress(newValue);
                                                        localStorage.setItem('trackReadingProgress', newValue);
                                                    }}
                                                />
                                                Update progress on scroll
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!autoPlay && isAuthenticated && completedAyahs.length > 0 && (() => {
                                const firstGap = findFirstGap();
                                return firstGap !== null && firstGap > 1;
                            })() && (
                                    <Button
                                        variant="secondary"
                                        className="catch-up-btn"
                                        onClick={() => {
                                            const firstGap = findFirstGap();
                                            if (firstGap) {
                                                const gapIndex = ayahs.findIndex(a => a.number_in_surah === firstGap);
                                                if (gapIndex >= 0) {
                                                    setAutoPlay(true);
                                                    playAyah(gapIndex);
                                                    ayahRefs.current[gapIndex]?.scrollIntoView({
                                                        behavior: 'smooth',
                                                        block: 'center',
                                                    });
                                                }
                                            }
                                        }}
                                    >
                                        Catch up from Ayah {findFirstGap()}
                                    </Button>
                                )}
                        </div>
                    </div>
                </div>
            </div>



            {/* Surah Progress Card (for all users) */}
            <div className="card mb-4" ref={progressCardRef}>
                <div className="card-body">
                    {isAuthenticated && completionStats ? (
                        <>
                            <div className="d-flex justify-between align-center mb-2">
                                <span className="text-muted small">Your Progress</span>
                                <span className="text-muted small">
                                    {completionStats.completed_count} / {completionStats.total_ayahs} ayahs
                                </span>
                            </div>
                            <div className="progress-bar-container">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${completionStats.completion_percentage}%` }}
                                />
                            </div>
                            <div className="d-flex gap-2" style={{ marginTop: '24px' }}>
                                {completionStats.completed_count > 0 && completedAyahs.length > 0 && (() => {
                                    const latestNext = findLatestNext();
                                    const latestIndex = ayahs.findIndex(a => a.number_in_surah === latestNext);
                                    return latestIndex >= 0;
                                })() && (
                                        <Button
                                            variant="primary"
                                            size="small"
                                            onClick={() => {
                                                const latestNext = findLatestNext();
                                                const latestIndex = ayahs.findIndex(a => a.number_in_surah === latestNext);

                                                if (latestIndex >= 0) {
                                                    setAutoPlay(true);
                                                    playAyah(latestIndex);

                                                    // Also scroll to it
                                                    ayahRefs.current[latestIndex]?.scrollIntoView({
                                                        behavior: 'smooth',
                                                        block: 'center',
                                                    });
                                                }
                                            }}
                                        >
                                            Resume from Latest (Ayah {findLatestNext()})
                                        </Button>
                                    )}
                                {completionStats.completed_count > 0 && (
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={() => setShowClearProgressConfirm(true)}
                                        style={{ marginLeft: 'auto' }}
                                    >
                                        Clear Progress
                                    </Button>
                                )}
                            </div>

                            {/* Ayah Heatmap Visualization */}
                            <div className="ayah-heatmap" style={{ marginTop: '16px' }}>
                                {Array.from({ length: completionStats.total_ayahs }, (_, i) => {
                                    const ayahNum = i + 1;
                                    const isRead = completedAyahs.includes(ayahNum);
                                    const isPlaying = playingAyah !== null && ayahs[playingAyah]?.number_in_surah === ayahNum;

                                    return (
                                        <div
                                            key={ayahNum}
                                            className={`heatmap-cell ${isRead ? 'read' : isPlaying ? 'reading' : 'unread'}`}
                                            onClick={() => {
                                                const ayahIndex = ayahs.findIndex(a => a.number_in_surah === ayahNum);
                                                if (ayahIndex >= 0) {
                                                    ayahRefs.current[ayahIndex]?.scrollIntoView({
                                                        behavior: 'smooth',
                                                        block: 'center',
                                                    });
                                                }
                                            }}
                                            title={`Ayah ${ayahNum}${isRead ? ' (read)' : isPlaying ? ' (playing)' : ' (unread)'}`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="heatmap-legend">
                                <div className="heatmap-legend-item">
                                    <div className="heatmap-legend-dot read"></div>
                                    <span>Read</span>
                                </div>
                                <div className="heatmap-legend-item">
                                    <div className="heatmap-legend-dot reading"></div>
                                    <span>Playing</span>
                                </div>
                                <div className="heatmap-legend-item">
                                    <div className="heatmap-legend-dot unread"></div>
                                    <span>Unread</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="d-flex justify-between align-center mb-2">
                                <span className="text-muted small">Surah Progress</span>
                                <span className="text-muted small">
                                    {ayahs.length} ayahs
                                </span>
                            </div>

                            {/* Ayah Heatmap Visualization - click to navigate */}
                            <div className="ayah-heatmap" style={{ marginTop: '8px' }}>
                                {ayahs.map((ayah, index) => {
                                    const isPlaying = playingAyah === index;

                                    return (
                                        <div
                                            key={ayah.number_in_surah}
                                            className={`heatmap-cell ${isPlaying ? 'reading' : 'unread'}`}
                                            onClick={() => {
                                                ayahRefs.current[index]?.scrollIntoView({
                                                    behavior: 'smooth',
                                                    block: 'center',
                                                });
                                            }}
                                            title={`Ayah ${ayah.number_in_surah}${isPlaying ? ' (playing)' : ''} - Click to navigate`}
                                        />
                                    );
                                })}
                            </div>
                            <p className="text-muted small" style={{ marginTop: '12px' }}>
                                Click on any cell to jump to that ayah. <Link to="/login" style={{ color: 'var(--accent-color)' }}>Sign in</Link> to track your reading progress.
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Ayahs List */}
            {
                ayahs.length === 0 ? (
                    <EmptyState message="No verses found" />
                ) : (
                    <div className="ayahs-list">
                        {ayahs.map((ayah, index) => {
                            const translation = getTranslationForAyah(ayah.number_in_surah);
                            const isPlaying = playingAyah === index;
                            const isBookmarked = !!bookmarks[ayah.id];
                            const isLoadingBookmark = bookmarkLoading[ayah.id];
                            const isCompleted = completedAyahs.includes(ayah.number_in_surah);
                            const isHighlighted = highlightedAyah === index;

                            return (
                                <div
                                    key={ayah.id}
                                    data-index={index}
                                    ref={(el) => ayahRefs.current[index] = el}
                                    className={`ayah-card ${isPlaying ? 'playing' : ''} ${isCompleted ? 'completed' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                >
                                    <div className="ayah-header">
                                        <span className={`ayah-number-badge ${isCompleted ? 'completed' : ''}`}>
                                            {isCompleted && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
                                                    <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                            {ayah.number_in_surah}
                                        </span>
                                        <div className="ayah-actions">
                                            {/* Bookmark Button */}
                                            <button
                                                className={`btn-icon ${isBookmarked ? 'bookmarked' : ''}`}
                                                onClick={() => handleBookmarkToggle(ayah)}
                                                title={isBookmarked ? 'Remove bookmark' : isAuthenticated ? 'Add bookmark' : 'Sign in to bookmark'}
                                                disabled={isLoadingBookmark}
                                            >
                                                {isLoadingBookmark ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
                                                            <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1s" repeatCount="indefinite" />
                                                        </circle>
                                                    </svg>
                                                ) : isBookmarked ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                                    </svg>
                                                )}
                                            </button>
                                            {/* Share Button */}
                                            <ShareButton
                                                surahId={parseInt(id)}
                                                ayahNumber={ayah.number_in_surah}
                                                surahName={surah.name}
                                                surahEnglishName={surah.english_name}
                                                surahTranslation={surah.english_name_translation}
                                                totalAyahs={surah.number_of_ayahs}
                                                translation={selectedTranslation}
                                            />
                                            {/* Play/Pause Button */}
                                            <button
                                                className={`btn-icon ${isPlaying ? 'playing' : ''}`}
                                                onClick={() => togglePlay(index)}
                                                title={isPlaying ? 'Pause' : 'Play'}
                                            >
                                                {isPlaying ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                        <rect x="6" y="4" width="4" height="16"></rect>
                                                        <rect x="14" y="4" width="4" height="16"></rect>
                                                    </svg>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Arabic Text */}
                                    <div className="ayah-text-arabic">
                                        <TextHighlighter text={ayah.text} highlight={highlightQuery} />
                                        <span className="ayah-symbol">&#65018;</span>
                                    </div>

                                    {/* Translation */}
                                    {translation && (
                                        <div className="ayah-translation">
                                            <TextHighlighter text={translation.text} highlight={highlightQuery} />
                                        </div>
                                    )}

                                    {/* Ayah Metadata */}
                                    <div className="ayah-meta">
                                        <span className="ayah-meta-item">Juz {ayah.juz}</span>
                                        <span className="ayah-meta-item">Page {ayah.page}</span>
                                        {ayah.sajda && (
                                            <span className="ayah-meta-item sajda">Sajdah</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }

            {/* Floating Progress Indicator */}
            <div className={`floating-progress ${showFloatingProgress ? 'visible' : ''}`}>
                <div className="floating-progress-content">
                    <div className="floating-progress-info">
                        <div className="floating-progress-titles marquee-container">
                            <div className="marquee-text">
                                <span className="floating-progress-surah-ar">{surah?.name}</span>
                                <span className="floating-progress-surah-en">{surah?.english_name}</span>
                                <span className="floating-progress-surah-translation">({surah?.english_name_translation})</span>
                                <div className="floating-progress-dot" />
                                <span className="floating-progress-label">
                                    Ayah {playingAyah !== null ? ayahs[playingAyah]?.number_in_surah : (ayahs[lastPlayedIndex]?.number_in_surah || '-')} of {ayahs.length}
                                </span>
                                {playingAyah !== null && translationAyahs[playingAyah] && (
                                    <>
                                        <div className="floating-progress-dot" />
                                        <span className="floating-progress-ayah-translation">
                                            {translationAyahs[playingAyah].text}
                                        </span>
                                    </>
                                )}
                                {/* Duplicate for seamless loop */}
                                <span className="floating-progress-surah-ar" style={{ marginLeft: '40px' }}>{surah?.name}</span>
                                <span className="floating-progress-surah-en">{surah?.english_name}</span>
                                <span className="floating-progress-surah-translation">({surah?.english_name_translation})</span>
                                <div className="floating-progress-dot" />
                                <span className="floating-progress-label">
                                    Ayah {playingAyah !== null ? ayahs[playingAyah]?.number_in_surah : (ayahs[lastPlayedIndex]?.number_in_surah || '-')} of {ayahs.length}
                                </span>
                                {playingAyah !== null && translationAyahs[playingAyah] && (
                                    <>
                                        <div className="floating-progress-dot" />
                                        <span className="floating-progress-ayah-translation">
                                            {translationAyahs[playingAyah].text}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {completionStats && (
                            <div className="floating-progress-bar">
                                <div
                                    className="floating-progress-bar-fill"
                                    style={{ width: `${completionStats.completion_percentage}%` }}
                                />
                            </div>
                        )}
                    </div>
                    <div className="floating-progress-controls">
                        {/* Prev Button */}
                        <button
                            className="btn-icon-floating"
                            onClick={() => {
                                // Use ref to always get the latest value, even if state hasn't updated yet
                                const currentAyah = playingAyah !== null ? playingAyah : lastPlayingAyahRef.current;

                                if (currentAyah !== null && currentAyah > 0) {
                                    playAyah(currentAyah - 1);
                                } else if (currentAyah === null || currentAyah === undefined) {
                                    // Nothing has been played yet, play last ayah
                                    playAyah(ayahs.length - 1);
                                }
                            }}
                            title="Previous ayah"
                            disabled={playingAyah !== null && playingAyah === 0}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18 6l-8.5 6 8.5 6V6zM6 6v12h2V6H6z" />
                            </svg>
                        </button>

                        {/* Play/Pause Button */}
                        <button
                            className="btn-icon-floating btn-icon-floating-primary"
                            onClick={() => {
                                if (playingAyah !== null) {
                                    // Currently playing - pause it
                                    pauseAyah();
                                } else {
                                    // Currently paused - resume from last playing ayah, or first unread, or beginning
                                    const resumeIndex = lastPlayingAyahRef.current !== null
                                        ? lastPlayingAyahRef.current
                                        : lastPlayedIndex !== null
                                            ? lastPlayedIndex
                                            : completionStats?.first_unread_ayah
                                                ? ayahs.findIndex(a => a.number_in_surah === completionStats.first_unread_ayah)
                                                : 0;
                                    setAutoPlay(true);
                                    playAyah(resumeIndex >= 0 ? resumeIndex : 0);
                                }
                            }}
                            title={playingAyah !== null ? 'Pause' : 'Play'}
                        >
                            {playingAyah !== null ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16"></rect>
                                    <rect x="14" y="4" width="4" height="16"></rect>
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                            )}
                        </button>

                        {/* Next Button */}
                        <button
                            className="btn-icon-floating"
                            onClick={() => {
                                // Use ref to always get the latest value, even if state hasn't updated yet
                                const currentAyah = playingAyah !== null ? playingAyah : lastPlayingAyahRef.current;

                                if (currentAyah !== null && currentAyah < ayahs.length - 1) {
                                    playAyah(currentAyah + 1);
                                } else if (currentAyah === null || currentAyah === undefined) {
                                    // Nothing has been played yet, play first ayah
                                    playAyah(0);
                                }
                            }}
                            title="Next ayah"
                            disabled={playingAyah !== null && playingAyah === ayahs.length - 1}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                            </svg>
                        </button>

                        {/* Speed Control */}
                        <button
                            className="btn-icon-floating"
                            onClick={() => {
                                const speeds = [1, 1.25, 1.5, 2, 0.5, 0.75];
                                const currentIndex = speeds.indexOf(playbackSpeed);
                                const nextIndex = (currentIndex + 1) % speeds.length;
                                setPlaybackSpeed(speeds[nextIndex]);
                            }}
                            title={`Playback Speed: ${playbackSpeed}x`}
                            style={{ fontSize: '11px', fontWeight: 'bold', width: 'auto', padding: '0 8px', minWidth: '32px' }}
                        >
                            {playbackSpeed}x
                        </button>

                        <div className="floating-progress-separator" />

                        {/* Audio Settings (Stacked Volume + Reciter) */}
                        <div className="floating-progress-settings">
                            {/* Volume Control */}
                            <div className="floating-progress-volume">
                                <button
                                    className="btn-icon-floating"
                                    onClick={() => setVolume(v => v === 0 ? 1 : 0)}
                                    title={volume === 0 ? 'Unmute' : 'Mute'}
                                >
                                    {volume === 0 ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                        </svg>
                                    )}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    className="volume-slider"
                                    title="Volume"
                                />
                            </div>

                            {/* Reciter Selector */}
                            <select
                                className="reciter-select-floating"
                                value={selectedAudioEdition}
                                onChange={(e) => {
                                    // Save current playing state (both playing and paused)
                                    const wasPlaying = playingAyah !== null;
                                    const currentAyahIndex = playingAyah !== null
                                        ? playingAyah
                                        : lastPlayingAyahRef.current;
                                    const newEdition = e.target.value;

                                    // Change reciter
                                    setSelectedAudioEdition(newEdition);

                                    // If something was playing or paused, restart from the same ayah with new reciter
                                    if (currentAyahIndex !== null && currentAyahIndex !== undefined) {
                                        // Pass new edition directly to avoid race condition
                                        playAyah(currentAyahIndex, newEdition);
                                        // If it wasn't playing before, pause it after starting
                                        if (!wasPlaying) {
                                            pauseAyah();
                                        }
                                    }
                                }}
                            >
                                {simplifiedReciters.map(reciter => (
                                    <option key={reciter.identifier} value={reciter.identifier}>
                                        {reciter.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Footer */}
            <div className="surah-nav-footer">
                <div className="d-flex justify-between">
                    <Button
                        variant="secondary"
                        disabled={!surah.id || surah.id <= 1}
                        onClick={() => navigate(`/quran/${surah.id - 1}`)}
                    >
                        &larr; Previous Surah
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={!surah.id || surah.id >= 114}
                        onClick={() => navigate(`/quran/${surah.id + 1}`)}
                    >
                        Next Surah &rarr;
                    </Button>
                </div>
            </div>

            {/* Clear Progress Confirmation Modal */}
            <Modal
                isOpen={showClearProgressConfirm}
                onClose={() => setShowClearProgressConfirm(false)}
                title="Clear Surah Progress?"
                size="small"
                footer={
                    <div className="d-flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setShowClearProgressConfirm(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleClearProgress}
                        >
                            Clear Progress
                        </Button>
                    </div>
                }
            >
                <p>
                    Are you sure you want to clear your progress for <strong>{surah?.english_name}</strong> ({surah?.name})?
                </p>
                <p className="text-muted small">
                    This will remove all completed ayahs for this surah. This action cannot be undone.
                </p>
            </Modal>

            {/* Surah Completion Modal */}
            <Modal
                isOpen={showSurahCompletion}
                onClose={() => setShowSurahCompletion(false)}
                title="Alhamdulillah! Surah Complete"
                size="small"
                footer={
                    <div className="d-flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowSurahCompletion(false);
                                playAyah(0); // Replay from beginning
                                setAutoPlay(true);
                            }}
                        >
                            Replay Surah
                        </Button>
                        {surah.id && surah.id < 114 && (
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setShowSurahCompletion(false);
                                    navigate(`/quran/${surah.id + 1}`);
                                }}
                            >
                                Next Surah &rarr;
                            </Button>
                        )}
                    </div>
                }
            >
                <div className="surah-completion-content">
                    <p className="surah-completion-message">
                        You have completed <strong>{surah?.english_name}</strong> ({surah?.name}).
                    </p>
                    <p className="surah-completion-subtitle">
                        {surah?.id === 114
                            ? "You have completed the final Surah of the Quran!"
                            : `Continue to Surah ${surah?.id + 1} or replay this surah?`
                        }
                    </p>
                </div>
            </Modal>

            {/* Login Prompt Modal */}
            <Modal
                isOpen={showLoginPrompt}
                onClose={() => setShowLoginPrompt(false)}
                title="Sign in Required"
                size="small"
                footer={
                    <div className="d-flex gap-2 w-100">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setShowLoginPrompt(false)}
                        >
                            Cancel
                        </Button>
                        <Link
                            to={`/login?redirect=${encodeURIComponent(location.pathname + '#ayah-' + (pendingAyahInfo?.ayahNumber || ''))}`}
                            className="btn btn-primary flex-1 text-center"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            Sign In
                        </Link>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔖</div>
                    <p style={{ marginBottom: '8px', fontWeight: '600' }}>Want to save Ayah {pendingAyahInfo?.ayahNumber}?</p>
                    <p className="text-muted small">
                        Create a free account or sign in to bookmark ayahs, track your reading progress, and sync across devices.
                    </p>
                    <p className="text-muted extra-small" style={{ marginTop: '12px', fontStyle: 'italic' }}>
                        Your journey is private. No ads, no tracking, ever.
                    </p>
                </div>
            </Modal>

            {/* Bookmark Success Toast */}
            {showBookmarkSuccess && (
                <div className="toast-notification toast-success">
                    <div className="toast-content">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Ayah bookmarked successfully!</span>
                    </div>
                    <button className="toast-dismiss" onClick={() => setShowBookmarkSuccess(false)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            )}
        </>
    );
}

export default SurahDetail;
