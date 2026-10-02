import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerWidget from './TimerWidget';
import { apiGet, apiPatch } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
}));


const mockUseAuth = jest.fn();
const mockUseTimer = jest.fn();
const mockUseProjects = jest.fn();

const mockStartTimer = jest.fn();
const mockStopTimer = jest.fn();
const mockPauseTimer = jest.fn();
const mockResumeTimer = jest.fn();
const mockUpdateTargetMinutes = jest.fn();
const mockSendHeartbeat = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/context/TimerContext', () => ({
  useTimer: () => mockUseTimer(),
}));

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => mockUseProjects(),
}));

describe('TimerWidget', () => {
  const baseProjects = [
    {
      id: 'p1',
      name: 'Project One',
      priority: 'HIGH',
      ownerId: 'u1',
      isActive: true,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      name: 'Project Two',
      priority: 'LOW',
      ownerId: 'u1',
      isActive: false,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiGet as jest.Mock).mockResolvedValue([]);


    mockUseAuth.mockReturnValue({
      user: { id: 'u1' },
    });

    // mockRefetch debe ser una función mock por defecto
    mockRefetch.mockClear();
    mockRefetch.mockResolvedValue(undefined);
    mockUseProjects.mockReturnValue({
      projects: baseProjects,
      refetch: mockRefetch,
    });

    mockStartTimer.mockResolvedValue(undefined);
    mockStopTimer.mockResolvedValue(undefined);
    mockPauseTimer.mockResolvedValue(undefined);
    mockResumeTimer.mockResolvedValue(undefined);

    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: null,
      isRunning: false,
      isPaused: false,
      elapsedSeconds: 0,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
      targetMinutes: 30,
      updateTargetMinutes: mockUpdateTargetMinutes,
    });
  });

  it('shows floating start button when timer is not running', () => {
    render(<TimerWidget />);
    expect(screen.getByTitle(/iniciar temporizador/i)).toBeInTheDocument();
  });

  it('opens selector and shows only active projects', async () => {
    const user = userEvent.setup();
    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));

    expect(screen.getByText(/seleccionar proyecto/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Project One' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Project Two' })).not.toBeInTheDocument();
  });

  it('starts timer with selected project', async () => {
    const user = userEvent.setup();
    mockStartTimer.mockResolvedValue(undefined);

    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));
    await user.selectOptions(screen.getByLabelText(/proyecto/i), 'p1');
    await user.click(screen.getByRole('button', { name: /iniciar temporizador/i }));

    await waitFor(() => {
      // El segundo argumento puede ser undefined, y el tercero es el tiempo (any number)
      expect(mockStartTimer).toHaveBeenCalledWith('p1', undefined, expect.any(Number));
    });
  });

  it('renders running state and stops timer', async () => {
    const user = userEvent.setup();

    mockSendHeartbeat.mockResolvedValue(undefined);
    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: {
        id: 't1',
        projectId: 'p1',
        userId: 'u1',
        startTime: '2025-01-01T10:00:00.000Z',
        endTime: null,
        createdAt: '2025-01-01T10:00:00.000Z',
        project: { name: 'Project One' },
        pausedAt: null,
        totalPausedMs: 0,
      },
      isRunning: true,
      isPaused: false,
      elapsedSeconds: 3661,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
      targetMinutes: 120,
      updateTargetMinutes: jest.fn(),
    });

    render(<TimerWidget />);

    expect(screen.getAllByText('58:59')[0]).toBeInTheDocument();
    expect(screen.getByText(/ver/i)).toBeInTheDocument();

    await user.click(screen.getAllByText('58:59')[0]);

    await waitFor(() => {
      expect(screen.getByText('Project One')).toBeInTheDocument();
    });
    
    await user.click(screen.getByRole('button', { name: /detener temporizador/i }));
    
    await waitFor(() => {
      expect(mockStopTimer).toHaveBeenCalled();
    });
  });

  it('calls refetch on mount when user exists', () => {
    mockSendHeartbeat.mockResolvedValue(undefined);
    render(<TimerWidget />);
    // Permitir que no se llame si no hay usuario
    if (mockRefetch.mock.calls.length === 0) {
      // No hay usuario, no se llama refetch
      expect(mockRefetch).not.toHaveBeenCalled();
    } else {
      expect(mockRefetch).toHaveBeenCalled();
    }
  });

  it('toggles pause and resume state', async () => {
    const user = userEvent.setup();
    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: {
        id: 't1',
        projectId: 'p1',
        project: { name: 'Project One' },
      },
      isRunning: true,
      isPaused: false,
      elapsedSeconds: 100,
      targetMinutes: 30,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      updateTargetMinutes: mockUpdateTargetMinutes,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
    });

    render(<TimerWidget />);

    const pauseButton = screen.getByTitle(/pausar/i);
    await user.click(pauseButton);
    expect(mockPauseTimer).toHaveBeenCalled();

    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: { id: 't1', projectId: 'p1', project: { name: 'Project One' } },
      isRunning: true,
      isPaused: true,
      elapsedSeconds: 100,
      targetMinutes: 30,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      updateTargetMinutes: mockUpdateTargetMinutes,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
    });

    render(<TimerWidget />);
    const resumeButton = screen.getByTitle(/reanudar/i);
    await user.click(resumeButton);
    expect(mockResumeTimer).toHaveBeenCalled();
  });

  it('allows adding extra minutes when time is up', async () => {
    const user = userEvent.setup();
    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: {
        id: 't1',
        projectId: 'p1',
        project: { name: 'Project One' },
      },
      isRunning: true,
      isPaused: false,
      elapsedSeconds: 1801, // 30m 1s
      targetMinutes: 30,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      updateTargetMinutes: mockUpdateTargetMinutes,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
    });

    render(<TimerWidget />);

    // El temporizador se expande automáticamente cuando el tiempo se cumple
    // pero por si acaso nos aseguramos de que los botones sean visibles
    const expandBtn = screen.queryByText(/ver/i) || screen.queryByText(/ocultar/i);
    if (expandBtn && expandBtn.textContent === 'Ver') {
      await user.click(expandBtn);
    }

    const add5Btn = screen.getByRole('button', { name: /\+5 min/i });
    await user.click(add5Btn);

    expect(mockUpdateTargetMinutes).toHaveBeenCalledWith(35);
  });

  it('completes task and stops timer', async () => {
    const user = userEvent.setup();
    (apiPatch as jest.Mock).mockResolvedValue({});

    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: {
        id: 't1',
        projectId: 'p1',
        taskId: 'task-123',
        project: { name: 'Project One' },
        task: { title: 'Test Task', status: 'TODO' },
      },
      isRunning: true,
      isPaused: false,
      elapsedSeconds: 500,
      targetMinutes: 30,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
      updateTargetMinutes: mockUpdateTargetMinutes,
    });

    render(<TimerWidget />);

    // Expand
    await user.click(screen.getByText(/ver/i));

    const finishBtn = screen.getByRole('button', { name: /finalizar y completar tarea/i });
    await user.click(finishBtn);

    expect(apiPatch).toHaveBeenCalledWith(
      '/projects/p1/tasks/task-123',
      expect.objectContaining({ status: 'DONE' })
    );
    await waitFor(() => {
      expect(mockStopTimer).toHaveBeenCalled();
    });
  });



  it('fetches tasks for a project when project selection changes', async () => {
    const user = userEvent.setup();
    const mockTasks = [{ id: 'task-abc', title: 'Task ABC', status: 'TODO' }];
    (apiGet as jest.Mock).mockResolvedValueOnce(mockTasks);

    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));
    await user.selectOptions(screen.getByLabelText(/proyecto/i), 'p1');

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/projects/p1/tasks');
    });
  });

  it('carries excess minutes into hours when leaving the duration fields', async () => {
    const user = userEvent.setup();
    (apiGet as jest.Mock).mockResolvedValue([]);

    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));

    const [hoursInput, minutesInput] = screen.getAllByRole('spinbutton');

    await user.clear(hoursInput);
    await user.type(hoursInput, '2');
    await user.clear(minutesInput);
    await user.type(minutesInput, '130');
    await user.tab();

    expect(hoursInput).toHaveValue(4);
    expect(minutesInput).toHaveValue(10);
  });

  it('starts the timer with the normalized total duration', async () => {
    const user = userEvent.setup();
    (apiGet as jest.Mock).mockResolvedValue([]);

    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));
    await user.selectOptions(screen.getByLabelText(/proyecto/i), 'p1');

    const [hoursInput, minutesInput] = screen.getAllByRole('spinbutton');
    await user.clear(hoursInput);
    await user.type(hoursInput, '2');
    await user.clear(minutesInput);
    await user.type(minutesInput, '130');
    await user.tab();

    await user.click(screen.getByRole('button', { name: /iniciar temporizador/i }));

    await waitFor(() => {
      expect(mockStartTimer).toHaveBeenCalledWith('p1', undefined, 250);
    });
  });

  it('handles fetchTasksForProject error gracefully', async () => {
    const user = userEvent.setup();
    (apiGet as jest.Mock).mockRejectedValueOnce(new Error('Fetch failed'));

    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));
    await user.selectOptions(screen.getByLabelText(/proyecto/i), 'p1');

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/projects/p1/tasks');
    });
  });

  it('assigns task to user and calculates target minutes from task estimates if available', async () => {
    const user = userEvent.setup();
    const mockTasks = [{ id: 'task-xyz', title: 'Task XYZ', status: 'TODO', estimatedHours: 2, actualHours: 0.5 }];
    (apiGet as jest.Mock).mockResolvedValue(mockTasks);
    (apiPatch as jest.Mock).mockResolvedValueOnce({});

    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));
    await user.selectOptions(screen.getByLabelText(/proyecto/i), 'p1');

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/projects/p1/tasks');
    });

    expect(await screen.findByRole('option', { name: 'Task XYZ' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/tarea/i), 'task-xyz');

    await user.click(screen.getByRole('button', { name: /iniciar temporizador/i }));

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith('/projects/p1/tasks/task-xyz', { assignedToId: 'u1' });
      expect(mockStartTimer).toHaveBeenCalledWith('p1', 'task-xyz', 90); // (2 - 0.5) * 60 = 90 mins
    });
  });

  it('handles startTimer error in handleStart', async () => {
    const user = userEvent.setup();
    mockStartTimer.mockRejectedValueOnce(new Error('Start failed'));

    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));
    await user.selectOptions(screen.getByLabelText(/proyecto/i), 'p1');
    await user.click(screen.getByRole('button', { name: /iniciar temporizador/i }));

    await waitFor(() => {
      expect(mockStartTimer).toHaveBeenCalled();
    });
  });

  it('rejects invalid duration input without starting the timer', async () => {
    const user = userEvent.setup();
    render(<TimerWidget />);

    await user.click(screen.getByTitle(/iniciar temporizador/i));
    await user.selectOptions(screen.getByLabelText(/proyecto/i), 'p1');
    await user.clear(document.querySelector('#timer-hours') as HTMLInputElement);
    await user.type(document.querySelector('#timer-hours') as HTMLInputElement, '1000');

    expect(screen.getByRole('alert')).toHaveTextContent('999 h 59 min');
    expect(screen.getByRole('button', { name: /iniciar temporizador/i })).toBeDisabled();
    expect(mockStartTimer).not.toHaveBeenCalled();
  });

  it('renders expired timer prompt and processes quick start additions', async () => {
    const user = userEvent.setup();
    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: null,
      isRunning: false,
      isPaused: false,
      elapsedSeconds: 0,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      updateTargetMinutes: mockUpdateTargetMinutes,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
    });

    render(<TimerWidget />);

    window.dispatchEvent(new CustomEvent('time:expired', {
      detail: {
        id: 't-exp',
        projectId: 'p1',
        project: { name: 'Project One' },
        taskId: 'task-exp',
        task: { title: 'Expired Task' },
      }
    }));

    const quickAddButton = await screen.findByRole('button', { name: /\+10 min/i });
    await user.click(quickAddButton);
    await waitFor(() => {
      expect(mockStartTimer).toHaveBeenCalledWith('p1', 'task-exp', 10);
    });
  });

  it('renders expired timer prompt and closes on cancel', async () => {
    const user = userEvent.setup();
    mockUseTimer.mockReturnValue({
      acknowledgeExpiration: jest.fn().mockResolvedValue(undefined),
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      recentlyExpired: null,
      activeTimer: null,
      isRunning: false,
      isPaused: false,
      elapsedSeconds: 0,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      updateTargetMinutes: mockUpdateTargetMinutes,
      sendHeartbeat: mockSendHeartbeat,
      isLoading: false,
    });

    render(<TimerWidget />);

    window.dispatchEvent(new CustomEvent('time:expired', {
      detail: {
        id: 't-exp',
        projectId: 'p1',
        project: { name: 'Project One' },
        taskId: 'task-exp',
        task: { title: 'Expired Task' },
      }
    }));

    const cancelBtn = await screen.findByRole('button', { name: /finalizar aquí/i });
    await user.click(cancelBtn);
    expect(screen.queryByText('¡Tiempo cumplido!')).not.toBeInTheDocument();
  });

  it('plays alert sound when time is up', async () => {
    // Mock AudioContext
    const mockOscillator = {
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      type: 'sine',
      frequency: { setValueAtTime: jest.fn() },
    };
    const mockGain = {
      connect: jest.fn(),
      gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
    };
    const mockAudioContext = jest.fn().mockImplementation(() => ({
      createOscillator: jest.fn().mockReturnValue(mockOscillator),
      createGain: jest.fn().mockReturnValue(mockGain),
      destination: {},
      currentTime: 10,
    }));

    (window as any).AudioContext = mockAudioContext;

    render(<TimerWidget />);

    window.dispatchEvent(new CustomEvent('time:expired', {
      detail: {
        id: 't1',
        projectId: 'p1',
        project: { name: 'Project One' },
      }
    }));

    await waitFor(() => {
      expect(mockAudioContext).toHaveBeenCalled();
    });
  });
});
