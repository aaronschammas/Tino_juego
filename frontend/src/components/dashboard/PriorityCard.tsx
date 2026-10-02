import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { memo } from 'react';

type PriorityTone = 'danger' | 'accent' | 'success';

interface PriorityItem {
  id?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  tone: PriorityTone;
  count?: number;
}

interface PriorityCardProps {
  item: PriorityItem;
  secondaryNotes: string[];
  onAction?: () => void;
}

const toneClasses: Record<PriorityTone, string> = {
  danger: 'border-[rgba(185,59,84,0.16)] bg-[linear-gradient(135deg,var(--color-danger-050),#fff)]',
  accent: 'border-[rgba(123,109,222,0.18)] bg-[linear-gradient(135deg,var(--color-accent-050),#fff)]',
  success: 'border-[rgba(35,121,104,0.16)] bg-[linear-gradient(135deg,var(--color-success-050),#fff)]',
};

const eyebrowClasses: Record<PriorityTone, string> = {
  danger: 'text-[var(--color-danger-700)]',
  accent: 'text-[var(--color-accent-700)]',
  success: 'text-[var(--color-success-700)]',
};

const PriorityCard = ({ item, secondaryNotes, onAction }: PriorityCardProps) => {
  return (
    <Card className={cn('grid gap-6 border p-6 xl:grid-cols-[minmax(0,1.2fr)_0.8fr]', toneClasses[item.tone])}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className={cn('app-caption uppercase tracking-[0.16em]', eyebrowClasses[item.tone])}>
            Que atender ahora
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-[-0.04em] text-[var(--color-ink-900)]">
              {item.title}
            </h2>
            {typeof item.count === 'number' ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-[var(--color-ink-700)]">
                {item.count}
              </span>
            ) : null}
          </div>
          <p className="app-body max-w-2xl">{item.description}</p>
        </div>

        {item.actionLabel && onAction ? (
          <div>
            <Button onClick={onAction}>{item.actionLabel}</Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-[22px] border border-white/70 bg-white/75 p-5 backdrop-blur-sm">
        <p className="app-caption uppercase tracking-[0.14em]">Lectura rapida</p>
        <div className="space-y-3">
          {secondaryNotes.map((note, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="mt-[7px] h-2 w-2 rounded-full bg-[var(--color-ink-400)]" />
              <p className="text-sm leading-6 text-[var(--color-ink-700)]">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default memo(PriorityCard);
