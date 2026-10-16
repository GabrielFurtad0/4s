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
  strokeWidth = 5,
  className,
  showLabel = true,
}: ProfitGaugeProps) {
  const radius = (size - strokeWidth) / 2;
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

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="rotate-[-90deg] transform"
        style={{ filter: `drop-shadow(0 0 6px ${bgColor})` }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={cn('text-[11px] font-bold font-mono tracking-tight', textColor)}>
            {margin.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
