import { useState, useEffect } from 'react';

/**
 * Toast - Notification messages
 *
 * Props:
 * - message: The message to display
 * - type: 'success' | 'info' | 'warning' | 'error'
 * - duration: How long to show in ms (default 3000)
 */
function Toast({ message, type = 'success', duration = 3000 }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration]);

    if (!visible) return null;

    const typeIcons = {
        success: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
        ),
        info: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
        ),
        warning: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
        ),
        error: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
            </svg>
        ),
    };

    const typeColors = {
        success: 'linear-gradient(145deg, #10b981, #059669)',
        info: 'linear-gradient(145deg, #3b82f6, #2563eb)',
        warning: 'linear-gradient(145deg, #f59e0b, #d97706)',
        error: 'linear-gradient(145deg, #ef4444, #dc2626)',
    };

    return (
        <div className="toast toast-show">
            <div className="toast-icon" style={{ background: typeColors[type] }}>
                {typeIcons[type]}
            </div>
            <span className="toast-message">{message}</span>
        </div>
    );
}

export default Toast;
