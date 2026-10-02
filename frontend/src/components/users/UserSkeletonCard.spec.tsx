import { render } from '@testing-library/react';
import UserSkeletonCard from './UserSkeletonCard';

describe('UserSkeletonCard Component', () => {
  test('renders without crashing and contains animation class', () => {
    // Arrange
    const { container } = render(<UserSkeletonCard />);
    
    // Act
    const pulseDiv = container.querySelector('.animate-pulse');
    
    // Assert
    expect(pulseDiv).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('app-card');
  });
});
