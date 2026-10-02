'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { CreateOrgForm } from '@/components/organizations/CreateOrgForm';
import { InviteMemberForm } from '@/components/organizations/InviteMemberForm';
import { OrgSettings } from '@/components/organizations/OrgSettings';

export default function WorkspacePage() {
  const { user } = useAuth();
  const [hasOrg, setHasOrg] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useRequireAuth();

  React.useEffect(() => {
    // Check if user has organization
    setHasOrg(!!user?.organizationId);
  }, [user]);

  const handleOrgCreated = () => {
    setHasOrg(true);
    setRefreshKey((prev) => prev + 1);
  };

  const handleMembersUpdated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Workspace Settings</h1>

      {hasOrg === false ? (
        <div className="grid md:grid-cols-2 gap-6">
          <CreateOrgForm onSuccess={handleOrgCreated} />
        </div>
      ) : hasOrg ? (
        <div key={refreshKey} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <InviteMemberForm onSuccess={handleMembersUpdated} />
          </div>

          <OrgSettings onMembersUpdated={handleMembersUpdated} />
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600">Checking your organization status...</p>
        </div>
      )}
    </div>
  );
}
