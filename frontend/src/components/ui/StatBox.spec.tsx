import { render, screen } from '@testing-library/react';
import StatBox from './StatBox';

describe('StatBox Component', () => {
  // Arrange-Act-Assert: Basic Rendering
  describe('Rendering', () => {
    test('renders with label and value', () => {
      // Arrange
      render(<StatBox label="Total Users" value={42} />);
      
      // Act
      const label = screen.getByText('Total Users');
      const value = screen.getByText('42');
      
      // Assert
      expect(label).toBeInTheDocument();
      expect(value).toBeInTheDocument();
    });

    test('renders with string value', () => {
      // Arrange
      render(<StatBox label="Status" value="Active" />);
      
      // Act
      const value = screen.getByText('Active');
      
      // Assert
      expect(value).toBeInTheDocument();
    });

    test('renders with numeric value', () => {
      // Arrange
      render(<StatBox label="Revenue" value={15000} />);
      
      // Act
      const value = screen.getByText('15000');
      
      // Assert
      expect(value).toBeInTheDocument();
    });

    test('renders as a div element', () => {
      // Arrange
      const { container } = render(<StatBox label="Label" value="Value" />);
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox?.tagName).toBe('DIV');
    });
  });

  // Arrange-Act-Assert: Label Styling
  describe('Label Styling', () => {
    test('label has app-caption class', () => {
      // Arrange
      render(<StatBox label="Test Label" value={1} />);
      
      // Act
      const label = screen.getByText('Test Label');
      
      // Assert
      expect(label).toHaveClass('app-caption');
    });

    test('label is uppercase', () => {
      // Arrange
      render(<StatBox label="test label" value={1} />);
      
      // Act
      const label = screen.getByText('test label');
      
      // Assert
      expect(label).toHaveClass('uppercase');
    });

    test('label has tracking applied', () => {
      // Arrange
      render(<StatBox label="Tracked" value={1} />);
      
      // Act
      const label = screen.getByText('Tracked');
      
      // Assert
      expect(label).toHaveClass('tracking-[0.12em]');
    });

    test('label has left padding', () => {
      // Arrange
      render(<StatBox label="Padded" value={1} />);
      
      // Act
      const label = screen.getByText('Padded');
      
      // Assert
      expect(label).toHaveClass('pl-1');
    });
  });

  // Arrange-Act-Assert: Value Styling
  describe('Value Styling', () => {
    test('value has large font size', () => {
      // Arrange
      render(<StatBox label="Label" value="123" />);
      
      // Act
      const value = screen.getByText('123');
      
      // Assert
      expect(value).toHaveClass('text-[2rem]');
    });

    test('value has semibold font weight', () => {
      // Arrange
      render(<StatBox label="Label" value="Value" />);
      
      // Act
      const value = screen.getByText('Value');
      
      // Assert
      expect(value).toHaveClass('font-semibold');
    });

    test('value has proper spacing and tracking', () => {
      // Arrange
      render(<StatBox label="Label" value="Value" />);
      
      // Act
      const value = screen.getByText('Value');
      
      // Assert
      expect(value).toHaveClass('mt-3');
      expect(value).toHaveClass('leading-none');
      expect(value).toHaveClass('tracking-[-0.03em]');
    });

    test('value has ink-900 color', () => {
      // Arrange
      render(<StatBox label="Label" value="Value" />);
      
      // Act
      const value = screen.getByText('Value');
      
      // Assert
      expect(value).toHaveClass('text-[var(--color-ink-900)]');
    });
  });

  // Arrange-Act-Assert: Meta Prop
  describe('Meta Prop', () => {
    test('renders meta when provided', () => {
      // Arrange
      render(<StatBox label="Label" value={100} meta="+5%" />);
      
      // Act
      const meta = screen.getByText('+5%');
      
      // Assert
      expect(meta).toBeInTheDocument();
    });

    test('does not render meta when not provided', () => {
      // Arrange
      render(<StatBox label="Label" value={100} />);
      
      // Act
      const meta = screen.queryByText(/\+/);
      
      // Assert
      expect(meta).not.toBeInTheDocument();
    });

    test('meta has app-caption class', () => {
      // Arrange
      render(<StatBox label="Label" value={100} meta="vs last month" />);
      
      // Act
      const meta = screen.getByText('vs last month');
      
      // Assert
      expect(meta).toHaveClass('app-caption');
    });

    test('meta has proper spacing', () => {
      // Arrange
      render(<StatBox label="Label" value={100} meta="Meta" />);
      
      // Act
      const meta = screen.getByText('Meta');
      
      // Assert
      expect(meta).toHaveClass('mt-3');
      expect(meta).toHaveClass('pl-1');
    });
  });

  // Arrange-Act-Assert: Tone Variants
  describe('Tone Variants', () => {
    test('renders with primary tone', () => {
      // Arrange
      render(<StatBox label="Label" value={1} tone="primary" />);
      
      // Act
      const label = screen.getByText('Label');
      
      // Assert
      expect(label).toBeInTheDocument();
    });

    test('renders with secondary tone', () => {
      // Arrange
      render(<StatBox label="Label" value={1} tone="secondary" />);
      
      // Act
      const label = screen.getByText('Label');
      
      // Assert
      expect(label).toBeInTheDocument();
    });

    test('renders with accent tone', () => {
      // Arrange
      render(<StatBox label="Label" value={1} tone="accent" />);
      
      // Act
      const label = screen.getByText('Label');
      
      // Assert
      expect(label).toBeInTheDocument();
    });

    test('renders with danger tone', () => {
      // Arrange
      render(<StatBox label="Label" value={1} tone="danger" />);
      
      // Act
      const label = screen.getByText('Label');
      
      // Assert
      expect(label).toBeInTheDocument();
    });

    test('applies primary tone by default', () => {
      // Arrange
      render(<StatBox label="Label" value={1} />);
      
      // Act
      const label = screen.getByText('Label');
      
      // Assert
      expect(label).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Structure
  describe('Structure', () => {
    test('has border and rounded corners', () => {
      // Arrange
      const { container } = render(<StatBox label="Label" value="Value" />);
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox).toHaveClass('rounded-[20px]');
      expect(statBox).toHaveClass('border');
    });

    test('has overflow hidden for rounded corners', () => {
      // Arrange
      const { container } = render(<StatBox label="Label" value="Value" />);
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox).toHaveClass('overflow-hidden');
    });

    test('has left accent bar (before element styling)', () => {
      // Arrange
      const { container } = render(<StatBox label="Label" value="Value" />);
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox?.className).toContain('before:absolute');
      expect(statBox?.className).toContain('before:left-0');
      expect(statBox?.className).toContain('before:top-0');
      expect(statBox?.className).toContain('before:h-full');
      expect(statBox?.className).toContain('before:w-1.5');
    });

    test('has padding', () => {
      // Arrange
      const { container } = render(<StatBox label="Label" value="Value" />);
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox).toHaveClass('p-5');
    });
  });

  // Arrange-Act-Assert: Custom Classes
  describe('Custom Classes', () => {
    test('merges custom className', () => {
      // Arrange
      const { container } = render(
        <StatBox label="Label" value="Value" className="custom-class" />
      );
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox?.className).toContain('custom-class');
      expect(statBox).toHaveClass('rounded-[20px]');
    });

    test('custom class can adjust appearance', () => {
      // Arrange
      const { container } = render(
        <StatBox
          label="Label"
          value="Value"
          className="shadow-xl hover:shadow-2xl"
        />
      );
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox?.className).toContain('shadow-xl');
      expect(statBox?.className).toContain('hover:shadow-2xl');
    });
  });

  // Arrange-Act-Assert: Combination Props
  describe('Combination Props', () => {
    test('renders with label, value, meta, and tone', () => {
      // Arrange
      render(
        <StatBox
          label="Revenue"
          value={25000}
          meta="Last month: $20000"
          tone="success"
        />
      );
      
      // Act
      const label = screen.getByText('Revenue');
      const value = screen.getByText('25000');
      const meta = screen.getByText('Last month: $20000');
      
      // Assert
      expect(label).toBeInTheDocument();
      expect(value).toBeInTheDocument();
      expect(meta).toBeInTheDocument();
    });

    test('renders with all props including custom class', () => {
      // Arrange
      const { container } = render(
        <StatBox
          label="Users"
          value={150}
          meta="Active today"
          tone="accent"
          className="col-span-2"
        />
      );
      
      // Act
      const statBox = container.querySelector('div');
      
      // Assert
      expect(statBox).toHaveClass('col-span-2');
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Active today')).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Edge Cases
  describe('Edge Cases', () => {
    test('renders with zero value', () => {
      // Arrange
      render(<StatBox label="Count" value={0} />);
      
      // Act
      const value = screen.getByText('0');
      
      // Assert
      expect(value).toBeInTheDocument();
    });

    test('renders with negative value', () => {
      // Arrange
      render(<StatBox label="Change" value={-50} />);
      
      // Act
      const value = screen.getByText('-50');
      
      // Assert
      expect(value).toBeInTheDocument();
    });

    test('renders with decimal value', () => {
      // Arrange
      render(<StatBox label="Average" value={3.14} />);
      
      // Act
      const value = screen.getByText('3.14');
      
      // Assert
      expect(value).toBeInTheDocument();
    });

    test('renders with very long meta text', () => {
      // Arrange
      const longMeta = 'This is a very long meta text that might wrap to multiple lines in the UI';
      
      // Act
      render(<StatBox label="Label" value={1} meta={longMeta} />);
      
      // Assert
      expect(screen.getByText(longMeta)).toBeInTheDocument();
    });

    test('renders multiple StatBoxes independently', () => {
      // Arrange
      render(
        <>
          <StatBox label="Box 1" value={10} tone="primary" />
          <StatBox label="Box 2" value={20} tone="secondary" />
          <StatBox label="Box 3" value={30} tone="danger" />
        </>
      );
      
      // Act
      const box1 = screen.getByText('Box 1').closest('div');
      const box2 = screen.getByText('Box 2').closest('div');
      const box3 = screen.getByText('Box 3').closest('div');
      
      // Assert
      expect(box1).toBeInTheDocument();
      expect(box2).toBeInTheDocument();
      expect(box3).toBeInTheDocument();
      expect(box1).not.toBe(box2);
    });
  });
});
