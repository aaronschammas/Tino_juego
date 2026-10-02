import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button Component', () => {
  // Arrange-Act-Assert: Basic Rendering
  describe('Rendering', () => {
    test('renders with default props', () => {
      // Arrange
      render(<Button>Click me</Button>);
      
      // Act
      const button = screen.getByRole('button', { name: /click me/i });
      
      // Assert
      expect(button).toBeInTheDocument();
    });

    test('renders children text correctly', () => {
      // Arrange
      const text = 'Submit Form';
      
      // Act
      render(<Button>{text}</Button>);
      const button = screen.getByRole('button', { name: /submit form/i });
      
      // Assert
      expect(button).toHaveTextContent(text);
    });

    test('renders with type="button" by default', () => {
      // Arrange
      render(<Button>Click</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  // Arrange-Act-Assert: Variants
  describe('Variants', () => {
    test('applies primary variant classes by default', () => {
      // Arrange
      render(<Button>Primary</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('bg-[var(--color-primary)]');
    });

    test('applies secondary variant classes', () => {
      // Arrange
      render(<Button variant="secondary">Secondary</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('bg-[var(--color-surface)]');
    });

    test('applies ghost variant classes', () => {
      // Arrange
      render(<Button variant="ghost">Ghost</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('bg-transparent');
    });

    test('applies danger variant classes', () => {
      // Arrange
      render(<Button variant="danger">Delete</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('bg-[var(--color-danger)]');
    });
  });

  // Arrange-Act-Assert: Sizes
  describe('Sizes', () => {
    test('applies small size classes', () => {
      // Arrange
      render(<Button size="sm">Small</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('px-3');
    });

    test('applies medium size classes by default', () => {
      // Arrange
      render(<Button>Medium</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('px-3.5');
    });

    test('applies large size classes', () => {
      // Arrange
      render(<Button size="lg">Large</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('px-5');
    });
  });

  // Arrange-Act-Assert: Full Width
  describe('Full Width', () => {
    test('applies full width class when fullWidth is true', () => {
      // Arrange
      render(<Button fullWidth>Full Width</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('w-full');
    });
  });

  // Arrange-Act-Assert: Disabled State
  describe('Disabled State', () => {
    test('applies disabled styling', () => {
      // Arrange
      render(<Button disabled>Disabled</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button).toBeDisabled();
      expect(button.className).toContain('disabled:opacity-55');
    });
  });

  // Arrange-Act-Assert: Interactions
  describe('Interactions', () => {
    test('calls onClick handler when clicked', async () => {
      // Arrange
      const handleClick = jest.fn();
      const user = userEvent.setup();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      // Act
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Assert
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  // Arrange-Act-Assert: Accessibility
  describe('Accessibility', () => {
    test('has proper focus styling', () => {
      // Arrange
      render(<Button>Focusable</Button>);
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button.className).toContain('focus-visible:ring-4');
    });
  });
});
