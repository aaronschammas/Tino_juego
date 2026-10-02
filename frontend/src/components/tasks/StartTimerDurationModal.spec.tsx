import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StartTimerDurationModal from './StartTimerDurationModal';
import { Task } from '@/types/task';

jest.mock('@/components/ui/Portal', () => ({ children }: { children: React.ReactNode }) => children);

const task = { id: 'task-1', title: 'Primera', projectId: 'p1', status: 'TODO', priority: 'MEDIUM' } as Task;

describe('StartTimerDurationModal', () => {
  it('uses 00:30 without an estimate and cancel does not start', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(<StartTimerDurationModal isOpen task={task} onClose={onClose} onConfirm={onConfirm} />);
    expect(screen.getByLabelText('Horas')).toHaveValue(0);
    expect(screen.getByLabelText('Minutos')).toHaveValue(30);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('preloads the remaining estimate and confirms that duration', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(<StartTimerDurationModal isOpen task={{ ...task, estimatedHours: 2, actualHours: .5 }} onClose={jest.fn()} onConfirm={onConfirm} />);
    expect(screen.getByLabelText('Horas')).toHaveValue(1);
    expect(screen.getByLabelText('Minutos')).toHaveValue(30);
    fireEvent.click(screen.getByText('Iniciar cronómetro'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(90));
  });

  it('resets for a newly selected task', () => {
    const view = render(<StartTimerDurationModal isOpen task={{ ...task, estimatedHours: 1 }} onClose={jest.fn()} onConfirm={jest.fn()} />);
    view.rerender(<StartTimerDurationModal isOpen task={{ ...task, id: 'task-2', title: 'Segunda' }} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.getByText('Segunda')).toBeInTheDocument();
    expect(screen.getByLabelText('Minutos')).toHaveValue(30);
  });

  it('prevents duplicate confirmation while starting', async () => {
    let resolve!: () => void;
    const onConfirm = jest.fn(() => new Promise<void>((done) => { resolve = done; }));
    render(<StartTimerDurationModal isOpen task={task} onClose={jest.fn()} onConfirm={onConfirm} />);
    const button = screen.getByText('Iniciar cronómetro');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolve();
  });

  it('rejects out-of-range and exponential input instead of silently clamping', () => {
    render(<StartTimerDurationModal isOpen task={task} onClose={jest.fn()} onConfirm={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '1000' } });
    expect(screen.getByRole('alert')).toHaveTextContent('999 h 59 min');
    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '1e2' } });
    expect(screen.getByText('Iniciar cronómetro')).toBeDisabled();
  });
});
