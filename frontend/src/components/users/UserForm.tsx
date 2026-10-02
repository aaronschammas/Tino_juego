'use client';

import { useState, useEffect } from 'react';
import { User, CreateUserDto } from '@/types/user';
import Button from '@/components/ui/Button';

import Portal from '@/components/ui/Portal';

interface UserFormProps {
  user?: User;
  onSubmit: (data: CreateUserDto) => Promise<void>;
  onCancel: () => void;
}

export default function UserForm({ user, onSubmit, onCancel }: UserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    lastname: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        name: user.name,
        lastname: user.lastname,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary)]/40 p-4 backdrop-blur-[2px]">
        <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] animate-page-enter">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-text)]">
              {user ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="app-label">
                Email <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="app-input"
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div>
              <label htmlFor="name" className="app-label">
                Nombre <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="app-input"
                placeholder="Juan"
              />
            </div>

            <div>
              <label htmlFor="lastname" className="app-label">
                Apellido <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="lastname"
                type="text"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                required
                className="app-input"
                placeholder="Pérez"
              />
            </div>

            {error && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-3 text-xs text-[var(--color-danger)] font-medium">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-5 border-t border-[var(--color-border)] mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                fullWidth
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                fullWidth
              >
                {isSubmitting ? 'Guardando...' : user ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
