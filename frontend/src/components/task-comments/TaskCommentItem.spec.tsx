import { render, screen } from '@testing-library/react';
import TaskCommentItem from './TaskCommentItem';
import { TaskComment } from '@/types/task-comment';

const baseComment: TaskComment = {
  id: 'c-1',
  content: 'Hola',
  taskId: 'task-1',
  author: null,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
  deletedAt: null,
  isEdited: false,
  canEdit: false,
  canDelete: false,
};

const renderItem = (comment: TaskComment) =>
  render(<TaskCommentItem comment={comment} onEdit={jest.fn()} onDelete={jest.fn()} />);

describe('TaskCommentItem', () => {
  it('shows the Trello author with a Trello badge', () => {
    renderItem({
      ...baseComment,
      externalAuthor: { displayName: 'Ana Trello', source: 'TRELLO_COMMENT' },
    });

    expect(screen.getByText('Ana Trello')).toBeInTheDocument();
    expect(screen.getByText('Trello')).toBeInTheDocument();
  });

  it('keeps the Tino author and no badge for local comments', () => {
    renderItem({
      ...baseComment,
      author: { id: 'u-1', name: 'Ada', lastname: 'L', displayName: 'Ada L' },
    });

    expect(screen.getByText('Ada L')).toBeInTheDocument();
    expect(screen.queryByText('Trello')).not.toBeInTheDocument();
  });

  it('falls back when the author was deleted', () => {
    renderItem(baseComment);

    expect(screen.getByText('Usuario eliminado')).toBeInTheDocument();
  });
});
