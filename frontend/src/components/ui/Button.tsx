import { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]',
  secondary:
    'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
  ghost:
    'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]',
  danger:
    'bg-[var(--color-danger)] text-[var(--color-primary-fg)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-3.5 py-2.5 text-[13.5px]',
  lg: 'px-5 py-3 text-sm',
};

export default function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(30,58,95,0.12)] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
