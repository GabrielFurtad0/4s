import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { fireConfetti } from './confetti';
import { cn } from '@/lib/utils';

interface CopyButtonProps extends ButtonProps {
  textToCopy: string;
  onCopied?: () => void;
  withConfetti?: boolean;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
}

export function CopyButton({
  textToCopy,
  onCopied,
  withConfetti = true,
  label = 'Copiar',
  copiedLabel = 'Copiado!',
  iconOnly = false,
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);

      if (withConfetti) {
        const rect = e.currentTarget.getBoundingClientRect();
        fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }

      onCopied?.();
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="outline"
      size={iconOnly ? 'icon' : 'sm'}
      onClick={handleCopy}
      className={cn(
        'relative transition-all duration-200 overflow-hidden',
        copied && 'border-emerald-500/40 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20',
        className,
      )}
      {...props}
    >
      {copied ? (
        <>
          <Check size={14} className="animate-in zoom-in-50 text-emerald-600 dark:text-emerald-400" />
          {!iconOnly && <span>{copiedLabel}</span>}
        </>
      ) : (
        <>
          <Copy size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          {!iconOnly && <span>{label}</span>}
        </>
      )}
    </Button>
  );
}
