import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * AuthCallback - Handles OAuth callback from Google sign-in
 *
 * This page is redirected to by Supabase after Google OAuth flow completes.
 * Uses Supabase client directly to handle the session.
 */
function AuthCallback() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                console.log('AuthCallback: Handling OAuth callback...');

                // Check if tokens are in the URL hash (Supabase OAuth return)
                // Supabase SDK will automatically pick these up
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const error = hashParams.get('error');
                const errorDescription = hashParams.get('error_description');

                console.log('URL hash params:', { hasAccessToken: !!accessToken, error });

                if (error) {
                    console.error('OAuth error from URL:', error, errorDescription);
                    setError(errorDescription || error);
                    setTimeout(() => navigate('/login', { replace: true }), 3000);
                    return;
                }

                if (!accessToken) {
                    console.log('No access token in URL, checking Supabase session...');
                }

                // Wait for Supabase SDK to process the URL hash
                await new Promise(resolve => setTimeout(resolve, 800));

                // Get session from Supabase (SDK auto-processes URL hash)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                console.log('Supabase session result:', { hasSession: !!session, sessionError: sessionError?.message });

                if (sessionError) {
                    console.error('Session error:', sessionError);
                    setError(sessionError.message);
                    setTimeout(() => navigate('/login', { replace: true }), 3000);
                    return;
                }

                if (!session) {
                    console.log('No session found after waiting');
                    setError('No session found. Please try signing in again.');
                    setTimeout(() => navigate('/login', { replace: true }), 3000);
                    return;
                }

                // We have a valid session!
                console.log('Session found:', session.user.email);

                // Store the access token for backend API calls
                localStorage.setItem('session_token', session.access_token);
                console.log('Token stored in localStorage');

                // Sync user with backend (create/update profile)
                // This is optional - user is already signed in with Supabase
                try {
                    console.log('Syncing with backend...');
                    const syncResponse = await fetch('/api/auth/oauth/callback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            provider: 'google',
                            access_token: session.access_token,
                            refresh_token: session.refresh_token,
                        }),
                    });
                    console.log('Backend sync response:', syncResponse.status);

                    if (syncResponse.ok) {
                        const syncData = await syncResponse.json();
                        console.log('Backend sync successful:', syncData);
                    }
                } catch (err) {
                    console.warn('Failed to sync with backend (non-critical):', err);
                    // Continue anyway - the user is signed in with Supabase
                }

                // Force a page reload to ensure AuthContext picks up the new token
                // This is more reliable than trying to update the context
                window.location.href = '/';
                return;

            } catch (err) {
                console.error('OAuth callback error:', err);
                setError(err.message || 'Authentication failed');
                setTimeout(() => navigate('/login', { replace: true }), 3000);
            } finally {
                setLoading(false);
            }
        };

        handleCallback();
    }, [navigate]);

    if (error) {
        return (
            <div className="auth-page">
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="alert alert-error">{error}</div>
                        <p className="text-muted" style={{ marginTop: '1rem' }}>Redirecting to login...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="loading-state">
                        {loading ? 'Completing sign in...' : 'Signed in! Redirecting...'}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AuthCallback;
