import { render, screen } from '@testing-library/react';
import ActivityChart from './ActivityChart';

// Mock Recharts
jest.mock('recharts', () => {
  const OriginalRecharts = jest.requireActual('recharts');
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: '800px', height: '400px' }} data-testid="responsive-container">
        {children}
      </div>
    ),
  };
});

describe('ActivityChart Component', () => {
  describe('Arrange: Rendering', () => {
    test('renders with correct title and description', () => {
      // Arrange
      render(<ActivityChart />);

      // Assert
      expect(screen.getByText('Tendencia y Progreso')).toBeInTheDocument();
      expect(screen.getByText(/actividad de tareas en la última semana/i)).toBeInTheDocument();
    });

    test('renders time period selectors', () => {
      // Arrange
      render(<ActivityChart />);

      // Assert
      expect(screen.getByText('Día')).toBeInTheDocument();
      expect(screen.getByText('Semana')).toBeInTheDocument();
      expect(screen.getByText('Mes')).toBeInTheDocument();
    });
  });

  describe('Act: Chart Elements', () => {
    test('renders the responsive container', () => {
      // Arrange
      render(<ActivityChart />);

      // Assert
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
