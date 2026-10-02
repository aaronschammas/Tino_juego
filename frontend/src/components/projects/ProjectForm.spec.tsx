import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectForm from './ProjectForm';
import { Priority } from '@/types/project';

describe('ProjectForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create mode', () => {
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    expect(screen.getByText(/nuevo proyecto/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear proyecto/i })).toBeInTheDocument();
  });

  it('submits normalized payload in create mode', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Proyecto QA');
    await user.type(screen.getByLabelText(/descripcion/i), 'Prueba integral');
    await user.selectOptions(screen.getByLabelText(/prioridad/i), Priority.HIGH);
    await user.type(screen.getByLabelText(/vencimiento/i), '2026-03-31');
    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    const submitted = mockOnSubmit.mock.calls[0][0];
    expect(submitted.name).toBe('Proyecto QA');
    expect(submitted.description).toBe('Prueba integral');
    expect(submitted.priority).toBe(Priority.HIGH);
    expect(submitted.dueDate).toMatch(/^2026-03-31T/);
  });

  it('prefills values in edit mode', () => {
    render(
      <ProjectForm
        project={{
          id: 'p1',
          name: 'Legacy',
          description: 'Desc',
          dueDate: '2026-04-01T00:00:00.000Z',
          priority: Priority.CRITICAL,
          ownerId: 'u1',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue('Legacy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar proyecto/i })).toBeInTheDocument();
  });

  it('shows error when submit fails', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error('Create failed'));

    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Proyecto Error');
    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    expect(await screen.findByText(/create failed/i)).toBeInTheDocument();
  });

  it('calls onCancel from action buttons', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
