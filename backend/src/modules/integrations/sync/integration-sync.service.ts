/**
 * Motor de sincronizacion comun a todos los proveedores: recibe un snapshot ya
 * traducido y lo escribe en Tino sin saber de donde viene.
 *
 * Qué contiene:
 * - `findExisting()`: busca en la organizacion el proyecto, las tareas y las
 *   subtareas del snapshot que ya fueron importados (por `externalSource` +
 *   `externalId`), para no duplicarlos.
 * - `findTargetProject()`: proyecto activo de la organizacion donde se importara.
 * - `importSnapshot()`: todo en una sola transaccion. Crea el proyecto si no hay
 *   destino (con el usuario como OWNER), ejecuta `onProjectReady` para que quien
 *   llama guarde datos propios (ej: la conexion) en la misma transaccion, crea
 *   las tareas que no existen (guardando su grupo externo y el ultimo estado
 *   visto en el proveedor, `externalSnapshot`), despues las subtareas
 *   colgadas del id de Tino de su tarea padre y por ultimo los comentarios que
 *   todavia no estan (con el nombre del autor externo). Si algo falla se deshace
 *   todo y se loguea solo nombre y codigo del error, nunca el mensaje crudo ni
 *   credenciales.
 */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, Priority } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  ExternalSources,
  IntegrationProvider,
  NormalizedSnapshot,
} from '../integration.types';
import { asJson, toItemSnapshot, toSubItemSnapshot } from './item-snapshot';

export interface ExistingImportState {
  containerProject: { id: string; name: string } | null;
  duplicateItemIds: Set<string>;
  duplicateSubItemIds: Set<string>;
}

export interface ImportSnapshotInput {
  provider: IntegrationProvider;
  sources: ExternalSources;
  snapshot: NormalizedSnapshot;
  organizationId: string;
  userId: string;
  targetProjectId?: string;
  existing: ExistingImportState;
  failureMessage: string;
  onProjectReady?: (
    tx: Prisma.TransactionClient,
    projectId: string,
  ) => Promise<void>;
}

export interface ImportSnapshotResult {
  project: { id: string; name: string } | null;
  createdProject: boolean;
  createdTasks: number;
  createdSubtasks: number;
  createdComments: number;
  skippedTasks: number;
  skippedSubtasks: number;
}

@Injectable()
export class IntegrationSyncService {
  private readonly logger = new Logger(IntegrationSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findExisting(
    organizationId: string,
    sources: ExternalSources,
    snapshot: NormalizedSnapshot,
  ): Promise<ExistingImportState> {
    const itemIds = snapshot.items.map((item) => item.externalId);
    const subItemIds = snapshot.items.flatMap((item) =>
      item.subItems.map((subItem) => subItem.externalId),
    );

    const [containerProject, duplicateItems, duplicateSubItems] =
      await Promise.all([
        this.prisma.project.findFirst({
          where: {
            organizationId,
            externalSource: sources.container,
            externalId: snapshot.container.externalId,
          },
          select: { id: true, name: true },
        }),
        this.prisma.task.findMany({
          where: {
            organizationId,
            externalSource: sources.item,
            externalId: { in: itemIds },
          },
          select: { externalId: true },
        }),
        this.prisma.task.findMany({
          where: {
            organizationId,
            externalSource: sources.subItem,
            externalId: { in: subItemIds },
          },
          select: { externalId: true },
        }),
      ]);

    return {
      containerProject,
      duplicateItemIds: this.toIdSet(duplicateItems),
      duplicateSubItemIds: this.toIdSet(duplicateSubItems),
    };
  }

  findTargetProject(organizationId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId, isActive: true },
      select: { id: true, name: true, organizationId: true },
    });
  }

  async importSnapshot(
    input: ImportSnapshotInput,
  ): Promise<ImportSnapshotResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const createdProject = input.targetProjectId
            ? null
            : await this.createProject(tx, input);
          const projectId = input.targetProjectId ?? createdProject?.id;

          if (!projectId) {
            throw new BadRequestException('Project target is required');
          }

          if (input.onProjectReady) {
            await input.onProjectReady(tx, projectId);
          }

          const createdTasks = await this.createParentTasks(
            tx,
            input,
            projectId,
          );
          const { createdSubtasks, parentIdByExternalId } =
            await this.createSubtasks(tx, input, projectId);
          const createdComments = await this.createComments(
            tx,
            input,
            parentIdByExternalId,
          );

          return {
            project: createdProject,
            createdProject: !!createdProject,
            createdTasks,
            createdSubtasks,
            createdComments,
            ...this.countSkipped(input, parentIdByExternalId),
          };
        },
        { maxWait: 10_000, timeout: 30_000 },
      );
    } catch (error: unknown) {
      const errorName =
        error instanceof Error ? error.name : 'UnknownTransactionError';
      const code = (error as { code?: unknown } | null)?.code;
      const errorCode = typeof code === 'string' ? code : 'UNKNOWN';

      this.logger.error(
        `Integration import transaction failed (provider=${input.provider}, userId=${input.userId}, organizationId=${input.organizationId}, error=${errorName}, code=${errorCode})`,
      );
      throw new InternalServerErrorException(input.failureMessage);
    }
  }

  private async createProject(
    tx: Prisma.TransactionClient,
    input: ImportSnapshotInput,
  ) {
    const { container } = input.snapshot;
    const project = await tx.project.create({
      data: {
        name: container.name,
        description: container.description || undefined,
        priority: Priority.MEDIUM,
        externalSource: input.sources.container,
        externalId: container.externalId,
        ownerId: input.userId,
        organizationId: input.organizationId,
      },
      select: { id: true, name: true },
    });

    await tx.projectMember.create({
      data: { projectId: project.id, userId: input.userId, role: 'OWNER' },
    });

    return project;
  }

  private async createParentTasks(
    tx: Prisma.TransactionClient,
    input: ImportSnapshotInput,
    projectId: string,
  ) {
    const existingParentIds = this.toIdSet(
      await this.findProjectItems(tx, input, projectId),
    );
    const itemsToCreate = input.snapshot.items.filter(
      (item) =>
        !existingParentIds.has(item.externalId) &&
        !input.existing.duplicateItemIds.has(item.externalId),
    );

    if (itemsToCreate.length > 0) {
      await tx.task.createMany({
        data: itemsToCreate.map((item) => ({
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          dueDate: item.dueDate,
          externalSource: input.sources.item,
          externalId: item.externalId,
          externalUrl: item.externalUrl,
          externalGroupId: item.groupExternalId,
          externalSnapshot: asJson(toItemSnapshot(item)),
          projectId,
          organizationId: input.organizationId,
        })),
      });
    }

    return itemsToCreate.length;
  }

  private async createSubtasks(
    tx: Prisma.TransactionClient,
    input: ImportSnapshotInput,
    projectId: string,
  ) {
    const parentTasks = await this.findProjectItems(tx, input, projectId);
    const parentIdByExternalId = new Map(
      parentTasks
        .filter((task) => task.externalId)
        .map((task) => [task.externalId as string, task.id]),
    );
    const subtasksToCreate = input.snapshot.items.flatMap((item) => {
      const parentTaskId = parentIdByExternalId.get(item.externalId);
      if (!parentTaskId) return [];

      return item.subItems
        .filter(
          (subItem) =>
            !input.existing.duplicateSubItemIds.has(subItem.externalId),
        )
        .map((subItem) => ({
          title: subItem.title,
          description: subItem.description,
          status: subItem.status,
          priority: item.priority,
          dueDate: item.dueDate,
          externalSource: input.sources.subItem,
          externalId: subItem.externalId,
          externalSnapshot: asJson(toSubItemSnapshot(subItem)),
          projectId,
          parentTaskId,
          organizationId: input.organizationId,
        }));
    });

    if (subtasksToCreate.length > 0) {
      await tx.task.createMany({ data: subtasksToCreate });
    }

    return { createdSubtasks: subtasksToCreate.length, parentIdByExternalId };
  }

  private async createComments(
    tx: Prisma.TransactionClient,
    input: ImportSnapshotInput,
    parentIdByExternalId: Map<string, string>,
  ) {
    const comments = (input.snapshot.comments ?? []).flatMap((comment) => {
      const taskId = parentIdByExternalId.get(comment.itemExternalId);
      if (!taskId) return [];
      return [
        {
          content: comment.text,
          taskId,
          organizationId: input.organizationId,
          externalSource: input.sources.comment,
          externalId: comment.externalId,
          externalAuthorName: comment.authorName,
          ...(comment.createdAt ? { createdAt: comment.createdAt } : {}),
        },
      ];
    });
    if (comments.length === 0) return 0;

    const { count } = await tx.taskComment.createMany({
      data: comments,
      skipDuplicates: true,
    });
    return count;
  }

  private findProjectItems(
    tx: Prisma.TransactionClient,
    input: ImportSnapshotInput,
    projectId: string,
  ) {
    return tx.task.findMany({
      where: {
        organizationId: input.organizationId,
        projectId,
        externalSource: input.sources.item,
        externalId: {
          in: input.snapshot.items.map((item) => item.externalId),
        },
      },
      select: { id: true, externalId: true },
    });
  }

  private countSkipped(
    input: ImportSnapshotInput,
    parentIdByExternalId: Map<string, string>,
  ) {
    const { items } = input.snapshot;
    const { duplicateItemIds, duplicateSubItemIds } = input.existing;

    return {
      skippedTasks: items.filter((item) =>
        duplicateItemIds.has(item.externalId),
      ).length,
      skippedSubtasks: items.reduce(
        (count, item) =>
          count +
          item.subItems.filter(
            (subItem) =>
              duplicateSubItemIds.has(subItem.externalId) ||
              !parentIdByExternalId.has(item.externalId),
          ).length,
        0,
      ),
    };
  }

  private toIdSet(rows: Array<{ externalId: string | null }>) {
    return new Set(
      rows.map((row) => row.externalId).filter((id): id is string => !!id),
    );
  }
}
