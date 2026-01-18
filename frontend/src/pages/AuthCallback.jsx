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
    const [statusMessage, setStatusMessage] = useState('Connecting...');

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

                setStatusMessage('Verifying your account...');

                // Reduced wait time - Supabase SDK processes the URL hash quickly
                // Only wait a tiny bit to ensure URL hash is parsed
                await new Promise(resolve => setTimeout(resolve, 100));

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
                setStatusMessage('Almost there...');

                // Store the access token for backend API calls
                localStorage.setItem('session_token', session.access_token);
                console.log('Token stored in localStorage');

                // Sync user with backend (create/update profile)
                // This is optional - user is already signed in with Supabase
                setStatusMessage('Setting up your profile...');
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

                setStatusMessage('Welcome!');
                // Small delay to show the success message
                await new Promise(resolve => setTimeout(resolve, 500));

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
                <div className="auth-card" style={{ textAlign: 'center', padding: '48px 40px' }}>
                    {/* Aesthetic loading indicator */}
                    <div style={{
                        position: 'relative',
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 32px'
                    }}>
                        {/* Outer ring */}
                        <div style={{
                            position: 'absolute',
                            inset: '0',
                            borderRadius: '50%',
                            border: '3px solid transparent',
                            borderTopColor: 'var(--accent-color)',
                            borderRightColor: 'var(--accent-color)',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        {/* Middle ring */}
                        <div style={{
                            position: 'absolute',
                            inset: '12px',
                            borderRadius: '50%',
                            border: '3px solid transparent',
                            borderTopColor: 'var(--accent-hover)',
                            animation: 'spin 1.5s linear infinite reverse'
                        }}></div>
                        {/* Inner circle */}
                        <div style={{
                            position: 'absolute',
                            inset: '24px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-color), var(--accent-hover))',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }}></div>
                    </div>

                    <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        marginBottom: '8px',
                        color: 'var(--text-primary)'
                    }}>
                        {loading ? 'Signing you in...' : 'Welcome!'}
                    </h3>
                    <p style={{
                        fontSize: '0.9375rem',
                        color: 'var(--text-secondary)',
                        margin: '0'
                    }}>
                        {statusMessage}
                    </p>

                    {/* Animated dots */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '8px',
                        marginTop: '24px'
                    }}>
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-color)',
                                    animation: `bounce 1.4s ease-in-out infinite ${i * 0.16}s`
                                }}
                            ></div>
                        ))}
                    </div>

                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                        @keyframes pulse {
                            0%, 100% { opacity: 0.5; transform: scale(0.95); }
                            50% { opacity: 1; transform: scale(1.05); }
                        }
                        @keyframes bounce {
                            0%, 80%, 100% { transform: scale(0); }
                            40% { transform: scale(1); }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
}

export default AuthCallback;
