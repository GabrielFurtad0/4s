import { useEffect, useRef, useState } from 'react';

interface NumberTickerProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  padZeroes?: number;
  className?: string;
}

export function NumberTicker({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  padZeroes = 0,
  className = '',
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startValRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = displayValue;
    startValRef.current = startVal;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (value - startVal) * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, duration]);

  const formatted = decimals > 0
    ? displayValue.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : padZeroes > 0
    ? String(Math.round(displayValue)).padStart(padZeroes, '0')
    : Math.round(displayValue).toLocaleString('pt-BR');

  return (
    <span className={`inline-block tabular-nums transition-transform duration-100 ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
