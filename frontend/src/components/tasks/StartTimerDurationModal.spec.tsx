import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StartTimerDurationModal from './StartTimerDurationModal';
import { shortTaskSeconds, timerTargetMinutes } from '@/lib/taskDuration';
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

  it('shows the fixed duration of a fair game task instead of the 30 min default', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(<StartTimerDurationModal isOpen task={{ ...task, estimatedHours: 12 / 3600 }} onClose={jest.fn()} onConfirm={onConfirm} />);
    expect(screen.getByLabelText('Duración de la tarea')).toHaveTextContent('00:00:12');
    expect(screen.getByText(/tardará 12 segundos/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Minutos')).toBeNull();
    fireEvent.click(screen.getByText('Iniciar cronómetro'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(1));
  });

  it('counts only what is left of a fair game task', () => {
    expect(shortTaskSeconds({ ...task, estimatedHours: 12 / 3600, actualHours: 5 / 3600 })).toBe(7);
    expect(shortTaskSeconds({ ...task, estimatedHours: 12 / 3600, actualHours: 20 / 3600 })).toBe(1);
    expect(shortTaskSeconds({ ...task, estimatedHours: 1 })).toBeNull();
    expect(shortTaskSeconds(task)).toBeNull();
  });

  it('makes the timer of a fair game task count down from the task duration', () => {
    expect(timerTargetMinutes({ targetMinutes: 1, task: { estimatedHours: 12 / 3600 } }, 30)).toBeCloseTo(12 / 60);
    expect(timerTargetMinutes({ targetMinutes: 45, task: { estimatedHours: 2 } }, 30)).toBe(45);
    expect(timerTargetMinutes(null, 30)).toBe(30);
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
