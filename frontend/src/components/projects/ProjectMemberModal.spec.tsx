import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectMemberModal from './ProjectMemberModal';
import { OrganizationMember } from '@/types/organization';

const members: OrganizationMember[] = [
  {
    membershipId: 'membership-1',
    userId: 'user-1',
    email: 'ana@example.com',
    name: 'Ana',
    lastname: 'Pérez',
    status: 'ACTIVE',
    role: 'ORG_MEMBER',
  },
  {
    membershipId: 'membership-2',
    userId: 'user-2',
    email: 'bruno@example.com',
    name: 'Bruno',
    lastname: 'Díaz',
    status: 'ACTIVE',
    role: 'ORG_MEMBER',
  },
];

function renderModal(overrides: Partial<React.ComponentProps<typeof ProjectMemberModal>> = {}) {
  const props: React.ComponentProps<typeof ProjectMemberModal> = {
    isOpen: true,
    members,
    currentMembersCount: 1,
    error: null,
    pendingMemberId: null,
    onAddMember: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  return { ...render(<ProjectMemberModal {...props} />), props };
}

describe('ProjectMemberModal', () => {
  it('filters members and submits the selected user', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.type(screen.getByPlaceholderText('Buscar por nombre o email'), 'ana');
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Bruno Díaz')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(props.onAddMember).toHaveBeenCalledWith('user-1');
  });

  it('blocks every add action while a request is pending', () => {
    renderModal({ pendingMemberId: 'user-1' });
    expect(screen.getByRole('button', { name: 'Agregando...' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Agregar' })[0]).toBeDisabled();
  });

  it('shows backend errors and closes from the close button', async () => {
    const user = userEvent.setup();
    const { props } = renderModal({ error: 'No autorizado' });
    expect(screen.getByText('No autorizado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('resets the search when the dialog is closed and opened again', async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderModal();
    const search = screen.getByPlaceholderText('Buscar por nombre o email');
    await user.type(search, 'ana');

    rerender(<ProjectMemberModal {...props} isOpen={false} />);
    rerender(<ProjectMemberModal {...props} isOpen />);

    expect(screen.getByPlaceholderText('Buscar por nombre o email')).toHaveValue('');
  });
});
