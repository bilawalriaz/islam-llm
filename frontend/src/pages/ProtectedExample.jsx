import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';

/**
 * ProtectedExample - Example protected page
 *
 * This demonstrates a page that:
 * - Requires authentication (wrapped in ProtectedRoute in App.jsx)
 * - Accesses user info from auth context
 * - Can be used as a template for other protected pages
 *
 * You can delete this page once you have your own pages set up.
 */
function ProtectedExample() {
    const { user, logoutUser } = useAuth();

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Protected Page</h1>
            </div>

            <Card title="User Information">
                <p className="mb-4">This page is protected and can only be accessed by authenticated users.</p>

                <div style={{
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}>
                    <p className="mb-2"><strong>Name:</strong> {user?.name || 'N/A'}</p>
                    <p className="mb-2"><strong>Email:</strong> {user?.email || 'N/A'}</p>
                    <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
                </div>

                <p>
                    This is an example protected page. You can create more protected pages
                    by adding routes inside the <code>ProtectedRoute</code> wrapper in <code>App.jsx</code>.
                </p>
            </Card>
        </>
    );
}

export default ProtectedExample;
