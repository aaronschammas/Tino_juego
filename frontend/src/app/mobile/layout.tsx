import type { Metadata } from 'next';
import MobileProtectedLayout from '@/components/mobile/MobileProtectedLayout';

export const metadata: Metadata = { title: 'Tino Mobile' };

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <MobileProtectedLayout>{children}</MobileProtectedLayout>;
}
