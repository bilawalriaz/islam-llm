import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getShareSettings, generateShareProfile, updateShareSettings, getShareProfileUrl } from '../api/client';
import { LoadingState } from '../components/Spinner';

/**
 * ShareSettingsPanel - Component for managing share profile settings
 * Embeddable panel for the Journey page
 */
export default function ShareSettingsPanel() {
    const { user } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [message, setMessage] = useState(null);

    // Theme options with visual previews - Enhanced designs
    const themes = [
        {
            id: 'classic',
            name: 'Classic',
            description: 'Warm sunset gradient',
            preview: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)',
            accent: '#f97316',
        },
        {
            id: 'nature',
            name: 'Forest',
            description: 'Deep green with gold',
            preview: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
            accent: '#fbbf24',
        },
        {
            id: 'dark',
            name: 'Midnight',
            description: 'Rich dark slate with orange',
            preview: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            accent: '#f97316',
        },
        {
            id: 'minimal',
            name: 'Minimal',
            description: 'Clean monochrome',
            preview: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%)',
            accent: '#71717a',
        },
        {
            id: 'ocean',
            name: 'Ocean',
            description: 'Calm blue gradients',
            preview: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)',
            accent: '#38bdf8',
        },
        {
            id: 'royal',
            name: 'Royal Purple',
            description: 'Elegant purple theme',
            preview: 'linear-gradient(135deg, #581c87 0%, #6b21a8 50%, #7e22ce 100%)',
            accent: '#c084fc',
        },
    ];

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await getShareSettings();
            if (data) {
                setSettings(data);
            }
        } catch (err) {
            console.error('Failed to load share settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateProfile = async () => {
        try {
            setSaving(true);
            const data = await generateShareProfile();
            setSettings(data);
            setMessage({ type: 'success', text: 'Share profile created!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to create share profile' });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateSettings = async (updates) => {
        try {
            setSaving(true);
            await updateShareSettings(updates);
            setSettings(prev => ({ ...prev, ...updates }));
            setMessage({ type: 'success', text: 'Settings saved!' });
            setTimeout(() => setMessage(null), 2000);
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const handleCopyUrl = async () => {
        if (!settings?.share_id) return;

        const url = getShareProfileUrl(settings.share_id);
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) {
        return <LoadingState message="Loading settings..." />;
    }

    // No profile yet
    if (!settings) {
        return (
            <div className="share-settings-panel">
                <div style={styles.header}>
                    <h2 style={styles.title}>Share Your Progress</h2>
                    <p style={styles.subtitle}>
                        Create a unique shareable profile to show your Quran reading progress to friends and family.
                    </p>
                </div>

                <div style={styles.emptyState}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#94a3b8', marginBottom: '16px' }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                    </svg>
                    <h3 style={styles.emptyTitle}>Create Your Share Profile</h3>
                    <p style={styles.emptyDescription}>
                        Generate a unique link to share your Quran journey with others.
                    </p>
                    <button
                        onClick={handleGenerateProfile}
                        disabled={saving}
                        style={styles.primaryButton}
                    >
                        {saving ? 'Creating...' : 'Create Share Profile'}
                    </button>
                </div>
            </div>
        );
    }

    const isProfileEnabled = settings.enabled !== false;
    const currentTheme = themes.find(t => t.id === settings.theme) || themes[0];

    return (
        <div className="share-settings-panel">
            <div style={styles.header}>
                <h2 style={styles.title}>Share Your Progress</h2>
                <p style={styles.subtitle}>
                    Customize your public profile and share your Quran journey.
                </p>
            </div>

            {message && (
                <div style={{
                    ...styles.message,
                    backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                }}>
                    {message.text}
                </div>
            )}

            {/* Profile Enable/Disable Toggle - Prominent placement */}
            <div style={{
                ...styles.card,
                borderLeft: `4px solid ${isProfileEnabled ? '#22c55e' : '#ef4444'}`,
                background: isProfileEnabled
                    ? 'linear-gradient(to right, rgba(34, 197, 94, 0.05), transparent)'
                    : 'linear-gradient(to right, rgba(239, 68, 68, 0.05), transparent)',
            }}>
                <div style={styles.enableHeader}>
                    <div style={styles.enableInfo}>
                        <div style={{
                            ...styles.statusBadge,
                            backgroundColor: isProfileEnabled ? '#dcfce7' : '#fee2e2',
                            color: isProfileEnabled ? '#166534' : '#991b1b',
                        }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isProfileEnabled ? '#22c55e' : '#ef4444',
                                marginRight: '8px',
                                display: 'inline-block',
                            }} />
                            {isProfileEnabled ? 'Public' : 'Disabled'}
                        </div>
                        <h3 style={styles.enableTitle}>
                            {isProfileEnabled ? 'Your profile is public' : 'Your profile is disabled'}
                        </h3>
                        <p style={styles.enableDescription}>
                            {isProfileEnabled
                                ? 'Anyone with your share link can view your Quran reading progress.'
                                : 'Your share link is temporarily hidden. Toggle to make it public again.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => handleUpdateSettings({ enabled: !isProfileEnabled })}
                    disabled={saving}
                    style={{
                        ...styles.enableButton,
                        backgroundColor: isProfileEnabled ? '#ef4444' : '#22c55e',
                    }}
                >
                    {isProfileEnabled ? 'Disable Profile' : 'Enable Profile'}
                </button>
            </div>

            {/* Share URL Section - Only show when enabled */}
            {isProfileEnabled && (
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Your Share Link</h3>
                    <p style={styles.cardDescription}>
                        Share this link to let others see your progress.
                    </p>

                    <div style={styles.urlContainer}>
                        <input
                            type="text"
                            value={getShareProfileUrl(settings.share_id)}
                            readOnly
                            style={styles.urlInput}
                        />
                        <button
                            onClick={handleCopyUrl}
                            style={styles.copyButton}
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    <a
                        href={getShareProfileUrl(settings.share_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.previewLink}
                    >
                        Preview your profile →
                    </a>
                </div>
            )}

            {/* Theme Selection - Only show when enabled */}
            {isProfileEnabled && (
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Theme</h3>
                    <p style={styles.cardDescription}>
                        Choose the visual style for your share profile.
                    </p>

                    <div style={styles.themeGrid}>
                        {themes.map(theme => (
                            <button
                                key={theme.id}
                                onClick={() => handleUpdateSettings({ theme: theme.id })}
                                style={{
                                    ...styles.themeOption,
                                    border: settings.theme === theme.id
                                        ? `3px solid ${theme.accent}`
                                        : '3px solid transparent',
                                    transform: settings.theme === theme.id ? 'scale(1.02)' : 'scale(1)',
                                }}
                            >
                                <div
                                    style={{
                                        ...styles.themePreview,
                                        background: theme.preview,
                                    }}
                                />
                                <div style={styles.themeInfo}>
                                    <span style={styles.themeName}>{theme.name}</span>
                                    <span style={styles.themeDescription}>{theme.description}</span>
                                </div>
                                {settings.theme === theme.id && (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: theme.accent, marginLeft: 'auto' }}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Privacy Settings - Only show when enabled */}
            {isProfileEnabled && (
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Privacy Settings</h3>
                    <p style={styles.cardDescription}>
                        Choose which stats to display on your public profile.
                    </p>

                    <div style={styles.toggles}>
                        <Toggle
                            label="Show Completion Stats"
                            description="Display completion percentage and ayahs completed"
                            checked={settings.show_completion}
                            onChange={(checked) => handleUpdateSettings({ show_completion: checked })}
                        />
                        <Toggle
                            label="Show Reading Progress"
                            description="Display total ayahs and surahs read"
                            checked={settings.show_reading_progress}
                            onChange={(checked) => handleUpdateSettings({ show_reading_progress: checked })}
                        />
                        <Toggle
                            label="Show Reading Streak"
                            description="Display your current reading streak"
                            checked={settings.show_streak}
                            onChange={(checked) => handleUpdateSettings({ show_streak: checked })}
                        />
                        <Toggle
                            label="Show Bookmarks"
                            description="Display your total bookmarks count"
                            checked={settings.show_bookmarks}
                            onChange={(checked) => handleUpdateSettings({ show_bookmarks: checked })}
                        />
                        <Toggle
                            label="Show Listening Stats"
                            description="Display total plays and listening time"
                            checked={settings.show_listening_stats}
                            onChange={(checked) => handleUpdateSettings({ show_listening_stats: checked })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Toggle Component
function Toggle({ label, description, checked, onChange }) {
    return (
        <div style={styles.toggle}>
            <div style={styles.toggleInfo}>
                <label style={styles.toggleLabel}>{label}</label>
                {description && <p style={styles.toggleDescription}>{description}</p>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                style={{
                    ...styles.toggleButton,
                    backgroundColor: checked ? '#f97316' : '#e2e8f0',
                }}
            >
                <span style={{
                    ...styles.toggleKnob,
                    transform: checked ? 'translateX(24px)' : 'translateX(0)',
                }} />
            </button>
        </div>
    );
}

const styles = {
    container: {
        width: '100%',
        textAlign: 'center',
    },
    header: {
        marginBottom: '32px',
        textAlign: 'center',
    },
    title: {
        fontSize: '24px',
        fontWeight: '700',
        margin: '0 0 12px 0',
        color: '#1c1917',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: '16px',
        color: '#64748b',
        margin: 0,
        lineHeight: 1.5,
        textAlign: 'center',
    },
    message: {
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '24px',
        fontSize: '14px',
        fontWeight: '500',
    },
    emptyState: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '48px',
        textAlign: 'center',
        border: '1px solid #e2e8f0',
    },
    emptyTitle: {
        fontSize: '20px',
        fontWeight: '600',
        margin: '0 0 8px 0',
        color: '#1c1917',
    },
    emptyDescription: {
        fontSize: '14px',
        color: '#64748b',
        margin: '0 0 24px 0',
    },
    primaryButton: {
        backgroundColor: '#f97316',
        color: '#ffffff',
        border: 'none',
        borderRadius: '12px',
        padding: '14px 32px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    primaryButtonDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e2e8f0',
    },
    cardTitle: {
        fontSize: '20px',
        fontWeight: '600',
        margin: '0 0 8px 0',
        color: '#1c1917',
    },
    cardDescription: {
        fontSize: '14px',
        color: '#64748b',
        margin: '0 0 20px 0',
    },
    // Enable/Disable styles
    enableHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px',
    },
    enableInfo: {
        flex: 1,
    },
    statusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        marginBottom: '12px',
    },
    enableTitle: {
        fontSize: '18px',
        fontWeight: '600',
        margin: '0 0 6px 0',
        color: '#1c1917',
    },
    enableDescription: {
        fontSize: '14px',
        color: '#64748b',
        margin: 0,
        lineHeight: 1.5,
    },
    enableButton: {
        padding: '12px 24px',
        borderRadius: '10px',
        border: 'none',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
    },
    urlContainer: {
        display: 'flex',
        gap: '8px',
    },
    urlInput: {
        flex: 1,
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        fontSize: '14px',
        backgroundColor: '#f8fafc',
        fontFamily: 'monospace',
    },
    copyButton: {
        padding: '12px 24px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    previewLink: {
        display: 'inline-block',
        marginTop: '16px',
        fontSize: '14px',
        color: '#f97316',
        textDecoration: 'none',
        fontWeight: '500',
    },
    themeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
    },
    themeOption: {
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        borderRadius: '12px',
        border: '3px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backgroundColor: '#f8fafc',
    },
    themePreview: {
        height: '80px',
        borderRadius: '8px',
        marginBottom: '12px',
    },
    themeInfo: {
        display: 'flex',
        flexDirection: 'column',
    },
    themeName: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#1c1917',
    },
    themeDescription: {
        fontSize: '13px',
        color: '#64748b',
    },
    toggles: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    toggle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: '#f8fafc',
    },
    toggleInfo: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#1c1917',
        display: 'block',
        marginBottom: '4px',
    },
    toggleDescription: {
        fontSize: '13px',
        color: '#64748b',
        margin: 0,
    },
    toggleButton: {
        width: '52px',
        height: '28px',
        borderRadius: '14px',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        flexShrink: 0,
    },
    toggleKnob: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s',
        position: 'absolute',
        top: '2px',
        left: '2px',
    },
};
