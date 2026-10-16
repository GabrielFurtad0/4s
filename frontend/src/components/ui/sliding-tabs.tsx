import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface SlidingTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function SlidingTabs({
  tabs,
  activeTab,
  onChange,
  className,
}: SlidingTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`);
    if (activeBtn) {
      setPillStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center p-1 bg-muted/60 dark:bg-muted/30 rounded-lg border border-border/40 select-none',
        className,
      )}
    >
      {/* Sliding Pill Indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-md bg-card shadow-xs transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] border border-border/50"
        style={{
          left: `${pillStyle.left}px`,
          width: `${pillStyle.width}px`,
        }}
      />

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-200 cursor-pointer rounded-md',
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
