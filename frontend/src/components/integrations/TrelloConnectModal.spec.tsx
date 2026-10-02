import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrelloConnectModal from './TrelloConnectModal';
import { useTrelloConnection } from '@/hooks/useTrelloConnection';
import { ConnectionTargetMode, TrelloConnectionPreview } from '@/types/integration';
import { Priority } from '@/types/project';
import { TaskStatus } from '@/types/task';

jest.mock('@/hooks/useTrelloConnection');
jest.mock('@/components/ui/Portal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseTrelloConnection = useTrelloConnection as jest.Mock;
const authorize = jest.fn();
const preview = jest.fn();
const connect = jest.fn();
const clearPreview = jest.fn();
const onClose = jest.fn();
const onConnected = jest.fn();

const projects = [
  {
    id: 'project-1',
    name: 'Proyecto existente',
    priority: Priority.MEDIUM,
    ownerId: 'user-1',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const previewData: TrelloConnectionPreview = {
  board: { id: 'board-1', name: 'Roadmap' },
  mode: 'NEW_PROJECT' as TrelloConnectionPreview['mode'],
  alreadyImported: false,
  importDisabled: false,
  blockedReason: null,
  totals: {
    lists: 2,
    cards: 3,
    checklists: 0,
    subtasks: 0,
    newTasks: 3,
    duplicateTasks: 0,
    newSubtasks: 0,
    duplicateSubtasks: 0,
    warnings: 1,
  },
  warnings: [],
  tasks: [],
  statusMapping: [
    { externalGroupId: 'l-doing', name: 'En progreso', suggestedStatus: TaskStatus.IN_PROGRESS, itemCount: 2 },
    { externalGroupId: 'l-qa', name: 'QA', suggestedStatus: null, itemCount: 1 },
  ],
};

function mockHook(overrides: Partial<ReturnType<typeof useTrelloConnection>> = {}) {
  mockUseTrelloConnection.mockReturnValue({
    token: 'user-token',
    boards: [{ id: 'board-1', name: 'Roadmap' }],
    previewData: null,
    result: null,
    isLoading: false,
    error: null,
    authorize,
    listBoards: jest.fn(),
    preview,
    connect,
    clearPreview,
    reset: jest.fn(),
    ...overrides,
  });
}

const renderModal = () =>
  render(<TrelloConnectModal projects={projects} onClose={onClose} onConnected={onConnected} />);

describe('TrelloConnectModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authorize.mockResolvedValue('user-token');
    preview.mockResolvedValue(previewData);
    connect.mockResolvedValue({ result: { createdTasks: 3, createdSubtasks: 0 } });
  });

  it('asks to authorize Trello before anything else', async () => {
    const user = userEvent.setup();
    mockHook({ token: null, boards: [] });
    renderModal();

    expect(screen.getByLabelText('Tablero')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ver vista previa' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /autorizar trello/i }));

    expect(authorize).toHaveBeenCalled();
  });

  it('requests a preview for the first board and an existing project', async () => {
    const user = userEvent.setup();
    mockHook();
    renderModal();

    await user.selectOptions(screen.getByLabelText('Destino'), ConnectionTargetMode.EXISTING_PROJECT);
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }));

    expect(clearPreview).toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith({
      token: 'user-token',
      boardId: 'board-1',
      mode: ConnectionTargetMode.EXISTING_PROJECT,
      projectId: 'project-1',
    });
  });

  it('keeps connect disabled until every list has a status, then sends the mapping', async () => {
    const user = userEvent.setup();
    mockHook({ previewData });
    renderModal();

    expect(screen.getByText('Falta definir 1 lista')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado para En progreso')).toHaveValue(TaskStatus.IN_PROGRESS);
    expect(screen.getByRole('button', { name: 'Conectar e importar' })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Estado para QA'), TaskStatus.BLOCKED);

    expect(screen.getByText('Todas las listas tienen estado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conectar e importar' }));

    expect(connect).toHaveBeenCalledWith({
      token: 'user-token',
      boardId: 'board-1',
      mode: ConnectionTargetMode.NEW_PROJECT,
      statusMapping: [
        { externalGroupId: 'l-doing', status: TaskStatus.IN_PROGRESS },
        { externalGroupId: 'l-qa', status: TaskStatus.BLOCKED },
      ],
    });
    expect(onConnected).toHaveBeenCalled();
  });

  it('shows why a board cannot be connected', () => {
    mockHook({
      previewData: {
        ...previewData,
        importDisabled: true,
        blockedReason: 'Este tablero ya esta conectado al proyecto "Otro"',
        statusMapping: [previewData.statusMapping[0]],
      },
    });
    renderModal();

    expect(screen.getByText('Este tablero ya esta conectado al proyecto "Otro"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conectar e importar' })).toBeDisabled();
  });

  it('shows the result and the API error', () => {
    mockHook({
      previewData,
      error: 'Falta definir el estado de: QA',
      result: { result: { createdTasks: 3, createdSubtasks: 1 } } as ReturnType<
        typeof useTrelloConnection
      >['result'],
    });
    renderModal();

    expect(screen.getByRole('alert')).toHaveTextContent('Falta definir el estado de: QA');
    expect(screen.getByText(/Tablero conectado: 3 tareas y 1 subtareas importadas/)).toBeInTheDocument();
  });

  it('closes from the header', async () => {
    const user = userEvent.setup();
    mockHook();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('tells whether the automatic update was activated', () => {
    mockHook({
      previewData,
      result: {
        result: { createdTasks: 1, createdSubtasks: 0 },
        liveSync: { active: false, reason: 'REGISTRATION_FAILED' },
      } as ReturnType<typeof useTrelloConnection>['result'],
    });
    renderModal();

    expect(screen.getByText(/podes reintentarla desde el proyecto/)).toBeInTheDocument();
  });
});
