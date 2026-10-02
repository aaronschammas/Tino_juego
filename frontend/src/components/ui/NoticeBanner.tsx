import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

interface NoticeBannerProps {
  title?: string;
  children: ReactNode;
  tone?: NoticeTone;
  className?: string;
  onDismiss?: () => void;
}

const toneClasses: Record<NoticeTone, string> = {
  info: 'border-[rgba(21,101,140,0.18)] bg-[var(--color-primary-050)] text-[var(--color-primary-800)]',
  success: 'border-[rgba(24,126,92,0.18)] bg-[var(--color-success-050)] text-[var(--color-success-800)]',
  warning: 'border-[rgba(196,138,33,0.22)] bg-[var(--color-warning-050)] text-[var(--color-warning-800)]',
  error: 'border-[rgba(185,59,84,0.18)] bg-[var(--color-danger-050)] text-[var(--color-danger-800)]',
};

export default function NoticeBanner({
  title,
  children,
  tone = 'info',
  className,
  onDismiss,
}: NoticeBannerProps) {
  return (
    <div className={cn('relative rounded-[20px] border px-4 py-3', toneClasses[tone], className)}>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="absolute right-3 top-3 text-current opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      ) : null}
      {title ? <p className={cn('text-sm font-semibold', onDismiss ? 'pr-6' : '')}>{title}</p> : null}
      <div className={cn('text-sm', title ? 'mt-1' : '', onDismiss && !title ? 'pr-6' : '')}>{children}</div>
    </div>
  );
}
