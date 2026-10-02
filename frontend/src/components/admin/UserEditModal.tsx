'use client';

import React, { useState, useEffect } from 'react';
import Portal from '@/components/ui/Portal';
import { apiPut } from '@/lib/api';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user?: { id: string; name: string; lastname: string; email: string } | null;
}

export default function UserEditModal({ isOpen, onClose, onSuccess, user }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        password: '', // Don't populate password
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const dataToSend: any = {
        name: formData.name,
        lastname: formData.lastname,
        email: formData.email,
      };
      if (formData.password) {
        dataToSend.password = formData.password;
      }

      await apiPut(`/admin/users/${user?.id}`, dataToSend);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar el usuario');
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
            <h2 className="text-2xl font-bold text-slate-900">Editar Usuario</h2>
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
              <label htmlFor="edit-name" className="mb-2 block text-sm font-semibold text-slate-900">
                Nombre
              </label>
              <input
                id="edit-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-lastname" className="mb-2 block text-sm font-semibold text-slate-900">
                Apellido
              </label>
              <input
                id="edit-lastname"
                type="text"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-email" className="mb-2 block text-sm font-semibold text-slate-900">
                Email
              </label>
              <input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-password" className="mb-2 block text-sm font-semibold text-slate-900">
                Nueva Contraseña (opcional)
              </label>
              <input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dejar en blanco para no cambiar"
              />
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
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
