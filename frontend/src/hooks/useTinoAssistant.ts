'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPost } from '@/lib/api';
import { useAuth } from './useAuth';
import type { AssistantAnswer, AssistantMessage } from '@/types/assistant';

export const TINO_SUGGESTIONS = [
  'Qué pasó hoy en mi equipo',
  'Cuántas horas trabajamos esta semana',
  'Qué tareas están atrasadas',
  'Qué proyecto consumió más tiempo',
  'Quién tiene más carga de trabajo',
  'Qué tareas no tienen responsable',
  'Qué timers están activos',
  'Dame un resumen para una reunión',
];

export function useTinoAssistant() {
  const { user, activeOrganization } = useAuth();
  const scope = `${user?.id ?? ''}:${activeOrganization?.id ?? ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const generation = useRef(0);
  const sequence = useRef(0);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    generation.current += 1;
    setMessages([]);
    setLoading(false);
    setError(null);
  }, []);

  const send = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || loading || !user?.id || !activeOrganization?.id) return false;
    const requestScope = scopeRef.current;
    const requestGeneration = generation.current;
    const id = ++sequence.current;
    setMessages((current) => [...current, { id: `user-${id}`, role: 'user', text: query }]);
    setLoading(true);
    setError(null);
    try {
      const answer = await apiPost<AssistantAnswer>('/mobile/assistant/query', { query });
      if (!valid()) return false;
      setMessages((current) => [...current, { id: `assistant-${id}`, role: 'assistant', answer }]);
      return true;
    } catch (requestError) {
      if (valid()) setError(requestError instanceof Error ? requestError.message : 'No pude responder la consulta.');
      return false;
    } finally {
      if (valid()) setLoading(false);
    }

    function valid() {
      return generation.current === requestGeneration && scopeRef.current === requestScope;
    }
  }, [activeOrganization?.id, loading, user?.id]);

  useEffect(() => {
    clear();
  }, [clear, scope]);

  useEffect(() => {
    window.addEventListener('organization:changed', clear);
    window.addEventListener('auth:cleared', clear);
    return () => {
      generation.current += 1;
      window.removeEventListener('organization:changed', clear);
      window.removeEventListener('auth:cleared', clear);
    };
  }, [clear]);

  return { messages, loading, error, send, suggestions: TINO_SUGGESTIONS };
}
