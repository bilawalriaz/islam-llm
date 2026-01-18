import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LoadingState, EmptyState } from '../components/Spinner';

/**
 * EventDetailPage - Shows detailed information about a single Islamic historical event
 */
function EventDetailPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/events/${eventId}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        setEvent(null);
                    }
                    return;
                }
                const data = await response.json();
                setEvent(data);
            } catch (error) {
                console.error('Error fetching event:', error);
                setEvent(null);
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    const getCategoryBadgeClass = (category) => {
        const badgeMap = {
            'milestone': 'primary',
            'battle': 'danger',
            'death': 'muted',
            'birth': 'success',
            'conquest': 'primary',
            'treaty': 'warning',
            'caliph': 'primary'
        };
        return badgeMap[category] || 'muted';
    };

    const getCategoryLabel = (category) => {
        const labels = {
            'milestone': 'Major Milestone',
            'battle': 'Battle',
            'death': 'Death',
            'birth': 'Birth',
            'conquest': 'Conquest',
            'treaty': 'Treaty',
            'caliph': 'Caliph'
        };
        return labels[category] || category;
    };

    if (loading) {
        return <LoadingState message="Loading event..." />;
    }

    if (!event) {
        return (
            <>
                <div className="page-header">
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-secondary btn-small"
                        style={{ marginBottom: '16px' }}
                    >
                        ← Back to Events
                    </button>
                    <h1 className="page-title">Event Not Found</h1>
                </div>
                <EmptyState message="This event could not be found. It may have been removed or the ID is incorrect." />
            </>
        );
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                    <div>
                        <Link
                            to="/events"
                            className="btn btn-secondary btn-small"
                            style={{ marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                            ← Back to Events
                        </Link>
                        <h1 className="page-title">{event.title}</h1>
                        <p className="page-subtitle">
                            {event.gregorian ? `${event.gregorian.day}/${event.gregorian.month}/${event.gregorian.year} CE` : ''}
                            {event.hijri && event.hijri.year ? ` • ${event.hijri.day}/${event.hijri.month}/${event.hijri.year} AH` : ''}
                            {event.display ? ` • ${event.display}` : ''}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="card">
                    <div className="card-body">
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '16px' }}>Description</h3>
                        <p style={{
                            lineHeight: '1.8',
                            color: 'var(--text-secondary)',
                            fontSize: '1rem'
                        }}>
                            {event.description || 'No description available for this event.'}
                        </p>
                    </div>
                </div>

                <div>
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div className="card-body">
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Event Type
                            </h3>
                            <span className={`status-badge ${getCategoryBadgeClass(event.category)}`} style={{ fontSize: '0.875rem' }}>
                                {getCategoryLabel(event.category)}
                            </span>
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div className="card-body">
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Gregorian Date
                            </h3>
                            {event.gregorian ? (
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                        {event.gregorian.day}/{event.gregorian.month}/{event.gregorian.year}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Common Era</div>
                                </div>
                            ) : (
                                <span className="text-muted">Not specified</span>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div className="card-body">
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Hijri Date
                            </h3>
                            {event.hijri && event.hijri.year ? (
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                        {event.hijri.day}/{event.hijri.month}/{event.hijri.year}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>After Hijrah</div>
                                </div>
                            ) : (
                                <span className="text-muted">Not specified</span>
                            )}
                        </div>
                    </div>

                    {event.years_ago && (
                        <div className="card">
                            <div className="card-body">
                                <h3 style={{ fontSize: '0.875rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                    Years Ago
                                </h3>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-color)' }}>
                                    {event.years_ago}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>years ago today</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {event.tags && event.tags.length > 0 && (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-body">
                        <h3 style={{ fontSize: '0.875rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            Tags
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {event.tags.map(tag => (
                                <Link
                                    key={tag}
                                    to={`/events?search=${tag}`}
                                    style={{
                                        fontSize: '0.875rem',
                                        background: 'rgba(249, 115, 22, 0.1)',
                                        color: 'var(--accent-color)',
                                        padding: '6px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        textDecoration: 'none',
                                        transition: 'all 0.2s',
                                        border: '1px solid rgba(249, 115, 22, 0.2)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = 'var(--accent-color)';
                                        e.target.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = 'rgba(249, 115, 22, 0.1)';
                                        e.target.style.color = 'var(--accent-color)';
                                    }}
                                >
                                    #{tag}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default EventDetailPage;
