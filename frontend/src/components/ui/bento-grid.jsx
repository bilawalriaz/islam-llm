"use client";
import React from "react";
import { motion } from "framer-motion";

/**
 * BentoGrid - A beautiful grid layout for displaying content in cards
 * Inspired by modern bento box layouts
 */
export const BentoGrid = ({
    className,
    children,
}) => {
    return (
        <div
            className={`bento-grid ${className || ''}`}
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                maxWidth: '100%',
                margin: '0 auto',
            }}
        >
            {children}
        </div>
    );
};

/**
 * BentoGridItem - Individual card in the bento grid
 * Supports different column spans and hover animations
 */
export const BentoGridItem = ({
    className,
    title,
    description,
    header,
    icon,
    colSpan = 1,
    style = {},
}) => {
    return (
        <motion.div
            className={`bento-grid-item ${className || ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            whileHover={{
                scale: 1.02,
                boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.2)'
            }}
            style={{
                gridColumn: `span ${colSpan}`,
                borderRadius: '20px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'all 0.3s ease',
                ...style,
            }}
        >
            {/* Header/Visual section */}
            {header && (
                <div style={{
                    flex: 1,
                    minHeight: '120px',
                    marginBottom: '16px',
                    borderRadius: '12px',
                    overflow: 'hidden'
                }}>
                    {header}
                </div>
            )}

            {/* Content section */}
            <div>
                {/* Icon */}
                {icon && (
                    <div style={{ marginBottom: '8px' }}>
                        {icon}
                    </div>
                )}

                {/* Title */}
                {title && (
                    <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: '18px',
                        fontWeight: '600',
                        lineHeight: 1.3,
                    }}>
                        {title}
                    </h3>
                )}

                {/* Description */}
                {description && (
                    <div style={{
                        fontSize: '14px',
                        opacity: 0.8,
                        lineHeight: 1.5,
                    }}>
                        {description}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

/**
 * Animated skeleton components for stat cards
 */

// Animated progress bars
export const SkeletonProgress = ({ color = "#f97316" }) => {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            className="skeleton-progress"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
            }}
        >
            {[1, 2, 3, 4].map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        width: ['0%', `${60 + i * 10}%`, `${60 + i * 10}%`],
                    }}
                    transition={{
                        duration: 1.5,
                        delay: i * 0.15,
                        ease: "easeOut",
                    }}
                    style={{
                        height: '8px',
                        background: `linear-gradient(90deg, ${color}55 0%, ${color} 100%)`,
                        borderRadius: '4px',
                    }}
                />
            ))}
        </motion.div>
    );
};

// Animated flame for streak
export const SkeletonStreak = ({ color = "#f97316" }) => {
    return (
        <motion.div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
            }}
        >
            <motion.svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.8, 1, 0.8],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            >
                <motion.path
                    d="M12 2C12 2 4 9 4 14C4 17.5 7.5 21 12 21C16.5 21 20 17.5 20 14C20 9 12 2 12 2Z"
                    fill={color}
                    animate={{
                        d: [
                            "M12 2C12 2 4 9 4 14C4 17.5 7.5 21 12 21C16.5 21 20 17.5 20 14C20 9 12 2 12 2Z",
                            "M12 3C12 3 5 9 5 13.5C5 17 8 20 12 20C16 20 19 17 19 13.5C19 9 12 3 12 3Z",
                            "M12 2C12 2 4 9 4 14C4 17.5 7.5 21 12 21C16.5 21 20 17.5 20 14C20 9 12 2 12 2Z",
                        ],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
                <motion.path
                    d="M12 8C12 8 8 12 8 15C8 17 10 19 12 19C14 19 16 17 16 15C16 12 12 8 12 8Z"
                    fill={`${color}88`}
                    animate={{
                        scale: [1, 1.05, 1],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </motion.svg>
        </motion.div>
    );
};

// Animated book/reading icon
export const SkeletonBook = ({ color = "#f97316" }) => {
    return (
        <motion.div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
            }}
        >
            <motion.svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: [0, 15, 0, -15, 0] }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </motion.svg>
        </motion.div>
    );
};

// Animated audio waves for listening stats
export const SkeletonAudio = ({ color = "#f97316" }) => {
    return (
        <motion.div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                width: '100%',
                height: '100%',
            }}
        >
            {[1, 2, 3, 4, 5].map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        height: ['20px', '40px', '20px'],
                    }}
                    transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut",
                    }}
                    style={{
                        width: '8px',
                        backgroundColor: color,
                        borderRadius: '4px',
                    }}
                />
            ))}
        </motion.div>
    );
};

// Animated bookmark stack
export const SkeletonBookmarks = ({ color = "#f97316" }) => {
    return (
        <motion.div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                position: 'relative',
            }}
        >
            {[0, 1, 2].map((i) => (
                <motion.svg
                    key={i}
                    width="32"
                    height="40"
                    viewBox="0 0 24 24"
                    fill={color}
                    style={{
                        position: 'absolute',
                        left: `calc(50% - 16px + ${i * 12}px)`,
                        zIndex: 3 - i,
                    }}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{
                        y: [10, 0, 0],
                        opacity: [0, 1, 1],
                    }}
                    transition={{
                        duration: 0.6,
                        delay: i * 0.2,
                    }}
                    whileHover={{ y: -5 }}
                >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                        fill={i === 0 ? color : `${color}${['FF', 'AA', '66'][i]}`} />
                </motion.svg>
            ))}
        </motion.div>
    );
};

// Circular progress indicator
export const SkeletonCircularProgress = ({ percent = 0, color = "#f97316", size = 100 }) => {
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <motion.div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
            }}
        >
            <svg width={size} height={size} viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={`${color}22`}
                    strokeWidth="8"
                />
                {/* Progress circle */}
                <motion.circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    style={{
                        transform: 'rotate(-90deg)',
                        transformOrigin: 'center',
                    }}
                />
                {/* Percentage text */}
                <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={color}
                    fontSize="20"
                    fontWeight="bold"
                >
                    {percent}%
                </text>
            </svg>
        </motion.div>
    );
};
