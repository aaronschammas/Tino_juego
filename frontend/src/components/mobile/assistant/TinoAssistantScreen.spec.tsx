import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TinoAssistantScreen from './TinoAssistantScreen';
import { useTinoAssistant } from '@/hooks/useTinoAssistant';

jest.mock('@/hooks/useTinoAssistant', () => ({ useTinoAssistant: jest.fn() }));
const send = jest.fn().mockResolvedValue(true);
const base = { messages: [], loading: false, error: null, send, suggestions: ['Qué pasó hoy en mi equipo'] };

describe('TinoAssistantScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); (useTinoAssistant as jest.Mock).mockReturnValue(base); });

  it('renders the initial suggestions and sends a chip', async () => {
    render(<TinoAssistantScreen />);
    expect(screen.getByText(/podés preguntarme cosas como/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /qué pasó hoy/i }));
    expect(send).toHaveBeenCalledWith('Qué pasó hoy en mi equipo');
  });

  it('submits typed questions and exposes an accessible loading state', async () => {
    const { rerender } = render(<TinoAssistantScreen />);
    await userEvent.type(screen.getByPlaceholderText(/preguntá sobre tu equipo/i), 'Timers activos');
    await userEvent.click(screen.getByRole('button', { name: /enviar consulta/i }));
    expect(send).toHaveBeenCalledWith('Timers activos');
    (useTinoAssistant as jest.Mock).mockReturnValue({ ...base, loading: true });
    rerender(<TinoAssistantScreen />);
    expect(screen.getByRole('status')).toHaveTextContent(/consultando datos reales/i);
  });

  it('renders structured answers and recommendations', () => {
    (useTinoAssistant as jest.Mock).mockReturnValue({ ...base, messages: [{ id: 'a1', role: 'assistant', answer: { title: 'Tareas atrasadas', summary: 'Hay 2 tareas.', details: ['Tarea A'], recommendation: 'Revisalas.' } }] });
    render(<TinoAssistantScreen />);
    expect(screen.getByRole('heading', { name: /tareas atrasadas/i })).toBeInTheDocument();
    expect(screen.getByText(/revisalas/i)).toBeInTheDocument();
  });
});
