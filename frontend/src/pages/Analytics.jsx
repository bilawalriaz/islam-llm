import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getReplayStats } from '../api/client';
import { LoadingState, EmptyState } from '../components/Spinner';
import { Card } from '../components/Card';

/**
 * Analytics - View listening patterns and replay statistics
 * Shows most replayed ayahs and listening insights
 */
export default function Analytics() {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAnalytics = async () => {
            try {
                const data = await getReplayStats(10);
                setStats(data);
            } catch (err) {
                console.error('Failed to load analytics:', err);
            } finally {
                setLoading(false);
            }
        };
        loadAnalytics();
    }, []);

    if (loading) {
        return <LoadingState message="Loading analytics..." />;
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Listening Analytics</h1>
                <p className="page-subtitle">Track your Quran listening patterns and favorites</p>
            </div>

            {/* Most Replayed Ayahs */}
            <Card title="Most Replayed Ayahs">
                {stats.length > 0 ? (
                    <div className="replay-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {stats.map((stat, index) => (
                            <Link
                                key={stat.ayah_id}
                                to={`/quran/${stat.surah_id}`}
                                className="replay-item"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '16px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-white)',
                                    border: '1px solid var(--border-color)',
                                    textDecoration: 'none',
                                    color: 'var(--text-primary)',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-soft)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div
                                    className="replay-rank"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: index < 3 ? 'var(--accent-color)' : 'var(--color-bg)',
                                        color: index < 3 ? 'white' : 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        fontSize: '14px',
                                    }}
                                >
                                    #{index + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                        {stat.english_name}
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                        Ayah {stat.number_in_surah}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: '700', fontSize: '18px' }}>
                                        {stat.play_count}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        plays
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <EmptyState message="No replay data yet. Start listening to track your patterns!" />
                )}
            </Card>

            {/* Tips */}
            <Card title="Tips">
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '8px' }}>Listen to ayahs multiple times to track your favorites</li>
                    <li style={{ marginBottom: '8px' }}>Use the "Play Quran" mode to listen continuously</li>
                    <li>Revisit this page to see your most listened verses</li>
                </ul>
            </Card>
        </div>
    );
}
