import { createContext, useContext, useState, useEffect } from 'react';
import { login, logout, getCurrentUser, isAuthenticated as checkAuth } from '../api/client';

const AuthContext = createContext(null);

/**
 * AuthProvider - Manages user authentication state
 *
 * Provides:
 * - user: Current user object (null if not authenticated)
 * - loading: Loading state during auth checks
 * - error: Error message from auth operations
 * - isAuthenticated: Boolean indicating if user is logged in
 * - loginUser: Function to log in with email/password
 * - logoutUser: Function to log out
 * - refreshUser: Function to refresh user data from server
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load user on mount if authenticated
    useEffect(() => {
        const loadUser = async () => {
            if (checkAuth()) {
                try {
                    const data = await getCurrentUser();
                    setUser(data.user);
                } catch (err) {
                    console.error('Failed to load user:', err);
                    setUser(null);
                }
            }
            setLoading(false);
        };

        loadUser();
    }, []);

    const loginUser = async (email, password) => {
        setError(null);
        try {
            const data = await login(email, password);
            setUser(data.user);
            return { success: true };
        } catch (err) {
            const errorMsg = err.message || 'Login failed';
            setError(errorMsg);
            return { success: false, error: errorMsg };
        }
    };

    const logoutUser = async () => {
        try {
            await logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            setUser(null);
        }
    };

    const refreshUser = async () => {
        if (checkAuth()) {
            try {
                const data = await getCurrentUser();
                setUser(data.user);
            } catch (err) {
                console.error('Failed to refresh user:', err);
                setUser(null);
            }
        }
    };

    const value = {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        loginUser,
        logoutUser,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth - Hook to access auth context
 *
 * Usage:
 *   const { user, isAuthenticated, loginUser, logoutUser } = useAuth();
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
