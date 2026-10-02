/**
 * Novedades de Trello para el cartel de la app.
 *
 * - `useIntegrationActivity()`: pide una vez `GET /integrations/activity`. El
 *   cartel se muestra (`visible`) solo si las integraciones estan disponibles y
 *   hubo novedades. Ante un error queda oculto, porque es un aviso y no debe
 *   romper la pantalla. `dismiss()` lo oculta en el momento y avisa al backend
 *   (`POST /integrations/activity/seen`) para que no vuelva a aparecer hasta que
 *   haya novedades nuevas; si ese aviso falla, el cartel igual queda cerrado.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type {
  IntegrationActivityResponse,
  IntegrationActivitySummary,
} from '@/types/integration';

export function useIntegrationActivity() {
  const [summary, setSummary] = useState<IntegrationActivitySummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<IntegrationActivityResponse>('/integrations/activity')
      .then((data) => {
        if (!cancelled) setSummary(data?.available ? data.summary : null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(async () => {
    setDismissed(true);
    await apiPost('/integrations/activity/seen').catch(() => undefined);
  }, []);

  const visible = Boolean(summary && !summary.isEmpty && !dismissed);
  return { summary, visible, dismiss };
}
