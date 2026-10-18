import React from 'react';

export function FourSIcon({
  size = 28,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const borderRadius = Math.max(4, Math.round(size * 0.22));
  return (
    <img
      src="/logo-4s.jpg"
      alt="Logo 4S ERP"
      width={size}
      height={size}
      className={`shrink-0 select-none object-cover shadow-xs border border-white/10 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${borderRadius}px`,
      }}
      loading="eager"
    />
  );
}

export function FourSLogo({
  size = 28,
  subtitle,
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
