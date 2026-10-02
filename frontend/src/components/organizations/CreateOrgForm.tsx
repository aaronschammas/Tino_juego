'use client';

import React, { useState } from 'react';
import { useOrganizations } from '@/hooks/useOrganizations';

interface CreateOrgFormProps {
  onSuccess?: () => void;
}

export function CreateOrgForm({ onSuccess }: CreateOrgFormProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createOrganization } = useOrganizations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await createOrganization({ name: name.trim() });
      setName('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating organization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold">Create Organization</h2>

      {error && <div className="p-3 bg-red-100 text-red-600 rounded">{error}</div>}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Organization Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
          placeholder="e.g., Demo SRL"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !name}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Creating...' : 'Create Organization'}
      </button>
    </form>
  );
}
