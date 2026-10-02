/**
 * Tests del cartel "Novedades de Trello": que muestre los numeros y el tiempo
 * por persona, que no dibuje nada sin novedades y que la cruz lo cierre.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useIntegrationActivity } from '@/hooks/useIntegrationActivity';
import IntegrationActivityBanner from './IntegrationActivityBanner';

jest.mock('@/hooks/useIntegrationActivity', () => ({
  useIntegrationActivity: jest.fn(),
}));

const mockUseIntegrationActivity = useIntegrationActivity as jest.Mock;

const worker = (index: number) => ({
  userId: `u${index}`,
  name: `Persona ${index}`,
  minutes: 60,
  tasks: [{ taskId: `t${index}`, title: `Tarea ${index}`, minutes: 60 }],
});

const summary = {
  since: '2026-09-28T09:00:00.000Z',
  until: '2026-09-29T09:00:00.000Z',
  created: [
    { taskId: 'a', title: 'Login', projectName: 'Web' },
    { taskId: 'b', title: 'Pagos', projectName: 'Web' },
  ],
  statusChanges: [],
  archived: [],
  work: [worker(1), worker(2), worker(3), worker(4), worker(5), worker(6)],
  totalMinutes: 360,
  isEmpty: false,
};

describe('IntegrationActivityBanner', () => {
  const dismiss = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => jest.clearAllMocks());

  it('shows the numbers and who worked on what', () => {
    mockUseIntegrationActivity.mockReturnValue({ summary, visible: true, dismiss });
    render(<IntegrationActivityBanner />);

    expect(screen.getByText('Novedades de Trello')).toBeInTheDocument();
    expect(screen.getByText('Se agregaron 2 tareas.')).toBeInTheDocument();
    expect(screen.getByText('Persona 1 trabajó 1 h en Tarea 1')).toBeInTheDocument();
    expect(screen.getByText('Persona 4 trabajó 1 h en Tarea 4')).toBeInTheDocument();
    expect(screen.queryByText(/Persona 5/)).not.toBeInTheDocument();
    expect(screen.getByText('y 2 personas más')).toBeInTheDocument();
  });

  it('renders nothing when it is not visible', () => {
    mockUseIntegrationActivity.mockReturnValue({ summary: null, visible: false, dismiss });
    const { container } = render(<IntegrationActivityBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('closes with the dismiss button', () => {
    mockUseIntegrationActivity.mockReturnValue({ summary, visible: true, dismiss });
    render(<IntegrationActivityBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
