/**
 * Tests del modal de importacion manual de Trello (SUPERADMIN): ya no pide API
 * key ni token; se autoriza en la ventana de Trello y se importa con ese token.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrelloImportModal from './TrelloImportModal';
import { useTrelloImport } from '@/hooks/useTrelloImport';
import { Priority } from '@/types/project';
import { TaskStatus } from '@/types/task';
import { TrelloImportMode, TrelloImportPreview } from '@/types/trello-import';

jest.mock('@/hooks/useTrelloImport');
jest.mock('@/components/ui/Portal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseTrelloImport = useTrelloImport as jest.Mock;
const authorize = jest.fn();
const preview = jest.fn();
const executeImport = jest.fn();
const reset = jest.fn();
const onClose = jest.fn();
const onImported = jest.fn();

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

const boards = [
  { id: 'board-1', name: 'Roadmap' },
  { id: 'board-2', name: 'Operaciones' },
];

const previewData: TrelloImportPreview = {
  board: boards[0],
  mode: TrelloImportMode.NEW_PROJECT,
  alreadyImported: false,
  importDisabled: false,
  totals: {
    lists: 1,
    cards: 1,
    checklists: 0,
    subtasks: 0,
    newTasks: 1,
    duplicateTasks: 0,
    newSubtasks: 0,
    duplicateSubtasks: 0,
    warnings: 1,
  },
  warnings: ['Una tarjeta no tiene fecha'],
  tasks: [
    {
      id: 'card-1',
      title: 'Preparar entrega',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      listName: 'Backlog',
      duplicate: false,
      subtasks: [],
    },
  ],
};

function hookValue(overrides = {}) {
  return {
    token: null,
    boards: [],
    previewData: null,
    result: null,
    connectionStatus: null,
    isLoading: false,
    error: null,
    authorize,
    preview,
    executeImport,
    reset,
    ...overrides,
  };
}

const authorizedValue = (overrides = {}) =>
  hookValue({ token: 'trello-token', boards, ...overrides });

function renderModal(isOpen = true) {
  return render(
    <TrelloImportModal
      isOpen={isOpen}
      projects={projects}
      onClose={onClose}
      onImported={onImported}
    />,
  );
}

describe('TrelloImportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTrelloImport.mockReturnValue(hookValue());
  });

  it('renders nothing when closed and resets transient import state', () => {
    const { container } = renderModal(false);

    expect(container.firstChild).toBeNull();
    expect(reset).toHaveBeenCalled();
  });

  it('asks to authorize Trello instead of pasting an API key and token', () => {
    renderModal();

    expect(screen.getByText('Importar proyectos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Autorizar Trello' })).toBeEnabled();
    expect(screen.getByText(/Continuar con Google/)).toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Token')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tablero')).toBeDisabled();
    expect(screen.getByText('Preview pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Proximamente')).not.toBeInTheDocument();
  });

  it('authorizes Trello and selects the first board', async () => {
    const user = userEvent.setup();
    authorize.mockResolvedValueOnce(boards);
    mockUseTrelloImport.mockReturnValue(hookValue({ boards }));
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Autorizar Trello' }));

    await waitFor(() => expect(authorize).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Tablero')).toHaveValue('board-1');
  });

  it('stays usable when the authorization window fails', async () => {
    const user = userEvent.setup();
    authorize.mockRejectedValueOnce(new Error('Se cerro la ventana de Trello antes de autorizar.'));
    mockUseTrelloImport.mockReturnValue(
      hookValue({ error: 'Se cerro la ventana de Trello antes de autorizar.' }),
    );
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Autorizar Trello' }));

    expect(screen.getByText('Se cerro la ventana de Trello antes de autorizar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Autorizar Trello' })).toBeEnabled();
  });

  it('shows the authorized account and lets it be changed', () => {
    mockUseTrelloImport.mockReturnValue(authorizedValue());
    renderModal();

    expect(screen.getByText('Trello autorizado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tablero')).toBeEnabled();
  });

  it('allows selecting a board and an existing project destination', async () => {
    const user = userEvent.setup();
    mockUseTrelloImport.mockReturnValue(authorizedValue());
    renderModal();

    await user.selectOptions(screen.getByLabelText('Tablero'), 'board-2');
    expect(screen.getByLabelText('Tablero')).toHaveValue('board-2');

    await user.selectOptions(screen.getByLabelText('Modo'), TrelloImportMode.EXISTING_PROJECT);
    expect(screen.getByLabelText('Proyecto Tino')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Proyecto existente' })).toBeInTheDocument();
  });

  it('shows a local error when preview is requested before authorizing', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Generar preview' }));

    expect(screen.getByText('Primero autoriza a Tino en Trello')).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
  });

  it('generates a preview with the token of the authorization', async () => {
    const user = userEvent.setup();
    mockUseTrelloImport.mockReturnValue(authorizedValue());
    renderModal();

    await user.selectOptions(screen.getByLabelText('Tablero'), 'board-2');
    await user.click(screen.getByRole('button', { name: 'Generar preview' }));

    expect(preview).toHaveBeenCalledWith({
      token: 'trello-token',
      boardId: 'board-2',
      mode: TrelloImportMode.NEW_PROJECT,
    });
  });

  it('renders preview details and executes the import callback', async () => {
    const user = userEvent.setup();
    executeImport.mockResolvedValueOnce(undefined);
    onImported.mockResolvedValueOnce(undefined);
    mockUseTrelloImport.mockReturnValue(authorizedValue({ previewData }));
    renderModal();

    expect(screen.getByText('Resumen de importacion')).toBeInTheDocument();
    expect(screen.getByText('Preparar entrega')).toBeInTheDocument();
    expect(screen.getByText('Una tarjeta no tiene fecha')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Tablero'), 'board-1');
    await user.click(screen.getByRole('button', { name: 'Importar a Tino' }));

    expect(executeImport).toHaveBeenCalledWith({
      token: 'trello-token',
      boardId: 'board-1',
      mode: TrelloImportMode.NEW_PROJECT,
    });
    expect(onImported).toHaveBeenCalled();
  });

  it('calls onClose from the header close button', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
