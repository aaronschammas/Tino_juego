'use client';

import { useEffect, useState } from 'react';
import { Task } from '@/types/task';
import { normalizeDurationParts, secondsToHMS } from '@/lib/time';
import Button from '@/components/ui/Button';
import Portal from '@/components/ui/Portal';
import {
  MAX_TASK_HOURS,
  MAX_TASK_MINUTES,
  parseTaskDuration,
  shortTaskSeconds,
  TASK_DURATION_ERROR,
} from '@/lib/taskDuration';

interface StartTimerDurationModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirm: (minutes: number) => Promise<void> | void;
}

export default function StartTimerDurationModal({
  isOpen,
  task,
  onClose,
  onConfirm,
}: StartTimerDurationModalProps) {
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const remaining = task?.estimatedHours
        ? Math.round((task.estimatedHours - (task.actualHours || 0)) * 60)
        : 0;
      const initial = remaining > 0 ? Math.min(remaining, MAX_TASK_HOURS * 60 + MAX_TASK_MINUTES) : 30;
      setHours(Math.floor(initial / 60).toString());
      setMinutes((initial % 60).toString());
      setIsSubmitting(false);
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const shortSeconds = shortTaskSeconds(task);
  const totalMinutes = shortSeconds ? 1 : parseTaskDuration(hours, minutes);

  const handleDurationBlur = () => {
    const normalized = normalizeDurationParts(hours, minutes);
    setHours(normalized.hours);
    setMinutes(normalized.minutes);
  };

  const handleConfirm = async () => {
    if (!totalMinutes || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(totalMinutes);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary)]/40 p-4 backdrop-blur-[2px]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] animate-page-enter"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-subtle)]">
                Cronómetro
              </p>
              <h2 className="text-xl font-bold text-[var(--color-text)]">Configurar duración</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] transition-colors"
            >
              ✕
            </button>
          </div>

          <p className="mb-4 text-sm text-[var(--color-text-subtle)]">
            {shortSeconds ? 'Vas a trabajar en' : 'Configurá cuánto tiempo querés trabajar en'}{' '}
            <span className="font-semibold text-[var(--color-text)]">{task.title}</span>.
          </p>

          {shortSeconds ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Duración de la tarea</p>
              <p className="font-mono text-3xl font-bold text-[var(--color-text)]" aria-label="Duración de la tarea">
                {secondsToHMS(shortSeconds)}
              </p>
              <p className="mt-1 text-xs leading-snug text-blue-800">
                Esta tarea tardará {shortSeconds} segundos en realizarse. El cronómetro no puede durar más que eso.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max={MAX_TASK_HOURS}
                  step="1"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  onBlur={handleDurationBlur}
                  className="app-input text-center font-mono"
                  placeholder="HH"
                  aria-label="Horas"
                />
                <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-400 font-bold uppercase">
                  HRS
                </span>
              </div>
              <span className="text-xl font-bold text-gray-300">:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  onBlur={handleDurationBlur}
                  className="app-input text-center font-mono"
                  placeholder="MM"
                  aria-label="Minutos"
                />
                <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-400 font-bold uppercase">
                  MIN
                </span>
              </div>
            </div>
          )}
          {totalMinutes === null ? <p role="alert" className="mt-2 text-sm text-red-600">{TASK_DURATION_ERROR}</p> : null}

          <div className="flex gap-3 border-t border-[var(--color-border)] pt-5 mt-6">
            <Button type="button" variant="secondary" onClick={onClose} fullWidth>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || !totalMinutes}
              fullWidth
            >
              {isSubmitting ? 'Iniciando...' : 'Iniciar cronómetro'}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
