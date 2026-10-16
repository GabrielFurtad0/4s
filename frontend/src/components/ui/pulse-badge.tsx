import React from 'react';
import { cn } from '@/lib/utils';

interface PulseBadgeProps {
  status: 'ready' | 'pending' | 'success' | 'warning' | 'live';
  label: string;
  sublabel?: string;
  className?: string;
}

export function PulseBadge({
  status,
  label,
  sublabel,
  className,
}: PulseBadgeProps) {
  const isReady = status === 'ready' || status === 'success' || status === 'live';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
        isReady
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
          : 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            isReady ? 'bg-emerald-400' : 'bg-amber-400',
          )}
        />
        <span
          className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            isReady ? 'bg-emerald-500' : 'bg-amber-500',
          )}
        />
      </span>
      <span>{label}</span>
      {sublabel && (
        <span className="text-[10px] opacity-60 font-mono border-l border-current/20 pl-1.5 ml-0.5">
          {sublabel}
        </span>
      )}
    </div>
  );
}
