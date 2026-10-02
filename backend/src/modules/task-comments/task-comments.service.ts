import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { PermissionUser } from 'src/common/permissions';
import type { TaskComment, User } from '@prisma/client';
import { ProjectMembersService } from '../projects/project-members.service';
import { CommentContentDto } from './dto/comment-content.dto';

const PAGE_SIZE = 20;
const authorSelect = { id: true, name: true, lastname: true } as const;
type CommentWithAuthor = TaskComment & {
  author: Pick<User, 'id' | 'name' | 'lastname'> | null;
};

@Injectable()
export class TaskCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectMembers: ProjectMembersService,
  ) {}

  private async assertTask(
    projectId: string,
    taskId: string,
    user: PermissionUser,
  ) {
    if (!user.organizationId) throw new NotFoundException('Task not found');
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!(await this.projectMembers.hasProjectAccess(user, projectId))) {
      throw new ForbiddenException('You do not have access to this project');
    }
  }

  private present(
    comment: CommentWithAuthor,
    userId: string,
    canManage: boolean,
  ) {
    const deleted = !!comment.deletedAt;
    return {
      id: comment.id,
      content: deleted ? null : comment.content,
      taskId: comment.taskId,
      author: comment.author
        ? {
            ...comment.author,
            displayName:
              `${comment.author.name} ${comment.author.lastname}`.trim(),
          }
        : null,
      externalAuthor: comment.externalSource
        ? {
            displayName: comment.externalAuthorName || 'Trello',
            source: comment.externalSource,
          }
        : null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      isEdited:
        !deleted && comment.updatedAt.getTime() > comment.createdAt.getTime(),
      canEdit: !deleted && comment.authorId === userId,
      canDelete: !deleted && (comment.authorId === userId || canManage),
    };
  }

  async list(
    projectId: string,
    taskId: string,
    cursor: string | undefined,
    user: PermissionUser,
  ) {
    await this.assertTask(projectId, taskId, user);
    const canManage = await this.projectMembers.canManageProject(
      user,
      projectId,
    );
    const comments = await this.prisma.taskComment.findMany({
      where: { taskId, organizationId: user.organizationId! },
      include: { author: { select: authorSelect } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = comments.length > PAGE_SIZE;
    const page = comments.slice(0, PAGE_SIZE);
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    return {
      items: page
        .reverse()
        .map((comment) => this.present(comment, user.id, canManage)),
      nextCursor,
    };
  }

  async create(
    projectId: string,
    taskId: string,
    dto: CommentContentDto,
    user: PermissionUser,
  ) {
    await this.assertTask(projectId, taskId, user);
    const comment = await this.prisma.taskComment.create({
      data: {
        content: dto.content.trim(),
        taskId,
        authorId: user.id,
        organizationId: user.organizationId!,
      },
      include: { author: { select: authorSelect } },
    });
    return this.present(comment, user.id, false);
  }

  private async findComment(
    projectId: string,
    taskId: string,
    commentId: string,
    user: PermissionUser,
  ) {
    await this.assertTask(projectId, taskId, user);
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId, organizationId: user.organizationId! },
      include: { author: { select: authorSelect } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  async update(
    projectId: string,
    taskId: string,
    commentId: string,
    dto: CommentContentDto,
    user: PermissionUser,
  ) {
    const comment = await this.findComment(projectId, taskId, commentId, user);
    if (comment.deletedAt) throw new NotFoundException('Comment not found');
    if (comment.authorId !== user.id)
      throw new ForbiddenException('Only the author can edit this comment');
    const updated = await this.prisma.taskComment.update({
      where: { id: comment.id },
      data: { content: dto.content.trim() },
      include: { author: { select: authorSelect } },
    });
    return this.present(updated, user.id, false);
  }

  async remove(
    projectId: string,
    taskId: string,
    commentId: string,
    user: PermissionUser,
  ) {
    const comment = await this.findComment(projectId, taskId, commentId, user);
    if (comment.deletedAt) return this.present(comment, user.id, false);
    const canManage = await this.projectMembers.canManageProject(
      user,
      projectId,
    );
    if (comment.authorId !== user.id && !canManage) {
      throw new ForbiddenException('You cannot delete this comment');
    }
    const deleted = await this.prisma.taskComment.update({
      where: { id: comment.id },
      data: { deletedAt: new Date(), content: '' },
      include: { author: { select: authorSelect } },
    });
    return this.present(deleted, user.id, canManage);
  }
}
