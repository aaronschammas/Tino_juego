import { AcceptInviteForm } from '@/components/organizations/AcceptInviteForm';
import { Suspense } from 'react';

export const metadata = {
  title: 'Accept Invitation | Tino',
  description: 'Accept your invitation to join a Tino organization',
};

export default function InvitePage() {
  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <AcceptInviteForm />
      </Suspense>
    </main>
  );
}
