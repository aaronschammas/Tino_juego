/**
 * URL de autorizacion de Trello, compartida por la conexion de proyectos (owner)
 * y la importacion manual de SUPERADMIN.
 *
 * La persona inicia sesion en Trello como lo haga siempre (usuario y clave,
 * Google, Microsoft...) y acepta dar acceso de solo lectura a Tino. Trello
 * devuelve el token en el fragmento de `<origen>/integrations/trello/callback`,
 * asi el token nunca viaja por query string. La API key es la de la app de Tino
 * y queda en el servidor.
 *
 * Qué contiene:
 * - `TRELLO_CALLBACK_PATH`: pagina del frontend que recibe el token.
 * - `buildTrelloAuthorizeUrl()`: arma la URL con la API key, el origen de
 *   retorno (solo el origen, sin ruta) y el vencimiento pedido: `never` para
 *   conexiones que quedan guardadas, `1hour` para una importacion de una vez.
 */
export const TRELLO_AUTHORIZE_URL = 'https://trello.com/1/authorize';
export const TRELLO_CALLBACK_PATH = '/integrations/trello/callback';

export type TrelloTokenExpiration = 'never' | '1hour' | '1day' | '30days';

export function buildTrelloAuthorizeUrl(
  apiKey: string,
  returnOrigin: string,
  expiration: TrelloTokenExpiration,
): string {
  const origin = new URL(returnOrigin).origin;
  const url = new URL(TRELLO_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    expiration,
    name: 'Tino',
    scope: 'read',
    response_type: 'token',
    callback_method: 'fragment',
    key: apiKey,
    return_url: `${origin}${TRELLO_CALLBACK_PATH}`,
  }).toString();
  return url.toString();
}
