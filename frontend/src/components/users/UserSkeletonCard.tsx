'use client';

import { memo } from 'react';
import Card from '@/components/ui/Card';

const UserSkeletonCard = () => {
  return (
    <Card className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-[var(--color-ink-100)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded-full bg-[var(--color-ink-100)]" />
            <div className="h-3 w-44 rounded-full bg-[var(--color-ink-050)]" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-full bg-[var(--color-ink-050)]" />
          <div className="h-6 w-20 rounded-full bg-[var(--color-ink-050)]" />
        </div>
        <div className="h-16 rounded-[18px] bg-[var(--color-ink-050)]" />
      </div>
    </Card>
  );
};

export default memo(UserSkeletonCard);
