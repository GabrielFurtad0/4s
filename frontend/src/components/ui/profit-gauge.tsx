import React from 'react';
import { cn } from '@/lib/utils';

interface ProfitGaugeProps {
  margin: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function ProfitGauge({
  margin,
  size = 54,
  strokeWidth,
  className,
  showLabel = true,
}: ProfitGaugeProps) {
  const effectiveStrokeWidth = strokeWidth ?? Math.max(3, Math.round(size * 0.09));
  const radius = (size - effectiveStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Cap visual fill at 35% margin for display
  const clampedMargin = Math.max(0, Math.min(margin, 35));
  const offset = circumference - (clampedMargin / 35) * circumference;

  let strokeColor = '#10B981'; // Emerald (> 15%)
  let bgColor = 'rgba(16, 185, 129, 0.15)';
  let textColor = 'text-emerald-600 dark:text-emerald-400';

  if (margin < 8) {
    strokeColor = '#EF4444'; // Red (< 8%)
    bgColor = 'rgba(239, 68, 68, 0.15)';
    textColor = 'text-red-600 dark:text-red-400';
  } else if (margin < 15) {
    strokeColor = '#F59E0B'; // Amber (8 - 15%)
    bgColor = 'rgba(245, 158, 11, 0.15)';
    textColor = 'text-amber-600 dark:text-amber-400';
  }

  // Calculate proportional font size so text always fits comfortably inside inner circle
  const innerDiameter = size - effectiveStrokeWidth * 2;
  const fontSizePx = Math.max(7.5, Math.min(13, innerDiameter * 0.28));

  return (
    <div
      className={cn('relative inline-flex items-center justify-center flex-shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="rotate-[-90deg] transform"
        style={{ filter: `drop-shadow(0 0 4px ${bgColor})` }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={effectiveStrokeWidth}
          className="text-muted/40"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={effectiveStrokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
          <span
            className={cn('font-bold font-mono tracking-tighter leading-none whitespace-nowrap', textColor)}
            style={{ fontSize: `${fontSizePx.toFixed(1)}px` }}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
