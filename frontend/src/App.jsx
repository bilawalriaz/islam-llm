import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Account from './pages/Account'
import Journey from './pages/Journey'
import Analytics from './pages/Analytics'
import QuranHome from './pages/QuranHome'
import SurahDetail from './pages/SurahDetail'
import SearchPage from './pages/SearchPage'
import SharedProfile from './pages/SharedProfile'
import SharedProfile from './pages/SharedProfile'

/**
 * ProtectedRoute - Wrapper that redirects to login if not authenticated
 * Use for routes that require login (account, dashboard, etc.)
 */
function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="container">
                <div className="loading-state">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

/**
 * PublicRoute - Redirects to home if already authenticated
 * Use this for login/register pages
 */
function PublicRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="container">
                <div className="loading-state">Loading...</div>
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
}

/**
 * AppRoutes - Define your application routes here
 *
 * Public routes (no auth required): Home, Quran reader, About
 * Public routes with redirect (if logged in): Login, Register
 * Protected routes (require auth): Account/Dashboard for progress tracking
 */
function AppRoutes() {
    return (
        <Routes>
            {/* Auth routes - redirect to home if already authenticated */}
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                }
            />
            <Route
                path="/register"
                element={
                    <PublicRoute>
                        <Register />
                    </PublicRoute>
                }
            />
            <Route
                path="/forgot-password"
                element={
                    <PublicRoute>
                        <ForgotPassword />
                    </PublicRoute>
                }
            />
            <Route
                path="/reset-password"
                element={
                    <ResetPassword />
                }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Public routes - no authentication required */}
            <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="quran" element={<QuranHome />} />
                <Route path="quran/:id" element={<SurahDetail />} />
                <Route path="search" element={<SearchPage />} />
            </Route>

            {/* Public share profile route - no auth required, no layout */}
            <Route path="/share/:shareId" element={<SharedProfile />} />

            {/* Protected routes - require authentication for account features */}
            <Route
                path="/account"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Account />} />
                {/* Add more protected account routes here (progress, bookmarks, etc.) */}
            </Route>

            {/* Journey page - protected route */}
            <Route
                path="/journey"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Journey />} />
            </Route>

            {/* Analytics page - protected route */}
            <Route
                path="/analytics"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Analytics />} />
            </Route>



            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

/**
 * App - Root component with AuthProvider
 */
function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}

export default App
