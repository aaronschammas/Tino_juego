import {
  readTrelloCallback,
  requestTrelloToken,
  TRELLO_TOKEN_MESSAGE,
} from './trelloAuthPopup';

describe('trelloAuthPopup', () => {
  describe('readTrelloCallback', () => {
    it('reads the token from the fragment', () => {
      expect(readTrelloCallback('#token=abc123')).toEqual({ token: 'abc123' });
    });

    it('reads an authorization error', () => {
      expect(readTrelloCallback('#error=Token%20request%20rejected')).toEqual({
        error: 'Token request rejected',
      });
    });

    it('returns nothing for an empty fragment', () => {
      expect(readTrelloCallback('')).toEqual({});
    });
  });

  describe('requestTrelloToken', () => {
    let popup: { closed: boolean };
    let openSpy: jest.SpyInstance;

    const dispatchFrom = (source: unknown, data: unknown, origin = window.location.origin) => {
      window.dispatchEvent(
        new MessageEvent('message', { data, origin, source: source as MessageEventSource }),
      );
    };

    beforeEach(() => {
      jest.useFakeTimers();
      popup = { closed: false };
      openSpy = jest.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    });

    afterEach(() => {
      openSpy.mockRestore();
      jest.useRealTimers();
    });

    it('resolves with the token sent by the popup', async () => {
      const promise = requestTrelloToken('https://trello.com/1/authorize?x=1');

      dispatchFrom(popup, { type: TRELLO_TOKEN_MESSAGE, token: 'tok-1' });

      await expect(promise).resolves.toBe('tok-1');
      expect(openSpy).toHaveBeenCalledWith(
        'https://trello.com/1/authorize?x=1',
        'tino-trello-auth',
        'width=560,height=720',
      );
    });

    it('ignores messages from other origins or windows', async () => {
      const promise = requestTrelloToken('u');

      dispatchFrom(popup, { type: TRELLO_TOKEN_MESSAGE, token: 'evil' }, 'https://evil.test');
      dispatchFrom({}, { type: TRELLO_TOKEN_MESSAGE, token: 'other-window' });
      dispatchFrom(popup, { type: 'something-else', token: 'x' });
      dispatchFrom(popup, { type: TRELLO_TOKEN_MESSAGE, token: 'good' });

      await expect(promise).resolves.toBe('good');
    });

    it('rejects when Trello returns an error', async () => {
      const promise = requestTrelloToken('u');

      dispatchFrom(popup, { type: TRELLO_TOKEN_MESSAGE, error: 'denied' });

      await expect(promise).rejects.toThrow('Trello no autorizo el acceso.');
    });

    it('rejects when the user closes the popup', async () => {
      const promise = requestTrelloToken('u');

      popup.closed = true;
      jest.advanceTimersByTime(600);

      await expect(promise).rejects.toThrow('Se cerro la ventana de Trello antes de autorizar.');
    });

    it('rejects when the browser blocks the popup', async () => {
      openSpy.mockReturnValue(null);

      await expect(requestTrelloToken('u')).rejects.toThrow(/bloqueo la ventana/);
    });
  });
});
