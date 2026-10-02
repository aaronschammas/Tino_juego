/**
 * Autorizacion de Trello en una ventana emergente.
 *
 * Trello devuelve el token en el fragmento (`#token=...`) de la pagina
 * `/integrations/trello/callback`, que se lo pasa a esta ventana con
 * `postMessage`. El token queda solo en memoria: no se guarda en localStorage
 * ni viaja en la URL de la app.
 *
 * - `TRELLO_TOKEN_MESSAGE`: tipo del mensaje que envia la pagina de retorno.
 * - `readTrelloCallback()`: lee `token` o `error` del fragmento de la URL.
 * - `requestTrelloToken()`: abre la ventana y resuelve con el token. Solo acepta
 *   mensajes del mismo origen y de esa ventana; falla si el navegador bloquea
 *   la ventana, si el usuario la cierra o si Trello devuelve un error.
 */
export const TRELLO_TOKEN_MESSAGE = 'tino:trello-auth';

export interface TrelloCallbackMessage {
  type: typeof TRELLO_TOKEN_MESSAGE;
  token?: string;
  error?: string;
}

export function readTrelloCallback(hash: string): { token?: string; error?: string } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token')?.trim();
  const error = params.get('error')?.trim();
  return {
    ...(token ? { token } : {}),
    ...(error ? { error } : {}),
  };
}

export function requestTrelloToken(authorizeUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      authorizeUrl,
      'tino-trello-auth',
      'width=560,height=720',
    );
    if (!popup) {
      reject(new Error('El navegador bloqueo la ventana de Trello. Permiti ventanas emergentes.'));
      return;
    }

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedWatcher);
    };

    const onMessage = (event: MessageEvent<TrelloCallbackMessage>) => {
      if (event.origin !== window.location.origin || event.source !== popup) return;
      if (event.data?.type !== TRELLO_TOKEN_MESSAGE) return;

      cleanup();
      if (event.data.token) {
        resolve(event.data.token);
      } else {
        reject(new Error('Trello no autorizo el acceso.'));
      }
    };

    const closedWatcher = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Se cerro la ventana de Trello antes de autorizar.'));
      }
    }, 500);

    window.addEventListener('message', onMessage);
  });
}
