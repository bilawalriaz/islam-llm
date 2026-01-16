import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSurahs } from '../api/client';
import { LoadingState, EmptyState } from '../components/Spinner';

/**
 * QuranHome - Main Quran page with surah (chapter) listing
 *
 * Features:
 * - Display all 114 surahs with their info
 * - Search/filter surahs by name or number
 * - Show surah details (number, name, verses count, revelation type)
 */
function QuranHome() {
    const [surahs, setSurahs] = useState([]);
    const [filteredSurahs, setFilteredSurahs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        loadSurahs();
    }, []);

    useEffect(() => {
        filterSurahs();
    }, [searchQuery, filterType, surahs]);

    const loadSurahs = async () => {
        try {
            const data = await getSurahs();
            setSurahs(data);
            setFilteredSurahs(data);
        } catch (err) {
            console.error('Failed to load surahs:', err);
        } finally {
            setLoading(false);
        }
    };

    const filterSurahs = () => {
        let filtered = [...surahs];

        // Filter by revelation type
        if (filterType !== 'all') {
            filtered = filtered.filter(s => s.revelation_type?.toLowerCase() === filterType);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.name?.toLowerCase().includes(query) ||
                s.english_name?.toLowerCase().includes(query) ||
                s.english_name_translation?.toLowerCase().includes(query) ||
                s.id?.toString().includes(query)
            );
        }

        setFilteredSurahs(filtered);
    };

    const getRevelationBadgeClass = (type) => {
        return type?.toLowerCase() === 'meccan' ? 'primary' : 'success';
    };

    if (loading) {
        return <LoadingState message="Loading Quran..." />;
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                    <div>
                        <h1 className="page-title">The Noble Quran</h1>
                        <p className="page-subtitle">Read and listen to the Holy Quran with translations</p>
                    </div>
                    <Link
                        to="/search"
                        className="btn-icon"
                        title="Search the Quran"
                        style={{
                            padding: '0.5rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-white)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">114</div>
                    <div className="stat-label">Surahs</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">6,236</div>
                    <div className="stat-label">Ayahs</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">30</div>
                    <div className="stat-label">Juz</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">86</div>
                    <div className="stat-label">Meccan</div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex flex-wrap gap-3">
                        <div style={{ flex: '1', minWidth: '200px' }}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search surahs by name, English name, or number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div>
                            <select
                                className="form-select"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                style={{ minWidth: '150px' }}
                            >
                                <option value="all">All Surahs</option>
                                <option value="meccan">Meccan</option>
                                <option value="medinan">Medinan</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-muted small mt-4">
                        Showing {filteredSurahs.length} of {surahs.length} surahs
                    </p>
                </div>
            </div>

            {/* Surah Grid */}
            {filteredSurahs.length === 0 ? (
                <EmptyState message="No surahs match your search" />
            ) : (
                <div className="surah-grid">
                    {filteredSurahs.map((surah) => (
                        <Link
                            key={surah.id}
                            to={`/quran/${surah.id}`}
                            className="surah-card"
                        >
                            <div className="surah-number">
                                <span className="surah-num">{surah.id}</span>
                            </div>
                            <div className="surah-info">
                                <div className="surah-header">
                                    <h3 className="surah-name-arabic">{surah.name}</h3>
                                    <div className="surah-details">
                                        <span className="surah-name-english">{surah.english_name}</span>
                                        <span className="surah-meaning">{surah.english_name_translation}</span>
                                    </div>
                                </div>
                                <div className="surah-meta">
                                    <span className={`status-badge ${getRevelationBadgeClass(surah.revelation_type)}`}>
                                        {surah.revelation_type}
                                    </span>
                                    <span className="ayah-count">{surah.number_of_ayahs} verses</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </>
    );
}

export default QuranHome;
