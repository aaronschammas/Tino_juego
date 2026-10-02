'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { apiGet, apiPatch } from '@/lib/api';
import { TaskStatus } from '@/types/task';
import type { MobileTaskFilters, TaskListItem, TasksPage } from '@/types/task-list';

const EMPTY_FILTERS: MobileTaskFilters = { search: '', projectId: '', status: '', priority: '', assignedTo: '', overdue: null };

function queryString(filters: MobileTaskFilters, page: number) {
  const query = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (filters.search.trim()) query.set('search', filters.search.trim());
  if (filters.projectId) query.set('projectId', filters.projectId);
  if (filters.status) query.set('status', filters.status);
  if (filters.priority) query.set('priority', filters.priority);
  if (filters.assignedTo) query.set('assignedTo', filters.assignedTo);
  if (filters.overdue !== null) query.set('overdue', String(filters.overdue));
  return query.toString();
}

export function useMobileTasks() {
  const { user, activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [filters, setFiltersState] = useState<MobileTaskFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const mutationLocks = useRef(new Set<string>());
  const [, forceLocksRender] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const effectiveFilters = useMemo(() => ({ ...filters, search: debouncedSearch }), [debouncedSearch, filters]);

  const clearForContextChange = useCallback(() => {
    generation.current += 1;
    mutationLocks.current.clear();
    setItems([]);
    setPage(0);
    setTotalPages(0);
    setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const clear = () => clearForContextChange();
    window.addEventListener('organization:changed', clear);
    window.addEventListener('auth:cleared', clear);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.removeEventListener('organization:changed', clear);
      window.removeEventListener('auth:cleared', clear);
    };
  }, [clearForContextChange]);

  const load = useCallback(async (targetPage = 1, append = false) => {
    if (!organizationId || !user?.id) return;
    const requestGeneration = ++generation.current;
    const requestOrganization = organizationId;
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<TasksPage>(`/tasks?${queryString(effectiveFilters, targetPage)}`);
      if (!mounted.current || generation.current !== requestGeneration || activeOrganization?.id !== requestOrganization) return;
      setItems((current) => append ? [...current, ...result.items] : result.items);
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch (loadError) {
      if (!mounted.current || generation.current !== requestGeneration || activeOrganization?.id !== requestOrganization) return;
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las tareas.');
      if (!append) setItems([]);
    } finally {
      if (mounted.current && generation.current === requestGeneration && activeOrganization?.id === requestOrganization) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [activeOrganization?.id, effectiveFilters, organizationId, user?.id]);

  useEffect(() => {
    clearForContextChange();
    if (organizationId && user?.id) void load(1, false);
  }, [clearForContextChange, load, organizationId, user?.id]);

  const setFilters = useCallback((next: Partial<MobileTaskFilters>) => {
    setFiltersState((current) => ({ ...current, ...next }));
  }, []);

  const mutate = useCallback(async (task: TaskListItem, kind: 'status' | 'take', value?: TaskStatus) => {
    const lock = `${kind}:${task.id}`;
    if (mutationLocks.current.has(lock) || !organizationId || !user?.id) return false;
    mutationLocks.current.add(lock);
    forceLocksRender((x) => x + 1);
    const requestOrganization = organizationId;
    const requestGeneration = generation.current;
    const previous = items;
    if (kind === 'status' && value) setItems((current) => current.map((item) => item.id === task.id ? { ...item, status: value } : item));
    try {
      const updated = await apiPatch<TaskListItem>(
        kind === 'status' ? `/projects/${task.projectId}/tasks/${task.id}/status` : `/projects/${task.projectId}/tasks/${task.id}`,
        kind === 'status' ? { status: value } : { assignedToId: user.id },
      );
      if (!mounted.current || generation.current !== requestGeneration || activeOrganization?.id !== requestOrganization) return false;
      setItems((current) => current.map((item) => item.id === task.id ? { ...item, ...updated, project: item.project, hasSubTasks: item.hasSubTasks, assignmentSource: kind === 'take' ? 'direct' : item.assignmentSource } : item));
      window.dispatchEvent(new Event('task:updated'));
      window.dispatchEvent(new Event('projects:updated'));
      return true;
    } catch (mutationError) {
      if (mounted.current && generation.current === requestGeneration && activeOrganization?.id === requestOrganization) {
        setItems(previous);
        setError(mutationError instanceof Error ? mutationError.message : 'No se pudo actualizar la tarea.');
      }
      return false;
    } finally {
      mutationLocks.current.delete(lock);
      if (mounted.current) forceLocksRender((x) => x + 1);
    }
  }, [activeOrganization?.id, items, organizationId, user?.id]);

  return {
    items, filters, page, totalPages, isLoading, isLoadingMore, error,
    setFilters,
    retry: () => load(1, false),
    refresh: () => load(1, false),
    loadMore: () => page < totalPages ? load(page + 1, true) : Promise.resolve(),
    changeStatus: (task: TaskListItem, status: TaskStatus) => mutate(task, 'status', status),
    takeTask: (task: TaskListItem) => mutate(task, 'take'),
    isMutating: (taskId: string) => mutationLocks.current.has(`status:${taskId}`) || mutationLocks.current.has(`take:${taskId}`),
  };
}
