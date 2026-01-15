import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthCallback - Handles OAuth callback from Google sign-in
 *
 * This page is redirected to by Supabase after Google OAuth flow completes.
 * It extracts the access_token and refresh_token from the URL and exchanges
 * them with the backend for a proper session.
 */
function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            const accessToken = searchParams.get('access_token');
            const refreshToken = searchParams.get('refresh_token');
            const error = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            if (error) {
                console.error('OAuth error:', error, errorDescription);
                navigate('/login', { replace: true });
                return;
            }

            if (accessToken && refreshToken) {
                try {
                    // Exchange OAuth tokens with backend for proper session
                    const response = await fetch('/api/auth/oauth/callback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            provider: 'google',
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        }),
                    });

                    if (response.ok) {
                        const result = await response.json();
                        // Store the session token
                        const token = result.session?.access_token || result.session_token || result.access_token;
                        if (token) {
                            localStorage.setItem('session_token', token);
                        }
                        // Refresh user context
                        await refreshUser();
                        // Redirect to home
                        navigate('/', { replace: true });
                    } else {
                        console.error('Failed to exchange tokens');
                        navigate('/login', { replace: true });
                    }
                } catch (err) {
                    console.error('OAuth callback error:', err);
                    navigate('/login', { replace: true });
                }
            } else {
                // No tokens found, redirect to login
                navigate('/login', { replace: true });
            }
        };

        handleCallback();
    }, [searchParams, navigate, refreshUser]);

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="loading-state">Completing sign in...</div>
                </div>
            </div>
        </div>
    );
}

export default AuthCallback;
