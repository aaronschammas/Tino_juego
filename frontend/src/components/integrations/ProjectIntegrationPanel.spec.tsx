import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectIntegrationPanel from './ProjectIntegrationPanel';
import { useProjectIntegration } from '@/hooks/useIntegrations';
import { ProjectIntegrationConnection } from '@/types/integration';
import { TaskStatus } from '@/types/task';

jest.mock('@/hooks/useIntegrations');

const mockUseProjectIntegration = useProjectIntegration as jest.Mock;
const disconnect = jest.fn();
const enableLiveSync = jest.fn();
const updateStatusMappings = jest.fn();
const syncNow = jest.fn();
const syncResult = {
  groupsAdded: 0,
  created: 2,
  updated: 1,
  restored: 0,
  archived: 1,
  subtasksChanged: 0,
  commentsAdded: 0,
  commentsUpdated: 0,
  baselined: 0,
  liveSyncActive: true,
};

const connection: ProjectIntegrationConnection = {
  id: 'conn-1',
  provider: 'TRELLO',
  status: 'ACTIVE',
  container: { id: 'board-1', name: 'Roadmap', url: 'https://trello.com/b/1' },
  connectedAt: '2026-09-24T10:00:00.000Z',
  connectedBy: { id: 'owner-1', name: 'Ana Paz' },
  lastSyncedAt: null,
  liveSync: { active: true, lastEventAt: '2026-09-25T10:00:00.000Z', lastSyncError: null },
  statusMappings: [
    { externalGroupId: 'l1', name: 'Doing', status: TaskStatus.IN_PROGRESS },
    { externalGroupId: 'l2', name: 'QA', status: null },
  ],
};

function mockHook(overrides: Partial<ProjectIntegrationConnection> = {}) {
  mockUseProjectIntegration.mockReturnValue({
    connection: { ...connection, ...overrides },
    disconnect,
    enableLiveSync,
    updateStatusMappings,
    syncNow,
  });
}

describe('ProjectIntegrationPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disconnect.mockResolvedValue(undefined);
    enableLiveSync.mockResolvedValue({ active: true, reason: null });
    updateStatusMappings.mockResolvedValue(undefined);
    syncNow.mockResolvedValue(syncResult);
  });

  it('renders nothing when the project is not connected', () => {
    mockUseProjectIntegration.mockReturnValue({ connection: null, disconnect });

    const { container } = render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the board, the live sync and read-only lists to members', () => {
    mockHook();

    render(<ProjectIntegrationPanel projectId="p-1" canManage={false} />);

    expect(mockUseProjectIntegration).toHaveBeenCalledWith('p-1');
    expect(screen.getByRole('link', { name: /Roadmap/ })).toHaveAttribute('href', 'https://trello.com/b/1');
    expect(screen.getByText(/por Ana Paz/)).toBeInTheDocument();
    expect(screen.getByText(/Actualizacion automatica activa/)).toBeInTheDocument();
    expect(screen.getByText('Doing → En progreso')).toBeInTheDocument();
    expect(screen.getByText('QA → Por definir')).toBeInTheDocument();
    expect(screen.getByText(/1 por definir/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument();
  });

  it('shows when the last full review ran and hides the sync button from members', () => {
    mockHook({ lastSyncedAt: '2026-09-26T04:00:00.000Z' });

    render(<ProjectIntegrationPanel projectId="p-1" canManage={false} />);

    expect(screen.getByText(/Ultima revision completa/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).not.toBeInTheDocument();
  });

  it('lets the owner sync now and shows a summary', async () => {
    const user = userEvent.setup();
    mockHook();
    render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    expect(screen.getByText(/Todavia no hubo una revision completa/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));

    expect(syncNow).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByText(/Sincronizado: 2 nuevas, 1 actualizadas, 1 archivadas\./),
      ).toBeInTheDocument(),
    );
  });

  it('says when there was nothing to sync', async () => {
    const user = userEvent.setup();
    syncNow.mockResolvedValue({ ...syncResult, created: 0, updated: 0, archived: 0 });
    mockHook();
    render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));

    await waitFor(() =>
      expect(screen.getByText(/no habia cambios pendientes/)).toBeInTheDocument(),
    );
  });

  it('shows the error when the sync fails', async () => {
    const user = userEvent.setup();
    syncNow.mockRejectedValue(new Error('No se pudo conectar con Trello'));
    mockHook();
    render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con Trello'),
    );
  });

  it('lets the owner retry an inactive live sync', async () => {
    const user = userEvent.setup();
    mockHook({
      liveSync: { active: false, lastEventAt: null, lastSyncError: 'WEBHOOK_REGISTRATION_FAILED' },
    });
    render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    expect(screen.getByText(/inactiva/)).toHaveTextContent('WEBHOOK_REGISTRATION_FAILED');
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(enableLiveSync).toHaveBeenCalled();
  });

  it('lets the owner define a pending list and save it', async () => {
    const user = userEvent.setup();
    mockHook();
    render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    expect(screen.queryByRole('button', { name: 'Guardar equivalencias' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Estado para QA'), TaskStatus.BLOCKED);
    expect(screen.queryByText(/por definir/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar equivalencias' }));

    expect(updateStatusMappings).toHaveBeenCalledWith([
      { externalGroupId: 'l2', status: TaskStatus.BLOCKED },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Guardar equivalencias' })).not.toBeInTheDocument(),
    );
  });

  it('shows the error when saving fails', async () => {
    const user = userEvent.setup();
    updateStatusMappings.mockRejectedValue(new Error('Unknown list in status mapping'));
    mockHook();
    render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    await user.selectOptions(screen.getByLabelText('Estado para QA'), TaskStatus.DONE);
    await user.click(screen.getByRole('button', { name: 'Guardar equivalencias' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Unknown list in status mapping'),
    );
  });

  it('lets the owner disconnect after confirming', async () => {
    const user = userEvent.setup();
    mockHook();
    render(<ProjectIntegrationPanel projectId="p-1" canManage />);

    await user.click(screen.getByRole('button', { name: 'Desconectar' }));
    expect(disconnect).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole('button', { name: 'Desconectar' });
    await user.click(buttons[buttons.length - 1]);

    expect(disconnect).toHaveBeenCalled();
  });
});
