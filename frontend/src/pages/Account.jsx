import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card, StatCard } from '../components/Card';
import { getBookmarks, getProgressStats, getLastPosition } from '../api/client';
import { LoadingState } from '../components/Spinner';

// Total ayahs in Quran for percentage calculation
const TOTAL_AYAHS_IN_QURAN = 6236;

/**
 * Account - User account page for tracking reading progress
 * Protected route - requires authentication
 */
function Account() {
    const { user } = useAuth();

    const [stats, setStats] = useState({
        total_ayahs_read: 0,
        total_surahs_read: 0,
        total_bookmarks: 0,
        reading_streak: 0,
    });
    const [lastPosition, setLastPosition] = useState(null);
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAllBookmarks, setShowAllBookmarks] = useState(false);

    useEffect(() => {
        loadAccountData();
    }, []);

    const loadAccountData = async () => {
        try {
            const [statsData, lastPosData, bookmarksData] = await Promise.all([
                getProgressStats(),
                getLastPosition().catch(() => null), // May return null if no progress
                getBookmarks(),
            ]);

            setStats(statsData);
            setLastPosition(lastPosData);
            setBookmarks(bookmarksData);
        } catch (err) {
            console.error('Failed to load account data:', err);
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

            // Reload bookmarks
            const bookmarksData = await getBookmarks();
            setBookmarks(bookmarksData);

            // Reload stats
            const statsData = await getProgressStats();
            setStats(statsData);
        } catch (err) {
            console.error('Failed to delete bookmark:', err);
        }
    };

    if (loading) {
        return <LoadingState message="Loading your account..." />;
    }

    return (
        <div className="account-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Your Progress</h1>
                    <p className="page-subtitle">Track your Quran reading progress and continue where you left off, {user?.name || user?.email}.</p>
                </div>
            </div>

            <div className="stats-grid">
                <StatCard value={`${Math.round((stats.total_ayahs_read / TOTAL_AYAHS_IN_QURAN) * 100)}%`} label="Overall Complete" />
                <StatCard value={stats.total_ayahs_read.toString()} label="Ayahs Read" />
                <StatCard value={stats.total_surahs_read.toString()} label="Surahs Started" />
                <StatCard value={stats.reading_streak.toString()} label="Day Streak" />
            </div>

            <div className="account-actions">
                <Link to="/progress" className="btn btn-primary">
                    View Detailed Progress
                </Link>
            </div>

            <div className="account-grid">
                {/* Continue Reading */}
                <Card title="Continue Reading">
                    {lastPosition ? (
                        <div className="continue-reading">
                            <p className="text-muted mb-3">
                                You were reading <strong>{lastPosition.surah_name}</strong>
                            </p>
                            <p className="small text-muted mb-4">
                                Last read: Ayah {lastPosition.last_read_ayah_number} of {lastPosition.number_of_ayahs}
                            </p>
                            <Link
                                to={`/quran/${lastPosition.surah_id}`}
                                className="btn btn-primary"
                            >
                                Continue Reading
                            </Link>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p className="text-muted">You haven't started reading yet.</p>
                            <Link to="/quran" className="btn btn-primary mt-4">
                                Start Reading
                            </Link>
                        </div>
                    )}
                </Card>

                {/* Bookmarks */}
                <Card title={bookmarks.length > 0 ? `Your Bookmarks (${bookmarks.length})` : "Bookmarks"}>
                    {bookmarks.length > 0 ? (
                        <>
                            <div className="bookmarks-list">
                                {(showAllBookmarks ? bookmarks : bookmarks.slice(0, 5)).map((bookmark) => (
                                    <div key={bookmark.id} className="bookmark-item">
                                        <div className="bookmark-info">
                                            <span className="bookmark-surah-number">{bookmark.surah_id}</span>
                                            <div className="bookmark-details">
                                                <Link
                                                    to={`/quran/${bookmark.surah_id}`}
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

                {/* Reading Goals - Coming Soon */}
                <Card title="Reading Goals">
                    <div className="empty-state">
                        <p className="text-muted">Set daily reading goals and track your progress.</p>
                        <p className="small text-muted mt-4">Coming soon!</p>
                    </div>
                </Card>

                {/* Preferences - Coming Soon */}
                <Card title="Preferences">
                    <div className="empty-state">
                        <p className="text-muted">Customize your reading experience:</p>
                        <ul style={{ textAlign: 'left', marginTop: '16px', lineHeight: '1.8' }}>
                            <li>Default reciter selection</li>
                            <li>Translation language preference</li>
                            <li>Text size and theme options</li>
                            <li>Auto-play settings</li>
                        </ul>
                        <p className="small text-muted mt-4">Coming soon!</p>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default Account;
