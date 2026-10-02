import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileTasksScreen from './MobileTasksScreen';

const state = { items: [], filters: { search: '', projectId: '', status: '', priority: '', assignedTo: '', overdue: null }, page: 0, totalPages: 0, isLoading: false, isLoadingMore: false, error: null, setFilters: jest.fn(), retry: jest.fn(), loadMore: jest.fn() };
jest.mock('@/hooks/useMobileTasks', () => ({ useMobileTasks: () => state }));
jest.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ projects: [{ id: 'p1', name: 'Proyecto real' }] }) }));

describe('MobileTasksScreen', () => {
  beforeEach(() => jest.clearAllMocks());
  it('renders honest empty state, accessible search and filters without desktop components', async () => {
    render(<MobileTasksScreen />);
    expect(screen.getByRole('heading', { name: 'Tareas' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /buscar tareas/i })).toBeInTheDocument();
    expect(screen.getByText(/todavia no tiene tareas accesibles/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /filtros/i }));
    expect(screen.getByRole('combobox', { name: /proyecto/i })).toBeInTheDocument();
    expect(screen.queryByTestId('timer-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
  });

  it('wires quick filters', async () => {
    render(<MobileTasksScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Mias' }));
    expect(state.setFilters).toHaveBeenCalledWith({ assignedTo: 'me', overdue: null });
  });
});
