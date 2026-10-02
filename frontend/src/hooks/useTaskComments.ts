"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { TaskComment, TaskCommentsPage } from "@/types/task-comment";
import { useAuth } from "./useAuth";

export function useTaskComments(projectId: string, taskId: string) {
  const { activeOrganization } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const generation = useRef(0);
  const base = `/projects/${projectId}/tasks/${taskId}/comments`;

  const load = useCallback(async () => {
    const requestGeneration = ++generation.current;
    const requestOrganization = activeOrganization?.id;
    setLoading(true);
    setError(null);
    try {
      const page = await apiGet<TaskCommentsPage>(base);
      if (generation.current !== requestGeneration || activeOrganization?.id !== requestOrganization) return;
      setComments(page.items);
      setNextCursor(page.nextCursor);
    } catch (e) {
      if (generation.current !== requestGeneration || activeOrganization?.id !== requestOrganization) return;
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar los comentarios",
      );
    } finally {
      if (generation.current === requestGeneration && activeOrganization?.id === requestOrganization) setLoading(false);
    }
  }, [activeOrganization?.id, base]);

  useEffect(() => {
    void load();
    const invalidate = () => {
      generation.current += 1;
      setComments([]);
      setNextCursor(null);
    };
    window.addEventListener('organization:changed', invalidate);
    window.addEventListener('auth:cleared', invalidate);
    return () => {
      generation.current += 1;
      window.removeEventListener('organization:changed', invalidate);
      window.removeEventListener('auth:cleared', invalidate);
    };
  }, [load]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const requestGeneration = generation.current;
    const requestOrganization = activeOrganization?.id;
    setLoadingMore(true);
    try {
      const page = await apiGet<TaskCommentsPage>(
        `${base}?cursor=${encodeURIComponent(nextCursor)}`,
      );
      if (generation.current !== requestGeneration || activeOrganization?.id !== requestOrganization) return;
      setComments((current) => [...page.items, ...current]);
      setNextCursor(page.nextCursor);
    } finally {
      if (generation.current === requestGeneration && activeOrganization?.id === requestOrganization) setLoadingMore(false);
    }
  }, [activeOrganization?.id, base, loadingMore, nextCursor]);

  const create = useCallback(
    async (content: string) => {
      if (submitting.current) return false;
      const trimmed = content.trim();
      if (!trimmed || trimmed.length > 2000) return false;
      submitting.current = true;
      const requestGeneration = generation.current;
      const requestOrganization = activeOrganization?.id;
      try {
        const item = await apiPost<TaskComment>(base, { content: trimmed });
        if (generation.current !== requestGeneration || activeOrganization?.id !== requestOrganization) return false;
        setComments((c) => [...c, item]);
        setError(null);
        return true;
      } catch (createError) {
        if (generation.current === requestGeneration && activeOrganization?.id === requestOrganization) {
          setError(createError instanceof Error ? createError.message : 'No se pudo publicar el comentario');
        }
        return false;
      } finally {
        submitting.current = false;
      }
    },
    [activeOrganization?.id, base],
  );

  const update = useCallback(
    async (id: string, content: string) => {
      const item = await apiPatch<TaskComment>(`${base}/${id}`, {
        content: content.trim(),
      });
      setComments((c) => c.map((x) => (x.id === id ? item : x)));
    },
    [base],
  );

  const remove = useCallback(
    async (id: string) => {
      const item = await apiDelete<TaskComment>(`${base}/${id}`);
      setComments((c) => c.map((x) => (x.id === id ? item : x)));
    },
    [base],
  );

  return {
    comments,
    nextCursor,
    loading,
    loadingMore,
    error,
    retry: load,
    loadOlder,
    create,
    update,
    remove,
  };
}
