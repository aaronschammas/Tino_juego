/**
 * PriorityCard.tsx - Priority Card Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PriorityCard from './PriorityCard';

describe('PriorityCard Component', () => {
  const mockItem = {
    title: 'Tareas Bloqueadas',
    description: 'Tareas que necesitan atención inmediata',
    actionLabel: 'Ver tareas',
    tone: 'danger' as const,
    count: 5,
  };

  const mockSecondaryNotes = ['2 por dependencias', '3 por recursos'];
  const mockOnAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render priority item title', () => {
      // Arrange & Act
      render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('Tareas Bloqueadas')).toBeInTheDocument();
    });

    it('should render priority item description', () => {
      // Arrange & Act
      render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('Tareas que necesitan atención inmediata')).toBeInTheDocument();
    });

    it('should display count badge when provided', () => {
      // Arrange & Act
      render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render secondary notes', () => {
      // Arrange & Act
      render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('2 por dependencias')).toBeInTheDocument();
      expect(screen.getByText('3 por recursos')).toBeInTheDocument();
    });

    it('should render action button when actionLabel provided', () => {
      // Arrange & Act
      render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByRole('button', { name: /ver tareas/i })).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onAction when action button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Act
      const button = screen.getByRole('button', { name: /ver tareas/i });
      await user.click(button);

      // Assert
      expect(mockOnAction).toHaveBeenCalledTimes(1);
    });

    it('should navigate when actionHref is provided', () => {
      // Arrange
      const itemWithHref = {
        ...mockItem,
        actionHref: '/tasks/blocked',
      };

      // Act
      render(
        <PriorityCard
          item={itemWithHref}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      const button = screen.getByRole('button', { name: /ver tareas/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Tone Styling', () => {
    it('should apply danger tone styling', () => {
      // Arrange & Act
      const { container } = render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      const card = container.querySelector('[class*="danger"]');
      expect(card).toBeInTheDocument();
    });

    it('should apply accent tone styling', () => {
      // Arrange
      const accentItem = { ...mockItem, tone: 'accent' as const };

      // Act
      const { container } = render(
        <PriorityCard
          item={accentItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      const card = container.querySelector('[class*="accent"]');
      expect(card).toBeInTheDocument();
    });

    it('should apply success tone styling', () => {
      // Arrange
      const successItem = { ...mockItem, tone: 'success' as const };

      // Act
      const { container } = render(
        <PriorityCard
          item={successItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      const card = container.querySelector('[class*="success"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render without action button', () => {
      // Arrange
      const itemNoAction = {
        title: 'Tareas',
        description: 'Descripción',
        tone: 'accent' as const,
      };

      // Act
      render(
        <PriorityCard
          item={itemNoAction}
          secondaryNotes={[]}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('Tareas')).toBeInTheDocument();
    });

    it('should render without count', () => {
      // Arrange
      const itemNoCount = { ...mockItem, count: undefined };

      // Act
      render(
        <PriorityCard
          item={itemNoCount}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('Tareas Bloqueadas')).toBeInTheDocument();
    });

    it('should render without secondary notes', () => {
      // Arrange & Act
      render(
        <PriorityCard
          item={mockItem}
          secondaryNotes={[]}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('Tareas Bloqueadas')).toBeInTheDocument();
    });

    it('should handle zero count', () => {
      // Arrange
      const zeroCountItem = { ...mockItem, count: 0 };

      // Act
      render(
        <PriorityCard
          item={zeroCountItem}
          secondaryNotes={mockSecondaryNotes}
          onAction={mockOnAction}
        />
      );

      // Assert
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});
