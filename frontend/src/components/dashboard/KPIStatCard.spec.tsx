import { render, screen } from '@testing-library/react';
import KPIStatCard from './KPIStatCard';

describe('KPIStatCard Component', () => {
  describe('Rendering', () => {
    test('renders with all required props', () => {
      render(
        <KPIStatCard
          label="Revenue"
          value={150000}
          meta="vs last quarter"
          tone="primary"
        />
      );
      
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('150000')).toBeInTheDocument();
      expect(screen.getByText('vs last quarter')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    test('label has correct typography', () => {
      render(<KPIStatCard label="Test Label" value="100" meta="Meta" tone="primary" />);
      const label = screen.getByText('Test Label');
      expect(label).toHaveClass('uppercase');
      expect(label).toHaveClass('tracking-widest');
    });

    test('value has correct size', () => {
      render(<KPIStatCard label="Label" value="999" meta="Meta" tone="primary" />);
      const value = screen.getByText('999');
      expect(value).toHaveClass('text-[32px]');
    });
  });

  describe('Tone Variants', () => {
    test('applies primary tone colors', () => {
      render(<KPIStatCard label="Label" value="1" meta="M" tone="primary" />);
      const iconContainer = screen.getByText('Label').previousElementSibling;
      expect(iconContainer).toHaveClass('bg-[#e8eef5]');
    });
  });
});
