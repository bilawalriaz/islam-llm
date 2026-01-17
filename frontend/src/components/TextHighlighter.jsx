
import React from 'react';

/**
 * TextHighlighter - Highlights search terms within a block of text
 * 
 * @param {string} text - The text to display
 * @param {string} highlight - The search term to highlight
 * @param {string} className - Optional class name for the container
 */
const TextHighlighter = ({ text, highlight, className = '' }) => {
    if (!highlight || !text) {
        return <span className={className}>{text}</span>;
    }

    // Escape special regex characters
    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create case-insensitive regex
    // For Arabic, we might want to be more sophisticated later (ignoring diacritics), 
    // but a simple regex match is a good start.
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');

    const parts = text.split(regex);

    return (
        <span className={className}>
            {parts.map((part, index) =>
                regex.test(part) ? (
                    <span key={index} className="highlight">{part}</span>
                ) : (
                    <span key={index}>{part}</span>
                )
            )}
        </span>
    );
};

export default TextHighlighter;
