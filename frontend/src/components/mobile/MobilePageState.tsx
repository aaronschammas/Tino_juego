import type { LucideIcon } from 'lucide-react';

export default function MobilePageState({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <section className="mobile-state" aria-labelledby="mobile-page-title">
      <div className="mobile-state-icon" aria-hidden="true"><Icon size={28} /></div>
      <h1 id="mobile-page-title" className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>
    </section>
  );
}
