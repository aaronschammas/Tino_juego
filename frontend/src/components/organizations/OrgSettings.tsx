'use client';

import React, { useEffect, useState } from 'react';
import { useOrganizations } from '@/hooks/useOrganizations';
import { OrganizationDetail } from '@/types/organization';
import { formatUserDisplayName } from '@/lib/user-display';

interface OrgSettingsProps {
  onMembersUpdated?: () => void;
}

export function OrgSettings({ onMembersUpdated }: OrgSettingsProps) {
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const { getMyOrganization, removeMember } = useOrganizations();

  const loadOrganization = async () => {
    try {
      setError(null);
      const data = await getMyOrganization();
      setOrg(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading organization');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrganization();
  }, []);


  const handleCopyInviteLink = async (inviteLink: string, email: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyMessage(`✅ Link copiado para ${email}`);
      setTimeout(() => setCopyMessage(null), 2000);
    } catch {
      setCopyMessage('❌ No se pudo copiar el link');
      setTimeout(() => setCopyMessage(null), 2000);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    setRemoving(userId);
    try {
      await removeMember(userId);
      await loadOrganization();
      onMembersUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing member');
    } finally {
      setRemoving(null);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div className="p-3 bg-red-100 text-red-600 rounded">{error}</div>;
  if (!org) return <div>Organization not found</div>;

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">{org.name}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Plan</p>
            <p className="text-lg font-semibold">{org.plan?.title || 'Free'}</p>
            <p className="text-xs text-blue-600">
              {org.plan?.price === 0 ? 'Gratis' : `$${org.plan?.price}/mes`}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Your Role</p>
            <p className="text-lg font-semibold">{org.userRole}</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Members ({org.members.length})</h3>

        {org.members.length === 0 ? (
          <p className="text-gray-600">No members yet</p>
        ) : (
          <div className="space-y-2">
            {org.members.map((member) => (
              <div key={member.membershipId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="font-semibold">
                    {formatUserDisplayName(member.name, member.lastname) || member.email}
                  </p>
                  <p className="text-sm text-gray-600">{member.email}</p>
                  <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
                    {member.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-1 text-sm bg-gray-100 rounded">
                    {member.role}
                  </span>
                  {org.userRole === 'ORG_OWNER' && member.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={removing === member.userId}
                      className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
                    >
                      {removing === member.userId ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {copyMessage && (
        <div className="p-3 bg-green-100 text-green-700 rounded">{copyMessage}</div>
      )}

      {/* Pending Invites */}
      {org.pendingInvites.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">Pending Invitations ({org.pendingInvites.length})</h3>

          <div className="space-y-2">
            {org.pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                <div className="flex-1">
                  <p className="font-semibold">{invite.email}</p>
                  <p className="text-sm text-gray-600">Estado: {invite.status}</p>
                  <p className="text-sm text-gray-600">
                    Creada: {new Date(invite.createdAt!).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                  </p>
                </div>
                <div className="text-right space-y-2">
                  <span className="inline-block px-2 py-1 text-sm bg-yellow-100 text-yellow-600 rounded">
                    {invite.role}
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => handleCopyInviteLink(invite.inviteLink!, invite.email)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Copiar link
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
