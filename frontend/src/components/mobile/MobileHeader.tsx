'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/brand/BrandMark';
import { useAuth } from '@/hooks/useAuth';

export default function MobileHeader() {
  const { activeOrganization, memberships, switchOrganization, isSwitchingOrganization } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleOrganizationChange = async (organizationId: string) => {
    if (!organizationId || organizationId === activeOrganization?.id || isSwitchingOrganization) return;
    setError(null);
    try {
      await switchOrganization(organizationId);
      router.replace('/mobile');
    } catch {
      setError('No se pudo cambiar de organizacion. Intenta nuevamente.');
    }
  };

  return (
    <header className="mobile-header">
      <div className="mobile-header-row">
        <BrandMark href="/mobile" compact ariaLabel="Ir al inicio movil de Tino" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Organizacion activa</span>
          <select
            className="mobile-org-select"
            value={activeOrganization?.id ?? ''}
            disabled={isSwitchingOrganization}
            onChange={(event) => void handleOrganizationChange(event.target.value)}
            aria-describedby={error ? 'mobile-org-error' : undefined}
          >
            {memberships.map((membership) => (
              <option key={membership.membershipId} value={membership.organizationId}>
                {membership.organizationName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p id="mobile-org-error" role="alert" className="mobile-header-error">{error}</p>}
    </header>
  );
}
