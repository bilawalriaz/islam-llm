import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicShareStats } from '../api/client';
import { motion } from 'framer-motion';
import {
    BentoGrid,
    BentoGridItem,
    SkeletonProgress,
    SkeletonStreak,
    SkeletonBook,
    SkeletonAudio,
    SkeletonBookmarks,
    SkeletonCircularProgress
} from '../components/ui/bento-grid';

/**
 * SharedProfile - Public profile page for sharing Quran progress
 * Redesigned with beautiful bento box layout
 * This page does NOT require authentication
 */
export default function SharedProfile() {
    const { shareId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDisabled, setIsDisabled] = useState(false);

    // Theme styles mapping - 3 sleek, modern themes
    const themeStyles = {
        classic: {
            name: 'Classic',
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
            cardBg: 'rgba(255, 255, 255, 0.85)',
            cardBorder: 'rgba(251, 191, 36, 0.2)',
            text: '#1c1917',
            textSecondary: '#57534e',
            accent: '#f97316',
            accentGlow: 'rgba(249, 115, 22, 0.3)',
        },
        dark: {
            name: 'Dark',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            cardBg: 'rgba(30, 41, 59, 0.8)',
            cardBorder: 'rgba(249, 115, 22, 0.15)',
            text: '#f8fafc',
            textSecondary: '#94a3b8',
            accent: '#f97316',
            accentGlow: 'rgba(249, 115, 22, 0.25)',
        },
        nature: {
            name: 'Nature',
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 30%, #047857 70%, #064e3b 100%)',
            cardBg: 'rgba(6, 78, 59, 0.75)',
            cardBorder: 'rgba(251, 191, 36, 0.2)',
            text: '#ecfdf5',
            textSecondary: '#a7f3d0',
            accent: '#fbbf24',
            accentGlow: 'rgba(251, 191, 36, 0.3)',
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
                <motion.div
                    style={styles.spinner}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
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
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            ...styles.errorCard,
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            textAlign: 'center',
                            padding: '60px 40px',
                        }}
                    >
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
                    </motion.div>
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

    // Get theme, default to classic if theme not found
    const themeKey = themeStyles[profile.theme] ? profile.theme : 'classic';
    const theme = themeStyles[themeKey];
    const stats = profile.stats || {};

    // Build bento grid items based on available stats
    const bentoItems = [];

    // Header card (always shown) - spans 2 columns
    bentoItems.push({
        id: 'header',
        colSpan: 2,
        content: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                <div>
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                            margin: 0,
                            fontSize: '36px',
                            fontWeight: '700',
                            color: theme.text,
                            marginBottom: '8px'
                        }}
                    >
                        {profile.user.name || 'Quran Reader'}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        style={{
                            margin: 0,
                            fontSize: '18px',
                            color: theme.textSecondary
                        }}
                    >
                        Quran Journey
                    </motion.p>
                </div>
                {stats.completion && (
                    <SkeletonCircularProgress
                        percent={stats.completion.completion_percentage || 0}
                        color={theme.accent}
                        size={100}
                    />
                )}
            </div>
        ),
    });

    // Completion/Ayahs card
    if (stats.completion) {
        bentoItems.push({
            id: 'ayahs',
            colSpan: 1,
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                </svg>
            ),
            title: 'Ayahs Completed',
            value: stats.completion.ayahs_completed?.toLocaleString() || 0,
            subtitle: 'of 6,236 total',
            header: <SkeletonProgress color={theme.accent} />,
        });
    }

    // Surahs read
    if (stats.reading) {
        bentoItems.push({
            id: 'surahs',
            colSpan: 1,
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
            ),
            title: 'Surahs Read',
            value: stats.reading.total_surahs_read || 0,
            subtitle: 'of 114 total',
            header: <SkeletonBook color={theme.accent} />,
        });
    }

    // Streak
    if (stats.streak !== undefined) {
        bentoItems.push({
            id: 'streak',
            colSpan: 1,
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill={theme.accent}>
                    <path d="M12 2C12 2 4 9 4 14C4 17.5 7.5 21 12 21C16.5 21 20 17.5 20 14C20 9 12 2 12 2Z" />
                </svg>
            ),
            title: 'Day Streak',
            value: stats.streak,
            subtitle: stats.streak === 1 ? 'day' : 'days',
            header: <SkeletonStreak color={theme.accent} />,
        });
    }

    // Bookmarks
    if (stats.bookmarks !== undefined) {
        bentoItems.push({
            id: 'bookmarks',
            colSpan: 1,
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
            ),
            title: 'Bookmarks',
            value: stats.bookmarks,
            subtitle: 'saved verses',
            header: <SkeletonBookmarks color={theme.accent} />,
        });
    }

    // Listening stats (spans 2 columns if both available)
    if (stats.listening) {
        bentoItems.push({
            id: 'listening',
            colSpan: 2,
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
            ),
            title: 'Listening',
            header: <SkeletonAudio color={theme.accent} />,
            customContent: (
                <div style={{ display: 'flex', gap: '32px', marginTop: '16px' }}>
                    <div>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: theme.text }}>
                            {stats.listening.total_plays?.toLocaleString() || 0}
                        </div>
                        <div style={{ fontSize: '14px', color: theme.textSecondary }}>Total Plays</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: theme.text }}>
                            {stats.listening.total_minutes?.toLocaleString() || 0}
                        </div>
                        <div style={{ fontSize: '14px', color: theme.textSecondary }}>Minutes</div>
                    </div>
                </div>
            ),
        });
    }

    return (
        <div style={{ ...styles.container, background: theme.background, minHeight: '100vh' }}>
            <div style={styles.content}>
                {/* Bento Grid */}
                <div className="shared-profile-bento" style={styles.bentoGrid}>
                    {bentoItems.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{
                                scale: 1.02,
                                boxShadow: `0 20px 40px -15px ${theme.accentGlow}`,
                            }}
                            style={{
                                gridColumn: `span ${item.colSpan}`,
                                backgroundColor: theme.cardBg,
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                borderRadius: '24px',
                                padding: '24px',
                                border: `1px solid ${theme.cardBorder}`,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: item.colSpan === 2 ? '160px' : '200px',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {/* Special header card */}
                            {item.id === 'header' ? (
                                item.content
                            ) : (
                                <>
                                    {/* Animated header/visual */}
                                    {item.header && (
                                        <div style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: '80px',
                                        }}>
                                            {item.header}
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div style={{ marginTop: 'auto' }}>
                                        {item.icon && (
                                            <div style={{ marginBottom: '8px' }}>
                                                {item.icon}
                                            </div>
                                        )}

                                        {item.value !== undefined && !item.customContent && (
                                            <div style={{
                                                fontSize: '32px',
                                                fontWeight: '700',
                                                color: theme.text,
                                                lineHeight: 1,
                                            }}>
                                                {item.value}
                                            </div>
                                        )}

                                        {item.title && (
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: '600',
                                                color: theme.text,
                                                marginTop: '4px',
                                            }}>
                                                {item.title}
                                            </div>
                                        )}

                                        {item.subtitle && !item.customContent && (
                                            <div style={{
                                                fontSize: '14px',
                                                color: theme.textSecondary,
                                            }}>
                                                {item.subtitle}
                                            </div>
                                        )}

                                        {item.customContent}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    style={{
                        ...styles.ctaCard,
                        backgroundColor: theme.cardBg,
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: `1px solid ${theme.cardBorder}`,
                    }}
                >
                    <h3 style={{ ...styles.ctaTitle, color: theme.text }}>Start Your Quran Journey</h3>
                    <p style={{ ...styles.ctaDescription, color: theme.textSecondary }}>
                        Track your reading progress, listen to beautiful recitations, and bookmark your favorite verses.
                    </p>
                    <Link to="/" style={{ ...styles.ctaButton, backgroundColor: theme.accent }}>
                        Get Started Free
                    </Link>
                    <p style={{ ...styles.footerText, color: theme.textSecondary }}>
                        Powered by <a href="https://quran.hyperflash.uk" style={{ color: theme.accent, textDecoration: 'none' }}>Quran Reader</a>
                    </p>
                </motion.div>
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
        maxWidth: '900px',
    },
    bentoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '32px',
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
    errorCard: {
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    },
    ctaCard: {
        borderRadius: '24px',
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
        marginTop: '24px',
        marginBottom: 0,
    },
};

// Add responsive styles via CSS
const responsiveStyles = document.createElement('style');
responsiveStyles.textContent = `
    @media (max-width: 768px) {
        .shared-profile-bento {
            grid-template-columns: repeat(2, 1fr) !important;
        }
    }
    @media (max-width: 480px) {
        .shared-profile-bento {
            grid-template-columns: 1fr !important;
        }
        .shared-profile-bento > div {
            grid-column: span 1 !important;
        }
    }
`;
if (!document.getElementById('shared-profile-responsive')) {
    responsiveStyles.id = 'shared-profile-responsive';
    document.head.appendChild(responsiveStyles);
}
