import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicShareStats } from '../api/client';

/**
 * SharedProfile - Public profile page for sharing Quran progress
 * This page does NOT require authentication
 * Displays user stats based on their share settings
 */
export default function SharedProfile() {
    const { shareId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDisabled, setIsDisabled] = useState(false);

    // Theme styles mapping - Enhanced with new themes
    const themeStyles = {
        classic: {
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)',
            text: '#1c1917',
            textSecondary: '#44403c',
            accent: '#f97316',
            cardBg: 'rgba(255, 255, 255, 0.9)',
            shadow: '0 4px 6px -1px rgba(249, 115, 22, 0.15), 0 2px 4px -1px rgba(249, 115, 22, 0.1)',
        },
        nature: {
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
            text: '#ffffff',
            textSecondary: '#d1fae5',
            accent: '#fbbf24',
            cardBg: 'rgba(6, 78, 59, 0.6)',
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        },
        dark: {
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            text: '#ffffff',
            textSecondary: '#94a3b8',
            accent: '#f97316',
            cardBg: 'rgba(30, 41, 59, 0.9)',
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        },
        minimal: {
            background: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%)',
            text: '#1c1917',
            textSecondary: '#44403c',
            accent: '#71717a',
            cardBg: '#ffffff',
            shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
        ocean: {
            background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)',
            text: '#ffffff',
            textSecondary: '#bae6fd',
            accent: '#38bdf8',
            cardBg: 'rgba(12, 74, 110, 0.6)',
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        },
        royal: {
            background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 50%, #7e22ce 100%)',
            text: '#ffffff',
            textSecondary: '#e9d5ff',
            accent: '#c084fc',
            cardBg: 'rgba(88, 28, 135, 0.6)',
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        },
    };

    useEffect(() => {
        const loadProfile = async () => {
            try {
                setLoading(true);
                const data = await getPublicShareStats(shareId);
                setProfile(data);

                // Update document title and meta tags for social sharing
                if (data.user?.name) {
                    const completion = data.stats?.completion?.completion_percentage || 0;
                    document.title = `${data.user.name}'s Quran Journey - ${completion}% Complete`;

                    // Update or create OG meta tags
                    updateMetaTag('og:title', `${data.user.name}'s Quran Journey`);
                    updateMetaTag('og:description', `${completion}% complete • ${data.stats?.streak || 0} day streak • Track your Quran journey`);
                    updateMetaTag('og:image', `${window.location.origin}/api/share/og/${shareId}.png`);
                    updateMetaTag('og:type', 'website');
                }
            } catch (err) {
                if (err.message?.includes('disabled') || err.message?.includes('403')) {
                    setIsDisabled(true);
                }
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [shareId]);

    // Helper to update meta tags
    const updateMetaTag = (property, content) => {
        let element = document.querySelector(`meta[property="${property}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute('property', property);
            document.head.appendChild(element);
        }
        element.setAttribute('content', content);
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p style={{ marginTop: '20px', color: '#64748b' }}>Loading profile...</p>
            </div>
        );
    }

    // Profile disabled state
    if (isDisabled) {
        return (
            <div style={{
                ...styles.container,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                minHeight: '100vh',
            }}>
                <div style={styles.content}>
                    <div style={{
                        ...styles.card,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        textAlign: 'center',
                        padding: '60px 40px',
                    }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" style={{ marginBottom: '24px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 16px 0', color: '#1c1917' }}>
                            Profile Unavailable
                        </h1>
                        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '32px', lineHeight: 1.6 }}>
                            This share profile has been temporarily disabled by the owner.
                        </p>
                        <Link to="/" style={styles.ctaButton}>
                            Start Your Own Quran Journey
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.errorContainer}>
                <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Profile Not Found</h1>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>
                    This share profile doesn't exist or has been removed.
                </p>
                <Link to="/" style={styles.ctaButton}>
                    Start Your Quran Journey
                </Link>
            </div>
        );
    }

    if (!profile) {
        return null;
    }

    const theme = themeStyles[profile.theme] || themeStyles.classic;
    const stats = profile.stats || {};

    return (
        <div style={{ ...styles.container, background: theme.background, minHeight: '100vh' }}>
            <div style={styles.content}>
                {/* Header Card */}
                <div style={{ ...styles.headerCard, backgroundColor: theme.cardBg, color: theme.text, boxShadow: theme.shadow }}>
                    <div style={styles.headerLeft}>
                        <h1 style={{ ...styles.userName, color: theme.text }}>
                            {profile.user.name || 'Quran Reader'}
                        </h1>
                        <p style={{ ...styles.subtitle, color: theme.textSecondary }}>
                            Quran Journey
                        </p>
                    </div>

                    {/* Completion Badge */}
                    {stats.completion && (
                        <div style={{ ...styles.completionBadge, backgroundColor: theme.accent }}>
                            <span style={styles.completionPercentage}>
                                {stats.completion.completion_percentage}%
                            </span>
                            <span style={styles.completionLabel}>Complete</span>
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div style={styles.statsGrid}>
                    {/* Reading Progress Stats */}
                    {(stats.reading || stats.completion) && (
                        <>
                            {stats.completion && (
                                <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, boxShadow: theme.shadow }}>
                                    <div style={{ ...styles.statIcon, color: theme.accent }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v6l4 2" />
                                        </svg>
                                    </div>
                                    <div style={styles.statContent}>
                                        <p style={{ ...styles.statValue, color: theme.text }}>
                                            {stats.completion.ayahs_completed?.toLocaleString() || 0}
                                        </p>
                                        <p style={{ ...styles.statLabel, color: theme.textSecondary }}>
                                            Ayahs Completed
                                        </p>
                                    </div>
                                </div>
                            )}

                            {stats.reading && (
                                <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, boxShadow: theme.shadow }}>
                                    <div style={{ ...styles.statIcon, color: theme.accent }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                        </svg>
                                    </div>
                                    <div style={styles.statContent}>
                                        <p style={{ ...styles.statValue, color: theme.text }}>
                                            {stats.reading.total_surahs_read || 0}
                                        </p>
                                        <p style={{ ...styles.statLabel, color: theme.textSecondary }}>
                                            Surahs Read
                                        </p>
                                    </div>
                                </div>
                            )}

                            {stats.streak !== undefined && (
                                <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, boxShadow: theme.shadow }}>
                                    <div style={{ ...styles.statIcon, color: theme.accent }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3.5 4 4 6.5.5-2.5 1.5-5 2-6.5a6 6 0 0 0-2-4c-1-1-2-2-2-4a2.5 2.5 0 0 0 5 0" />
                                        </svg>
                                    </div>
                                    <div style={styles.statContent}>
                                        <p style={{ ...styles.statValue, color: theme.text }}>
                                            {stats.streak}
                                        </p>
                                        <p style={{ ...styles.statLabel, color: theme.textSecondary }}>
                                            Day Streak
                                        </p>
                                    </div>
                                </div>
                            )}

                            {stats.bookmarks !== undefined && (
                                <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, boxShadow: theme.shadow }}>
                                    <div style={{ ...styles.statIcon, color: theme.accent }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </div>
                                    <div style={styles.statContent}>
                                        <p style={{ ...styles.statValue, color: theme.text }}>
                                            {stats.bookmarks}
                                        </p>
                                        <p style={{ ...styles.statLabel, color: theme.textSecondary }}>
                                            Bookmarks
                                        </p>
                                    </div>
                                </div>
                            )}

                            {stats.listening && (
                                <>
                                    <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, boxShadow: theme.shadow }}>
                                        <div style={{ ...styles.statIcon, color: theme.accent }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                            </svg>
                                        </div>
                                        <div style={styles.statContent}>
                                            <p style={{ ...styles.statValue, color: theme.text }}>
                                                {stats.listening.total_plays?.toLocaleString() || 0}
                                            </p>
                                            <p style={{ ...styles.statLabel, color: theme.textSecondary }}>
                                            Total Plays
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, boxShadow: theme.shadow }}>
                                        <div style={{ ...styles.statIcon, color: theme.accent }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12,6 12,12 16,14" />
                                            </svg>
                                        </div>
                                        <div style={styles.statContent}>
                                            <p style={{ ...styles.statValue, color: theme.text }}>
                                                {stats.listening.total_minutes?.toLocaleString() || 0}
                                            </p>
                                            <p style={{ ...styles.statLabel, color: theme.textSecondary }}>
                                                Minutes Listened
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Call to Action */}
                <div style={{ ...styles.ctaCard, backgroundColor: theme.cardBg, boxShadow: theme.shadow }}>
                    <h3 style={{ ...styles.ctaTitle, color: theme.text }}>Start Your Quran Journey</h3>
                    <p style={{ ...styles.ctaDescription, color: theme.textSecondary }}>
                        Track your reading progress, listen to beautiful recitations, and bookmark your favorite verses.
                    </p>
                    <Link to="/" style={{ ...styles.ctaButton, backgroundColor: theme.accent }}>
                        Get Started Free
                    </Link>
                    <p style={styles.footerText}>
                        Powered by <a href="https://quran.hyperflash.uk" style={{ color: theme.accent, textDecoration: 'none' }}>Quran Reader</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
    },
    content: {
        width: '100%',
        maxWidth: '800px',
    },
    headerCard: {
        borderRadius: '24px',
        padding: '40px',
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flex: 1,
    },
    userName: {
        fontSize: '36px',
        fontWeight: '700',
        margin: 0,
        marginBottom: '8px',
    },
    subtitle: {
        fontSize: '18px',
        margin: 0,
    },
    completionBadge: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '16px',
        padding: '20px 30px',
        minWidth: '120px',
    },
    completionPercentage: {
        fontSize: '42px',
        fontWeight: '700',
        color: '#ffffff',
        lineHeight: 1,
    },
    completionLabel: {
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: '4px',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
    },
    statCard: {
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    statIcon: {
        flexShrink: 0,
    },
    statContent: {
        flex: 1,
    },
    statValue: {
        fontSize: '32px',
        fontWeight: '700',
        margin: 0,
        lineHeight: 1,
    },
    statLabel: {
        fontSize: '14px',
        margin: '4px 0 0 0',
    },
    ctaCard: {
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
    },
    ctaTitle: {
        fontSize: '28px',
        fontWeight: '700',
        margin: '0 0 12px 0',
    },
    ctaDescription: {
        fontSize: '16px',
        marginBottom: '24px',
        lineHeight: 1.5,
    },
    ctaButton: {
        display: 'inline-block',
        padding: '14px 32px',
        borderRadius: '12px',
        color: '#ffffff',
        textDecoration: 'none',
        fontSize: '16px',
        fontWeight: '600',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    footerText: {
        fontSize: '14px',
        color: '#64748b',
        marginTop: '24px',
        marginBottom: 0,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e2e8f0',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#f97316',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        textAlign: 'center',
        padding: '20px',
    },
};

// Add keyframe animation for spinner
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
