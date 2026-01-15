import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getSequentialProgress } from '../api/client';

/**
 * ContinueJourney - Prominent one-tap resume button
 * Shows true sequential progress percentage
 * Can be placed on Home, Account, or as floating button
 *
 * @param {string} variant - 'card' for full card, 'compact' for small button
 */
export function ContinueJourney({ variant = 'card' }) {
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const requestInFlight = useRef(false);

    useEffect(() => {
        // Prevent duplicate requests (React StrictMode runs effects twice)
        if (requestInFlight.current) return;

        let cancelled = false;
        requestInFlight.current = true;

        const loadProgress = async () => {
            try {
                const data = await getSequentialProgress();
                if (!cancelled) {
                    setProgress(data);
                }
            } catch (err) {
                console.error('Failed to load progress:', err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    requestInFlight.current = false;
                }
            }
        };

        loadProgress();

        return () => {
            cancelled = true;
        };
    }, []);

    if (loading || !progress) {
        return null;
    }

    const isComplete = progress.sequential_percentage === 100;

    if (variant === 'compact') {
        return (
            <Link
                to={`/quran/${progress.first_incomplete_surah}`}
                className="btn-continue-journey"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'var(--accent-color)',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '50px',
                    textDecoration: 'none',
                    fontWeight: '600',
                    boxShadow: 'var(--shadow-glow-accent)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 24px 48px -12px rgba(249, 115, 22, 0.4)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-glow-accent)';
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>{isComplete ? 'Completed!' : `Continue (${progress.sequential_percentage}%)`}</span>
            </Link>
        );
    }

    // Full card variant
    return (
        <Link
            to={`/quran/${progress.first_incomplete_surah}`}
            className="continue-journey-card"
            style={{
                display: 'block',
                background: `linear-gradient(135deg, var(--accent-color), var(--accent-hover))`,
                borderRadius: 'var(--radius-lg)',
                padding: '32px',
                color: 'white',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-glow-accent)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 24px 48px -12px rgba(249, 115, 22, 0.4)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-glow-accent)';
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
                        {isComplete ? '🎉 Quran Complete!' : 'Continue Your Journey'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                        {isComplete
                            ? 'Mashallah! You have completed the entire Quran.'
                            : `Resume from Surah ${progress.first_incomplete_surah}, Ayah ${progress.first_incomplete_ayah}`
                        }
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '48px', fontWeight: '700', lineHeight: 1 }}>
                        {progress.sequential_percentage}%
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>
                        {progress.sequential_completion_count.toLocaleString()} / 6,236 ayahs
                    </div>
                </div>
            </div>
            <div style={{
                marginTop: '24px',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${progress.sequential_percentage}%`,
                    height: '100%',
                    background: 'white',
                    borderRadius: '4px',
                    transition: 'width 0.5s ease'
                }} />
            </div>
        </Link>
    );
}
