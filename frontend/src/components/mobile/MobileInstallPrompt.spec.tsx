import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileInstallPrompt from './MobileInstallPrompt';
import type { BeforeInstallPromptEvent } from '@/types/pwa';

function installEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  return event;
}

describe('MobileInstallPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    jest.spyOn(Storage.prototype, 'setItem');
    (window.matchMedia as jest.Mock).mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Chrome Android' });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Linux armv8l' });
  });

  it('offers Android installation only after the browser event and invokes it by click', async () => {
    render(<MobileInstallPrompt />);
    expect(screen.queryByRole('button', { name: /instalar aplicacion/i })).not.toBeInTheDocument();
    const event = installEvent();
    act(() => window.dispatchEvent(event));
    await userEvent.click(await screen.findByRole('button', { name: /instalar aplicacion/i }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('hides after appinstalled and when dismissed for the session', async () => {
    render(<MobileInstallPrompt />);
    act(() => window.dispatchEvent(installEvent()));
    await screen.findByText('Instalar Tino');
    act(() => window.dispatchEvent(new Event('appinstalled')));
    await waitFor(() => expect(screen.queryByText('Instalar Tino')).not.toBeInTheDocument());
  });

  it('shows accurate iOS instructions and can be dismissed', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla iPhone' });
    render(<MobileInstallPrompt />);
    expect(await screen.findByText(/agregar a inicio/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cerrar sugerencia/i }));
    expect(Storage.prototype.setItem).toHaveBeenCalledWith('tino:pwa-install-dismissed', 'true');
    expect(screen.queryByText(/agregar a inicio/i)).not.toBeInTheDocument();
  });

  it('does not render in standalone mode', () => {
    (window.matchMedia as jest.Mock).mockReturnValue({ matches: true });
    fireEvent(window, new Event('appinstalled'));
    render(<MobileInstallPrompt />);
    expect(screen.queryByText('Instalar Tino')).not.toBeInTheDocument();
  });
});
