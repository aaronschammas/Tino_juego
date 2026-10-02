import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No Data" description="Try searching for something else" />);
    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText('Try searching for something else')).toBeInTheDocument();
  });

  it('renders default icon', () => {
    render(<EmptyState title="Title" description="Desc" />);
    expect(screen.getByText('•')).toBeInTheDocument();
  });

  it('renders custom icon', () => {
    render(<EmptyState title="Title" description="Desc" icon="🔍" />);
    expect(screen.getByText('🔍')).toBeInTheDocument();
  });

  it('renders optional action', () => {
    render(
      <EmptyState
        title="Title"
        description="Desc"
        action={<button>Create New</button>}
      />
    );
    expect(screen.getByRole('button', { name: /create new/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState title="Title" description="Desc" className="custom-test-class" />
    );
    // Card applies the class to its root element
    expect(container.firstChild).toHaveClass('custom-test-class');
  });
});
