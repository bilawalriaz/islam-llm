/**
 * Spinner - Loading indicator component
 *
 * Props:
 * - size: 'small' | 'medium' | 'large'
 * - className: Additional CSS classes
 */
function Spinner({ size = 'medium', className = '' }) {
    const sizeStyles = {
        small: { width: '16px', height: '16px' },
        medium: { width: '20px', height: '20px' },
        large: { width: '32px', height: '32px' },
    };

    return (
        <div
            className="spinner"
            style={sizeStyles[size] || sizeStyles.medium}
        ></div>
    );
}

/**
 * LoadingState - Full-page loading component with text
 *
 * Props:
 * - message: Optional loading message
 */
function LoadingState({ message = 'Loading...' }) {
    return (
        <div className="loading-state">
            <Spinner />
            <p className="mt-4 text-muted">{message}</p>
        </div>
    );
}

/**
 * EmptyState - Empty state placeholder with icon
 *
 * Props:
 * - message: Message to display
 * - icon: Optional SVG icon component
 */
function EmptyState({ message, icon = null }) {
    return (
        <div className="empty-state">
            {icon || (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            )}
            <p>{message}</p>
        </div>
    );
}

export { Spinner, LoadingState, EmptyState };
