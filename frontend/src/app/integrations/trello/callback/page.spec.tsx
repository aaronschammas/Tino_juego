import { render, screen } from '@testing-library/react';
import TrelloCallbackPage from './page';
import { TRELLO_TOKEN_MESSAGE } from '@/lib/trelloAuthPopup';

describe('TrelloCallbackPage', () => {
  const originalOpener = window.opener;
  let closeSpy: jest.SpyInstance;

  beforeEach(() => {
    closeSpy = jest.spyOn(window, 'close').mockImplementation(() => undefined);
  });

  afterEach(() => {
    closeSpy.mockRestore();
    Object.defineProperty(window, 'opener', { value: originalOpener, configurable: true });
    window.history.replaceState(null, '', '/');
  });

  const openWith = (hash: string, opener: unknown) => {
    window.history.replaceState(null, '', `/integrations/trello/callback${hash}`);
    Object.defineProperty(window, 'opener', { value: opener, configurable: true });
  };

  it('sends the token to the Tino window, clears the fragment and closes', () => {
    const postMessage = jest.fn();
    openWith('#token=tok-123', { postMessage });

    render(<TrelloCallbackPage />);

    expect(postMessage).toHaveBeenCalledWith(
      { type: TRELLO_TOKEN_MESSAGE, token: 'tok-123' },
      window.location.origin,
    );
    expect(window.location.hash).toBe('');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('forwards an authorization error', () => {
    const postMessage = jest.fn();
    openWith('#error=denied', { postMessage });

    render(<TrelloCallbackPage />);

    expect(postMessage).toHaveBeenCalledWith(
      { type: TRELLO_TOKEN_MESSAGE, error: 'denied' },
      window.location.origin,
    );
  });

  it('does nothing with the token when opened outside Tino', () => {
    openWith('#token=tok-123', null);

    render(<TrelloCallbackPage />);

    expect(screen.getByText(/volve a conectar Trello desde Tino/)).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
