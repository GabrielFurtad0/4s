import React from 'react';

export function FourSIcon({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ícone 4S"
    >
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5E43F3" />
          <stop offset="55%" stopColor="#4338CA" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="18" y1="13" x2="35" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <filter id="subtleGlow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#1E1B4B" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Squircle base */}
      <rect width="48" height="48" rx="12" fill="url(#bgGrad)" />

      {/* Inset border highlight */}
      <rect
        x="0.75"
        y="0.75"
        width="46.5"
        height="46.5"
        rx="11.25"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.5"
      />

      {/* 4S Intertwined Monogram */}
      <g filter="url(#subtleGlow)">
        {/* Stroke of '4' diagonal and crossbar */}
        <path
          d="M20 12.5L10.5 27.5H24.5"
          stroke="#FFFFFF"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Vertical stem of '4' */}
        <path
          d="M20.5 12.5V35.5"
          stroke="#FFFFFF"
          strokeWidth="3.6"
          strokeLinecap="round"
        />

        {/* 'S' intertwined in warm gold/amber (wheat tone) */}
        <path
          d="M34.5 17.5C33.2 14.6 30.6 13.5 27 13.5C23.2 13.5 21 15.6 21 18.8C21 24.2 34 22.8 34 28.5C34 32.2 31 34.5 26.2 34.5C22.2 34.5 19.5 32.6 18.2 30"
          stroke="url(#goldGrad)"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Golden wheat grain accent spark */}
        <circle cx="34.5" cy="14" r="2.2" fill="#FDE68A" />
      </g>
    </svg>
  );
}

export function FourSLogo({
  size = 28,
  subtitle = 'Total Trigo',
  className = '',
}: {
  size?: number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <FourSIcon size={size} />
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold tracking-tight text-foreground font-sans text-base">
            4S
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            ERP
          </span>
        </div>
        {subtitle && (
          <span className="text-[9px] text-muted-foreground font-medium tracking-wide mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
