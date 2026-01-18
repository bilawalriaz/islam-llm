import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LoadingState, EmptyState } from '../components/Spinner';

function EventDetail() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvent();
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [eventId]);

    const fetchEvent = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/events/${eventId}`);
            const data = await response.json();
            setEvent(data);
        } catch (error) {
            console.error('Error fetching event:', error);
        } finally {
            setLoading(false);
        }
    };

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
        return <EmptyState message="Event not found" />;
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <Link to="/events" className="btn btn-secondary btn-small" style={{ marginBottom: '16px', display: 'inline-block' }}>
                        &larr; Back to Events
                    </Link>
                    <h1 className="page-title">{event.title}</h1>
                    <div className="page-subtitle">
                        {event.hijri_year && `${event.hijri_year} AH`}
                        {event.gregorian_year && ` • ${event.gregorian_year} CE`}
                    </div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-body">
                    <div className="surah-meta" style={{ marginBottom: '16px' }}>
                        <span className={`status-badge ${getCategoryBadgeClass(event.category)}`}>
                            {getCategoryLabel(event.category)}
                        </span>
                        {event.years_ago && (
                            <span className="ayah-count">{event.years_ago} years ago</span>
                        )}
                    </div>

                    {(event.gregorian_day && event.gregorian_month && event.gregorian_year) && (
                        <div style={{ marginBottom: '16px' }}>
                            <strong>Date:</strong>{' '}
                            {event.gregorian_day}/{event.gregorian_month}/{event.gregorian_year} CE
                            {(event.hijri_day && event.hijri_month && event.hijri_year) && (
                                <span> ({event.hijri_day}/{event.hijri_month}/{event.hijri_year} AH)</span>
                            )}
                        </div>
                    )}

                    {event.description && (
                        <div style={{ 
                            lineHeight: '1.8',
                            color: 'var(--text-primary)',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {event.description}
                        </div>
                    )}

                    {event.tags && event.tags.length > 0 && (
                        <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {event.tags.map(tag => (
                                <span
                                    key={tag}
                                    style={{
                                        fontSize: '0.875rem',
                                        background: 'rgba(148, 163, 184, 0.1)',
                                        color: 'var(--text-muted)',
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid rgba(148, 163, 184, 0.2)'
                                    }}
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default EventDetail;
