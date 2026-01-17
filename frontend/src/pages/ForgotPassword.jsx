import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/client';

/**
 * ForgotPassword - Request password reset email
 *
 * Features:
 * - Email input form
 * - Success message after submission
 * - Link back to login
 */
function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await requestPasswordReset(email);
            setSuccess(true);
        } catch (err) {
            setError(err.message || 'Failed to send reset email. Please try again.');
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
                    <h1>Reset Password</h1>
                    <p>Enter your email address and we'll send you a link to reset your password.</p>

                    {success ? (
                        <div className="alert alert-success">
                            <p>If an account exists with this email, you'll receive a password reset link shortly.</p>
                            <p style={{ marginTop: '1rem' }}>
                                <Link to="/login">Return to login</Link>
                            </p>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="alert alert-error">
                                    {error}
                                </div>
                            )}

                            <form className="auth-form" onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        placeholder="Enter your email address"
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>
                        </>
                    )}

                    <div className="auth-footer">
                        Remember your password? <Link to="/login">Sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;
