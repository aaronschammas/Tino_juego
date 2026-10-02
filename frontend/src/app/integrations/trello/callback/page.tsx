'use client';

/**
 * Pagina de retorno de la autorizacion de Trello (se abre en la ventana emergente).
 *
 * `TrelloCallbackPage()` lee el token (o el error) del fragmento de la URL y
 * borra el fragmento del historial. Si la abrio una ventana de Tino, le envia el
 * resultado con `postMessage` restringido al mismo origen y se cierra; si se
 * abrio de otra forma (por ejemplo, pegando la URL) no usa el token y solo queda
 * el aviso para volver a la app.
 */
import { useEffect } from 'react';
import {
  readTrelloCallback,
  TRELLO_TOKEN_MESSAGE,
  TrelloCallbackMessage,
} from '@/lib/trelloAuthPopup';

export default function TrelloCallbackPage() {
  useEffect(() => {
    const { token, error } = readTrelloCallback(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname);

    const opener = window.opener as Window | null;
    if (!opener) return;

    const message: TrelloCallbackMessage = {
      type: TRELLO_TOKEN_MESSAGE,
      ...(token ? { token } : { error: error || 'missing_token' }),
    };
    opener.postMessage(message, window.location.origin);
    window.close();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-600">
          Si esta ventana no se cierra sola, cerrala y volve a conectar Trello desde Tino.
        </p>
      </div>
    </main>
  );
}
