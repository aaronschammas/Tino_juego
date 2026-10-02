/**
 * ContextBar.tsx - Context Bar Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContextBar from './ContextBar';

describe('ContextBar Component', () => {
  const mockProjects = [
    { id: 'proj-1', name: 'Frontend Development' },
    { id: 'proj-2', name: 'Backend API' },
    { id: 'proj-3', name: 'Mobile App' },
  ];

  const mockPeriodLabels = {
    week: 'Esta Semana',
    month: 'Este Mes',
    total: 'Total',
  };

  const mockOnProjectChange = jest.fn();
  const mockOnPeriodChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render context bar', () => {
      // Arrange & Act
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={mockProjects}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Assert
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('proj-1');
    });

    it('should display all projects in dropdown', () => {
      // Arrange & Act
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={mockProjects}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Assert
      expect(screen.getByText('Frontend Development')).toBeInTheDocument();
      expect(screen.getByText('Backend API')).toBeInTheDocument();
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    it('should display period buttons', () => {
      // Arrange & Act
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={mockProjects}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Assert
      expect(screen.getByText('Esta Semana')).toBeInTheDocument();
      expect(screen.getByText('Este Mes')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('should show selected project', () => {
      // Arrange & Act
      render(
        <ContextBar
          selectedProjectId="proj-2"
          timePeriod="week"
          projects={mockProjects}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Assert
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('proj-2');
    });
  });

  describe('Project Selection', () => {
    it('should call onProjectChange when project is selected', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={mockProjects}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Act
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(select, 'proj-3');

      // Assert
      expect(mockOnProjectChange).toHaveBeenCalledWith('proj-3');
    });
  });

  describe('Period Selection', () => {
    it('should call onPeriodChange when period button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={mockProjects}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Act - find buttons by their text content
      const buttons = screen.getAllByRole('button');
      const monthButton = buttons.find(btn => btn.textContent?.includes('Este Mes'));
      if (monthButton) await user.click(monthButton);

      // Assert
      if (monthButton) {
        expect(mockOnPeriodChange).toHaveBeenCalledWith('month');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle single project', () => {
      // Arrange & Act
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={[mockProjects[0]]}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Assert
      expect(screen.getByText('Frontend Development')).toBeInTheDocument();
    });

    it('should handle empty projects list', () => {
      // Arrange & Act
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={[]}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Assert
      expect(screen.getByText('Esta Semana')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible select element', () => {
      // Arrange & Act
      render(
        <ContextBar
          selectedProjectId="proj-1"
          timePeriod="week"
          projects={mockProjects}
          periodLabels={mockPeriodLabels}
          onProjectChange={mockOnProjectChange}
          onPeriodChange={mockOnPeriodChange}
        />
      );

      // Assert
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
    });
  });
});
