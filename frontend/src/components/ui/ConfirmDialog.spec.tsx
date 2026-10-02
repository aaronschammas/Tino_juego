import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Confirm Title',
    description: 'Confirm Description',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders title and description when isOpen is true', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm Title')).toBeInTheDocument();
    expect(screen.getByText('Confirm Description')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('renders custom labels', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
      />
    );
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
    expect(screen.getByText('No, keep')).toBeInTheDocument();
  });

  it('applies primary tone styles', () => {
    render(<ConfirmDialog {...defaultProps} tone="primary" />);
    const confirmBtn = screen.getByText('Confirmar');
    expect(confirmBtn).toHaveClass('bg-[var(--color-primary)]');
  });

  it('applies danger tone styles by default', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmBtn = screen.getByText('Confirmar');
    expect(confirmBtn).toHaveClass('bg-[var(--color-danger)]');
  });
});
