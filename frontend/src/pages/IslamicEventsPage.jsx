import { useState, useEffect } from 'react';
import { LoadingState, EmptyState } from '../components/Spinner';

/**
 * IslamicEventsPage - Browse 1400+ years of Islamic historical events
 *
 * Features:
 * - "On This Day" - See what happened in Islamic history on today's date
 * - Search - Full-text search across all events
 * - Categories - Browse by event type (Battle, Birth, Death, Milestone, etc.)
 */
function IslamicEventsPage() {
    const [activeTab, setActiveTab] = useState('on-this-day');
    const [loading, setLoading] = useState(true);
    const [todayEvents, setTodayEvents] = useState([]);
    const [categories, setCategories] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // Fetch "On This Day" events
    const fetchOnThisDay = async () => {
        try {
            setLoading(true);
            const today = new Date();
            const response = await fetch(`/api/events/on-this-day?month=${today.getMonth() + 1}&day=${today.getDate()}`);
            const data = await response.json();
            setTodayEvents(data.events || []);
        } catch (error) {
            console.error('Error fetching on-this-day events:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch categories
    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/events/categories');
            const data = await response.json();
            setCategories(data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    // Search events
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            const url = selectedCategory
                ? `/api/events/search?q=${encodeURIComponent(searchQuery)}&category=${selectedCategory}`
                : `/api/events/search?q=${encodeURIComponent(searchQuery)}`;
            const response = await fetch(url);
            const data = await response.json();
            setSearchResults(data.results || []);
        } catch (error) {
            console.error('Error searching events:', error);
        }
    };

    useEffect(() => {
        fetchOnThisDay();
        fetchCategories();
    }, []);

    useEffect(() => {
        if (activeTab === 'search' && searchQuery) {
            handleSearch();
        }
    }, [selectedCategory]);

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

    const renderEventCard = (event, index) => (
        <div
            key={event.id || index}
            className="surah-card"
            onClick={() => window.location.href = `/events/${event.id}`}
        >
            <div className="surah-number">
                <span style={{ fontSize: '0.875rem' }}>{event.years_ago || '?'}</span>
            </div>
            <div className="surah-info">
                <div className="surah-header">
                    <h3 className="surah-name-arabic" style={{ fontSize: '1.125rem' }}>{event.title}</h3>
                    <div className="surah-details">
                        <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                            {event.gregorian && (
                                <span>{event.gregorian.day}/{event.gregorian.month}/{event.gregorian.year} CE</span>
                            )}
                            {event.hijri && event.hijri.year && (
                                <span> • {event.hijri.day}/{event.hijri.month}/{event.hijri.year} AH</span>
                            )}
                        </span>
                    </div>
                </div>
                <div className="surah-meta">
                    <span className={`status-badge ${getCategoryBadgeClass(event.category)}`}>
                        {getCategoryLabel(event.category)}
                    </span>
                    {event.display && (
                        <span className="ayah-count">{event.display}</span>
                    )}
                </div>
                {event.description && (
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        margin: '8px 0 0 0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {event.description}
                    </p>
                )}
                {event.tags && event.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                        {event.tags.slice(0, 3).map(tag => (
                            <span
                                key={tag}
                                style={{
                                    fontSize: '0.75rem',
                                    background: 'rgba(148, 163, 184, 0.1)',
                                    color: 'var(--text-muted)',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                }}
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return <LoadingState message="Loading Islamic events..." />;
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Islamic Historical Events</h1>
                    <p className="page-subtitle">Explore 1400+ years of Islamic history</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{Object.values(categories).reduce((a, b) => a + b, 0)}</div>
                    <div className="stat-label">Total Events</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{Object.keys(categories).length}</div>
                    <div className="stat-label">Categories</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{todayEvents.length}</div>
                    <div className="stat-label">Events Today</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">1400+</div>
                    <div className="stat-label">Years of History</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="card mb-4">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setActiveTab('on-this-day')}
                            className={`btn ${activeTab === 'on-this-day' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: '1', minWidth: '140px' }}
                        >
                            📅 On This Day
                        </button>
                        <button
                            onClick={() => setActiveTab('search')}
                            className={`btn ${activeTab === 'search' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: '1', minWidth: '140px' }}
                        >
                            🔍 Search Events
                        </button>
                        <button
                            onClick={() => setActiveTab('categories')}
                            className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: '1', minWidth: '140px' }}
                        >
                            📁 Categories
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'on-this-day' && (
                <>
                    {todayEvents.length > 0 && (
                        <p className="text-muted" style={{ marginBottom: '16px' }}>
                            Showing {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''} from{' '}
                            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                        </p>
                    )}
                    {todayEvents.length === 0 ? (
                        <EmptyState message="No historical events on this day. Try searching or browsing categories!" />
                    ) : (
                        <div className="surah-grid">
                            {todayEvents.map((event, index) => renderEventCard(event, index))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'search' && (
                <>
                    <div className="card mb-4">
                        <div className="card-body">
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1', minWidth: '200px' }}>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search events by name, description, or keyword..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>
                                <div style={{ width: '180px', minWidth: '180px' }}>
                                    <select
                                        className="form-select"
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        <option value="">All Categories</option>
                                        {Object.keys(categories).map(cat => (
                                            <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                                        ))}
                                    </select>
                                </div>
                                <button onClick={handleSearch} className="btn btn-primary">
                                    Search
                                </button>
                            </div>
                        </div>
                    </div>

                    {searchResults.length > 0 && (
                        <p className="text-muted" style={{ marginBottom: '16px' }}>
                            Found {searchResults.length} event{searchResults.length !== 1 ? 's' : ''}
                        </p>
                    )}

                    {searchQuery && searchResults.length === 0 && !loading && (
                        <EmptyState message="No events match your search. Try different keywords or browse categories." />
                    )}

                    {searchResults.length > 0 && (
                        <div className="surah-grid">
                            {searchResults.map((event, index) => renderEventCard(event, index))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'categories' && (
                <>
                    <p className="text-muted" style={{ marginBottom: '16px' }}>
                        Browse {Object.keys(categories).length} categories of Islamic historical events
                    </p>
                    <div className="surah-grid">
                        {Object.entries(categories).map(([category, count]) => (
                            <div
                                key={category}
                                className="surah-card"
                                onClick={() => {
                                    setSelectedCategory(category);
                                    setActiveTab('search');
                                    setSearchQuery('');
                                    handleSearch();
                                }}
                            >
                                <div className="surah-number">
                                    <span>{count}</span>
                                </div>
                                <div className="surah-info">
                                    <div className="surah-header">
                                        <h3 className="surah-name-arabic">{getCategoryLabel(category)}</h3>
                                        <div className="surah-details">
                                            <span className="text-muted">Click to view events</span>
                                        </div>
                                    </div>
                                    <div className="surah-meta">
                                        <span className={`status-badge ${getCategoryBadgeClass(category)}`}>
                                            {category}
                                        </span>
                                        <span className="ayah-count">{count} events</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}

export default IslamicEventsPage;
