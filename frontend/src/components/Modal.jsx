import { useEffect, useRef } from 'react';

/**
 * Modal - Dialog overlay with header, body, and footer
 *
 * Props:
 * - isOpen: Whether modal is shown
 * - onClose: Function called when closing modal
 * - title: Modal title
 * - children: Modal body content
 * - footer: Optional footer content (e.g., action buttons)
 * - size: 'small' | 'medium' | 'large'
 */
function Modal({ isOpen, onClose, title, children, footer, size = 'medium' }) {
    const modalRef = useRef(null);
    const overlayRef = useRef(null);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Focus trap
    useEffect(() => {
        if (isOpen && modalRef.current) {
            modalRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        small: 'max-w-sm',
        medium: 'max-w-md',
        large: 'max-w-2xl',
    };

    return (
        <div
            ref={overlayRef}
            className={`modal-overlay show`}
            onClick={(e) => {
                if (e.target === overlayRef.current) onClose();
            }}
        >
            <div
                ref={modalRef}
                className={`modal-content ${sizeClasses[size] || sizeClasses.medium}`}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {title && (
                    <div className="modal-header">
                        <h3 id="modal-title" className="modal-title">{title}</h3>
                        <button
                            className="btn-close"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            &times;
                        </button>
                    </div>
                )}
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Modal;
