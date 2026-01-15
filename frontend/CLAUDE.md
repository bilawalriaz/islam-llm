# CLAUDE.md - React App Template

**Owner:** Bilawal Riaz
**Repository:** github.com/bilawalriaz/react-app-template
**Last Updated:** 2025-01-15

---

## Project Overview

A production-ready React 19 + Vite template with authentication, routing, and a complete design system. Designed to be cloned and used as the starting point for new web applications.

**Tech Stack:**
- Frontend: React 19, Vite 7, React Router v7
- Styling: Plain CSS with design system variables (no component libraries)
- Auth: Token-based authentication with localStorage
- Build: ESLint, Vite build system

---

## Quick Start for New Sessions

When starting a new project based on this template:

```bash
# Clone the template
git clone git@github.com:bilawalriaz/react-app-template.git my-new-app
cd my-new-app

# Remove git history to start fresh
rm -rf .git
git init

# Update package.json with new project name
# Update index.html with new app title

# Install dependencies
npm install

# Start dev server
npm run dev
```

---

## Architecture

```
react-app-template/
├── src/
│   ├── api/
│   │   └── client.js              # API client with auth wrapper, example endpoints
│   ├── components/
│   │   ├── Button.jsx             # Button component (variants: primary, secondary, success, danger)
│   │   ├── Card.jsx               # Card & StatCard components
│   │   ├── Layout.jsx             # Main layout with header, nav, footer
│   │   ├── Modal.jsx              # Modal dialog with focus trap
│   │   ├── Pagination.jsx         # Pagination component
│   │   ├── Spinner.jsx            # Spinner, LoadingState, EmptyState
│   │   └── Table.jsx              # Table & StatusBadge components
│   ├── contexts/
│   │   └── AuthContext.jsx        # Authentication context (user, login, logout)
│   ├── pages/
│   │   ├── Home.jsx               # Dashboard/home page (protected)
│   │   ├── Login.jsx              # Login page
│   │   ├── ProtectedExample.jsx   # Example protected page
│   │   └── Register.jsx           # Registration page
│   ├── App.jsx                    # Route definitions (ProtectedRoute, PublicRoute)
│   ├── main.jsx                   # App entry point with StrictMode + BrowserRouter
│   └── index.css                  # Complete design system CSS
├── index.html                     # HTML entry point
├── vite.config.js                 # Vite config with API proxy
├── eslint.config.js               # ESLint configuration
└── package.json
```

---

## Key Design Patterns

### 1. Authentication Flow

**AuthContext** (`src/contexts/AuthContext.jsx`):
- `user` - Current user object or null
- `isAuthenticated` - Boolean derived from user
- `loading` - True during initial auth check
- `loginUser(email, password)` - Login function
- `logoutUser()` - Logout function
- `refreshUser()` - Refresh user data from server

**Protected Routes** (`src/App.jsx`):
```jsx
<Route
    path="/"
    element={
        <ProtectedRoute>
            <Layout />
        </ProtectedRoute>
    }
>
    <Route index element={<Home />} />
    {/* Add more protected routes here */}
</Route>
```

**Public Routes** (redirect if authenticated):
```jsx
<Route
    path="/login"
    element={
        <PublicRoute>
            <Login />
        </PublicRoute>
    }
/>
```

### 2. API Client Pattern

All API calls go through `src/api/client.js`:

```jsx
import { getItems, createItem } from '../api/client';

// Generic fetch with auth headers and error handling
const data = await getItems({ page: 1, per_page: 10 });
```

**Key Features:**
- Automatic Bearer token injection from localStorage
- 401 handling - clears session and redirects to login
- Consistent error throwing with message
- File upload support with FormData

### 3. Component Patterns

**Button** - Variants and sizes:
```jsx
<Button variant="primary" size="small" onClick={handleClick}>
    Click Me
</Button>
```

**Card** - With optional header:
```jsx
<Card title="Section Title">
    <p>Content goes here</p>
</Card>
```

**Modal** - With overlay click close and escape key:
```jsx
<Modal isOpen={show} onClose={() => setShow(false)} title="Title">
    <p>Content</p>
</Modal>
```

**Table** - With custom cell renderers:
```jsx
<Table
    columns={[
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> }
    ]}
    data={items}
    keyField="id"
/>
```

### 4. Responsive Design

Mobile-first approach with breakpoint at 768px:

- **Desktop**: Horizontal nav, full tables
- **Mobile**: Burger menu, card-style tables with data-labels

**Burger Menu Implementation** (`src/components/Layout.jsx`):
```jsx
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

<div className={`burger-menu ${mobileMenuOpen ? 'open' : ''}`} onClick={toggleMobileMenu}>
    <span className="burger-line"></span>
    <span className="burger-line"></span>
    <span className="burger-line"></span>
</div>
```

---

## Design System Customization

### Colors (`src/index.css`)

```css
:root {
    /* Primary accent - change for your brand */
    --accent-color: #f97316;
    --accent-hover: #ea580c;

    /* Backgrounds */
    --color-bg: #fafaf9;
    --bg-white: #ffffff;
    --bg-dark: #0f172a;

    /* Text */
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;

    /* Borders & Shadows */
    --border-color: rgba(0, 0, 0, 0.08);
    --shadow-soft: 0 20px 40px -12px rgba(0, 0, 0, 0.1);
    --shadow-glow-accent: 0 20px 40px -12px rgba(249, 115, 22, 0.25);
}
```

### Typography

- **Body**: Inter (variable fallback to system fonts)
- **Code/Mono**: JetBrains Mono
- **Font sizes**: Defined in component styles

### Spacing Scale

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 20px;
--radius-xl: 28px;
```

---

## Backend API Requirements

The template expects these auth endpoints:

```
POST /api/auth/register
  Request: { name, email, password }
  Response: { user: { id, name, email } }

POST /api/auth/login
  Request: { email, password }
  Response: { user: { id, name, email }, session_token: "..." }

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
  Response: { success: true }

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Response: { user: { id, name, email } }
```

**Error Response Format:**
```json
{
    "error": "Error message here"
}
```

---

## Common Tasks

### Adding a New Page

1. Create page component in `src/pages/YourPage.jsx`:
```jsx
function YourPage() {
    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Your Page</h1>
            </div>
            {/* Content */}
        </>
    );
}
export default YourPage;
```

2. Add route in `src/App.jsx`:
```jsx
import YourPage from './pages/YourPage';

<Route path="/your-page" element={<YourPage />} />
```

3. Add nav link in `src/components/Layout.jsx`:
```jsx
<NavLink to="/your-page">Your Page</NavLink>
```

### Adding API Endpoints

In `src/api/client.js`:
```jsx
export async function getYourData(params = {}) {
    const query = new URLSearchParams(params);
    return fetchAPI(`/your-endpoint?${query}`);
}

export async function createYourData(data) {
    return fetchAPI('/your-endpoint', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
```

### Customizing the Logo

In `src/components/Layout.jsx`, update the logo:
```jsx
<div className="logo-mark">AB</div>  {/* Your initials */}
<span className="logo-text">Your App</span>
```

Also update in `src/pages/Login.jsx` and `src/pages/Register.jsx`.

### Changing API Proxy

In `vite.config.js`:
```js
server: {
    proxy: {
        '/api': {
            target: 'http://localhost:YOUR_PORT',  // Your backend
            changeOrigin: true,
        },
    },
}
```

---

## Important Gotchas

### 1. Protected Routes Require AuthContext

Components inside `<ProtectedRoute>` must use `<Layout>` or handle auth state themselves.

### 2. Token Storage

Session tokens are stored in `localStorage` as `session_token`. The API client automatically:
- Reads from localStorage
- Adds `Authorization: Bearer <token>` header
- Clears token on 401 response
- Redirects to login on 401

### 3. Mobile Table Behavior

Tables transform to card-style on mobile. Add `data-label` attributes via the Table component - it's handled automatically.

### 4. Modal Accessibility

The Modal component:
- Traps focus within the modal
- Closes on Escape key
- Closes on overlay click
- Prevents body scroll when open

### 5. Page Data Loading Pattern

```jsx
import { useState, useEffect } from 'react';
import { getItems } from '../api/client';
import { LoadingState, EmptyState } from '../components/Spinner';

function MyPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getItems();
                setItems(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <LoadingState />;
    if (!items.length) return <EmptyState message="No items found" />;

    return <div>{/* Render items */}</div>;
}
```

---

## Environment Variables

No built-in environment variable usage. Add via `import.meta.env`:

```js
const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

Create `.env` file:
```
VITE_API_URL=https://api.example.com
```

**Note:** Variables must be prefixed with `VITE_` to be available in client code.

---

## Testing

No test framework is included. To add testing:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Create `vitest.config.js` and add test scripts to `package.json`.

---

## Build & Deployment

### Development
```bash
npm run dev  # Runs on http://localhost:5173
```

### Production Build
```bash
npm run build     # Creates dist/ directory
npm run preview   # Preview production build locally
```

### Deployment

The `dist/` directory contains static files. Deploy to:
- Netlify: Drag & drop `dist/`
- Vercel: Connect GitHub repo
- Static hosting: Upload `dist/` contents

---

## Component Props Reference

### Button
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | string | 'primary' | 'primary' \| 'secondary' \| 'success' \| 'danger' |
| size | string | 'normal' | 'normal' \| 'small' |
| disabled | boolean | false | Disable button |
| onClick | function | - | Click handler |
| type | string | 'button' | Button type attribute |
| className | string | '' | Additional classes |
| children | node | - | Button content |

### Card
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | - | Card header title |
| children | node | - | Card body content |
| className | string | '' | Additional classes |

### Modal
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| isOpen | boolean | false | Show/hide modal |
| onClose | function | - | Close handler |
| title | string | - | Modal title |
| children | node | - | Modal body |
| footer | node | - | Modal footer content |
| size | string | 'medium' | 'small' \| 'medium' \| 'large' |

### Table
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| columns | array | [] | [{ key, label, render? }] |
| data | array | [] | Array of objects |
| emptyMessage | string | 'No data' | Empty state message |
| keyField | string | 'id' | Field for React keys |
| className | string | '' | Additional classes |

### Pagination
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| currentPage | number | - | Current page (1-indexed) |
| totalPages | number | - | Total pages |
| onPageChange | function | - | Page change handler |
| maxPagesToShow | number | 5 | Max page buttons |

---

## Commit Conventions

```
type: description

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- style: CSS/styling changes
- docs: Documentation
- chore: Build/config changes
```

**Always include `Co-Authored-By: Claude <noreply@anthropic.com>` for AI-assisted commits.**

---

## Future Enhancements

Consider adding when needed:
- Test framework (Vitest + Testing Library)
- Form validation (react-hook-form + zod)
- Date handling (date-fns)
- Rich text editor
- File upload component
- Toast notifications
- Data tables with sorting/filtering
- Dark mode toggle
- Internationalization (i18n)
