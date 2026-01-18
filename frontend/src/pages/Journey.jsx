import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Card, StatCard } from '../components/Card';
import { getBookmarks, getProgressStats, getSequentialProgress, getAllSurahsProgress, getSurahs } from '../api/client';

// Lazy load the ShareSettingsPanel - only loads when "Share Profile" tab is clicked
const ShareSettingsPanel = lazy(() => import('../components/ShareSettingsPanel'));

// Suspense fallback for lazy loaded components
function SharePanelFallback() {
    return (
        <div className="share-settings-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <div className="skeleton" style={{ height: '32px', width: '70%', margin: '0 auto 12px', borderRadius: '8px' }}></div>
            <div className="skeleton" style={{ height: '20px', width: '50%', margin: '0 auto 24px', borderRadius: '8px' }}></div>
            <div className="skeleton" style={{ height: '200px', width: '100%', borderRadius: '12px' }}></div>
        </div>
    );
}

/**
 * Journey - Detailed Quran reading progress tracking
 * Shows overview of all surahs with drill-down capability
 */
function Journey() {
    const [stats, setStats] = useState({
        total_ayahs_read: 0,
        total_surahs_read: 0,
        total_bookmarks: 0,
        reading_streak: 0,
    });
    const [sequentialProgress, setSequentialProgress] = useState(null);
    const [bookmarks, setBookmarks] = useState([]);
    const [surahsProgress, setSurahsProgress] = useState([]);
    const [allSurahs, setAllSurahs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSurah, setSelectedSurah] = useState(null);
    const [viewMode, setViewMode] = useState('all'); // 'all', 'in-progress', 'completed', 'not-started'
    const [showAllBookmarks, setShowAllBookmarks] = useState(false);
    const [activeTab, setActiveTab] = useState('journey'); // 'journey', 'share'
    const [motivationalIndex, setMotivationalIndex] = useState(0);

    // Motivational messages for the hero section
    const motivationalMessages = [
        {
            title: "Your Journey Through the Quran",
            subtitle: "Every ayah you read brings you closer to Allah",
            reward: "The Prophet (pbuh) said: 'The one who recites the Quran while stammering with it will have a double reward.'"
        },
        {
            title: "Keep Going, You're Doing Great!",
            subtitle: "Consistency is key in the journey of Quran",
            reward: "The best among you are those who learn the Quran and teach it."
        },
        {
            title: "Each Ayah is a Step Towards Jannah",
            subtitle: "The Quran will intercede for its companions on the Day of Judgment",
            reward: "Read the Quran, for it will come as an intercessor for its companions on the Day of Resurrection."
        },
        {
            title: "Your Progress Inspires",
            subtitle: "The light of the Quran illuminates your path in this life and the next",
            reward: "Whoever reads a letter from the Book of Allah will receive a Hasanah (good deed)."
        },
        {
            title: "The Rewards Are Endless",
            subtitle: "Every letter you read earns you Hasanah (good deeds)",
            reward: "The Prophet (pbuh) said: 'Whoever reads a letter from the Book of Allah will receive a Hasanah, and a Hasanah is multiplied by ten.'"
        },
        {
            title: "Invest in Your Akhirah",
            subtitle: "The Quran is a treasure that benefits you in this life and the next",
            reward: "The Quran will be an intercessor on the Day of Judgment for those who used to recite it."
        },
        {
            title: "Stay Consistent, Even One Ayah",
            subtitle: "Small consistent steps lead to great rewards",
            reward: "The most beloved deeds to Allah are those that are consistent, even if they are small."
        },
        {
            title: "The Best of People",
            subtitle: "You are among those who hold tight to the Quran",
            reward: "The Prophet (pbuh) said: 'The best among you are those who learn the Quran and teach it.'"
        }
    ];

    // Pick a random motivational message on component mount (changes on refresh)
    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * motivationalMessages.length);
        setMotivationalIndex(randomIndex);
    }, []);

    useEffect(() => {
        loadProgressData();
    }, []);

    const loadProgressData = async () => {
        try {
            const [statsData, sequentialData, bookmarksData, progressData, surahsData] = await Promise.all([
                getProgressStats(),
                getSequentialProgress().catch(() => null),
                getBookmarks(),
                getAllSurahsProgress().catch(() => []),
                getSurahs(),
            ]);

            setStats(statsData);
            setSequentialProgress(sequentialData);
            setBookmarks(bookmarksData);

            // Merge surah info with progress data
            const surahsMap = new Map(surahsData.map(s => [s.id, s]));
            const mergedProgress = progressData.map(p => ({
                ...p,
                ...surahsMap.get(p.surah_id),
            }));

            setSurahsProgress(mergedProgress);
            setAllSurahs(surahsData);
        } catch (err) {
            console.error('Failed to load progress data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBookmark = async (bookmarkId) => {
        try {
            await fetch(`/api/bookmarks/${bookmarkId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('session_token')}`,
                },
            });

            const bookmarksData = await getBookmarks();
            setBookmarks(bookmarksData);

            const statsData = await getProgressStats();
            setStats(statsData);
        } catch (err) {
            console.error('Failed to delete bookmark:', err);
        }
    };

    const getFilteredSurahs = () => {
        switch (viewMode) {
            case 'completed':
                return surahsProgress.filter(s => s.completed_count === s.total_ayahs);
            case 'in-progress':
                return surahsProgress.filter(s => s.completed_count > 0 && s.completed_count < s.total_ayahs);
            case 'not-started':
                return surahsProgress.filter(s => s.completed_count === 0);
            default:
                return surahsProgress;
        }
    };

    const getCompletionColor = (percentage) => {
        if (percentage === 100) return '#10b981';
        if (percentage >= 50) return '#22c55e';
        if (percentage >= 25) return '#84cc16';
        return '#f97316';
    };

    // Memoize filtered surahs to prevent recalculation on every render
    const filteredSurahs = useMemo(() => getFilteredSurahs(), [surahsProgress, viewMode]);

    // Skeleton loader for initial load
    if (loading) {
        return (
            <div className="progress-page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">My Journey</h1>
                        <p className="page-subtitle">Track your journey through the Quran</p>
                    </div>
                    <div className="page-header-actions">
                        <div className="skeleton" style={{ height: '40px', width: '160px', borderRadius: '12px' }}></div>
                        <div className="skeleton" style={{ height: '40px', width: '140px', borderRadius: '12px' }}></div>
                    </div>
                </div>

                {/* Motivational hero skeleton */}
                <div className="card mb-4" style={{ marginBottom: '24px' }}>
                    <div className="card-body">
                        <div className="skeleton" style={{ height: '32px', width: '70%', marginBottom: '12px', borderRadius: '8px' }}></div>
                        <div className="skeleton" style={{ height: '20px', width: '50%', marginBottom: '16px', borderRadius: '8px' }}></div>
                        <div className="skeleton" style={{ height: '16px', width: '90%', borderRadius: '8px' }}></div>
                    </div>
                </div>

                {/* Stats skeleton */}
                <div className="stats-grid">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="stat-card">
                            <div className="skeleton" style={{ height: '48px', width: '80px', margin: '0 auto 8px', borderRadius: '8px' }}></div>
                            <div className="skeleton" style={{ height: '16px', width: '100px', margin: '0 auto', borderRadius: '8px' }}></div>
                        </div>
                    ))}
                </div>

                {/* Surah grid skeleton */}
                <div className="surah-progress-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="surah-progress-card" style={{ pointerEvents: 'none' }}>
                            <div className="surah-progress-header">
                                <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '12px' }}></div>
                                <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '8px' }}></div>
                            </div>
                            <div className="skeleton" style={{ height: '24px', width: '70%', marginBottom: '8px', borderRadius: '8px' }}></div>
                            <div className="skeleton" style={{ height: '16px', width: '50%', marginBottom: '8px', borderRadius: '8px' }}></div>
                            <div className="skeleton" style={{ height: '6px', width: '100%', borderRadius: '3px' }}></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Calculate overall completion percentage
    const totalAyahsInQuran = 6236; // Total ayahs in Quran
    const overallPercentage = Math.round((stats.total_ayahs_read / totalAyahsInQuran) * 100);
    const currentMessage = motivationalMessages[motivationalIndex];

    return (
        <div className="progress-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Journey</h1>
                    <p className="page-subtitle">Track your journey through the Quran</p>
                </div>
                <div className="page-header-actions">
                    <Link to="/analytics" className="btn btn-secondary">
                        📊 Listening Analytics
                    </Link>
                    <Link to="/account" className="btn btn-secondary">
                        &larr; Back to Account
                    </Link>
                </div>
            </div>

            {/* Motivational Hero Section */}
            <Card className="mb-4" style={{ marginBottom: '24px', overflow: 'hidden', position: 'relative' }}>
                <div className="card-body" style={{
                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.03) 100%)',
                    padding: '40px',
                    position: 'relative'
                }}>
                    {/* Decorative background elements */}
                    <div style={{
                        position: 'absolute',
                        top: '-50px',
                        right: '-50px',
                        width: '200px',
                        height: '200px',
                        background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, transparent 70%)',
                        pointerEvents: 'none',
                        borderRadius: '50%'
                    }}></div>
                    <div style={{
                        position: 'absolute',
                        bottom: '-30px',
                        left: '-30px',
                        width: '150px',
                        height: '150px',
                        background: 'radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)',
                        pointerEvents: 'none',
                        borderRadius: '50%'
                    }}></div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {/* Icon/Emoji at top */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%)',
                            fontSize: '1.75rem',
                            marginBottom: '20px',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
                        }}>
                            🌟
                        </div>
                        <h3 style={{
                            fontSize: '1.875rem',
                            fontWeight: '800',
                            letterSpacing: '-0.03em',
                            marginBottom: '12px',
                            background: 'linear-gradient(135deg, var(--accent-color) 0%, #ea580c 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            lineHeight: '1.2'
                        }}>
                            {currentMessage.title}
                        </h3>
                        <p style={{
                            fontSize: '1.125rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '20px',
                            lineHeight: '1.6',
                            fontWeight: '500'
                        }}>
                            {currentMessage.subtitle}
                        </p>
                        <div style={{
                            padding: '20px',
                            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.05) 100%)',
                            borderLeft: '4px solid var(--accent-color)',
                            borderRadius: '12px',
                            fontStyle: 'italic',
                            color: 'var(--text-primary)',
                            lineHeight: '1.8',
                            fontSize: '1rem',
                            fontWeight: '400',
                            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.08)'
                        }}>
                            <span style={{ marginRight: '8px' }}>✨</span>
                            {currentMessage.reward}
                        </div>
                        {sequentialProgress && sequentialProgress.sequential_percentage > 0 && (
                            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, height: '10px', background: 'rgba(0, 0, 0, 0.06)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                                    <div style={{
                                        width: `${sequentialProgress.sequential_percentage}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--accent-color) 0%, var(--accent-hover) 100%)',
                                        borderRadius: '8px',
                                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)'
                                    }}></div>
                                </div>
                                <span style={{
                                    fontSize: '0.9375rem',
                                    fontWeight: '700',
                                    color: 'var(--accent-color)',
                                    whiteSpace: 'nowrap',
                                    textShadow: '0 1px 2px rgba(249, 115, 22, 0.1)'
                                }}>
                                    {sequentialProgress.sequential_percentage}% Complete
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Main Tabs */}
            <div className="filter-tabs" style={{ marginBottom: '24px', justifyContent: 'center' }}>
                <button
                    className={`filter-tab ${activeTab === 'journey' ? 'active' : ''}`}
                    onClick={() => setActiveTab('journey')}
                    style={{ fontSize: '1rem', padding: '12px 24px' }}
                >
                    My Journey
                </button>
                <button
                    className={`filter-tab ${activeTab === 'share' ? 'active' : ''}`}
                    onClick={() => setActiveTab('share')}
                    style={{ fontSize: '1rem', padding: '12px 24px' }}
                >
                    Share Profile
                </button>
            </div>

            {activeTab === 'share' ? (
                <Suspense fallback={<SharePanelFallback />}>
                    <ShareSettingsPanel />
                </Suspense>
            ) : (
                <>
                    {/* Overview Stats */}
                    <div className="stats-grid">
                        <StatCard value={`${overallPercentage}%`} label="Overall Complete" />
                        <StatCard value={stats.total_ayahs_read.toString()} label="Ayahs Read" />
                        <StatCard value={stats.total_surahs_read.toString()} label="Surahs Started" />
                        <StatCard value={stats.reading_streak.toString()} label="Day Streak" />
                    </div>

                    {/* Overall Progress Bar */}
                    <Card className="mb-4">
                        <div className="card-body">
                            <div className="d-flex justify-between align-center mb-2">
                                <span className="text-muted small">Total Quran Completion</span>
                                <span className="text-muted small">
                                    {stats.total_ayahs_read} / {totalAyahsInQuran} ayahs
                                </span>
                            </div>
                            <div className="progress-bar-large">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${overallPercentage}%` }}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Quick Actions - Continue button using sequential progress */}
                    <div className="progress-quick-actions">
                        {sequentialProgress && (
                            <Link
                                to={`/quran/${sequentialProgress.first_incomplete_surah}#ayah-${sequentialProgress.first_incomplete_ayah}`}
                                className="btn btn-primary"
                                style={{
                                    padding: '16px 32px',
                                    fontSize: '1rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                                Continue Reading: Surah {sequentialProgress.first_incomplete_surah}, Ayah {sequentialProgress.first_incomplete_ayah}
                            </Link>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="filter-tabs">
                        <button
                            className={`filter-tab ${viewMode === 'all' ? 'active' : ''}`}
                            onClick={() => setViewMode('all')}
                        >
                            All Surahs
                        </button>
                        <button
                            className={`filter-tab ${viewMode === 'in-progress' ? 'active' : ''}`}
                            onClick={() => setViewMode('in-progress')}
                        >
                            In Progress
                        </button>
                        <button
                            className={`filter-tab ${viewMode === 'completed' ? 'active' : ''}`}
                            onClick={() => setViewMode('completed')}
                        >
                            Completed
                        </button>
                        <button
                            className={`filter-tab ${viewMode === 'not-started' ? 'active' : ''}`}
                            onClick={() => setViewMode('not-started')}
                        >
                            Not Started
                        </button>
                    </div>

                    {/* Surahs Grid */}
                    <div className="surah-progress-grid">
                        {filteredSurahs.map((surah) => {
                            const percentage = Math.round((surah.completed_count / surah.total_ayahs) * 100);
                            const color = getCompletionColor(percentage);

                            return (
                                <Link
                                    key={surah.surah_id}
                                    to={`/quran/${surah.surah_id}`}
                                    className="surah-progress-card"
                                >
                                    <div className="surah-progress-header">
                                        <span className="surah-progress-number">{surah.surah_id}</span>
                                        <div className="surah-progress-status-stack">
                                            {percentage === 100 && (
                                                <div className="surah-progress-badge completed">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                        <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    Completed
                                                </div>
                                            )}
                                            {surah.completed_count > 0 && percentage < 100 && (
                                                <div className="surah-progress-badge in-progress">
                                                    In Progress
                                                </div>
                                            )}
                                            <span
                                                className="surah-progress-percentage"
                                                style={{ color }}
                                            >
                                                {percentage}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="surah-progress-info">
                                        <h3 className="surah-progress-name-arabic">{surah.name || surah.surah_name}</h3>
                                        <p className="surah-progress-name-english">{surah.english_name}</p>
                                        <p className="surah-progress-stats">
                                            {surah.completed_count} / {surah.total_ayahs} ayahs
                                        </p>
                                    </div>
                                    <div className="surah-progress-bar">
                                        <div
                                            className="surah-progress-fill"
                                            style={{
                                                width: `${percentage}%`,
                                                background: color,
                                            }}
                                        />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Bookmarks Section */}
                    <Card title={bookmarks.length > 0 ? `Your Bookmarks (${bookmarks.length})` : "Bookmarks"} className="mt-4">
                        {bookmarks.length > 0 ? (
                            <>
                                <div className="bookmarks-list">
                                    {(showAllBookmarks ? bookmarks : bookmarks.slice(0, 5)).map((bookmark) => (
                                        <div key={bookmark.id} className="bookmark-item">
                                            <div className="bookmark-info">
                                                <span className="bookmark-surah-number">{bookmark.surah_id}</span>
                                                <div className="bookmark-details">
                                                    <Link
                                                        to={`/quran/${bookmark.surah_id}#ayah-${bookmark.ayah_number_in_surah}`}
                                                        className="bookmark-surah"
                                                    >
                                                        {bookmark.surah_name}
                                                    </Link>
                                                    <p className="small text-muted mb-2">
                                                        {bookmark.english_name} &bull; Ayah {bookmark.ayah_number_in_surah}
                                                    </p>
                                                    {bookmark.ayah_text && (
                                                        <p className="ayah-text-snippet">
                                                            {bookmark.ayah_text}
                                                        </p>
                                                    )}
                                                    {bookmark.ayah_english && (
                                                        <p className="ayah-english-snippet">
                                                            {bookmark.ayah_english}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleDeleteBookmark(bookmark.id)}
                                                title="Remove bookmark"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {bookmarks.length > 5 && (
                                    <button
                                        className="btn-view-all"
                                        onClick={() => setShowAllBookmarks(!showAllBookmarks)}
                                    >
                                        {showAllBookmarks ? 'Show Less' : `View All ${bookmarks.length} Bookmarks`}
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="empty-state">
                                <p className="text-muted">Bookmark ayahs to find them quickly later.</p>
                                <Link to="/quran" className="btn btn-secondary mt-4">
                                    Browse Quran
                                </Link>
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}

export default Journey;
