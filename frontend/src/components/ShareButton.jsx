import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAyahShareImageUrl } from '../api/client';

/**
 * ShareButton - Component for sharing ayahs as beautiful images
 */
function ShareButton({
    surahId,
    ayahNumber,
    surahName,
    surahEnglishName,
    surahTranslation,
    totalAyahs,
    translation = 'en.sahih'
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageLoading, setImageLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [imageFormat, setImageFormat] = useState('landscape'); // 'landscape', 'square', 'portrait'
    const [imageStyle, setImageStyle] = useState('nature'); // Default to nature for now since user is testing it
    const modalRef = useRef(null);

    // Get base URL for sharing
    const baseUrl = window.location.origin;
    const ayahUrl = `${baseUrl}/quran/${surahId}#ayah-${ayahNumber}`;

    // Generate image URL when modal opens or format changes
    useEffect(() => {
        if (isOpen) {
            const timestamp = Date.now();
            const isSquare = imageFormat === 'square';
            const isPortrait = imageFormat === 'portrait';
            const url = getAyahShareImageUrl(surahId, ayahNumber, translation, isSquare, isPortrait, imageStyle, 'png') + `&t=${timestamp}`;
            setImageUrl(url);

            // Preload the image
            setImageLoading(true);
            const img = new Image();
            img.onload = () => setImageLoading(false);
            img.onerror = () => setImageLoading(false);
            img.src = url;
        }
    }, [isOpen, surahId, ayahNumber, translation, imageFormat, imageStyle]);

    // Close modal on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Share to X (Twitter)
    const shareToX = () => {
        const fullSurahName = surahEnglishName && surahTranslation
            ? `${surahEnglishName} (${surahTranslation})`
            : surahEnglishName || surahName;
        const ayahInfo = totalAyahs ? `${ayahNumber}/${totalAyahs}` : ayahNumber;
        const text = `📖 ${fullSurahName} - Ayah ${ayahInfo}\n\nRead the full surah on Quran Reader:`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(ayahUrl)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    };

    // Share to WhatsApp
    const shareToWhatsApp = () => {
        const fullSurahName = surahEnglishName && surahTranslation
            ? `${surahEnglishName} (${surahTranslation})`
            : surahEnglishName || surahName;
        const ayahInfo = totalAyahs ? `${ayahNumber}/${totalAyahs}` : ayahNumber;
        const text = `📖 ${fullSurahName} - Ayah ${ayahInfo}\n\nRead more on Quran Reader: ${ayahUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank');
    };

    // Copy link to clipboard
    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(ayahUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    // Download image
    const downloadImage = async () => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const suffix = imageFormat === 'portrait' ? '-story' : imageFormat === 'square' ? '-square' : '';
            a.download = `surah-${surahId}-ayah-${ayahNumber}${suffix}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download image:', err);
        }
    };

    // Get aspect ratio style based on format
    const getAspectRatio = () => {
        switch (imageFormat) {
            case 'portrait': return '9 / 16';
            case 'square': return '1 / 1';
            default: return '16 / 9';
        }
    };

    const modalContent = isOpen && (
        <div className="modal-overlay show" style={{ zIndex: 99999 }}>
            <div
                ref={modalRef}
                className="modal-content share-modal"
                style={{
                    marginTop: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                <div className="modal-header">
                    <h3 className="modal-title">Share Ayah {ayahNumber}</h3>
                    <button
                        className="btn-icon"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="modal-body">
                    {/* Format Selection */}
                    <div className="format-selector" style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                            Image Format
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className={`btn btn-sm ${imageFormat === 'landscape' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setImageFormat('landscape')}
                                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                    <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                                </svg>
                                Landscape
                            </button>
                            <button
                                className={`btn btn-sm ${imageFormat === 'square' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setImageFormat('square')}
                                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                </svg>
                                Square
                            </button>
                            <button
                                className={`btn btn-sm ${imageFormat === 'portrait' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setImageFormat('portrait')}
                                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                    <rect x="5" y="2" width="14" height="20" rx="2"></rect>
                                </svg>
                                Story
                            </button>
                        </div>
                    </div>

                    {/* Style Selection */}
                    <div className="style-selector" style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                            Image Style
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className={`btn btn-sm ${imageStyle === 'classic' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setImageStyle('classic')}
                                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                            >
                                Classic
                            </button>
                            <button
                                className={`btn btn-sm ${imageStyle === 'nature' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setImageStyle('nature')}
                                style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                            >
                                Nature
                            </button>
                        </div>
                    </div>

                    {/* Image Preview */}
                    <div className="share-image-preview" style={{ marginBottom: '20px', minHeight: '180px' }}>
                        {imageLoading ? (
                            <div
                                style={{
                                    width: '100%',
                                    aspectRatio: getAspectRatio(),
                                    maxHeight: imageFormat === 'portrait' ? '300px' : 'auto',
                                    background: imageStyle === 'nature' ? '#1e293b' : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: imageStyle === 'nature' ? '#cbd5e1' : '#78716c',
                                }}
                            >
                                <div style={{ textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 8px', borderTopColor: imageStyle === 'nature' ? '#fff' : 'var(--accent-color)' }}></div>
                                    Generating...
                                </div>
                            </div>
                        ) : (
                            <img
                                src={imageUrl}
                                alt={`Ayah ${ayahNumber}`}
                                style={{
                                    width: '100%',
                                    maxHeight: imageFormat === 'portrait' ? '350px' : 'auto',
                                    objectFit: 'contain',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                    display: 'block'
                                }}
                            />
                        )}
                    </div>

                    {/* Share Options */}
                    <div className="share-options">
                        <button className="btn btn-secondary share-btn" onClick={shareToX}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Share on X
                        </button>
                        <button className="btn btn-secondary share-btn" onClick={shareToWhatsApp}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            WhatsApp
                        </button>
                        <button className="btn btn-secondary share-btn" onClick={copyLink}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="2" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            {copied ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button className="btn btn-primary share-btn" onClick={downloadImage}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <button
                className="btn-icon"
                onClick={() => setIsOpen(true)}
                title="Share ayah"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
            </button>
            {isOpen && createPortal(modalContent, document.body)}
        </>
    );
}

export default ShareButton;
