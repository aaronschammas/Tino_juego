'use client';

import { useState, useEffect } from 'react';
import { ProjectTimeEntry } from '@/types/project';
import { Task, taskStatusLabels } from '@/types/task';
import { apiPatch } from '@/lib/api';
import Button from '@/components/ui/Button';
import Portal from '@/components/ui/Portal';
import { secondsToHMS } from '@/lib/time';

interface LinkTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ProjectTimeEntry | null;
  tasks: Task[];
  onLinkSuccess: () => void;
}

export default function LinkTimeModal({
  isOpen,
  onClose,
  entry,
  tasks,
  onLinkSuccess,
}: LinkTimeModalProps) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [splitMode, setSplitMode] = useState<'full' | 'partial'>('full');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Calculate entry total active duration
  const activeMs = entry
    ? new Date(entry.endTime).getTime() -
      new Date(entry.startTime).getTime() -
      (entry.totalPausedMs || 0)
    : 0;

  const totalSeconds = Math.max(Math.round(activeMs / 1000), 0);

  useEffect(() => {
    if (isOpen) {
      setSelectedTaskId('');
      setSplitMode('full');
      setHours('0');
      setMinutes('0');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !entry) return null;

  const taskOptions = tasks.flatMap((task) => {
    if (task.subTasks?.length) {
      return task.subTasks.map((subTask) => ({
        task: subTask,
        label: `${task.title} / ${subTask.title}`,
        isSubTask: true,
      }));
    }

    return [{ task, label: task.title, isSubTask: false }];
  });
  const hasParentTasksWithSubTasks = tasks.some((task) => task.subTasks?.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!selectedTaskId) {
        throw new Error('Debes seleccionar una tarea');
      }

      let durationMs: number | undefined;

      if (splitMode === 'partial') {
        const hrs = parseInt(hours) || 0;
        const mins = parseInt(minutes) || 0;
        const selectedMs = (hrs * 3600 + mins * 60) * 1000;

        if (selectedMs <= 0) {
          throw new Error('La duración a vincular debe ser mayor que 0');
        }

        if (selectedMs >= activeMs) {
          throw new Error(
            'La duración parcial no puede superar ni igualar la duración total de la entrada. Para vincular todo el tiempo, usa el modo "Vincular tiempo completo".'
          );
        }

        // Additional validation to ensure at least 1 second remains
        if (activeMs - selectedMs < 1000) {
          throw new Error('Debe quedar al menos 1 segundo restante en la entrada original');
        }

        durationMs = selectedMs;
      }

      await apiPatch(`/time/${entry.id}/link`, {
        taskId: selectedTaskId,
        durationMs,
      });

      onLinkSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al vincular el tiempo');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert input values back to seconds to display remaining duration beautifully
  const selectedSecs = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60;
  const remainingSecs = Math.max(totalSeconds - selectedSecs, 0);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary)]/40 p-4 backdrop-blur-[3px]">
        <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] animate-page-enter border border-white/10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--color-text)]">
              Vincular tiempo a tarea
            </h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="mb-5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-4 border border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-subtle)] uppercase font-semibold tracking-wider">
              Tiempo total disponible
            </p>
            <p className="text-2xl font-extrabold font-mono text-[var(--color-text)] mt-1">
              {secondsToHMS(totalSeconds)}
            </p>
            <p className="text-xs text-[var(--color-text-subtle)] mt-2">
              Registrado por <span className="font-medium text-[var(--color-text)]">{entry.user.name} {entry.user.lastname}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="link-task-select" className="app-label">
                Seleccionar Tarea <span className="text-[var(--color-danger)]">*</span>
              </label>
              <select
                id="link-task-select"
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="app-select"
              >
                <option value="">Selecciona una tarea...</option>
                {taskOptions.map(({ task, label, isSubTask }) => (
                  <option key={task.id} value={task.id}>
                    {isSubTask ? 'Subtarea: ' : 'Tarea: '}{label} ({taskStatusLabels[task.status] || task.status})
                  </option>
                ))}
              </select>
              {taskOptions.length === 0 ? (
                <p className="mt-2 text-xs font-medium text-[var(--color-text-subtle)]">
                  No hay tareas disponibles para vincular.
                </p>
              ) : hasParentTasksWithSubTasks ? (
                <p className="mt-2 text-xs font-medium text-[var(--color-text-subtle)]">
                  Las tareas padre con subtareas se vinculan desde sus subtareas.
                </p>
              ) : null}
            </div>

            <div>
              <span className="app-label">Modalidad de Vinculación</span>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setSplitMode('full')}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 border text-center transition-all ${
                    splitMode === 'full'
                      ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] font-semibold'
                      : 'border-[var(--color-border)] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <span className="text-sm">Tiempo completo</span>
                  <span className="text-[10px] mt-1 opacity-80">Vincula todo el bloque</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('partial')}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 border text-center transition-all ${
                    splitMode === 'partial'
                      ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] font-semibold'
                      : 'border-[var(--color-border)] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <span className="text-sm">Vincular parte</span>
                  <span className="text-[10px] mt-1 opacity-80">Divide la duración</span>
                </button>
              </div>
            </div>

            {splitMode === 'partial' && (
              <div className="space-y-4 animate-page-enter">
                <div>
                  <label className="app-label">Duración a Vincular (HH:mm)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        className="app-input text-center font-mono"
                        placeholder="HH"
                      />
                      <span className="absolute -top-2 left-2 bg-[var(--color-surface)] px-1 text-[10px] text-gray-400 font-bold uppercase">
                        HRS
                      </span>
                    </div>
                    <span className="text-xl font-bold text-gray-300">:</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={minutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setMinutes(Math.min(val, 59).toString());
                        }}
                        className="app-input text-center font-mono"
                        placeholder="MM"
                      />
                      <span className="absolute -top-2 left-2 bg-[var(--color-surface)] px-1 text-[10px] text-gray-400 font-bold uppercase">
                        MIN
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider block text-[9px]">A Vincular</span>
                    <span className="font-mono text-slate-800 text-sm">{secondsToHMS(selectedSecs)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider block text-[9px]">Restará en Proyecto</span>
                    <span className="font-mono text-slate-800 text-sm">{secondsToHMS(remainingSecs)}</span>
                  </div>
                </div>
              </div>
            )}

            {error ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-3 text-xs text-[var(--color-danger)] font-medium">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3 border-t border-[var(--color-border)] pt-5 mt-2">
              <Button type="button" variant="secondary" onClick={onClose} fullWidth>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} fullWidth>
                {isSubmitting ? 'Vinculando...' : 'Confirmar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
