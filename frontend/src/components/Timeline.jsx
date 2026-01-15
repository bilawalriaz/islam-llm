/**
 * Timeline - Vertical timeline component for displaying feature items
 * Inspired by Aceternity UI Timeline
 */

export function Timeline({ data }) {
    return (
        <div className="timeline">
            <div className="timeline-line" />
            {data.map((item, index) => (
                <div key={index} className="timeline-item">
                    <div className="timeline-dot">
                        <div className="timeline-dot-inner" />
                    </div>
                    <div className="timeline-content">
                        <h3 className="timeline-title">{item.title}</h3>
                        <div className="timeline-description">
                            {item.content}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default Timeline;
