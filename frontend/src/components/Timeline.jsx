import { useEffect, useRef, useState } from 'react';

/**
 * Timeline - Advanced vertical timeline with scroll-triggered animations
 * Features:
 * - Scroll progress line that fills as you scroll
 * - Animated dots that light up when in view
 * - Content that fades in on scroll
 * - Large sticky titles on the left (desktop)
 */

export function Timeline({ data }) {
    const containerRef = useRef(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const rect = container.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const containerHeight = rect.height;

            // Calculate progress: 0% when timeline top enters viewport bottom,
            // 100% when timeline bottom reaches viewport top
            const viewportCenter = windowHeight * 0.5;

            // How far the top of the container is above the viewport center
            const scrolledPast = viewportCenter - rect.top;

            // Total scroll distance = container height
            // We want progress to go from 0 to 100% as we scroll through the entire container
            const progress = Math.min(Math.max(scrolledPast / containerHeight, 0), 1);
            setScrollProgress(progress);
        };

        // Set up Intersection Observer for each item
        const items = container.querySelectorAll('.timeline-item');
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const index = parseInt(entry.target.dataset.index, 10);
                    if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                        setActiveIndex((prev) => Math.max(prev, index));
                        entry.target.classList.add('in-view');
                    }
                });
            },
            { threshold: [0, 0.3, 0.5, 0.7, 1], rootMargin: '-20% 0px -20% 0px' }
        );

        items.forEach((item) => observer.observe(item));

        // Immediately check which items are already in view
        // This ensures seamless experience on page load without requiring scroll
        requestAnimationFrame(() => {
            items.forEach((item) => {
                const rect = item.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                // If item is sufficiently in viewport, mark it as visible immediately
                if (rect.top < windowHeight * 0.8 && rect.bottom > 0) {
                    const index = parseInt(item.dataset.index, 10);
                    item.classList.add('in-view');
                    setActiveIndex((prev) => Math.max(prev, index));
                }
            });
        });

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial calculation

        return () => {
            window.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, []);

    return (
        <div className="timeline-container" ref={containerRef}>
            {/* Progress line background */}
            <div className="timeline-track">
                <div
                    className="timeline-progress"
                    style={{ height: `${scrollProgress * 100}%` }}
                />
            </div>

            {data.map((item, index) => (
                <div
                    key={index}
                    className={`timeline-item ${index <= activeIndex ? 'active' : ''}`}
                    data-index={index}
                >
                    {/* Dot indicator */}
                    <div className="timeline-marker">
                        <div className={`timeline-dot ${index <= activeIndex ? 'lit' : ''}`}>
                            <div className="timeline-dot-inner" />
                        </div>
                    </div>

                    {/* Large title (sticky on desktop) */}
                    <div className="timeline-title-wrapper">
                        <h3 className="timeline-title-large">{item.title}</h3>
                    </div>

                    {/* Content */}
                    <div className="timeline-content-wrapper">
                        <div className="timeline-icon">{item.icon}</div>
                        <div className="timeline-content">
                            <h4 className="timeline-content-title">{item.title}</h4>
                            <p className="timeline-content-text">{item.description}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default Timeline;
