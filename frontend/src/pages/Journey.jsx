import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, StatCard } from '../components/Card';
import { getBookmarks, getProgressStats, getLastPosition, getAllSurahsProgress, getSurahs } from '../api/client';
import { LoadingState } from '../components/Spinner';
import ShareSettingsPanel from '../components/ShareSettingsPanel';

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
    const [lastPosition, setLastPosition] = useState(null);
    const [bookmarks, setBookmarks] = useState([]);
    const [surahsProgress, setSurahsProgress] = useState([]);
    const [allSurahs, setAllSurahs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSurah, setSelectedSurah] = useState(null);
    const [viewMode, setViewMode] = useState('all'); // 'all', 'in-progress', 'completed', 'not-started'
    const [showAllBookmarks, setShowAllBookmarks] = useState(false);
    const [activeTab, setActiveTab] = useState('journey'); // 'journey', 'share'

    useEffect(() => {
        loadProgressData();
    }, []);

    const loadProgressData = async () => {
        try {
            const [statsData, lastPosData, bookmarksData, progressData, surahsData] = await Promise.all([
                getProgressStats(),
                getLastPosition().catch(() => null),
                getBookmarks(),
                getAllSurahsProgress().catch(() => []),
                getSurahs(),
            ]);

            setStats(statsData);
            setLastPosition(lastPosData);
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

    const filteredSurahs = getFilteredSurahs();

    if (loading) {
        return <LoadingState message="Loading your progress..." />;
    }

    // Calculate overall completion percentage
    const totalAyahsInQuran = 6236; // Total ayahs in Quran
    const overallPercentage = Math.round((stats.total_ayahs_read / totalAyahsInQuran) * 100);

    return (
        <div className="progress-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Your Journey</h1>
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
                <ShareSettingsPanel />
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

                    {/* Quick Actions */}
                    <div className="progress-quick-actions">
                        {lastPosition && (
                            <Link
                                to={`/quran/${lastPosition.surah_id}`}
                                className="btn btn-primary"
                            >
                                Continue Reading: {lastPosition.surah_name}
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
