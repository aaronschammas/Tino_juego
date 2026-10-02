'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays, ListTree, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, apiGet, apiPatch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { getTaskStatusOptions, Task, TaskStatus, taskStatusLabels } from '@/types/task';
import { dueDatePresentation, priorityClasses, priorityLabels, statusClasses } from '@/lib/task-presentation';
import TaskCommentsSection from '@/components/task-comments/TaskCommentsSection';

export default function MobileTaskDetail({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { user, activeOrganization } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const generation = useRef(0);
  const actionLock = useRef(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrganization?.id) return;
    const requestOrganization = activeOrganization.id;
    const requestGeneration = ++generation.current;
    setLoading(true); setError(null); setUnavailable(false); setTask(null);
    try {
      const result = await apiGet<Task>(`/projects/${projectId}/tasks/${taskId}`);
      if (generation.current !== requestGeneration || activeOrganization.id !== requestOrganization) return;
      setTask(result);
    } catch (loadError) {
      if (generation.current !== requestGeneration || activeOrganization.id !== requestOrganization) return;
      const status = loadError instanceof ApiClientError ? loadError.status : undefined;
      if (status === 403 || status === 404) setUnavailable(true);
      else setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la tarea.');
    } finally {
      if (generation.current === requestGeneration && activeOrganization.id === requestOrganization) setLoading(false);
    }
  }, [activeOrganization?.id, projectId, taskId]);

  useEffect(() => {
    void load();
    const invalidate = () => { generation.current += 1; setTask(null); };
    window.addEventListener('organization:changed', invalidate);
    window.addEventListener('auth:cleared', invalidate);
    return () => { generation.current += 1; window.removeEventListener('organization:changed', invalidate); window.removeEventListener('auth:cleared', invalidate); };
  }, [load]);

  const mutate = async (data: { status?: TaskStatus; assignedToId?: string }) => {
    if (!task || actionLock.current || !activeOrganization?.id) return;
    actionLock.current = true; setBusy(true); setActionError(null);
    const requestOrganization = activeOrganization.id;
    const requestGeneration = generation.current;
    const previous = task;
    if (data.status) setTask({ ...task, status: data.status });
    try {
      const suffix = data.status ? '/status' : '';
      const updated = await apiPatch<Task>(`/projects/${projectId}/tasks/${taskId}${suffix}`, data);
      if (generation.current !== requestGeneration || activeOrganization.id !== requestOrganization) return;
      setTask(updated);
      window.dispatchEvent(new Event('task:updated'));
      window.dispatchEvent(new Event('projects:updated'));
    } catch (mutationError) {
      if (generation.current === requestGeneration && activeOrganization.id === requestOrganization) {
        setTask(previous);
        setActionError(mutationError instanceof Error ? mutationError.message : 'No se pudo actualizar la tarea.');
      }
    } finally {
      actionLock.current = false; setBusy(false);
    }
  };

  if (loading) return <div className="mobile-detail-skeleton" aria-label="Cargando detalle de tarea" />;
  if (unavailable) return <div className="mobile-message"><h1>Tarea no disponible</h1><p>No pudimos encontrar una tarea accesible con este enlace.</p><Link href="/mobile/tasks">Volver a tareas</Link></div>;
  if (error || !task) return <div className="mobile-message" role="alert"><h1>No pudimos cargar la tarea</h1><p>{error}</p><button onClick={() => void load()}>Reintentar</button><Link href="/mobile/tasks">Volver a tareas</Link></div>;

  const due = dueDatePresentation(task.dueDate);
  const responsible = task.assignedTo ? `${task.assignedTo.name} ${task.assignedTo.lastname}`.trim() : 'Sin responsable';
  return (
    <article aria-labelledby="mobile-task-detail-title">
      <Link href="/mobile/tasks" className="mobile-back-link"><ArrowLeft size={19} aria-hidden="true" />Volver a tareas</Link>
      <p className="mobile-eyebrow mt-5">{task.project?.name ?? 'Proyecto'}</p>
      <h1 id="mobile-task-detail-title" className="mobile-detail-title">{task.title}</h1>
      <div className="mt-3 flex flex-wrap gap-2"><span className={`mobile-task-badge ${statusClasses[task.status]}`}>{taskStatusLabels[task.status]}</span><span className={`mobile-task-badge ${priorityClasses[task.priority]}`}>{priorityLabels[task.priority]}</span></div>
      <div className="mobile-detail-section">
        <p>{task.description || 'Sin descripcion.'}</p>
        <dl className="mobile-detail-grid">
          <div><dt><UserRound size={16} aria-hidden="true" />Responsable</dt><dd>{responsible}</dd></div>
          <div><dt><CalendarDays size={16} aria-hidden="true" />Vencimiento</dt><dd>{due?.label ?? 'Sin fecha'}</dd></div>
          <div><dt>Estimacion</dt><dd>{task.estimatedHours != null ? `${task.estimatedHours} h` : 'Sin estimacion'}</dd></div>
          <div><dt>Horas reales</dt><dd>{task.actualHours != null ? `${task.actualHours.toFixed(2)} h` : 'Sin registro'}</dd></div>
        </dl>
        {(task.subTasks?.length ?? 0) > 0 && <p className="mobile-subtask-notice"><ListTree size={17} aria-hidden="true" />Esta tarea contiene {task.subTasks!.length} subtareas. Su gestion movil aun no esta disponible.</p>}
      </div>
      <section className="mobile-detail-section" aria-labelledby="mobile-task-actions"><h2 id="mobile-task-actions">Acciones</h2>{actionError && <p role="alert" className="mobile-action-error">{actionError}</p>}<label className="mobile-action-field"><span>Estado</span><select value={task.status} disabled={busy} onChange={(e) => void mutate({ status: e.target.value as TaskStatus })}>{getTaskStatusOptions(task.status).map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}</select></label>{!task.assignedToId && user?.id && <button className="mobile-primary-button w-full mt-3" disabled={busy} onClick={() => void mutate({ assignedToId: user.id })}>{busy ? 'Actualizando...' : 'Tomar tarea'}</button>}</section>
      <div className="mobile-comments"><TaskCommentsSection projectId={projectId} taskId={taskId} /></div>
    </article>
  );
}
