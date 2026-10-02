import { ReactNode } from 'react';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  variant?: 'default' | 'dashed';
}

export default function EmptyState({
  title,
  description,
  icon = '•',
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div className={cn(
      'p-12 text-center flex flex-col items-center justify-center rounded-[32px] transition-all',
      variant === 'dashed' ? 'border-2 border-dashed border-slate-200 bg-slate-50/20' : 'bg-white border border-slate-100 shadow-sm',
      className
    )}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100/50 text-slate-400">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-[20px] font-extrabold text-slate-900 tracking-tight">{title}</h3>
          <p className="text-[15px] text-slate-500 font-medium leading-relaxed">{description}</p>
        </div>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}
