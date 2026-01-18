import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';

// Lazy load Timeline - only loads when scrolled into view
const Timeline = lazy(() => import('../components/Timeline').then(m => ({ default: m.Timeline })));

// Timeline loading skeleton
function TimelineSkeleton() {
    return (
        <div className="timeline-container">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="timeline-item" style={{ opacity: 0.5 }}>
                    <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                    <h3 className="skeleton" style={{ width: '60%', margin: '0 auto 8px', borderRadius: '8px' }}></h3>
                    <p className="skeleton" style={{ width: '80%', margin: '0 auto', borderRadius: '8px' }}></p>
                </div>
            ))}
        </div>
    );
}

/**
 * Home - Landing page with About and How to Use sections
 * Publicly accessible - no authentication required
 */
function Home() {
    const { isAuthenticated } = useAuth();

    const features = [
        {
            icon: '📖',
            title: 'Complete Quran',
            description: 'Access all 114 surahs with 6,236 ayahs. Read in Arabic with multiple translations.'
        },
        {
            icon: '🎧',
            title: 'Audio Recitation',
            description: 'Listen to beautiful recitations from 30+ renowned reciters including Mishary Alafasy and Abdul Basit.'
        },
        {
            icon: '🔍',
            title: 'Easy Search',
            description: 'Find surahs quickly by name, English name, number, or revelation type (Meccan/Medinan).'
        },
        {
            icon: '🌙',
            title: 'Read Anywhere',
            description: 'Fully responsive design works perfectly on desktop, tablet, and mobile devices.'
        }
    ];

    const howToSteps = [
        {
            step: '1',
            icon: '📚',
            title: 'Browse & Discover',
            description: 'Explore all 114 surahs with powerful search. Filter by name, number, or revelation type to find exactly what you need.',
            tips: ['Search in Arabic or English', 'Filter by Meccan/Medinan', 'Sort by revelation order']
        },
        {
            step: '2',
            icon: '📖',
            title: 'Read, Listen & Reflect',
            description: 'Immerse yourself in the beautiful Arabic text with translations, or listen to world-renowned reciters. Experience the Quran your way.',
            tips: ['Sahih International translation', 'Mishary Alafasy recitation', 'Auto-advance through surahs', 'Multiple languages available']
        },
        {
            step: '3',
            icon: '💾',
            title: 'Track Your Journey',
            description: 'Create a free account to save your progress. Your bookmarks and reading position sync across all your devices.',
            tips: ['Pick up where you left off', 'Bookmark favorite verses', 'Track completion statistics']
        }
    ];

    const accountBenefits = [
        {
            icon: '📍',
            title: 'Resume Where You Left Off',
            description: 'Never lose your place. Your last reading position is automatically saved, so you can continue exactly where you stopped.',
            highlight: true
        },
        {
            icon: '🔖',
            title: 'Bookmark Favorite Verses',
            description: 'Save ayahs that resonate with you. Access your bookmarks anytime from your account dashboard.',
            highlight: false
        },
        {
            icon: '📊',
            title: 'Track Your Progress',
            description: 'Visualize your Quran journey. See which surahs you\'ve completed, track streaks, and monitor your overall progress.',
            highlight: false
        },
        {
            icon: '🎯',
            title: 'Listening Analytics',
            description: 'View your most-played ayahs and track how much you\'ve listened. Discover which verses you return to most often.',
            highlight: false
        },
        {
            icon: '📤',
            title: 'Share Your Progress',
            description: 'Generate a beautiful shareable profile to inspire others. Show off your Quran reading journey with friends and family.',
            highlight: false
        },
        {
            icon: '🔒',
            title: '100% Private & Secure',
            description: 'Your data is yours. No tracking, no ads, no selling your information. Just a pure Quran experience.',
            highlight: true
        }
    ];

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <h1 className="hero-title">Quran Reader</h1>
                    <p className="hero-subtitle">
                        Read, listen, and connect with the Holy Quran. A beautiful, accessible reading experience — no sign-up required.
                    </p>
                    <div className="hero-actions">
                        <Link to="/quran" className="btn btn-primary btn-large">
                            Start Reading
                        </Link>
                        {!isAuthenticated && (
                            <Link to="/register" className="btn btn-secondary btn-large">
                                Create Free Account
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            {/* Features Timeline */}
            <section className="features-section">
                <Suspense fallback={<TimelineSkeleton />}>
                    <Timeline data={features} />
                </Suspense>
            </section>

            {/* How to Use Section - Enhanced */}
            <section className="howto-section">
                <div className="section-header">
                    <h2 className="section-title">How to Use</h2>
                    <p className="section-subtitle">Your journey through the Quran in four simple steps</p>
                </div>
                <div className="steps-enhanced-container">
                    {howToSteps.map((item, index) => (
                        <div key={index} className="step-card" style={{
                            background: 'var(--bg-white)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '32px',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }} onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-soft)';
                        }} onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                        }}>
                            {/* Step number badge */}
                            <div style={{
                                position: 'absolute',
                                top: '24px',
                                right: '24px',
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'var(--gradient-accent)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.5rem',
                                fontWeight: '800'
                            }}>
                                {item.step}
                            </div>

                            {/* Icon */}
                            <div style={{
                                fontSize: '3rem',
                                marginBottom: '16px'
                            }}>
                                {item.icon}
                            </div>

                            {/* Content */}
                            <h3 style={{
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                marginBottom: '12px',
                                color: 'var(--text-primary)'
                            }}>
                                {item.title}
                            </h3>
                            <p style={{
                                fontSize: '1rem',
                                lineHeight: '1.6',
                                color: 'var(--text-secondary)',
                                marginBottom: '20px'
                            }}>
                                {item.description}
                            </p>

                            {/* Tips */}
                            <div style={{
                                background: 'rgba(249, 115, 22, 0.05)',
                                borderRadius: '8px',
                                padding: '16px'
                            }}>
                                <div style={{
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--accent-color)',
                                    marginBottom: '8px'
                                }}>
                                    Features
                                </div>
                                <ul style={{
                                    margin: '0',
                                    padding: '0',
                                    listStyle: 'none'
                                }}>
                                    {item.tips.map((tip, i) => (
                                        <li key={i} style={{
                                            fontSize: '0.875rem',
                                            color: 'var(--text-secondary)',
                                            marginBottom: i < item.tips.length - 1 ? '4px' : '0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <span style={{ color: 'var(--accent-color)' }}>✓</span>
                                            {tip}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Account Benefits Section - Enhanced */}
            <section className="benefits-section" style={{
                padding: '48px 0',
                background: 'linear-gradient(180deg, var(--color-bg) 0%, rgba(249, 115, 22, 0.03) 100%)'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <h2 style={{
                            fontSize: '2rem',
                            fontWeight: '800',
                            marginBottom: '16px',
                            background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            Why Create an Account?
                        </h2>
                        <p style={{
                            fontSize: '1.125rem',
                            color: 'var(--text-secondary)',
                            maxWidth: '600px',
                            margin: '0 auto',
                            lineHeight: '1.6'
                        }}>
                            The Quran Reader is completely free without an account. Sign up optionally to unlock powerful features that enhance your reading experience.
                        </p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: '24px',
                        marginBottom: '40px'
                    }}>
                        {accountBenefits.map((benefit, index) => (
                            <div key={index} style={{
                                background: benefit.highlight
                                    ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.02) 100%)'
                                    : 'var(--bg-white)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '24px',
                                border: benefit.highlight
                                    ? '1px solid rgba(249, 115, 22, 0.2)'
                                    : '1px solid var(--border-color)',
                                boxShadow: benefit.highlight
                                    ? 'var(--shadow-glow-accent)'
                                    : '0 2px 8px rgba(0, 0, 0, 0.04)',
                                transition: 'all 0.3s ease'
                            }} onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                if (!benefit.highlight) {
                                    e.currentTarget.style.boxShadow = 'var(--shadow-soft)';
                                }
                            }} onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = benefit.highlight
                                    ? 'var(--shadow-glow-accent)'
                                    : '0 2px 8px rgba(0, 0, 0, 0.04)';
                            }}>
                                <div style={{
                                    fontSize: '2rem',
                                    marginBottom: '16px'
                                }}>
                                    {benefit.icon}
                                </div>
                                <h3 style={{
                                    fontSize: '1.125rem',
                                    fontWeight: '700',
                                    marginBottom: '8px',
                                    color: 'var(--text-primary)'
                                }}>
                                    {benefit.title}
                                </h3>
                                <p style={{
                                    fontSize: '0.9375rem',
                                    lineHeight: '1.6',
                                    color: 'var(--text-secondary)',
                                    margin: '0'
                                }}>
                                    {benefit.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    {!isAuthenticated ? (
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <Link to="/register" className="btn btn-primary btn-large">
                                Create Free Account
                            </Link>
                            <Link to="/login" className="btn btn-secondary btn-large">
                                Sign In
                            </Link>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            <Link to="/account" className="btn btn-primary btn-large">
                                Go to Your Account
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Privacy Commitment Section */}
            <section className="privacy-section" style={{
                padding: '80px 0',
                background: 'var(--bg-white)',
                textAlign: 'center'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        fontSize: '2rem',
                        marginBottom: '24px'
                    }}>
                        🔒
                    </div>
                    <h2 style={{
                        fontSize: '2.25rem',
                        fontWeight: '800',
                        marginBottom: '24px',
                        color: 'var(--text-primary)'
                    }}>
                        Privacy by Design, Not by Choice
                    </h2>
                    <p style={{
                        fontSize: '1.125rem',
                        lineHeight: '1.8',
                        color: 'var(--text-secondary)',
                        marginBottom: '32px'
                    }}>
                        We believe that your spiritual journey should be sacred and private. Unlike many other platforms, <strong>Quran Reader will never show ads, never track your personal behavior, and never sell your data.</strong>
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '32px',
                        textAlign: 'left'
                    }}>
                        <div>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#10b981' }}>✓</span> No User Tracking
                            </h4>
                            <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
                                We don't use invasive trackers. We use simple Cloudflare Analytics to see basic page view counts without identifying you.
                            </p>
                        </div>
                        <div>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#10b981' }}>✓</span> No Advertisements
                            </h4>
                            <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
                                Your connection with the Quran should be distraction-free. No banners, no popups, no sponsored content. Ever.
                            </p>
                        </div>
                        <div>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#10b981' }}>✓</span> No Data Selling
                            </h4>
                            <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
                                By the will of God, we are committed to keeping this service pure. We will never "sell out" your personal information.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="cta-section">
                <Card className="cta-card">
                    <h2>Ready to Start Reading?</h2>
                    <p>Dive into the Quran with a beautiful, distraction-free reading experience.</p>
                    <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '24px', fontWeight: '500' }}>
                        🛡️ Your journey is private. No tracking, no ads, always free.
                    </p>
                    <Link to="/quran" className="btn btn-primary btn-large">
                        Browse Quran
                    </Link>
                </Card>
            </section>
        </div>
    );
}

export default Home;
