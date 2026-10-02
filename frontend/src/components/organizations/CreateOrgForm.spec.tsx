import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateOrgForm } from './CreateOrgForm';

const mockCreateOrganization = jest.fn();

jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    createOrganization: mockCreateOrganization,
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('CreateOrgForm', () => {
  beforeEach(() => {
    mockCreateOrganization.mockClear();
  });

  describe('Rendering', () => {
    it('should render the form with all required fields', () => {
      render(<CreateOrgForm />);

      expect(screen.getByRole('heading', { name: /create organization/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create organization/i })).toBeInTheDocument();
    });

    it('should have a disabled submit button initially', () => {
      render(<CreateOrgForm />);

      const submitButton = screen.getByRole('button', { name: /create organization/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('should enable submit button when name is entered', async () => {
      render(<CreateOrgForm />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      expect(submitButton).toBeDisabled();
      await userEvent.type(nameInput, 'Acme Corp');
      expect(submitButton).not.toBeDisabled();
    });

    it('should call createOrganization with the organization name', async () => {
      mockCreateOrganization.mockResolvedValue({});
      render(<CreateOrgForm onSuccess={() => {}} />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, 'Acme Corp');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({ name: 'Acme Corp' });
      });
    });

    it('should show loading state while submitting', async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => { resolvePromise = resolve; });
      mockCreateOrganization.mockReturnValue(promise);
      
      render(<CreateOrgForm />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, 'Acme Corp');
      await userEvent.click(submitButton);

      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
      
      await React.act(async () => {
        resolvePromise({});
      });
    });

    it('should call onSuccess callback after successful creation', async () => {
      mockCreateOrganization.mockResolvedValue({});
      const onSuccess = jest.fn();
      render(<CreateOrgForm onSuccess={onSuccess} />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, 'Acme Corp');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on failed creation', async () => {
      const errorMessage = 'Organization name already exists';
      mockCreateOrganization.mockRejectedValue(new Error(errorMessage));
      render(<CreateOrgForm />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, 'Acme Corp');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should handle error without message property', async () => {
      mockCreateOrganization.mockRejectedValue('Unknown error');
      render(<CreateOrgForm />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, 'Acme Corp');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/error creating organization/i)).toBeInTheDocument();
      });
    });

    it('should clear error on next submit attempt', async () => {
      mockCreateOrganization
        .mockRejectedValueOnce(new Error('Organization name already exists'))
        .mockResolvedValueOnce({});

      render(<CreateOrgForm />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      // First attempt - should fail
      await userEvent.type(nameInput, 'Acme Corp');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Organization name already exists/i)).toBeInTheDocument();
      });

      // Second attempt with different name - error should clear on submit
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'New Corp');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.queryByText(/Organization name already exists/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Input Validation', () => {
    it('should trim whitespace from name', async () => {
      mockCreateOrganization.mockResolvedValue({});
      render(<CreateOrgForm onSuccess={() => {}} />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, '  Acme Corp  ');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({ name: 'Acme Corp' });
      });
    });

    it('should accept long names', async () => {
      mockCreateOrganization.mockResolvedValue({});
      const longName = 'A'.repeat(100);
      render(<CreateOrgForm onSuccess={() => {}} />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      fireEvent.change(nameInput, { target: { value: longName } });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({ name: longName });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in name', async () => {
      mockCreateOrganization.mockResolvedValue({});
      render(<CreateOrgForm onSuccess={() => {}} />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, 'Acme & Co. (International)');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({ name: 'Acme & Co. (International)' });
      });
    });

    it('should properly reset loading state on error', async () => {
      mockCreateOrganization.mockRejectedValue(new Error('Network error'));
      render(<CreateOrgForm />);

      const nameInput = screen.getByLabelText(/organization name/i);
      const submitButton = screen.getByRole('button', { name: /create organization/i });

      await userEvent.type(nameInput, 'Acme Corp');
      await userEvent.click(submitButton);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /create organization/i });
        expect(button).not.toBeDisabled();
        expect(button).toHaveTextContent('Create Organization');
      });
    });
  });
});
