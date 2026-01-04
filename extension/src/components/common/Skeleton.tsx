import React from 'react';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    style?: React.CSSProperties;
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width,
    height,
    borderRadius,
    style,
    className
}) => {
    return (
        <div
            className={`skeleton ${className || ''}`}
            style={{
                width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : '100%',
                height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : '20px',
                borderRadius: borderRadius !== undefined ? (typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius) : undefined,
                ...style
            }}
        />
    );
};
