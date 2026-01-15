/**
 * Button - Reusable button component with variants
 *
 * Props:
 * - variant: 'primary' | 'secondary' | 'success' | 'danger'
 * - size: 'normal' | 'small'
 * - disabled: boolean
 * - onClick: function
 * - children: content
 * - type: button type (default: 'button')
 */
function Button({ variant = 'primary', size = 'normal', disabled = false, onClick, children, type = 'button', className = '' }) {
    const baseClasses = 'btn';
    const variantClasses = `btn-${variant}`;
    const sizeClasses = size === 'small' ? 'btn-small' : '';
    const disabledClasses = disabled ? 'disabled' : '';

    return (
        <button
            type={type}
            className={`${baseClasses} ${variantClasses} ${sizeClasses} ${disabledClasses} ${className}`.trim()}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

export default Button;
