import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ContinueJourney } from './ContinueJourney';

/**
 * Layout - Main app layout with header, navigation, and footer
 *
 * Features:
 * - Responsive navigation with mobile burger menu
 * - Auth-aware header (shows different options based on auth state)
 * - Outlet renders the current route's component
 */
function Layout() {
    const { user, isAuthenticated, logoutUser, loading } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logoutUser();
        navigate('/login');
    };

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    // Show skeleton shell while loading
    if (loading) {
        return (
            <>
                <div className="container">
                    <header className="header">
                        <div className="logo">
                            <div className="logo-mark">Q</div>
                            <span className="logo-text">Quran Reader</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div className="skeleton" style={{ width: '80px', height: '36px', borderRadius: 'var(--radius-md)' }} />
                            <div className="skeleton" style={{ width: '80px', height: '36px', borderRadius: 'var(--radius-md)' }} />
                        </div>
                    </header>
                    <main>
                        <div className="skeleton" style={{ width: '100%', height: '300px', borderRadius: 'var(--radius-lg)', marginTop: '40px' }} />
                    </main>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="container">
                <header className="header">
                    <Link to="/" className="logo">
                        <div className="logo-mark">Q</div>
                        <span className="logo-text">Quran Reader</span>
                    </Link>

                    {isAuthenticated ? (
                        <>
                            {/* Burger Menu Button */}
                            <div
                                className={`burger-menu ${mobileMenuOpen ? 'open' : ''}`}
                                onClick={toggleMobileMenu}
                            >
                                <span className="burger-line"></span>
                                <span className="burger-line"></span>
                                <span className="burger-line"></span>
                            </div>

                            <nav className={`nav-links ${mobileMenuOpen ? 'nav-links-open' : ''}`}>
                                <NavLink to="/quran" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                    Quran
                                </NavLink>
                                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                    Home
                                </NavLink>
                                {isAuthenticated && (
                                    <>
                                        <NavLink to="/account" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                            Progress
                                        </NavLink>
                                        <div className="nav-continue-journey" onClick={closeMobileMenu}>
                                            <ContinueJourney variant="compact" />
                                        </div>
                                    </>
                                )}
                                {/* Add more nav links here */}
                            </nav>
                            <div className={`user-menu ${mobileMenuOpen ? 'user-menu-open' : ''}`}>
                                <span className="user-name">{user?.name || user?.email}</span>
                                <button onClick={handleLogout} className="btn btn-secondary btn-small">
                                    Logout
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Burger Menu Button */}
                            <div
                                className={`burger-menu ${mobileMenuOpen ? 'open' : ''}`}
                                onClick={toggleMobileMenu}
                            >
                                <span className="burger-line"></span>
                                <span className="burger-line"></span>
                                <span className="burger-line"></span>
                            </div>

                            <div className={`auth-links ${mobileMenuOpen ? 'auth-links-open' : ''}`}>
                                <Link to="/login" className="btn btn-secondary btn-small" onClick={closeMobileMenu}>
                                    Sign In
                                </Link>
                                <Link to="/register" className="btn btn-primary btn-small" onClick={closeMobileMenu}>
                                    Sign Up
                                </Link>
                            </div>
                        </>
                    )}
                </header>

                <main>
                    <Outlet />
                </main>
            </div>

            <footer>
                <p>&copy; {new Date().getFullYear()} Quran Reader.</p>
            </footer>
        </>
    );
}

export default Layout;
