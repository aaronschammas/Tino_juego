import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function Section({
  title,
  description,
  action,
  className,
  children,
}: SectionProps) {
  return (
    <section className={cn('space-y-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="app-section-title">{title}</h2>
          {description ? <p className="app-body">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
