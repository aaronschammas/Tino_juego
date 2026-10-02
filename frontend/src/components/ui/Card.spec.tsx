import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card Component', () => {
  // Arrange-Act-Assert: Basic Rendering
  describe('Rendering', () => {
    test('renders with children', () => {
      // Arrange
      render(<Card>Card content</Card>);
      
      // Act
      const card = screen.getByText('Card content');
      
      // Assert
      expect(card).toBeInTheDocument();
    });

    test('renders with default props', () => {
      // Arrange
      render(<Card>Content</Card>);
      
      // Act
      const card = screen.getByText('Content');
      
      // Assert
      expect(card.closest('div')).toHaveClass('app-card');
    });

    test('renders as a div element', () => {
      // Arrange
      render(<Card>Test</Card>);
      
      // Act
      const card = screen.getByText('Test').closest('div');
      
      // Assert
      expect(card?.tagName).toBe('DIV');
    });

    test('renders with complex children', () => {
      // Arrange
      render(
        <Card>
          <h2>Title</h2>
          <p>Description</p>
        </Card>
      );
      
      // Act
      const heading = screen.getByRole('heading', { name: /title/i });
      const paragraph = screen.getByText('Description');
      
      // Assert
      expect(heading).toBeInTheDocument();
      expect(paragraph).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Hoverable Prop
  describe('Hoverable', () => {
    test('applies hoverable class when hoverable=true', () => {
      // Arrange
      render(<Card hoverable>Hoverable Card</Card>);
      
      // Act
      const card = screen.getByText('Hoverable Card').closest('div');
      
      // Assert
      expect(card).toHaveClass('app-card-hover');
    });

    test('does not apply hoverable class by default', () => {
      // Arrange
      render(<Card>Non-hoverable</Card>);
      
      // Act
      const card = screen.getByText('Non-hoverable').closest('div');
      
      // Assert
      expect(card).not.toHaveClass('app-card-hover');
    });

    test('applies hoverable class when hoverable=false', () => {
      // Arrange
      render(<Card hoverable={false}>Not Hoverable</Card>);
      
      // Act
      const card = screen.getByText('Not Hoverable').closest('div');
      
      // Assert
      expect(card).not.toHaveClass('app-card-hover');
    });

    test('always has app-card class regardless of hoverable', () => {
      // Arrange
      render(<Card hoverable>Hoverable</Card>);
      
      // Act
      const card = screen.getByText('Hoverable').closest('div');
      
      // Assert
      expect(card).toHaveClass('app-card');
      expect(card).toHaveClass('app-card-hover');
    });
  });

  // Arrange-Act-Assert: Padding Prop
  describe('Padding', () => {
    test('applies small padding class', () => {
      // Arrange
      render(<Card padding="sm">Small Padding</Card>);
      
      // Act
      const card = screen.getByText('Small Padding').closest('div');
      
      // Assert
      expect(card).toHaveClass('p-4');
    });

    test('applies medium padding class by default', () => {
      // Arrange
      render(<Card>Medium Padding</Card>);
      
      // Act
      const card = screen.getByText('Medium Padding').closest('div');
      
      // Assert
      expect(card).toHaveClass('p-6');
    });

    test('applies large padding class', () => {
      // Arrange
      render(<Card padding="lg">Large Padding</Card>);
      
      // Act
      const card = screen.getByText('Large Padding').closest('div');
      
      // Assert
      expect(card).toHaveClass('p-8');
    });

    test('switches padding sizes correctly', () => {
      // Arrange
      const { rerender } = render(<Card padding="sm">Content</Card>);
      
      // Act
      let card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('p-4');
      
      rerender(<Card padding="lg">Content</Card>);
      card = screen.getByText('Content').closest('div');
      
      // Assert
      expect(card).toHaveClass('p-8');
      expect(card).not.toHaveClass('p-4');
    });
  });

  // Arrange-Act-Assert: Custom Classes
  describe('Custom Classes', () => {
    test('merges custom className', () => {
      // Arrange
      render(<Card className="custom-class">Content</Card>);
      
      // Act
      const card = screen.getByText('Content').closest('div');
      
      // Assert
      expect(card).toHaveClass('app-card');
      expect(card).toHaveClass('custom-class');
    });

    test('allows multiple custom classes', () => {
      // Arrange
      render(<Card className="flex flex-col gap-2">Content</Card>);
      
      // Act
      const card = screen.getByText('Content').closest('div');
      
      // Assert
      expect(card?.className).toContain('flex');
      expect(card?.className).toContain('flex-col');
      expect(card?.className).toContain('gap-2');
    });

    test('custom class can override defaults with proper CSS specificity', () => {
      // Arrange
      render(<Card className="!p-10">Content</Card>);
      
      // Act
      const card = screen.getByText('Content').closest('div');
      
      // Assert
      expect(card?.className).toContain('!p-10');
    });
  });

  // Arrange-Act-Assert: HTML Attributes
  describe('HTML Attributes', () => {
    test('passes through data attributes', () => {
      // Arrange
      render(<Card data-testid="test-card">Content</Card>);
      
      // Act
      const card = screen.getByTestId('test-card');
      
      // Assert
      expect(card).toBeInTheDocument();
    });

    test('passes through aria attributes', () => {
      // Arrange
      render(<Card aria-label="Payment Card">Content</Card>);
      
      // Act
      const card = screen.getByLabelText('Payment Card');
      
      // Assert
      expect(card).toBeInTheDocument();
    });

    test('passes through id attribute', () => {
      // Arrange
      render(<Card id="card-123">Content</Card>);
      
      // Act
      const card = document.getElementById('card-123');
      
      // Assert
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('Content');
    });

    test('passes through style attribute', () => {
      // Arrange
      render(<Card style={{ minHeight: '200px' }}>Content</Card>);
      
      // Act
      const card = screen.getByText('Content').closest('div');
      
      // Assert
      expect(card).toHaveStyle('min-height: 200px');
    });
  });

  // Arrange-Act-Assert: Combination Props
  describe('Combination Props', () => {
    test('combines hoverable and padding', () => {
      // Arrange
      render(
        <Card hoverable padding="lg">
          Large Hoverable
        </Card>
      );
      
      // Act
      const card = screen.getByText('Large Hoverable').closest('div');
      
      // Assert
      expect(card).toHaveClass('app-card-hover');
      expect(card).toHaveClass('p-8');
    });

    test('combines all props together', () => {
      // Arrange
      render(
        <Card
          hoverable
          padding="sm"
          className="shadow-lg"
          data-testid="combo-card"
        >
          Combo
        </Card>
      );
      
      // Act
      const card = screen.getByTestId('combo-card');
      
      // Assert
      expect(card).toHaveClass('app-card');
      expect(card).toHaveClass('app-card-hover');
      expect(card).toHaveClass('p-4');
      expect(card).toHaveClass('shadow-lg');
    });
  });

  // Arrange-Act-Assert: Edge Cases
  describe('Edge Cases', () => {
    test('renders with empty children', () => {
      // Arrange
      const { container } = render(<Card></Card>);
      
      // Act
      const card = container.querySelector('div.app-card');
      
      // Assert
      expect(card).toBeInTheDocument();
    });

    test('renders with null children gracefully', () => {
      // Arrange
      const { container } = render(<Card>{null}</Card>);
      
      // Act
      const card = container.querySelector('div.app-card');
      
      // Assert
      expect(card).toBeInTheDocument();
    });

    test('renders multiple cards independently', () => {
      // Arrange
      render(
        <>
          <Card>Card 1</Card>
          <Card>Card 2</Card>
          <Card>Card 3</Card>
        </>
      );
      
      // Act
      const card1 = screen.getByText('Card 1').closest('div');
      const card2 = screen.getByText('Card 2').closest('div');
      const card3 = screen.getByText('Card 3').closest('div');
      
      // Assert
      expect(card1).toBeInTheDocument();
      expect(card2).toBeInTheDocument();
      expect(card3).toBeInTheDocument();
      expect(card1).not.toBe(card2);
    });
  });
});
