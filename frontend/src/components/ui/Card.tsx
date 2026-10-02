import { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({
  children,
  className,
  hoverable = false,
  padding = 'md',
  ...props
}: PropsWithChildren<CardProps>) {
  return (
    <div
      className={cn(
        'app-card',
        hoverable && 'app-card-hover',
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
