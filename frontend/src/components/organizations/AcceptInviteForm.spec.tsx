import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcceptInviteForm } from './AcceptInviteForm';
import { apiGet } from '@/lib/api';

const mockSearchParamsGet: jest.Mock<string | null, [string]> = jest.fn(
  (param: string) => (param === 'token' ? 'valid-token-123' : null),
);

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

const originalLocation = window.location;

describe('AcceptInviteForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet.mockImplementation((param: string) =>
      param === 'token' ? 'valid-token-123' : null,
    );
    (apiGet as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/invites/')) {
        return Promise.resolve({
          email: 'invitee@test.com',
          organizationName: 'Tino Org',
          expiresAt: '2026-06-19T00:00:00.000Z',
        });
      }
      if (url.startsWith('/auth/google/invite-url')) {
        return Promise.resolve({ url: 'https://google.test/oauth' });
      }
      return Promise.reject(new Error('unexpected url'));
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('does not show password fields and shows Google acceptance', async () => {
    render(<AcceptInviteForm />);

    expect(screen.getByRole('heading', { name: /aceptar con google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aceptar con google/i })).toBeDisabled();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();

    expect(await screen.findByText('invitee@test.com')).toBeInTheDocument();
    expect(screen.getByText('Tino Org')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aceptar con google/i })).not.toBeDisabled();
  });

  it('starts Google invite OAuth with the invitation token', async () => {
    const user = userEvent.setup();
    render(<AcceptInviteForm />);

    await screen.findByText('invitee@test.com');
    await user.click(screen.getByRole('button', { name: /aceptar con google/i }));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        '/auth/google/invite-url?token=valid-token-123',
        { skipAuthRedirect: true },
      );
      expect(window.location.href).toBe('https://google.test/oauth');
    });
  });

  it('shows clear message when Google email does not match invitation', async () => {
    mockSearchParamsGet.mockImplementation((param: string) => {
      if (param === 'token') return 'valid-token-123';
      if (param === 'reason') return 'invite_google_rejected';
      return null;
    });

    render(<AcceptInviteForm />);

    await screen.findByText('invitee@test.com');
    expect(
      screen.getByText(
        /esta invitacion fue generada para otro correo|esta invitación fue generada para otro correo/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows invalid link message when token is missing', () => {
    mockSearchParamsGet.mockReturnValue(null);

    render(<AcceptInviteForm />);

    expect(
      screen.getByText(/invalid invitation link. missing or invalid token/i),
    ).toBeInTheDocument();
  });
});
