/**
 * Estado y llamadas de la importacion manual de Trello (SUPERADMIN).
 *
 * - `authorize()`: pide al backend la URL de autorizacion para el origen actual,
 *   abre la ventana de Trello (donde se puede entrar con Google u otra cuenta),
 *   guarda el token solo en memoria y carga los tableros de esa cuenta.
 * - `getConnectionStatus()`: si la autorizacion con Trello esta disponible.
 * - `listBoards()`: tableros de la cuenta autorizada con un token.
 * - `preview()` / `executeImport()`: vista previa e importacion; al importar
 *   avisa con `projects:updated` y `task:updated` para refrescar las vistas.
 * - `reset()`: limpia todo, incluido el token.
 * Cada llamada maneja `isLoading` y deja el mensaje de error en `error`.
 */
import { useCallback, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { requestTrelloToken } from '@/lib/trelloAuthPopup';
import {
  TrelloBoard,
  TrelloConnectionStatus,
  TrelloImportPreview,
  TrelloImportRequest,
  TrelloImportResult,
} from '@/types/trello-import';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useTrelloImport() {
  const [token, setToken] = useState<string | null>(null);
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [previewData, setPreviewData] = useState<TrelloImportPreview | null>(null);
  const [result, setResult] = useState<TrelloImportResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<TrelloConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(fallback: string, action: () => Promise<T>): Promise<T> => {
      try {
        setIsLoading(true);
        setError(null);
        return await action();
      } catch (err) {
        setError(getErrorMessage(err, fallback));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const getConnectionStatus = useCallback(
    () =>
      run('Error al consultar conexion Trello', async () => {
        const data = await apiGet<TrelloConnectionStatus>('/trello-import/connection');
        setConnectionStatus(data);
        return data;
      }),
    [run],
  );

  const loadBoards = useCallback(async (userToken: string) => {
    setResult(null);
    const data = await apiPost<TrelloBoard[]>('/trello-import/boards', { token: userToken });
    setBoards(data);
    return data;
  }, []);

  const listBoards = useCallback(
    (userToken: string) => run('Error al cargar tableros de Trello', () => loadBoards(userToken)),
    [loadBoards, run],
  );

  const authorize = useCallback(
    () =>
      run('No se pudo autorizar Trello', async () => {
        const origin = encodeURIComponent(window.location.origin);
        const { url } = await apiGet<{ url: string }>(
          `/trello-import/authorize-url?returnOrigin=${origin}`,
        );
        const userToken = await requestTrelloToken(url);
        setToken(userToken);
        setPreviewData(null);
        return loadBoards(userToken);
      }),
    [loadBoards, run],
  );

  const preview = useCallback(
    (request: TrelloImportRequest) =>
      run('Error al generar preview', async () => {
        setResult(null);
        const data = await apiPost<TrelloImportPreview>('/trello-import/preview', request);
        setPreviewData(data);
        return data;
      }),
    [run],
  );

  const executeImport = useCallback(
    (request: TrelloImportRequest) =>
      run('Error al importar desde Trello', async () => {
        const data = await apiPost<TrelloImportResult>('/trello-import/import', request);
        setResult(data);
        setPreviewData(data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('projects:updated'));
          window.dispatchEvent(new Event('task:updated'));
        }
        return data;
      }),
    [run],
  );

  const reset = useCallback(() => {
    setToken(null);
    setBoards([]);
    setPreviewData(null);
    setResult(null);
    setConnectionStatus(null);
    setError(null);
  }, []);

  return {
    token,
    boards,
    previewData,
    result,
    connectionStatus,
    isLoading,
    error,
    authorize,
    getConnectionStatus,
    listBoards,
    preview,
    executeImport,
    reset,
  };
}
