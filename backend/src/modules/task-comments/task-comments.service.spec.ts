/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskCommentsService } from './task-comments.service';

const user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
const now = new Date('2026-08-06T12:00:00Z');
const comment = (extra: any = {}) => ({
  id: 'comment-1',
  content: 'Hola',
  taskId: 'task-1',
  authorId: 'user-1',
  organizationId: 'org-1',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  author: { id: 'user-1', name: 'Ada', lastname: 'Lovelace' },
  ...extra,
});

describe('TaskCommentsService', () => {
  let prisma: any;
  let members: any;
  let service: TaskCommentsService;
  beforeEach(() => {
    prisma = {
      task: { findFirst: jest.fn().mockResolvedValue({ id: 'task-1' }) },
      taskComment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    members = {
      hasProjectAccess: jest.fn().mockResolvedValue(true),
      canManageProject: jest.fn().mockResolvedValue(false),
    };
    service = new TaskCommentsService(prisma, members);
  });

  it('lists authorized comments chronologically', async () => {
    prisma.taskComment.findMany.mockResolvedValue([
      comment({
        id: 'new',
        createdAt: new Date('2026-08-06T13:00:00Z'),
        updatedAt: new Date('2026-08-06T13:00:00Z'),
      }),
      comment({ id: 'old' }),
    ]);
    const result = await service.list('project-1', 'task-1', undefined, user);
    expect(result.items.map((x) => x.id)).toEqual(['old', 'new']);
  });
  it('paginates 20 comments with an older cursor', async () => {
    prisma.taskComment.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => comment({ id: `c${i}` })),
    );
    const result = await service.list('project-1', 'task-1', undefined, user);
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe('c19');
  });
  it('creates using authenticated tenant and author', async () => {
    prisma.taskComment.create.mockResolvedValue(comment());
    await service.create('project-1', 'task-1', { content: '  listo  ' }, user);
    expect(prisma.taskComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'listo',
          authorId: 'user-1',
          organizationId: 'org-1',
        }),
      }),
    );
  });
  it('returns 404 for another organization or project task', async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    await expect(
      service.list('other-project', 'task-1', undefined, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'task-1',
        projectId: 'other-project',
        organizationId: 'org-1',
      },
      select: { id: true },
    });
  });
  it('rejects a user without project access', async () => {
    members.hasProjectAccess.mockResolvedValue(false);
    await expect(
      service.list('project-1', 'task-1', undefined, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows the author to edit', async () => {
    prisma.taskComment.findFirst.mockResolvedValue(comment());
    prisma.taskComment.update.mockResolvedValue(
      comment({
        content: 'Nuevo',
        updatedAt: new Date('2026-08-06T13:00:00Z'),
      }),
    );
    const result = await service.update(
      'project-1',
      'task-1',
      'comment-1',
      { content: ' Nuevo ' },
      user,
    );
    expect(result.content).toBe('Nuevo');
    expect(result.isEdited).toBe(true);
  });
  it('prevents another member from editing', async () => {
    prisma.taskComment.findFirst.mockResolvedValue(
      comment({ authorId: 'other' }),
    );
    await expect(
      service.update(
        'project-1',
        'task-1',
        'comment-1',
        { content: 'x' },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('prevents editing a deleted comment', async () => {
    prisma.taskComment.findFirst.mockResolvedValue(comment({ deletedAt: now }));
    await expect(
      service.update(
        'project-1',
        'task-1',
        'comment-1',
        { content: 'x' },
        user,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('allows author deletion and hides original content', async () => {
    prisma.taskComment.findFirst.mockResolvedValue(comment());
    prisma.taskComment.update.mockResolvedValue(
      comment({ content: '', deletedAt: now }),
    );
    const result = await service.remove(
      'project-1',
      'task-1',
      'comment-1',
      user,
    );
    expect(result.content).toBeNull();
    expect(prisma.taskComment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: '' }),
      }),
    );
  });
  it('allows a project or organization manager to delete another author comment', async () => {
    prisma.taskComment.findFirst.mockResolvedValue(
      comment({ authorId: 'other' }),
    );
    members.canManageProject.mockResolvedValue(true);
    prisma.taskComment.update.mockResolvedValue(
      comment({ authorId: 'other', content: '', deletedAt: now }),
    );
    await expect(
      service.remove('project-1', 'task-1', 'comment-1', user),
    ).resolves.toMatchObject({ content: null });
  });
  it('prevents a regular member deleting another author comment', async () => {
    prisma.taskComment.findFirst.mockResolvedValue(
      comment({ authorId: 'other' }),
    );
    await expect(
      service.remove('project-1', 'task-1', 'comment-1', user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('represents a missing author as null', async () => {
    prisma.taskComment.findMany.mockResolvedValue([
      comment({ authorId: null, author: null }),
    ]);
    const result = await service.list('project-1', 'task-1', undefined, user);
    expect(result.items[0].author).toBeNull();
    expect(result.items[0].externalAuthor).toBeNull();
  });
  it('shows the Trello author of a synced comment', async () => {
    prisma.taskComment.findMany.mockResolvedValue([
      comment({
        authorId: null,
        author: null,
        externalSource: 'TRELLO_COMMENT',
        externalAuthorName: 'Ana Trello',
      }),
      comment({
        id: 'no-name',
        authorId: null,
        author: null,
        externalSource: 'TRELLO_COMMENT',
        externalAuthorName: null,
      }),
    ]);
    const result = await service.list('project-1', 'task-1', undefined, user);
    const byId = new Map(result.items.map((item) => [item.id, item]));
    expect(byId.get('comment-1')?.externalAuthor).toEqual({
      displayName: 'Ana Trello',
      source: 'TRELLO_COMMENT',
    });
    expect(byId.get('no-name')?.externalAuthor).toEqual({
      displayName: 'Trello',
      source: 'TRELLO_COMMENT',
    });
    expect(byId.get('comment-1')?.canEdit).toBe(false);
  });
});
