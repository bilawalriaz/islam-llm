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
    const sessionToken = localStorage.getItem('session_token');

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

    // Password change state
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

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
                    'Authorization': `Bearer ${sessionToken}`,
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

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordMessage('');
        setPasswordLoading(true);

        // Validate
        if (passwordForm.newPassword.length < 6) {
            setPasswordMessage('Password must be at least 6 characters');
            setPasswordLoading(false);
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordMessage('Passwords do not match');
            setPasswordLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({
                    current_password: passwordForm.currentPassword,
                    new_password: passwordForm.newPassword
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setPasswordMessage('Password updated successfully!');
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setPasswordMessage(data.error || data.detail || 'Failed to update password');
            }
        } catch (err) {
            setPasswordMessage('Failed to update password. Please try again.');
        } finally {
            setPasswordLoading(false);
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
                <Link to="/journey" className="btn btn-primary">
                    View Detailed Journey
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

                {/* Account Settings */}
                <Card title="Account Settings">
                    <div className="account-settings">
                        <div className="account-info" style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <p className="small text-muted mb-1">Email</p>
                            <p style={{ fontSize: '1rem', fontWeight: '500' }}>{user?.email}</p>
                        </div>

                        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '16px' }}>Change Password</h4>
                        <p className="small text-muted mb-4">
                            Set a password to sign in with email instead of Google, or update your existing password.
                        </p>

                        <form className="password-change-form" onSubmit={handlePasswordChange}>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label htmlFor="currentPassword" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Current Password
                                </label>
                                <input
                                    id="currentPassword"
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    placeholder="Enter current password (leave empty if signing in with Google)"
                                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.9375rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label htmlFor="newPassword" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    New Password
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    placeholder="Must be at least 6 characters"
                                    required
                                    minLength={6}
                                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.9375rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Confirm New Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    placeholder="Confirm new password"
                                    required
                                    minLength={6}
                                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.9375rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                                />
                            </div>

                            {passwordMessage && (
                                <div className={`alert ${passwordMessage.includes('success') ? 'alert-success' : 'alert-error'}`} style={{ padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.875rem' }}>
                                    {passwordMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-secondary"
                                disabled={passwordLoading}
                                style={{ width: '100%' }}
                            >
                                {passwordLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default Account;
