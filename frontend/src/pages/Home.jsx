import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';

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
            title: 'Browse the Quran',
            description: 'Visit the Quran page to see all 114 surahs. Search or filter to find what you\'re looking for.'
        },
        {
            step: '2',
            title: 'Select a Surah',
            description: 'Click on any surah to view its ayahs (verses). Each surah shows its name, meaning, and revelation type.'
        },
        {
            step: '3',
            title: 'Read & Listen',
            description: 'Read the Arabic text with translations. Choose your favorite reciter and press play to listen.'
        },
        {
            step: '4',
            title: 'Track Progress (Optional)',
            description: 'Create a free account to save your reading progress, bookmark ayahs, and continue where you left off.'
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
                <div className="timeline">
                    <div className="timeline-line" />
                    {features.map((feature, index) => (
                        <div key={index} className="timeline-item">
                            <div className="timeline-dot">
                                <div className="timeline-icon">{feature.icon}</div>
                            </div>
                            <div className="timeline-content">
                                <h3 className="timeline-title">{feature.title}</h3>
                                <p className="timeline-description">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* How to Use Section */}
            <section className="howto-section">
                <div className="section-header">
                    <h2 className="section-title">How to Use</h2>
                    <p className="section-subtitle">Get started in four simple steps</p>
                </div>
                <div className="steps-container">
                    {howToSteps.map((item, index) => (
                        <div key={index} className="step-item">
                            <div className="step-number">{item.step}</div>
                            <div className="step-content">
                                <h3 className="step-title">{item.title}</h3>
                                <p className="step-description">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Account Benefits Section */}
            <section className="benefits-section">
                <div className="benefits-content">
                    <h2 className="section-title">Why Create an Account?</h2>
                    <p className="section-subtitle">
                        The Quran Reader is free to use without an account. Sign up optionally to:
                    </p>
                    <ul className="benefits-list">
                        <li>📍 Save your reading position and continue where you left off</li>
                        <li>🔖 Bookmark your favorite ayahs and surahs</li>
                        <li>📊 Track your reading progress and set daily goals</li>
                        <li>🎯 Sync your preferences across devices</li>
                    </ul>
                    {!isAuthenticated ? (
                        <div className="benefits-actions">
                            <Link to="/register" className="btn btn-primary btn-large">
                                Create Free Account
                            </Link>
                            <Link to="/login" className="btn btn-secondary btn-large">
                                Sign In
                            </Link>
                        </div>
                    ) : (
                        <div className="benefits-actions">
                            <Link to="/account" className="btn btn-primary btn-large">
                                Go to Your Account
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Footer CTA */}
            <section className="cta-section">
                <Card className="cta-card">
                    <h2>Ready to Start Reading?</h2>
                    <p>Dive into the Quran with a beautiful, distraction-free reading experience.</p>
                    <p style={{ fontSize: '0.875rem', opacity: 0.85, marginBottom: '24px' }}>
                        🔒 No tracking. No ads. Ever. Accounts are only used to save your reading progress.
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
