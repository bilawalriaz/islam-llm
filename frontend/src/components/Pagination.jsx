import { useState } from 'react';

/**
 * Pagination - Pagination component with page numbers
 *
 * Props:
 * - currentPage: Current active page (1-indexed)
 * - totalPages: Total number of pages
 * - onPageChange: Callback when page changes
 * - maxPagesToShow: Maximum number of page buttons to show (default: 5)
 */
function Pagination({ currentPage, totalPages, onPageChange, maxPagesToShow = 5 }) {
    // Don't render if only 1 page
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];
        const halfWindow = Math.floor(maxPagesToShow / 2);

        let startPage = Math.max(1, currentPage - halfWindow);
        let endPage = Math.min(totalPages, currentPage + halfWindow);

        // Adjust if we're near the beginning
        if (currentPage <= halfWindow) {
            endPage = Math.min(totalPages, maxPagesToShow);
        }

        // Adjust if we're near the end
        if (currentPage + halfWindow >= totalPages) {
            startPage = Math.max(1, totalPages - maxPagesToShow + 1);
        }

        // Add first page and ellipsis if needed
        if (startPage > 1) {
            pages.push(1);
            if (startPage > 2) {
                pages.push('...');
            }
        }

        // Add page range
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        // Add last page and ellipsis if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pages.push('...');
            }
            pages.push(totalPages);
        }

        return pages;
    };

    const pages = getPageNumbers();

    return (
        <div className="pagination">
            <button
                className="btn btn-secondary btn-small"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                Previous
            </button>

            <div className="pagination-numbers">
                {pages.map((page, index) =>
                    page === '...' ? (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                            ...
                        </span>
                    ) : (
                        <button
                            key={page}
                            className={`btn btn-small ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </button>
                    )
                )}
            </div>

            <button
                className="btn btn-secondary btn-small"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                Next
            </button>
        </div>
    );
}

export default Pagination;
