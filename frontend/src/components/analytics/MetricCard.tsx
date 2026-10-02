import Card from '@/components/ui/Card';
import { cn } from '@/lib/cn';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: 'primary' | 'secondary' | 'accent' | 'warning' | 'danger';
}

const toneClasses = {
  primary: 'border-[rgba(47,75,255,0.16)] bg-[linear-gradient(180deg,var(--color-surface-card),var(--color-primary-050))]',
  secondary: 'border-[rgba(94,199,192,0.22)] bg-[linear-gradient(180deg,var(--color-surface-card),var(--color-secondary-050))]',
  accent: 'border-[rgba(123,109,222,0.18)] bg-[linear-gradient(180deg,var(--color-surface-card),var(--color-accent-050))]',
  warning: 'border-[rgba(140,92,22,0.18)] bg-[linear-gradient(180deg,var(--color-surface-card),var(--color-warning-050))]',
  danger: 'border-[rgba(185,59,84,0.16)] bg-[linear-gradient(180deg,var(--color-surface-card),var(--color-danger-050))]',
};

export default function MetricCard({
  title,
  value,
  subtitle,
  tone = 'primary',
}: MetricCardProps) {
  return (
    <Card hoverable className={cn('border p-5 sm:p-6', toneClasses[tone])}>
      <p className="app-caption mb-2 truncate uppercase tracking-[0.14em]">{title}</p>
      <h3 className="break-words text-3xl font-semibold tracking-[-0.03em] text-[var(--color-ink-900)] sm:text-[2rem]">
        {value}
      </h3>
      {subtitle ? <p className="app-body mt-2 text-sm">{subtitle}</p> : null}
    </Card>
  );
}
