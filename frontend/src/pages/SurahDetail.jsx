import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    getSurah, getAyahs, getAudioEditions, getEditions,
    checkBookmark, toggleBookmark, updateProgress, getBookmarksForSurah,
    getCompletedAyahsForSurah, getSurahCompletionStats, markAyahCompleted
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, EmptyState } from '../components/Spinner';
import Button from '../components/Button';
import ShareButton from '../components/ShareButton';

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
    const [loopAyah, setLoopAyah] = useState(false);

    // Bookmark state - map of ayah_id -> bookmark_id (or null if not bookmarked)
    const [bookmarks, setBookmarks] = useState({});
    const [bookmarkLoading, setBookmarkLoading] = useState({});

    // Completion tracking state
    const [completedAyahs, setCompletedAyahs] = useState([]);
    const [completionStats, setCompletionStats] = useState(null);

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

    // Floating progress indicator visibility state
    const [showFloatingProgress, setShowFloatingProgress] = useState(false);
    const [volume, setVolume] = useState(1);

    // Simplified reciter options (only Mishary Alafasy and Ibrahim Walk)
    const simplifiedReciters = [
        { identifier: 'ar.alafasy', name: 'Alafasy' },
        { identifier: 'en.walk', name: 'I. Walk' },
    ];

    useEffect(() => {
        loadSurahData();
        loadEditions();
    }, [id]);

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
    }, [ayahs, isAuthenticated]);

    // Detect when progress card scrolls out of view to show floating indicator
    useEffect(() => {
        const handleScroll = () => {
            if (progressCardRef.current && ayahs.length > 0) {
                const rect = progressCardRef.current.getBoundingClientRect();
                // Show when the card is mostly out of view (top of card is below viewport top + 100px)
                // This makes it appear earlier than before
                const isMostlyOutOfView = rect.top < 100;
                setShowFloatingProgress(isMostlyOutOfView);
            } else {
                setShowFloatingProgress(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check

        return () => window.removeEventListener('scroll', handleScroll);
    }, [ayahs]);

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

    // Smooth scroll to playing ayah
    useEffect(() => {
        if (playingAyah !== null && ayahRefs.current[playingAyah]) {
            ayahRefs.current[playingAyah].scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [playingAyah]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => {
            if (playingAyah !== null) {
                // Mark ayah as completed when audio finishes
                const currentAyah = ayahs[playingAyah];
                if (currentAyah) {
                    markAyahAsCompleted(currentAyah);
                }

                // Check if loop mode is enabled - replay same ayah
                if (loopAyah) {
                    playAyah(playingAyah);
                    return;
                }

                // Continue to next ayah (either autoPlay or normal continuation)
                const nextAyah = playingAyah + 1;
                if (nextAyah < ayahs.length) {
                    playAyah(nextAyah);
                } else {
                    // End of surah reached
                    setPlayingAyah(null);
                }
            } else {
                setPlayingAyah(null);
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
    }, [autoPlay, loopAyah, playingAyah, ayahs]);

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
            // Redirect to login if not authenticated
            navigate('/login');
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
        try {
            await markAyahCompleted(ayah.id, parseInt(id), ayah.number_in_surah);
            // Update local state
            if (!completedAyahs.includes(ayah.number_in_surah)) {
                setCompletedAyahs(prev => [...prev, ayah.number_in_surah]);
                // Update completion stats
                if (completionStats) {
                    setCompletionStats(prev => ({
                        ...prev,
                        completed_count: prev.completed_count + 1,
                        completion_percentage: Math.round(((prev.completed_count + 1) / prev.total_ayahs) * 1000) / 10
                    }));
                }
            }
        } catch (err) {
            console.error('Failed to mark ayah as completed:', err);
        }
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
                .then(() => {
                    lastPlayingAyahRef.current = index;
                    setPlayingAyah(index);
                    // Preload next 2 ayahs after starting playback
                    preloadNextAyahs(index, audioEdition);
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
                preloadedAudio.load().catch(() => {
                    // Silently fail if preloading fails - playback will still work
                });
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

            {/* Header with Surah Info */}
            <div className="page-header">
                <div className="surah-header-info">
                    <Link to="/quran" className="btn btn-secondary btn-small mb-3">
                        &larr; Back to Surahs
                    </Link>
                    <h1 className="page-title">
                        <span className="surah-title-arabic">{surah.name}</span>
                    </h1>
                    <p className="page-subtitle">
                        {surah.english_name} &bull; {surah.english_name_translation} &bull;
                        {surah.number_of_ayahs} verses &bull;
                        <span className={`status-badge ${surah.revelation_type?.toLowerCase() === 'meccan' ? 'primary' : 'success'}`}>
                            {surah.revelation_type}
                        </span>
                    </p>
                </div>
                <div className="page-header-actions">
                    {!autoPlay ? (
                        <Button variant="success" onClick={playAll}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            Play All
                        </Button>
                    ) : (
                        <Button variant="danger" onClick={stopPlayback}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16"></rect>
                                <rect x="14" y="4" width="4" height="16"></rect>
                            </svg>
                            Stop
                        </Button>
                    )}
                </div>
            </div>

            {/* Edition Controls */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex flex-wrap gap-3">
                        {/* Audio Reciter Selection */}
                        <div style={{ flex: '1', minWidth: '220px' }}>
                            <label className="form-label">Reciter</label>
                            <select
                                className="form-select"
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
                                {audioEditions.map(edition => (
                                    <option key={edition.identifier} value={edition.identifier}>
                                        {getReciterName(edition.identifier)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Text Edition Selection */}
                        <div style={{ flex: '1', minWidth: '200px' }}>
                            <label className="form-label">Arabic Text</label>
                            <select
                                className="form-select"
                                value={selectedTextEdition}
                                onChange={(e) => handleTextEditionChange(e.target.value)}
                            >
                                {textEditions
                                    .filter(e => e.language === 'ar' && e.type === 'quran')
                                    .map(edition => (
                                        <option key={edition.identifier} value={edition.identifier}>
                                            {edition.english_name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Translation Selection */}
                        <div style={{ flex: '1', minWidth: '200px' }}>
                            <label className="form-label">Translation</label>
                            <select
                                className="form-select"
                                value={selectedTranslation}
                                onChange={(e) => setSelectedTranslation(e.target.value)}
                            >
                                <option value="none">No Translation</option>
                                {textEditions
                                    .filter(e => e.type === 'translation')
                                    .map(edition => (
                                        <option key={edition.identifier} value={edition.identifier}>
                                            {edition.english_name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Auto-play Toggle */}
                        <div className="align-center d-flex" style={{ paddingTop: '24px' }}>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={autoPlay}
                                    onChange={(e) => setAutoPlay(e.target.checked)}
                                />
                                Auto-play next
                            </label>
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
                            <div className="d-flex gap-2 mt-3">
                                {completionStats.first_unread_ayah && (
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={() => {
                                            const firstUnreadIndex = ayahs.findIndex(
                                                a => a.number_in_surah === completionStats.first_unread_ayah
                                            );
                                            if (firstUnreadIndex >= 0) {
                                                ayahRefs.current[firstUnreadIndex]?.scrollIntoView({
                                                    behavior: 'smooth',
                                                    block: 'center',
                                                });
                                            }
                                        }}
                                    >
                                        Resume from Ayah {completionStats.first_unread_ayah}
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
                                <span className="text-muted small">Surah Overview</span>
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
            {ayahs.length === 0 ? (
                <EmptyState message="No verses found" />
            ) : (
                <div className="ayahs-list">
                    {ayahs.map((ayah, index) => {
                        const translation = getTranslationForAyah(ayah.number_in_surah);
                        const isPlaying = playingAyah === index;
                        const isBookmarked = !!bookmarks[ayah.id];
                        const isLoadingBookmark = bookmarkLoading[ayah.id];
                        const isCompleted = completedAyahs.includes(ayah.number_in_surah);

                        return (
                            <div
                                key={ayah.id}
                                ref={(el) => ayahRefs.current[index] = el}
                                className={`ayah-card ${isPlaying ? 'playing' : ''} ${isCompleted ? 'completed' : ''}`}
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
                                    {ayah.text}
                                    <span className="ayah-symbol">&#65018;</span>
                                </div>

                                {/* Translation */}
                                {translation && (
                                    <div className="ayah-translation">
                                        {translation.text}
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
            )}

            {/* Floating Progress Indicator */}
            {showFloatingProgress && (
                <div className="floating-progress">
                    <div className="floating-progress-content">
                        <div className="floating-progress-info">
                            <span className="floating-progress-label">
                                Ayah {playingAyah !== null ? ayahs[playingAyah]?.number_in_surah : '-'} of {ayahs.length}
                            </span>
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
                                    <polygon points="19 3 5 12 19 21 19 3"></polygon>
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
                                            : completionStats?.first_unread_ayah
                                                ? ayahs.findIndex(a => a.number_in_surah === completionStats.first_unread_ayah)
                                                : 0;
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
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                            </button>

                            {/* Loop Toggle */}
                            <button
                                className={`btn-icon-floating ${loopAyah ? 'btn-icon-floating-active' : ''}`}
                                onClick={() => setLoopAyah(prev => !prev)}
                                title={loopAyah ? 'Disable loop (currently looping)' : 'Enable loop (repeat current ayah)'}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"></path>
                                </svg>
                            </button>

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
                                title="Reciter"
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
            )}

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
        </>
    );
}

export default SurahDetail;
