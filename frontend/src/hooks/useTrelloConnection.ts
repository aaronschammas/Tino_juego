/**
 * Estado y llamadas del flujo "Conectar Trello" de un proyecto.
 *
 * - `authorize()`: pide al backend la URL de autorizacion para el origen actual,
 *   abre la ventana de Trello y guarda el token solo en memoria.
 * - `listBoards()`: tableros del usuario con ese token.
 * - `preview()`: vista previa con la equivalencia de listas sugerida.
 * - `connect()`: primera importacion + alta de la conexion; al terminar avisa
 *   con `projects:updated` y `task:updated` para refrescar las vistas.
 * - `clearPreview()`: descarta la vista previa cuando cambia tablero o destino.
 * - `reset()`: limpia todo, incluido el token.
 * Cada llamada maneja `isLoading` y deja el mensaje de error en `error`.
 */
import { useCallback, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { requestTrelloToken } from '@/lib/trelloAuthPopup';
import {
  TrelloConnectionPreview,
  TrelloConnectionRequest,
  TrelloConnectionResult,
  TrelloConnectRequest,
} from '@/types/integration';
import { TrelloBoard } from '@/types/trello-import';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useTrelloConnection() {
  const [token, setToken] = useState<string | null>(null);
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [previewData, setPreviewData] = useState<TrelloConnectionPreview | null>(null);
  const [result, setResult] = useState<TrelloConnectionResult | null>(null);
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

  const listBoards = useCallback(
    (userToken: string) =>
      run('Error al cargar tableros de Trello', async () => {
        const data = await apiPost<TrelloBoard[]>('/integrations/trello/boards', {
          token: userToken,
        });
        setBoards(data);
        return data;
      }),
    [run],
  );

  const authorize = useCallback(
    () =>
      run('No se pudo autorizar Trello', async () => {
        const origin = encodeURIComponent(window.location.origin);
        const { url } = await apiGet<{ url: string }>(
          `/integrations/trello/authorize-url?returnOrigin=${origin}`,
        );
        const userToken = await requestTrelloToken(url);
        setToken(userToken);
        const data = await apiPost<TrelloBoard[]>('/integrations/trello/boards', {
          token: userToken,
        });
        setBoards(data);
        return userToken;
      }),
    [run],
  );

  const preview = useCallback(
    (request: TrelloConnectionRequest) =>
      run('Error al generar la vista previa', async () => {
        setResult(null);
        const data = await apiPost<TrelloConnectionPreview>(
          '/integrations/trello/preview',
          request,
        );
        setPreviewData(data);
        return data;
      }),
    [run],
  );

  const connect = useCallback(
    (request: TrelloConnectRequest) =>
      run('Error al conectar el tablero', async () => {
        const data = await apiPost<TrelloConnectionResult>(
          '/integrations/trello/connect',
          request,
        );
        setResult(data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('projects:updated'));
          window.dispatchEvent(new Event('task:updated'));
        }
        return data;
      }),
    [run],
  );

  const clearPreview = useCallback(() => {
    setPreviewData(null);
    setResult(null);
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setBoards([]);
    setPreviewData(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    token,
    boards,
    previewData,
    result,
    isLoading,
    error,
    authorize,
    listBoards,
    preview,
    connect,
    clearPreview,
    reset,
  };
}
