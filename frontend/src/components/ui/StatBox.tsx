import { cn } from '@/lib/cn';

type StatTone = 'primary' | 'secondary' | 'accent' | 'warning' | 'danger' | 'neutral' | 'success';

interface StatBoxProps {
  label: string;
  value: string | number;
  meta?: string;
  tone?: StatTone;
  className?: string;
}

const toneClasses: Record<StatTone, string> = {
  primary: 'border-[rgba(26,93,135,0.16)] bg-[linear-gradient(180deg,rgba(26,93,135,0.1),rgba(255,255,255,0.92))] before:bg-[var(--color-primary-600)]',
  secondary: 'border-[rgba(20,108,102,0.18)] bg-[linear-gradient(180deg,rgba(20,108,102,0.1),rgba(255,255,255,0.92))] before:bg-[var(--color-secondary-600)]',
  accent: 'border-[rgba(180,83,9,0.18)] bg-[linear-gradient(180deg,rgba(180,83,9,0.11),rgba(255,255,255,0.92))] before:bg-[var(--color-accent-600)]',
  warning: 'border-[rgba(138,91,23,0.18)] bg-[linear-gradient(180deg,rgba(138,91,23,0.09),rgba(255,255,255,0.92))] before:bg-[var(--color-warning-700)]',
  danger: 'border-[rgba(184,58,76,0.2)] bg-[linear-gradient(180deg,rgba(184,58,76,0.12),rgba(255,255,255,0.92))] before:bg-[var(--color-danger-700)]',
  neutral: 'border-[var(--color-border-soft)] bg-[linear-gradient(180deg,rgba(234,240,245,0.92),rgba(255,255,255,0.94))] before:bg-[var(--color-ink-500)]',
  success: 'border-[rgba(29,122,88,0.2)] bg-[linear-gradient(180deg,rgba(29,122,88,0.12),rgba(255,255,255,0.92))] before:bg-[var(--color-success-700)]',
};

export default function StatBox({
  label,
  value,
  meta,
  tone = 'neutral',
  className,
}: StatBoxProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-[20px] border p-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:content-[\'\']', toneClasses[tone], className)}>
      <p className="app-caption pl-1 uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--color-ink-900)]">
        {value}
      </p>
      {meta ? <p className="app-caption mt-3 pl-1">{meta}</p> : null}
    </div>
  );
}
