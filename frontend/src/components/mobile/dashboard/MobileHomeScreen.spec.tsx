import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileHomeScreen from './MobileHomeScreen';
import { useMobileHome } from '@/hooks/useMobileHome';
import { useTimer } from '@/context/TimerContext';

jest.mock('@/hooks/useMobileHome', () => ({ useMobileHome: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Ana' }, activeOrganization: { name: 'Acme' } }) }));
jest.mock('@/context/TimerContext', () => ({ useTimer: jest.fn() }));
jest.mock('@/components/integrations/IntegrationActivityBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="integration-activity-banner" />,
}));
const retry = jest.fn();
const home = {
  tasks: { overdue: [], upcoming: [], inProgress: [] },
  time: { todayMilliseconds: 3_600_000, weekMilliseconds: 7_200_000 },
  status: { overdue: { loading: false, error: null }, upcoming: { loading: false, error: null }, inProgress: { loading: false, error: null }, time: { loading: false, error: null } },
  retry,
  timezone: 'America/Argentina/Buenos_Aires',
};

describe('MobileHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMobileHome as jest.Mock).mockReturnValue(home);
    (useTimer as jest.Mock).mockReturnValue({ activeTimer: null, isPaused: false, isRunning: false, elapsedSeconds: 0 });
  });

  it('shows active organization, user, empty blocks, hours and all quick links', () => {
    render(<MobileHomeScreen />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByText('1.00 h')).toBeInTheDocument();
    expect(screen.getByText('2.00 h')).toBeInTheDocument();
    expect(screen.getByText(/no tenés tareas vencidas/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /accesos rápidos/i })).toBeInTheDocument();
    expect(screen.getByTestId('integration-activity-banner')).toBeInTheDocument();
  });

  it.each([
    [{ activeTimer: null, isPaused: false, isRunning: false, elapsedSeconds: 0 }, /iniciar timer/i],
    [{ activeTimer: { project: { name: 'Proyecto' }, task: { title: 'Tarea' } }, isPaused: false, isRunning: true, elapsedSeconds: 65 }, /pausar o revisar/i],
    [{ activeTimer: { project: { name: 'Proyecto' }, task: { title: 'Tarea' } }, isPaused: true, isRunning: false, elapsedSeconds: 65 }, /continuar en tiempo/i],
  ])('renders the correct timer CTA for state %#', (timer, label) => {
    (useTimer as jest.Mock).mockReturnValue(timer);
    render(<MobileHomeScreen />);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '/mobile/time');
  });

  it('does not render fake confirmed zeros while a block is loading', () => {
    (useMobileHome as jest.Mock).mockReturnValue({ ...home, time: null, status: { ...home.status, time: { loading: true, error: null } } });
    render(<MobileHomeScreen />);
    expect(screen.getByLabelText(/cargando horas confirmadas/i)).toBeInTheDocument();
    expect(screen.queryByText('0.00 h')).not.toBeInTheDocument();
  });

  it('keeps partial errors local and retries their block', async () => {
    (useMobileHome as jest.Mock).mockReturnValue({ ...home, status: { ...home.status, overdue: { loading: false, error: 'Error vencidas' } } });
    render(<MobileHomeScreen />);
    expect(screen.getByText('1.00 h')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(retry).toHaveBeenCalledWith('overdue');
  });
});
