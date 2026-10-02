import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardSlicers from './DashboardSlicers';
import { useProjects } from '@/hooks/useProjects';

// Mock the useProjects hook
jest.mock('@/hooks/useProjects');

const mockProjects = [
  { id: 'p1', name: 'Alpha Project' },
  { id: 'p2', name: 'Beta Project' },
];

(useProjects as jest.Mock).mockReturnValue({ projects: mockProjects });

describe('DashboardSlicers Component', () => {
  const mockFilters = {
    projectId: 'all',
    status: 'all',
    startDate: null,
    endDate: null,
  };

  const mockSetFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useProjects as jest.Mock).mockReturnValue({ projects: mockProjects, isLoading: false, error: null });
  });

  describe('Arrange: Rendering', () => {
    test('renders all filter labels and default options', () => {
      // Arrange
      render(<DashboardSlicers filters={mockFilters} setFilters={mockSetFilters} />);

      // Assert
      expect(screen.getByText('PROYECTO')).toBeInTheDocument();
      expect(screen.getByText('ESTADO')).toBeInTheDocument();
      expect(screen.getByText('FECHA INICIO')).toBeInTheDocument();
      expect(screen.getByText('FECHA FIN')).toBeInTheDocument();
      
      expect(screen.getByText('Toda la organización')).toBeInTheDocument();
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      expect(screen.getByText('Beta Project')).toBeInTheDocument();
    });

    test('does not call useProjects when projects are provided by parent', () => {
      render(
        <DashboardSlicers
          filters={mockFilters}
          setFilters={mockSetFilters}
          projects={mockProjects as any}
          projectsLoading={false}
          projectsError={null}
        />,
      );

      expect(useProjects).not.toHaveBeenCalled();
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    });

    test('displays current filter values correctly', () => {
      // Arrange
      const customFilters = {
        projectId: 'p1',
        status: 'DONE',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };
      render(<DashboardSlicers filters={customFilters} setFilters={mockSetFilters} />);

      // Assert
      expect(screen.getByLabelText(/proyecto/i)).toHaveValue('p1');
      expect(screen.getByLabelText(/estado/i)).toHaveValue('DONE');
      expect(screen.getByLabelText(/fecha inicio/i)).toHaveValue('2024-01-01');
      expect(screen.getByLabelText(/fecha fin/i)).toHaveValue('2024-12-31');
    });
  });

  describe('Act: Interactions', () => {
    test('calls setFilters when project selection changes', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DashboardSlicers filters={mockFilters} setFilters={mockSetFilters} />);
      
      // Act
      const projectSelect = screen.getByLabelText(/proyecto/i);
      await user.selectOptions(projectSelect, 'p2');
      
      // Assert
      expect(mockSetFilters).toHaveBeenCalled();
    });

    test('calls setFilters when status selection changes', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DashboardSlicers filters={mockFilters} setFilters={mockSetFilters} />);
      
      // Act
      const statusSelect = screen.getByLabelText(/estado/i);
      await user.selectOptions(statusSelect, 'IN_PROGRESS');
      
      // Assert
      expect(mockSetFilters).toHaveBeenCalled();
    });

    test('calls setFilters when dates are selected', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DashboardSlicers filters={mockFilters} setFilters={mockSetFilters} />);
      
      // Act
      const dateInput = screen.getByLabelText(/fecha inicio/i);
      await user.type(dateInput, '2024-05-01');
      
      // Assert
      expect(mockSetFilters).toHaveBeenCalled();
    });

    test('clears all filters when "Limpiar Filtros" is clicked', () => {
      // Arrange
      const activeFilters = {
        projectId: 'p1',
        status: 'all',
        startDate: null,
        endDate: null,
      };
      render(<DashboardSlicers filters={activeFilters} setFilters={mockSetFilters} />);
      
      // Act
      fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));
      
      // Assert
      expect(mockSetFilters).toHaveBeenCalledWith({
        projectId: 'all',
        startDate: null,
        endDate: null,
        status: 'all',
      });
    });
  });
});
