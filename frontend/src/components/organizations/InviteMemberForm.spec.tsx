import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteMemberForm } from './InviteMemberForm';

const mockInviteMember = jest.fn();

jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    inviteMember: mockInviteMember,
  }),
}));

Object.defineProperty(global.navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve()),
  },
  writable: true,
});
global.alert = jest.fn();

describe('InviteMemberForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render form with all required fields', () => {
      render(<InviteMemberForm />);

      expect(screen.getByRole('heading', { name: /invite member/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send invitation/i })).toBeInTheDocument();
    });

    it('should have submit button disabled when email is empty', () => {
      render(<InviteMemberForm />);

      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      expect(submitButton).toBeDisabled();
    });

    it('should have role select with default value', () => {
      render(<InviteMemberForm />);

      const roleSelect = screen.getByLabelText(/role/i) as HTMLSelectElement;
      expect(roleSelect.value).toBe('ORG_MEMBER');
    });
  });

  describe('Form Input', () => {
    it('should update email on input', async () => {
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      await userEvent.type(emailInput, 'test@example.com');

      expect(emailInput.value).toBe('test@example.com');
    });

    it('should enable submit button when email is entered', async () => {
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      expect(submitButton).toBeDisabled();
      await userEvent.type(emailInput, 'test@example.com');
      expect(submitButton).not.toBeDisabled();
    });

    it('should update role on select change', async () => {
      render(<InviteMemberForm />);

      const roleSelect = screen.getByLabelText(/role/i) as HTMLSelectElement;

      expect(roleSelect.value).toBe('ORG_MEMBER');
      await userEvent.selectOptions(roleSelect, 'ORG_OWNER');
      expect(roleSelect.value).toBe('ORG_OWNER');
    });
  });

  describe('Form Submission', () => {
    it('should call inviteMember with email and role', async () => {
      mockInviteMember.mockResolvedValue({ inviteLink: 'https://invite.link' });
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const roleSelect = screen.getByLabelText(/role/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.selectOptions(roleSelect, 'ORG_OWNER');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockInviteMember).toHaveBeenCalledWith({
          email: 'test@example.com',
          role: 'ORG_OWNER',
        });
      });
    });

    it('should show loading state during submission', async () => {
      mockInviteMember.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    });

    it('should display success message with invite link', async () => {
      const inviteLink = 'https://example.com/invite?token=abc123';
      mockInviteMember.mockResolvedValue({ inviteLink });
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invitation.*created/i)).toBeInTheDocument();
        expect(screen.getByText(/abc123/i)).toBeInTheDocument();
      });
    });

    it('should display error on failed submission', async () => {
      mockInviteMember.mockRejectedValue(new Error('Email already invited'));
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email already invited/i)).toBeInTheDocument();
      });
    });
  });

  describe('Success Callback', () => {
    it('should call onSuccess after successful invitation', async () => {
      const onSuccess = jest.fn();
      mockInviteMember.mockResolvedValue({
        inviteLink: 'https://example.com/invite?token=abc123',
      });
      render(<InviteMemberForm onSuccess={onSuccess} />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy invite link to clipboard', async () => {
      const inviteLink = 'https://example.com/invite?token=abc123';
      mockInviteMember.mockResolvedValue({ inviteLink });
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        const copyButton = screen.getByRole('button', { name: /copy link/i });
        expect(copyButton).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy link/i });
      await userEvent.click(copyButton);

      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(inviteLink);
      expect(global.alert).toHaveBeenCalledWith('Invite link copied to clipboard!');
    });
  });

  describe('Reset Form', () => {
    it('should reset form when invite another button is clicked', async () => {
      mockInviteMember.mockResolvedValue({
        inviteLink: 'https://example.com/invite?token=abc123',
      });
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite another member/i })).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /invite another member/i });
      await userEvent.click(resetButton);

      expect(emailInput.value).toBe('');
      expect(screen.queryByText(/invitation created/i)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in email', async () => {
      mockInviteMember.mockResolvedValue({
        inviteLink: 'https://example.com/invite?token=abc123',
      });
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'user+tag@example.co.uk');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockInviteMember).toHaveBeenCalledWith({
          email: 'user+tag@example.co.uk',
          role: 'ORG_MEMBER',
        });
      });
    });

    it('should handle null inviteLink in response', async () => {
      mockInviteMember.mockResolvedValue({ inviteLink: null });
      render(<InviteMemberForm />);

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /send invitation/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();
      });
    });
  });
});
