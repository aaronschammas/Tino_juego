import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserForm from './UserForm';

describe('UserForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create mode correctly', () => {
    render(<UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByText(/nuevo usuario/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crear$/i })).toBeInTheDocument();
  });

  it('prefills fields in edit mode', () => {
    render(
      <UserForm
        user={{
          id: 'u1',
          email: 'leo@demo.com',
          name: 'Leonardo',
          lastname: 'Morabito',
          role: 'USER',
          status: 'ACTIVE',
          isActive: true,
        }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue('leo@demo.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Leonardo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Morabito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeInTheDocument();
  });

  it('submits form data', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.type(screen.getByLabelText(/^email/i), 'ana@demo.com');
    await user.type(screen.getByLabelText(/^nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/^apellido/i), 'López');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'ana@demo.com',
        name: 'Ana',
        lastname: 'López',
      });
    });
  });

  it('shows error when submit fails', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error('Save failed'));

    render(<UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.type(screen.getByLabelText(/^email/i), 'ana@demo.com');
    await user.type(screen.getByLabelText(/^nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/^apellido/i), 'López');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
  });

  it('calls onCancel from close and cancel actions', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole('button', { name: '✕' }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(mockOnCancel).toHaveBeenCalledTimes(2);
  });
});
