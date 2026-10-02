/**
 * Tests de la URL de autorizacion de Trello compartida por la conexion de
 * proyectos y la importacion de SUPERADMIN.
 */
import {
  buildTrelloAuthorizeUrl,
  TRELLO_CALLBACK_PATH,
} from './trello-authorize';

describe('buildTrelloAuthorizeUrl', () => {
  it('asks for a read only token returned in the fragment of the callback page', () => {
    const url = new URL(
      buildTrelloAuthorizeUrl(
        'app-key',
        'https://qa.tino.test/projects?x=1',
        'never',
      ),
    );

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://trello.com/1/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      expiration: 'never',
      name: 'Tino',
      scope: 'read',
      response_type: 'token',
      callback_method: 'fragment',
      key: 'app-key',
      return_url: `https://qa.tino.test${TRELLO_CALLBACK_PATH}`,
    });
  });

  it('uses the requested expiration', () => {
    const url = new URL(
      buildTrelloAuthorizeUrl('app-key', 'https://qa.tino.test', '1hour'),
    );

    expect(url.searchParams.get('expiration')).toBe('1hour');
  });
});
