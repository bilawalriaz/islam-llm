import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchQuran, getSurahs } from '../api/client';
import { LoadingState, EmptyState } from '../components/Spinner';

/**
 * SearchPage - Full-text search across Quran ayahs
 *
 * Features:
 * - Diacritic-insensitive Arabic search (Uthmani text)
 * - English text search (Saheeh International translation)
 * - Auto-detects query language
 * - Filter by language, surah
 * - Debounced search input (300ms)
 * - Infinite scroll pagination
 * - Click results to navigate to surah context
 */
function SearchPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Search state from URL params
    const initialQuery = searchParams.get('q') || '';
    const initialLanguage = searchParams.get('language') || '';
    const initialSurahId = searchParams.get('surah_id') || '';

    // Component state
    const [query, setQuery] = useState(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
    const [language, setLanguage] = useState(initialLanguage);
    const [surahId, setSurahId] = useState(initialSurahId);
    const [results, setResults] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    // Reference data
    const [surahs, setSurahs] = useState([]);

    // Refs for debouncing and infinite scroll
    const debounceTimerRef = useRef(null);
    const observerRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Load reference data on mount
    useEffect(() => {
        const loadReferenceData = async () => {
            try {
                const surahsData = await getSurahs();
                setSurahs(surahsData);
            } catch (err) {
                console.error('Failed to load reference data:', err);
            }
        };
        loadReferenceData();
    }, []);

    // Debounce search query
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            setDebouncedQuery(query);
            setPage(0);
            setResults([]);
        }, 300);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [query]);

    // Update URL params when search changes
    useEffect(() => {
        const params = {};
        if (debouncedQuery) params.q = debouncedQuery;
        if (language) params.language = language;
        if (surahId) params.surah_id = surahId;
        setSearchParams(params);
    }, [debouncedQuery, language, surahId, setSearchParams]);

    // Perform search
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim()) {
                setResults([]);
                setTotalCount(0);
                setHasSearched(false);
                setHasMore(false);
                return;
            }

            setLoading(true);
            setError(null);
            setHasSearched(true);

            try {
                const options = {
                    limit: 50,
                    offset: page * 50,
                };
                if (language) options.language = language;
                if (surahId) options.surah_id = parseInt(surahId);

                const data = await searchQuran(debouncedQuery, options);
                setResults(data.results || []);
                setTotalCount(data.total_count || 0);
                setHasMore((data.results?.length || 0) >= 50);
            } catch (err) {
                setError(err.message || 'Search failed');
                setResults([]);
                setTotalCount(0);
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, language, surahId, page]);

    // Load more results (infinite scroll)
    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;

        const nextPage = page + 1;
        const offset = nextPage * 50;

        try {
            const options = {
                limit: 50,
                offset: offset,
            };
            if (language) options.language = language;
            if (surahId) options.surah_id = parseInt(surahId);

            const data = await searchQuran(debouncedQuery, options);
            setResults(prev => [...prev, ...(data.results || [])]);
            setHasMore((data.results?.length || 0) >= 50);
        } catch (err) {
            console.error('Failed to load more results:', err);
        }
    }, [loading, hasMore, page, debouncedQuery, language, surahId]);

    // Setup infinite scroll observer
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setPage(prev => prev + 1);
                }
            },
            { rootMargin: '200px' }
        );

        const currentRef = loadMoreRef.current;
        observerRef.current.observe(currentRef);

        return () => {
            if (observerRef.current && currentRef) {
                observerRef.current.unobserve(currentRef);
            }
        };
    }, [hasMore]);

    // Handle result click - navigate to surah with ayah anchor
    const handleResultClick = (surahId, ayahNumber) => {
        navigate(`/quran/${surahId}#ayah-${ayahNumber}`);
    };

    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setPage(0);
        setResults([]);
        switch (key) {
            case 'language':
                setLanguage(value);
                break;
            case 'surahId':
                setSurahId(value);
                break;
        }
    };

    // Detect language from query for default selection
    const detectedLanguage = (() => {
        const arabicChars = (debouncedQuery || '').match(/[\u0600-\u06FF]/g);
        return arabicChars && arabicChars.length > (debouncedQuery.length * 0.3) ? 'ar' : 'en';
    })();

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Search the Quran</h1>
                    <p className="page-subtitle">Find any verse in the Noble Quran</p>
                </div>
            </div>

            {/* Search Input and Filters */}
            <div className="card mb-4">
                <div className="card-body">
                    {/* Search Input */}
                    <div className="mb-4">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search in Arabic or English..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            style={{
                                fontSize: query && detectedLanguage === 'ar' ? '1.25rem' : '1rem',
                                fontFamily: query && detectedLanguage === 'ar' ? 'var(--font-arabic), sans-serif' : 'inherit',
                                direction: query && detectedLanguage === 'ar' ? 'rtl' : 'ltr'
                            }}
                        />
                    </div>

                    {/* Filters */}
                    <div className="d-flex flex-wrap gap-3">
                        {/* Language Filter */}
                        <div>
                            <select
                                className="form-select"
                                value={language || ''}
                                onChange={(e) => handleFilterChange('language', e.target.value)}
                                style={{ minWidth: '150px' }}
                            >
                                <option value="">Auto-detect</option>
                                <option value="ar">Arabic only</option>
                                <option value="en">English only</option>
                                <option value="all">All languages</option>
                            </select>
                        </div>

                        {/* Surah Filter */}
                        <div>
                            <select
                                className="form-select"
                                value={surahId || ''}
                                onChange={(e) => handleFilterChange('surahId', e.target.value)}
                                style={{ minWidth: '180px' }}
                                disabled={!surahs.length}
                            >
                                <option value="">All surahs</option>
                                {surahs.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.id}. {s.english_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Result Count */}
                    {hasSearched && !loading && (
                        <p className="text-muted small mt-4">
                            Found {totalCount} result{totalCount !== 1 ? 's' : ''} for "{debouncedQuery}"
                        </p>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && page === 0 && <LoadingState message="Searching..." />}

            {/* Error State */}
            {error && (
                <div className="alert alert-danger">
                    {error}
                </div>
            )}

            {/* No Query State */}
            {!hasSearched && !loading && !error && (
                <EmptyState message="Enter a search term to find verses in the Quran" />
            )}

            {/* No Results State */}
            {hasSearched && !loading && !error && results.length === 0 && (
                <EmptyState message={`No results found for "${debouncedQuery}"`} />
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="search-results">
                    {results.map((result, index) => (
                        <div
                            key={`${result.edition}-${result.ayah_number}-${index}`}
                            className="search-result-card card"
                            onClick={() => handleResultClick(result.surah_id, result.number_in_surah)}
                        >
                            <div className="card-body">
                                {/* Result Header */}
                                <div className="search-result-header">
                                    <div className="search-result-reference">
                                        <span className="search-result-surah">
                                            {result.surah_english_name || result.surah_name} ({result.surah_id})
                                        </span>
                                        <span className="search-result-ayah">
                                            Ayah {result.number_in_surah}
                                        </span>
                                    </div>
                                    <div className="search-result-meta">
                                        <span className={`language-badge ${result.language === 'ar' ? 'arabic' : 'english'}`}>
                                            {result.language === 'ar' ? 'Arabic' : result.edition_name || 'English'}
                                        </span>
                                        <span className="edition-badge">
                                            {result.edition}
                                        </span>
                                    </div>
                                </div>

                                {/* Result Text */}
                                <div className={`search-result-text ${result.language === 'ar' ? 'arabic-text' : 'english-text'}`}>
                                    {result.text}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Load More Trigger */}
            {hasMore && results.length > 0 && (
                <div ref={loadMoreRef} style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {loading && <Spinner />}
                </div>
            )}
        </>
    );
}

export default SearchPage;
