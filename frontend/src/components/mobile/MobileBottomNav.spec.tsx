import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import MobileBottomNav from './MobileBottomNav';

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));

describe('MobileBottomNav', () => {
  it('renders accessible destinations and marks the active route', () => {
    (usePathname as jest.Mock).mockReturnValue('/mobile/tasks');
    render(<MobileBottomNav />);
    expect(screen.getByRole('navigation', { name: /navegacion movil principal/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tareas/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /consultas/i })).toHaveAttribute('href', '/mobile/assistant');
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });
});
