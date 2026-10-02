import { render, screen } from '@testing-library/react';
import Section from './Section';

describe('Section Component', () => {
  // Arrange-Act-Assert: Basic Rendering
  describe('Rendering', () => {
    test('renders section with title', () => {
      // Arrange
      render(<Section title="Test Section">Content</Section>);
      
      // Act
      const heading = screen.getByRole('heading', { name: /test section/i });
      
      // Assert
      expect(heading).toBeInTheDocument();
    });

    test('renders children content', () => {
      // Arrange
      render(<Section title="Title">Section content</Section>);
      
      // Act
      const content = screen.getByText('Section content');
      
      // Assert
      expect(content).toBeInTheDocument();
    });

    test('renders as section element', () => {
      // Arrange
      const { container } = render(<Section title="Title">Content</Section>);
      
      // Act
      const section = container.querySelector('section');
      
      // Assert
      expect(section).toBeInTheDocument();
    });

    test('renders with space-y-5 class', () => {
      // Arrange
      const { container } = render(<Section title="Title">Content</Section>);
      
      // Act
      const section = container.querySelector('section');
      
      // Assert
      expect(section).toHaveClass('space-y-5');
    });

    test('renders with h2 title element', () => {
      // Arrange
      render(<Section title="My Section">Content</Section>);
      
      // Act
      const heading = screen.getByRole('heading', { level: 2 });
      
      // Assert
      expect(heading).toHaveTextContent('My Section');
    });
  });

  // Arrange-Act-Assert: Description Prop
  describe('Description', () => {
    test('renders description when provided', () => {
      // Arrange
      render(
        <Section title="Title" description="This is a description">
          Content
        </Section>
      );
      
      // Act
      const description = screen.getByText('This is a description');
      
      // Assert
      expect(description).toBeInTheDocument();
    });

    test('does not render description when not provided', () => {
      // Arrange
      render(<Section title="Title">Content</Section>);
      
      // Act
      const description = screen.queryByText(/description/i);
      
      // Assert
      expect(description).not.toBeInTheDocument();
    });

    test('renders description with app-body class', () => {
      // Arrange
      render(
        <Section title="Title" description="Test description">
          Content
        </Section>
      );
      
      // Act
      const description = screen.getByText('Test description');
      
      // Assert
      expect(description).toHaveClass('app-body');
    });

    test('renders long description correctly', () => {
      // Arrange
      const longDesc = 'This is a very long description that contains multiple sentences.';
      
      // Act
      render(
        <Section title="Title" description={longDesc}>
          Content
        </Section>
      );
      
      // Assert
      expect(screen.getByText(longDesc)).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Action Prop
  describe('Action', () => {
    test('renders action when provided', () => {
      // Arrange
      render(
        <Section title="Title" action={<button>Add</button>}>
          Content
        </Section>
      );
      
      // Act
      const button = screen.getByRole('button', { name: /add/i });
      
      // Assert
      expect(button).toBeInTheDocument();
    });

    test('does not render action when not provided', () => {
      // Arrange
      render(<Section title="Title">Content</Section>);
      
      // Act
      const addBtn = screen.queryByRole('button');
      
      // Assert
      expect(addBtn).not.toBeInTheDocument();
    });

    test('renders action in a div with shrink-0 class', () => {
      // Arrange
      const { container } = render(
        <Section title="Title" action={<button>Action</button>}>
          Content
        </Section>
      );
      
      // Act
      const actionDiv = Array.from(container.querySelectorAll('div')).find(
        (div) => div.className.includes('shrink-0')
      );
      
      // Assert
      expect(actionDiv).toBeInTheDocument();
      expect(actionDiv?.querySelector('button')).toBeInTheDocument();
    });

    test('renders complex action component', () => {
      // Arrange
      render(
        <Section
          title="Title"
          action={
            <div className="flex gap-2">
              <button>Save</button>
              <button>Cancel</button>
            </div>
          }
        >
          Content
        </Section>
      );
      
      // Act
      const saveBtn = screen.getByRole('button', { name: /save/i });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      
      // Assert
      expect(saveBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Custom Classes
  describe('Custom Classes', () => {
    test('applies custom className', () => {
      // Arrange
      const { container } = render(
        <Section title="Title" className="custom-section">
          Content
        </Section>
      );
      
      // Act
      const section = container.querySelector('section');
      
      // Assert
      expect(section).toHaveClass('custom-section');
      expect(section).toHaveClass('space-y-5');
    });

    test('combines custom class with default class', () => {
      // Arrange
      const { container } = render(
        <Section title="Title" className="mt-8 mb-4">
          Content
        </Section>
      );
      
      // Act
      const section = container.querySelector('section');
      
      // Assert
      expect(section).toHaveClass('space-y-5');
      expect(section?.className).toContain('mt-8');
      expect(section?.className).toContain('mb-4');
    });
  });

  // Arrange-Act-Assert: Layout
  describe('Layout', () => {
    test('header and content are separated', () => {
      // Arrange
      const { container } = render(
        <Section title="Title">Content</Section>
      );
      
      // Act
      const header = container.querySelector('.flex');
      const content = screen.getByText('Content');
      
      // Assert
      expect(header).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(header).not.toEqual(content);
    });

    test('header uses flex layout with responsive columns', () => {
      // Arrange
      const { container } = render(
        <Section title="Title" action={<button>Act</button>}>
          Content
        </Section>
      );
      
      // Act
      const header = container.querySelector('.flex');
      
      // Assert
      expect(header).toHaveClass('flex');
      expect(header).toHaveClass('flex-col');
      expect(header?.className).toContain('sm:flex-row');
    });

    test('title has app-section-title class', () => {
      // Arrange
      render(<Section title="My Title">Content</Section>);
      
      // Act
      const heading = screen.getByRole('heading');
      
      // Assert
      expect(heading).toHaveClass('app-section-title');
    });

    test('title and description have space between them', () => {
      // Arrange
      const { container } = render(
        <Section title="Title" description="Description">
          Content
        </Section>
      );
      
      // Act
      const titleSection = container.querySelector('.space-y-1\\.5');
      
      // Assert
      expect(titleSection).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Combination Props
  describe('Combination Props', () => {
    test('renders with title, description, and action', () => {
      // Arrange
      render(
        <Section
          title="Dashboard"
          description="View your analytics"
          action={<button>Refresh</button>}
        >
          <div>Dashboard content</div>
        </Section>
      );
      
      // Act
      const title = screen.getByRole('heading', { name: /dashboard/i });
      const description = screen.getByText('View your analytics');
      const button = screen.getByRole('button', { name: /refresh/i });
      const content = screen.getByText('Dashboard content');
      
      // Assert
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(button).toBeInTheDocument();
      expect(content).toBeInTheDocument();
    });

    test('renders with all props and custom class', () => {
      // Arrange
      const { container } = render(
        <Section
          title="Settings"
          description="Manage your preferences"
          action={<button>Save</button>}
          className="mt-10"
        >
          Settings form
        </Section>
      );
      
      // Act
      const section = container.querySelector('section');
      
      // Assert
      expect(section).toHaveClass('space-y-5');
      expect(section).toHaveClass('mt-10');
      expect(screen.getByText('Settings form')).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Children Variations
  describe('Children Variations', () => {
    test('renders text children', () => {
      // Arrange
      render(<Section title="Title">Simple text</Section>);
      
      // Act
      const content = screen.getByText('Simple text');
      
      // Assert
      expect(content).toBeInTheDocument();
    });

    test('renders element children', () => {
      // Arrange
      render(
        <Section title="Title">
          <div>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </div>
        </Section>
      );
      
      // Act
      const p1 = screen.getByText('Paragraph 1');
      const p2 = screen.getByText('Paragraph 2');
      
      // Assert
      expect(p1).toBeInTheDocument();
      expect(p2).toBeInTheDocument();
    });

    test('renders array children', () => {
      // Arrange
      render(
        <Section title="Title">
          {['Item 1', 'Item 2', 'Item 3'].map((item) => (
            <p key={item}>{item}</p>
          ))}
        </Section>
      );
      
      // Act
      const item1 = screen.getByText('Item 1');
      const item2 = screen.getByText('Item 2');
      const item3 = screen.getByText('Item 3');
      
      // Assert
      expect(item1).toBeInTheDocument();
      expect(item2).toBeInTheDocument();
      expect(item3).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Edge Cases
  describe('Edge Cases', () => {
    test('renders with empty title', () => {
      // Arrange
      render(<Section title="">Content</Section>);
      
      // Act
      const heading = screen.getByRole('heading');
      
      // Assert
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('');
    });

    test('renders with very long title', () => {
      // Arrange
      const longTitle = 'This is a very long section title that might wrap to multiple lines';
      
      // Act
      render(<Section title={longTitle}>Content</Section>);
      
      // Assert
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test('renders multiple sections independently', () => {
      // Arrange
      render(
        <>
          <Section title="Section 1">Content 1</Section>
          <Section title="Section 2">Content 2</Section>
        </>
      );
      
      // Act
      const heading1 = screen.getByRole('heading', { name: /section 1/i });
      const heading2 = screen.getByRole('heading', { name: /section 2/i });
      
      // Assert
      expect(heading1).toBeInTheDocument();
      expect(heading2).toBeInTheDocument();
    });
  });
});
