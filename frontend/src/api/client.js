const API_BASE = '/api';

/**
 * Get stored session token from localStorage
 */
function getSessionToken() {
    return localStorage.getItem('session_token');
}

/**
 * Store session token in localStorage
 */
function setSessionToken(token) {
    if (token) {
        localStorage.setItem('session_token', token);
    } else {
        localStorage.removeItem('session_token');
    }
}

/**
 * Clear session (logout)
 */
function clearSession() {
    localStorage.removeItem('session_token');
}

/**
 * Generic fetch wrapper with error handling and auth
 */
async function fetchAPI(endpoint, options = {}) {
    const token = getSessionToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Add auth header if token exists
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers,
        ...options,
    });

    // Handle 401 Unauthorized - clear session and redirect to login
    if (response.status === 401) {
        clearSession();
        // Only redirect if we're not already on auth pages
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
            window.location.href = '/login';
        }
        throw new Error('Authentication required. Please login.');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

// =============================================================================
// AUTH API - Update these endpoints to match your backend
// =============================================================================

/**
 * Register a new user
 */
export async function register(data) {
    const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(error.error || 'Registration failed');
    }

    const result = await response.json();

    // Supabase auth may return session data on registration
    // Store session token if available
    const token = result.session?.access_token || result.session_token || result.access_token;
    if (token) {
        setSessionToken(token);
    }

    return result;
}

/**
 * Login user
 */
export async function login(email, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || 'Login failed');
    }

    const result = await response.json();

    // Store session token from Supabase auth response
    // New format: { user: {...}, session: { access_token: ..., refresh_token: ... } }
    // Old format: { user: {...}, session_token: ... }
    const token = result.session?.access_token || result.session_token || result.access_token;
    if (token) {
        setSessionToken(token);
    }

    return result;
}

/**
 * Logout current user
 */
export async function logout() {
    try {
        await fetchAPI('/auth/logout', {
            method: 'POST',
        });
    } finally {
        // Always clear local session
        clearSession();
    }
}

/**
 * Get current user info
 */
export async function getCurrentUser() {
    return fetchAPI('/auth/me');
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated() {
    return !!getSessionToken();
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(email) {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.detail || error.error || 'Request failed');
    }

    return response.json();
}

/**
 * Reset password using recovery token
 */
export async function resetPassword(accessToken, newPassword) {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            access_token: accessToken,
            new_password: newPassword
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Reset failed' }));
        throw new Error(error.detail || error.error || 'Password reset failed');
    }

    return response.json();
}

/**
 * Get the Google OAuth URL for sign-in
 */
export function getGoogleAuthUrl() {
    const supabaseUrl = 'https://zxmyoojcuihavbhiblwc.supabase.co';
    const redirectUri = `${window.location.origin}/auth/callback`;
    return `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}&skip_http_redirect=true`;
}

// =============================================================================
// QURAN API FUNCTIONS
// =============================================================================

/**
 * Get all surahs (chapters)
 */
export async function getSurahs() {
    return fetchAPI('/quran/surahs');
}

/**
 * Get single surah by ID with ayahs
 */
export async function getSurah(id, edition = 'quran-uthmani') {
    return fetchAPI(`/quran/surahs/${id}?edition=${edition}`);
}

/**
 * Get ayahs for a specific surah
 */
export async function getAyahs(surahId, edition = 'quran-uthmani') {
    return fetchAPI(`/quran/surahs/${surahId}/ayahs?edition=${edition}`);
}

/**
 * Get audio editions available
 */
export async function getAudioEditions() {
    return fetchAPI('/quran/audio/editions');
}

/**
 * Get editions available
 */
export async function getEditions() {
    return fetchAPI('/quran/editions');
}

/**
 * Search Quran with full-text search
 * @param {string} query - Search query text
 * @param {Object} options - Search options
 * @param {string} options.language - Filter by language: 'ar', 'en', or 'all' (default: auto-detect)
 * @param {string} options.edition - Filter by specific edition identifier
 * @param {number} options.surah_id - Filter to specific surah
 * @param {number} options.limit - Max results (default: 50, max: 200)
 * @param {number} options.offset - Pagination offset (default: 0)
 */
export async function searchQuran(query, options = {}) {
    const params = new URLSearchParams({ q: query, ...options });
    return fetchAPI(`/quran/search?${params}`);
}

// =============================================================================
// BOOKMARKS API
// =============================================================================

/**
 * Get all bookmarks for the current user
 */
export async function getBookmarks() {
    return fetchAPI('/bookmarks');
}

/**
 * Create a new bookmark
 */
export async function createBookmark(ayahId, surahId, ayahNumberInSurah) {
    return fetchAPI('/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
            ayah_id: ayahId,
            surah_id: surahId,
            ayah_number_in_surah: ayahNumberInSurah,
        }),
    });
}

/**
 * Delete a bookmark
 */
export async function deleteBookmark(bookmarkId) {
    return fetchAPI(`/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
    });
}

/**
 * Check if an ayah is bookmarked
 */
export async function checkBookmark(ayahId) {
    return fetchAPI(`/bookmarks/exists/${ayahId}`);
}

/**
 * Toggle bookmark (add or remove)
 */
export async function toggleBookmark(ayahId, surahId, ayahNumberInSurah, bookmarkId = null) {
    if (bookmarkId) {
        return deleteBookmark(bookmarkId);
    } else {
        return createBookmark(ayahId, surahId, ayahNumberInSurah);
    }
}

// =============================================================================
// PROGRESS TRACKING API
// =============================================================================

/**
 * Update reading progress for a surah
 */
export async function updateProgress(surahId, ayahId, ayahNumber) {
    return fetchAPI('/progress', {
        method: 'POST',
        body: JSON.stringify({
            surah_id: surahId,
            ayah_id: ayahId,
            ayah_number: ayahNumber,
        }),
    });
}

/**
 * Get all reading progress for the current user
 */
export async function getProgress() {
    return fetchAPI('/progress');
}

/**
 * Get reading statistics
 */
export async function getProgressStats() {
    return fetchAPI('/progress/stats');
}

/**
 * Get last reading position (for resuming)
 */
export async function getLastPosition() {
    return fetchAPI('/progress/last-position');
}

// =============================================================================
// COMPLETION TRACKING API
// =============================================================================

/**
 * Mark an ayah as completed
 */
export async function markAyahCompleted(ayahId, surahId, ayahNumber) {
    return fetchAPI('/completed-ayahs', {
        method: 'POST',
        body: JSON.stringify({
            ayah_id: ayahId,
            surah_id: surahId,
            ayah_number: ayahNumber,
        }),
    });
}

/**
 * Mark multiple ayahs as completed in a batch
 * @param {Array<{ayah_id, surah_id, ayah_number}>} ayahsList 
 */
export async function markAyahsBatchCompleted(ayahsList) {
    if (!ayahsList || ayahsList.length === 0) return { success: true, count: 0 };

    return fetchAPI('/completed-ayahs/batch', {
        method: 'POST',
        body: JSON.stringify({
            ayahs: ayahsList
        }),
    });
}

/**
 * Get completed ayahs for a specific surah
 */
export async function getCompletedAyahsForSurah(surahId) {
    return fetchAPI(`/completed-ayahs/surah/${surahId}`);
}

/**
 * Get completion stats for a specific surah
 */
export async function getSurahCompletionStats(surahId) {
    return fetchAPI(`/completed-ayahs/stats/${surahId}`);
}

/**
 * Get first unread ayah across all surahs
 */
export async function getFirstUnreadAyah() {
    return fetchAPI('/completed-ayahs/first-unread');
}

/**
 * Get overall completion statistics
 */
export async function getOverallCompletionStats() {
    return fetchAPI('/completed-ayahs/overall-stats');
}

/**
 * Get detailed progress for all surahs (with completion status)
 * Returns array of all 114 surahs with read/unread ayah counts
 */
export async function getAllSurahsProgress() {
    return fetchAPI('/progress/all-surahs');
}

/**
 * Clear all progress for a specific surah
 * Deletes all completed ayahs for the given surah
 */
export async function clearSurahProgress(surahId) {
    return fetchAPI(`/completed-ayahs/surah/${surahId}`, {
        method: 'DELETE',
    });
}

// =============================================================================
// SEQUENTIAL PROGRESS API
// =============================================================================

/**
 * Get sequential progress (true Quran completion percentage)
 * Only counts ayahs where ALL previous ayahs are complete
 */
export async function getSequentialProgress() {
    return fetchAPI('/progress/sequential');
}

/**
 * Validate and recalculate sequential progress flags
 * Call this when an ayah is marked complete or on demand
 */
export async function validateSequentialProgress() {
    return fetchAPI('/progress/validate-sequential', {
        method: 'POST',
    });
}

// =============================================================================
// AUDIO ANALYTICS API
// =============================================================================

/**
 * Start a play session (analytics tracking)
 * Returns session_id to use when ending the session
 */
export async function startPlaySession(ayahId, surahId, ayahNumber, audioEdition = 'ar.alafasy') {
    return fetchAPI('/analytics/play-start', {
        method: 'POST',
        body: JSON.stringify({
            ayah_id: ayahId,
            surah_id: surahId,
            ayah_number: ayahNumber,
            audio_edition: audioEdition
        }),
    });
}

/**
 * End a play session with duration
 * Updates replay stats aggregate
 */
export async function endPlaySession(sessionId, durationSeconds) {
    return fetchAPI('/analytics/play-end', {
        method: 'POST',
        body: JSON.stringify({
            session_id: sessionId,
            duration_seconds: durationSeconds
        }),
    });
}

/**
 * Get most replayed ayahs (highest play count)
 */
export async function getReplayStats(limit = 10) {
    return fetchAPI(`/analytics/replay-stats?limit=${limit}`);
}

// =============================================================================
// FULL QURAN PLAY MODE API
// =============================================================================

/**
 * Start a full Quran play session from first incomplete ayah
 */
export async function startQuranPlay() {
    return fetchAPI('/quran-play/start', {
        method: 'POST',
    });
}

/**
 * Get next ayah in Quran order (crosses surah boundaries)
 */
export async function getNextQuranAyah(surahId, ayahNumber) {
    return fetchAPI(`/quran-play/next-ayah/${surahId}/${ayahNumber}`);
}

/**
 * End a Quran play session
 */
export async function endQuranPlay(sessionId) {
    return fetchAPI(`/quran-play/end/${sessionId}`, {
        method: 'POST',
    });
}

// =============================================================================
// FILE UPLOAD
// =============================================================================

/**
 * File upload utility
 */
export async function uploadFile(file, endpoint = '/upload') {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const token = getSessionToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
    }

    return response.json();
}

// Export utilities for use in components
/**
 * Get all bookmarks for a specific surah (batch endpoint)
 */
export async function getBookmarksForSurah(surahId) {
    return fetchAPI(`/bookmarks/surah/${surahId}`);
}

// =============================================================================
// SHARE IMAGE API
// =============================================================================

/**
 * Get the share image URL for an ayah
 * @param {number} surahId - Surah ID
 * @param {number} ayahNumber - Ayah number within the surah
 * @param {string} translation - Translation edition identifier
 * @param {boolean} square - Whether to generate a square image
 * @param {boolean} portrait - Whether to generate a 9:16 portrait image
 * @param {string} format - Image format (png or jpeg)
 * @returns {string} The URL for the share image
 */
export function getAyahShareImageUrl(surahId, ayahNumber, translation = 'en.sahih', square = false, portrait = false, style = 'classic', format = 'png') {
    const params = new URLSearchParams({
        translation,
        square: square.toString(),
        portrait: portrait.toString(),
        style,
        format,
    });
    return `/api/share/ayah/${surahId}/${ayahNumber}?${params.toString()}`;
}

/**
 * Get the share image URL for an ayah by its ID
 * @param {number} ayahId - Ayah ID
 * @param {string} translation - Translation edition identifier
 * @param {boolean} square - Whether to generate a square image
 * @param {string} format - Image format (png or jpeg)
 * @returns {string} The URL for the share image
 */
export function getAyahShareImageUrlById(ayahId, translation = 'en.sahih', square = false, style = 'classic', format = 'png') {
    const params = new URLSearchParams({
        translation,
        square: square.toString(),
        style,
        format,
    });
    return `/api/share/ayah/by-id/${ayahId}?${params.toString()}`;
}

// =============================================================================
// USER STATS SHARING API
// =============================================================================

/**
 * Generate a new share profile for the authenticated user
 * Creates a unique share_id if one doesn't exist
 */
export async function generateShareProfile() {
    return fetchAPI('/share/generate', {
        method: 'POST',
    });
}

/**
 * Get the current user's share profile settings
 * Returns null if no share profile exists
 */
export async function getShareSettings() {
    try {
        return await fetchAPI('/share/settings');
    } catch (e) {
        // If 404 or not found, return null
        return null;
    }
}

/**
 * Update the current user's share profile settings
 * @param {Object} settings - Settings to update
 * @param {string} settings.theme - Theme: 'classic', 'nature', 'dark', or 'minimal'
 * @param {boolean} settings.show_reading_progress - Show reading progress stats
 * @param {boolean} settings.show_completion - Show completion stats
 * @param {boolean} settings.show_streak - Show reading streak
 * @param {boolean} settings.show_bookmarks - Show bookmarks count
 * @param {boolean} settings.show_listening_stats - Show listening stats
 */
export async function updateShareSettings(settings) {
    return fetchAPI('/share/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
}

/**
 * Get public stats for a share profile (no auth required)
 * @param {string} shareId - The share ID (e.g., 'a7x2k9')
 */
export async function getPublicShareStats(shareId) {
    const response = await fetch(`${API_BASE}/share/${shareId}`);
    if (!response.ok) {
        throw new Error('Share profile not found');
    }
    return response.json();
}

/**
 * Get the share profile URL for a user
 * @param {string} shareId - The share ID
 * @returns {string} The full share URL
 */
export function getShareProfileUrl(shareId) {
    return `${window.location.origin}/share/${shareId}`;
}

/**
 * Get the OG image URL for a share profile
 * @param {string} shareId - The share ID
 * @returns {string} The OG image URL
 */
export function getShareProfileOgImageUrl(shareId) {
    return `${window.location.origin}/api/share/og/${shareId}.png`;
}
