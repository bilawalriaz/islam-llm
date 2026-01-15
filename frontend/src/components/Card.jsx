/**
 * Card - Container component with header and body sections
 *
 * Props:
 * - title: Card header title (optional)
 * - children: Content for card body
 * - className: Additional CSS classes
 */
function Card({ title, children, className = '' }) {
    return (
        <div className={`card ${className}`.trim()}>
            {title && <div className="card-header">{title}</div>}
            <div className="card-body">
                {children}
            </div>
        </div>
    );
}

/**
 * StatCard - Display a statistic with value and label
 *
 * Props:
 * - value: The stat value to display
 * - label: Label for the stat
 * - className: Additional CSS classes
 */
function StatCard({ value, label, className = '' }) {
    return (
        <div className={`stat-card ${className}`.trim()}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

export { Card, StatCard };
