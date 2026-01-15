/**
 * Table - Simple table component with responsive behavior
 *
 * Props:
 * - columns: Array of { key, label, render? }
 * - data: Array of objects to display
 * - emptyMessage: Message when no data
 * - keyField: Field to use as React key (default: 'id')
 * - className: Additional CSS classes
 */
function Table({ columns, data, emptyMessage = 'No data available', keyField = 'id', className = '' }) {
    if (!data || data.length === 0) {
        return (
            <div className="card">
                <div className="card-body">
                    <p className="text-center text-muted">{emptyMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <table className={`table ${className}`.trim()}>
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key}>{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row[keyField] || Math.random()}>
                            {columns.map((col) => (
                                <td key={col.key} data-label={col.label}>
                                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * StatusBadge - Badge component for status indicators
 *
 * Props:
 * - status: The status text
 * - variant: 'primary' | 'success' | 'warning' | 'danger' | 'muted'
 */
function StatusBadge({ status, variant = 'primary' }) {
    return (
        <span className={`status-badge ${variant}`}>
            {status}
        </span>
    );
}

export { Table, StatusBadge };
