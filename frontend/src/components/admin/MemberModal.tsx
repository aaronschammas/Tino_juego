'use client';

import React, { useState } from 'react';
import Portal from '@/components/ui/Portal';
import { apiPost } from '@/lib/api';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
}

export default function MemberModal({ isOpen, onClose, onSuccess, orgId }: MemberModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    lastname: '',
    role: 'ORG_MEMBER',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await apiPost(`/admin/orgs/${orgId}/members`, formData);
      onSuccess();
      onClose();
      setFormData({ email: '', password: '', name: '', lastname: '', role: 'ORG_MEMBER' }); // Reset form
    } catch (err: any) {
      setError(err?.message || 'Error al crear el miembro');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl animate-page-enter max-h-[90vh] overflow-y-auto">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Crear Miembro</h2>
            <button
              onClick={onClose}
              className="text-xl font-semibold text-slate-400 hover:text-slate-700 transition-colors"
            >
              x
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-900">
                Nombre
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej. Juan"
              />
            </div>

            <div>
              <label htmlFor="lastname" className="mb-2 block text-sm font-semibold text-slate-900">
                Apellido
              </label>
              <input
                id="lastname"
                type="text"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej. Pérez"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-900">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-900">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <label htmlFor="role" className="mb-2 block text-sm font-semibold text-slate-900">
                Rol en la Organización
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ORG_MEMBER">Miembro</option>
                <option value="ORG_OWNER">Propietario</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 rounded-lg bg-[#1e3a5f] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#152a46] disabled:opacity-50"
              >
                {isLoading ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
