import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileSummaryScreen from './MobileSummaryScreen';
import { useMobileSummary } from '@/hooks/useMobileSummary';

jest.mock('@/hooks/useMobileSummary', () => ({ useMobileSummary: jest.fn() }));
const setPeriod = jest.fn();
const retry = jest.fn();
const own = { pendingTasks: 2, inProgressTasks: 1, blockedTasks: 3, overdueTasks: 4, confirmedHours: 5, activeProjects: 6 };
const base = { period: 'week', setPeriod, self: { own }, organization: null, isOwner: false, loading: { self: false, organization: false }, errors: { self: null, organization: null }, retry, timezone: 'America/Argentina/Buenos_Aires' };

describe('MobileSummaryScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); (useMobileSummary as jest.Mock).mockReturnValue(base); });

  it('renders member metrics without administrative sections', () => {
    render(<MobileSummaryScreen />);
    expect(screen.getByRole('heading', { name: /mi actividad/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /organización/i })).not.toBeInTheDocument();
    expect(screen.getByText(/completedAt/)).toBeInTheDocument();
  });

  it('switches week to month with accessible pressed state', async () => {
    render(<MobileSummaryScreen />);
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(setPeriod).toHaveBeenCalledWith('month');
  });

  it('renders authorized owner aggregates, status distribution and hours by user', () => {
    (useMobileSummary as jest.Mock).mockReturnValue({ ...base, isOwner: true, organization: { organization: { confirmedHours: 8, overdueTasks: 2, unassignedTasks: 1, activeProjects: 3, statusDistribution: [{ status: 'TODO', count: 4 }], hoursByUser: [{ userId: 'u1', name: 'Ana Pérez', confirmedHours: 8 }] } } });
    render(<MobileSummaryScreen />);
    expect(screen.getByRole('heading', { name: 'Organización' })).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Por hacer')).toBeInTheDocument();
  });

  it('does not show zero values while loading and isolates organization errors', async () => {
    (useMobileSummary as jest.Mock).mockReturnValue({ ...base, isOwner: true, self: null, loading: { self: true, organization: false }, errors: { self: null, organization: 'No disponible' } });
    render(<MobileSummaryScreen />);
    expect(screen.getByLabelText(/cargando actividad propia/i)).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar agregados/i }));
    expect(retry).toHaveBeenCalledWith('organization');
  });
});
