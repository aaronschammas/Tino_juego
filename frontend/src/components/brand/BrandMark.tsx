import Link from 'next/link';
import { cn } from '@/lib/cn';

interface BrandMarkProps {
  href?: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function BrandMark({
  href = '/',
  tone = 'dark',
  compact = false,
  className,
  ariaLabel = 'Ir a la landing de Tino',
}: BrandMarkProps) {
  const accentClass =
    tone === 'light'
      ? 'border-white/20 bg-white/10 text-white'
      : 'border-transparent bg-[#1e3a5f] text-white';
  const subtextClass =
    tone === 'light' ? 'text-white/68' : 'text-[var(--color-ink-500)]';

  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-3', className)}
      aria-label={ariaLabel}
    >
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm border border-slate-100">
        <img 
          src="/logo-tino.png" 
          alt="Tino Logo" 
          className="h-full w-full object-contain p-1.5"
        />
      </div>
      {!compact && (
        <span className="flex flex-col">
          <span
            className={cn(
              'text-[0.98rem] font-semibold tracking-[-0.03em]',
              tone === 'light' ? 'text-white' : 'text-[var(--color-ink-900)]'
            )}
          >
            Tino
          </span>
          <span className={cn('text-xs', subtextClass)}>
            Operacion visible para equipos SaaS
          </span>
        </span>
      )}
    </Link>
  );
}
