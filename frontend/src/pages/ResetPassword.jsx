import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/client';

/**
 * ResetPassword - Update password after clicking email reset link
 *
 * Features:
 * - Extracts access token from URL hash (Supabase redirect format)
 * - New password + confirm password form
 * - Success message and redirect to login
 */
function ResetPassword() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [accessToken, setAccessToken] = useState('');
    const navigate = useNavigate();

    // Extract access token from URL hash on mount
    // Supabase redirects with format: /reset-password#access_token=xxx&type=recovery
    useEffect(() => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const type = params.get('type');

        if (token && type === 'recovery') {
            setAccessToken(token);
        } else if (!token) {
            setError('Invalid or missing reset token. Please request a new password reset link.');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        // Validate password length
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            await resetPassword(accessToken, newPassword);
            setSuccess(true);
            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.message || 'Failed to reset password. The link may have expired.');
        }

        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <Link to="/" className="logo">
                        <div className="logo-mark">QR</div>
                        <span className="logo-text">Quran Reader</span>
                    </Link>
                </div>

                <div className="auth-card">
                    <h1>Set New Password</h1>
                    <p>Enter your new password below.</p>

                    {success ? (
                        <div className="alert alert-success">
                            <p>Your password has been reset successfully!</p>
                            <p style={{ marginTop: '1rem' }}>Redirecting to login...</p>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="alert alert-error">
                                    {error}
                                </div>
                            )}

                            {accessToken && (
                                <form className="auth-form" onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label htmlFor="newPassword">New Password</label>
                                        <input
                                            id="newPassword"
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            autoComplete="new-password"
                                            placeholder="Enter new password"
                                            minLength={6}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="confirmPassword">Confirm Password</label>
                                        <input
                                            id="confirmPassword"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            autoComplete="new-password"
                                            placeholder="Confirm new password"
                                            minLength={6}
                                        />
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        {loading ? 'Resetting...' : 'Reset Password'}
                                    </button>
                                </form>
                            )}
                        </>
                    )}

                    <div className="auth-footer">
                        <Link to="/login">Return to login</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;
