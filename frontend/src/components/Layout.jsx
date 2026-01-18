import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ContinueJourney } from './ContinueJourney';
import { ScrollToTop } from './ScrollToTop';

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
                        <div className="desktop-only-skeleton">
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
                                <NavLink to="/search" className={({ isActive }) => `nav-link nav-link-icon ${isActive ? 'active' : ''}`} onClick={closeMobileMenu} title="Search the Quran">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <span className="nav-link-text">Search</span>
                                </NavLink>
                                <NavLink to="/quran" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                    Quran
                                </NavLink>
                                <NavLink to="/events" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                    Events
                                </NavLink>

                                {isAuthenticated && (
                                    <>
                                        <NavLink to="/journey" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                            Journey
                                        </NavLink>

                                        <div className="nav-continue-journey" onClick={closeMobileMenu}>
                                            <ContinueJourney variant="compact" />
                                        </div>
                                    </>
                                )}
                                {/* Add more nav links here */}
                            </nav>
                            <div className={`user-menu ${mobileMenuOpen ? 'user-menu-open' : ''}`}>
                                <Link to="/account" className="user-profile-pill" title="Your Account">
                                    <div className="user-avatar-small">
                                        {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="user-name-text">{user?.name || user?.email}</span>
                                </Link>
                                <button onClick={handleLogout} className="btn-icon-logout" title="Logout">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
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
                                <Link to="/search" className="nav-link-icon" onClick={closeMobileMenu} title="Search the Quran">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                </Link>
                                <Link to="/events" className="nav-link-icon" onClick={closeMobileMenu} title="Islamic Events">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                </Link>
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

            <ScrollToTop />
        </>
    );
}

export default Layout;
