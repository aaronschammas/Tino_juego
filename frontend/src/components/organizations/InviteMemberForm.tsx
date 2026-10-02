'use client';

import React, { useState } from 'react';
import { useOrganizations } from '@/hooks/useOrganizations';

interface InviteMemberFormProps {
  onSuccess?: () => void;
}

export function InviteMemberForm({ onSuccess }: InviteMemberFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ORG_MEMBER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { inviteMember } = useOrganizations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setIsLoading(true);

    try {
      const response = await inviteMember({ email, role: role as any });
      setEmail('');
      setInviteLink(response?.inviteLink || null);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inviting member');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard!');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold">Invite Member</h2>

      {error && <div className="p-3 bg-red-100 text-red-600 rounded">{error}</div>}

      {inviteLink && (
        <div className="p-3 bg-green-100 text-green-600 rounded space-y-2">
          <p className="font-semibold">✅ Invitation created!</p>
          <p className="text-sm break-all">{inviteLink}</p>
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-sm underline hover:no-underline"
          >
            Copy Link
          </button>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={!!inviteLink}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="ana@demo.com"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={!!inviteLink}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="ORG_MEMBER">Member</option>
          <option value="ORG_OWNER">Owner</option>
        </select>
      </div>

      {!inviteLink && (
        <button
          type="submit"
          disabled={isLoading || !email}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Sending...' : 'Send Invitation'}
        </button>
      )}

      {inviteLink && (
        <button
          type="button"
          onClick={() => {
            setInviteLink(null);
            setEmail('');
          }}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          Invite Another Member
        </button>
      )}
    </form>
  );
}
