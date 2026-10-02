/**
 * Aplica en Tino los cambios que llegan de un proveedor externo, uno por uno y
 * tocando solo los campos que cambiaron (regla de convivencia: lo editado en
 * Tino en otros campos se mantiene). Cada escritura tambien actualiza
 * `externalSnapshot` (ultimo estado visto en el proveedor), que usa la revision
 * diaria para saber que cambio.
 *
 * Qué contiene:
 * - `apply()`: despacha cada tipo de `ExternalChange`. Devuelve `IGNORED` cuando
 *   la tarea no existe en el proyecto conectado (la revision diaria la recupera).
 * - `createItem()`: crea la tarea con sus subtareas; si ya existia en el
 *   proyecto solo la desarchiva. El estado sale de la equivalencia del grupo.
 * - `updateItem()`: arma el `update` solo con los campos recibidos. Mover de
 *   grupo aplica el estado de la equivalencia (si esta definida); marcar como
 *   terminada pasa a DONE y desmarcar vuelve al estado del grupo actual. Aunque
 *   no cambie ningun campo visible, el snapshot se guarda igual.
 * - `archiveItem()`: archiva o restaura la tarea y sus subtareas (no se borran,
 *   asi no se pierden las horas registradas).
 * - `syncSubItems()`: crea las subtareas nuevas, archiva las quitadas y restaura
 *   las que volvieron; no cambia nombre ni estado de las existentes.
 * - `updateSubItem()`: nombre y/o estado de una subtarea.
 * - `recordSnapshot()`: guarda el ultimo estado visto sin tocar otros campos
 *   (la revision diaria lo usa como linea base).
 * - `upsertComment()` / `deleteComment()`: comentario con el nombre del autor
 *   externo; borrar es un borrado logico como en Tino.
 * - `upsertGroup()`: grupo nuevo con estado adivinado por nombre (o `null`, para
 *   definirlo a mano) o renombre sin tocar su estado.
 * - `resolveGroupStatus()`: estado de la equivalencia de un grupo; si el grupo
 *   no existia lo registra como "por definir".
 * - `recordActivity()`: deja una novedad (`IntegrationActivity`) con quien hizo
 *   el cambio. Se registra al crear una tarea nueva (no al restaurarla), cuando
 *   el estado realmente cambia y cuando una tarea activa se archiva. Con esto se
 *   arman el cartel de la app y el resumen diario por WhatsApp.
 */
import { Injectable } from '@nestjs/common';
import { IntegrationActivityKind, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { NormalizedItem, NormalizedSubItem } from '../integration.types';
import { guessTaskStatus } from '../mapping/status-guess';
import {
  ChangeContext,
  ChangeOutcome,
  ExternalChange,
  ItemFieldChanges,
} from './external-change';
import {
  asJson,
  ItemSnapshot,
  mergeItemSnapshot,
  mergeSubItemSnapshot,
  parseItemSnapshot,
  parseSubItemSnapshot,
  SubItemSnapshot,
  toItemSnapshot,
  toSubItemSnapshot,
} from './item-snapshot';

@Injectable()
export class IntegrationChangeService {
  constructor(private readonly prisma: PrismaService) {}

  apply(
    context: ChangeContext,
    change: ExternalChange,
  ): Promise<ChangeOutcome> {
    switch (change.kind) {
      case 'ITEM_CREATED':
        return this.createItem(context, change.item);
      case 'ITEM_UPDATED':
        return this.updateItem(context, change.externalId, change.changes);
      case 'ITEM_ARCHIVED':
        return this.archiveItem(context, change.externalId, change.archived);
      case 'SUBITEMS_SYNCED':
        return this.syncSubItems(
          context,
          change.itemExternalId,
          change.subItems,
        );
      case 'SUBITEM_UPDATED':
        return this.updateSubItem(context, change.externalId, change.changes);
      case 'COMMENT_UPSERTED':
        return this.upsertComment(context, change);
      case 'COMMENT_DELETED':
        return this.deleteComment(context, change.externalId);
      case 'GROUP_UPSERTED':
        return this.upsertGroup(context, change.externalId, change.name);
    }
  }

  private async createItem(
    context: ChangeContext,
    item: NormalizedItem,
  ): Promise<ChangeOutcome> {
    const existing = await this.findItem(context, item.externalId);
    if (existing) {
      await this.prisma.task.updateMany({
        where: { OR: [{ id: existing.id }, { parentTaskId: existing.id }] },
        data: { archivedAt: null },
      });
      return 'APPLIED';
    }

    const groupStatus = await this.resolveGroupStatus(
      context,
      item.groupExternalId,
      item.groupName,
    );
    const status = item.isCompleted
      ? TaskStatus.DONE
      : (groupStatus ?? TaskStatus.TODO);
    const task = await this.prisma.task.create({
      data: {
        title: item.title,
        description: item.description,
        status,
        priority: item.priority,
        dueDate: item.dueDate,
        externalSource: context.sources.item,
        externalId: item.externalId,
        externalUrl: item.externalUrl,
        externalGroupId: item.groupExternalId,
        externalSnapshot: asJson(toItemSnapshot(item)),
        projectId: context.projectId,
        organizationId: context.organizationId,
      },
      select: { id: true },
    });

    if (item.subItems.length > 0) {
      await this.prisma.task.createMany({
        data: item.subItems.map((subItem) =>
          this.subtaskData(context, task.id, item, subItem),
        ),
        skipDuplicates: true,
      });
    }
    await this.recordActivity(context, task.id, 'TASK_CREATED', null, status);
    return 'APPLIED';
  }

  private async updateItem(
    context: ChangeContext,
    externalId: string,
    changes: ItemFieldChanges,
  ): Promise<ChangeOutcome> {
    const task = await this.findItem(context, externalId);
    if (!task) return 'IGNORED';

    const data: Prisma.TaskUpdateInput = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) {
      data.description = changes.description;
    }
    if (changes.dueDate !== undefined) data.dueDate = changes.dueDate;
    if (changes.priority !== undefined) data.priority = changes.priority;
    if (changes.groupExternalId !== undefined) {
      data.externalGroupId = changes.groupExternalId;
    }

    const groupId = changes.groupExternalId ?? task.externalGroupId;
    let nextStatus: TaskStatus | null = null;
    if (changes.isCompleted === true) {
      nextStatus = TaskStatus.DONE;
    } else if (
      groupId &&
      (changes.isCompleted === false || changes.groupExternalId !== undefined)
    ) {
      nextStatus = await this.resolveGroupStatus(context, groupId);
    }
    if (nextStatus) data.status = nextStatus;

    const hasFieldChanges = Object.keys(data).length > 0;
    const snapshot = mergeItemSnapshot(
      parseItemSnapshot(task.externalSnapshot),
      changes,
    );
    if (snapshot) data.externalSnapshot = asJson(snapshot);
    if (Object.keys(data).length === 0) return 'IGNORED';

    await this.prisma.task.update({ where: { id: task.id }, data });
    if (nextStatus && nextStatus !== task.status) {
      await this.recordActivity(
        context,
        task.id,
        'STATUS_CHANGED',
        task.status,
        nextStatus,
      );
    }
    return hasFieldChanges ? 'APPLIED' : 'IGNORED';
  }

  async recordSnapshot(
    taskId: string,
    snapshot: ItemSnapshot | SubItemSnapshot,
  ): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: { externalSnapshot: asJson(snapshot) },
    });
  }

  private async archiveItem(
    context: ChangeContext,
    externalId: string,
    archived: boolean,
  ): Promise<ChangeOutcome> {
    const task = await this.findItem(context, externalId);
    if (!task) return 'IGNORED';

    await this.prisma.task.updateMany({
      where: { OR: [{ id: task.id }, { parentTaskId: task.id }] },
      data: { archivedAt: archived ? new Date() : null },
    });
    if (archived && !task.archivedAt) {
      await this.recordActivity(context, task.id, 'TASK_ARCHIVED', null, null);
    }
    return 'APPLIED';
  }

  private async syncSubItems(
    context: ChangeContext,
    itemExternalId: string,
    subItems: NormalizedSubItem[],
  ): Promise<ChangeOutcome> {
    const parent = await this.findItem(context, itemExternalId);
    if (!parent) return 'IGNORED';

    const current = await this.prisma.task.findMany({
      where: {
        organizationId: context.organizationId,
        parentTaskId: parent.id,
        externalSource: context.sources.subItem,
      },
      select: { id: true, externalId: true, archivedAt: true },
    });
    const currentIds = new Set(current.map((task) => task.externalId));
    const incomingIds = new Set(subItems.map((subItem) => subItem.externalId));
    const toCreate = subItems.filter(
      (subItem) => !currentIds.has(subItem.externalId),
    );
    const toArchive = current
      .filter((task) => !task.archivedAt && !incomingIds.has(task.externalId!))
      .map((task) => task.id);
    const toRestore = current
      .filter((task) => task.archivedAt && incomingIds.has(task.externalId!))
      .map((task) => task.id);

    await this.prisma.$transaction([
      this.prisma.task.createMany({
        data: toCreate.map((subItem) =>
          this.subtaskData(context, parent.id, parent, subItem),
        ),
        skipDuplicates: true,
      }),
      this.prisma.task.updateMany({
        where: { id: { in: toArchive } },
        data: { archivedAt: new Date() },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: toRestore } },
        data: { archivedAt: null },
      }),
    ]);
    return 'APPLIED';
  }

  private async updateSubItem(
    context: ChangeContext,
    externalId: string,
    changes: { title?: string; status?: TaskStatus },
  ): Promise<ChangeOutcome> {
    const data: Prisma.TaskUpdateInput = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.status !== undefined) data.status = changes.status;
    if (Object.keys(data).length === 0) return 'IGNORED';

    const subtask = await this.prisma.task.findFirst({
      where: {
        organizationId: context.organizationId,
        projectId: context.projectId,
        externalSource: context.sources.subItem,
        externalId,
      },
      select: { id: true, externalSnapshot: true },
    });
    if (!subtask) return 'IGNORED';

    const snapshot = mergeSubItemSnapshot(
      parseSubItemSnapshot(subtask.externalSnapshot),
      changes,
    );
    if (snapshot) data.externalSnapshot = asJson(snapshot);
    await this.prisma.task.update({ where: { id: subtask.id }, data });
    return 'APPLIED';
  }

  private async upsertComment(
    context: ChangeContext,
    change: Extract<ExternalChange, { kind: 'COMMENT_UPSERTED' }>,
  ): Promise<ChangeOutcome> {
    const task = await this.findItem(context, change.itemExternalId);
    if (!task) return 'IGNORED';

    await this.prisma.taskComment.upsert({
      where: {
        organizationId_externalSource_externalId: {
          organizationId: context.organizationId,
          externalSource: context.sources.comment,
          externalId: change.externalId,
        },
      },
      create: {
        content: change.text,
        taskId: task.id,
        organizationId: context.organizationId,
        externalSource: context.sources.comment,
        externalId: change.externalId,
        externalAuthorName: change.authorName,
        ...(change.createdAt ? { createdAt: change.createdAt } : {}),
      },
      update: { content: change.text },
    });
    return 'APPLIED';
  }

  private async deleteComment(
    context: ChangeContext,
    externalId: string,
  ): Promise<ChangeOutcome> {
    const { count } = await this.prisma.taskComment.updateMany({
      where: {
        organizationId: context.organizationId,
        externalSource: context.sources.comment,
        externalId,
        deletedAt: null,
      },
      data: { deletedAt: new Date(), content: '' },
    });
    return count > 0 ? 'APPLIED' : 'IGNORED';
  }

  private async upsertGroup(
    context: ChangeContext,
    externalId: string,
    name: string,
  ): Promise<ChangeOutcome> {
    await this.prisma.integrationStatusMapping.upsert({
      where: {
        connectionId_externalGroupId: {
          connectionId: context.connectionId,
          externalGroupId: externalId,
        },
      },
      create: {
        connectionId: context.connectionId,
        externalGroupId: externalId,
        externalGroupName: name,
        status: guessTaskStatus(name),
      },
      update: { externalGroupName: name },
    });
    return 'APPLIED';
  }

  private async resolveGroupStatus(
    context: ChangeContext,
    groupExternalId: string,
    groupName?: string,
  ): Promise<TaskStatus | null> {
    const mapping = await this.prisma.integrationStatusMapping.findUnique({
      where: {
        connectionId_externalGroupId: {
          connectionId: context.connectionId,
          externalGroupId: groupExternalId,
        },
      },
      select: { status: true },
    });
    if (mapping) return mapping.status;

    if (groupName) {
      await this.upsertGroup(context, groupExternalId, groupName);
      return guessTaskStatus(groupName);
    }
    return null;
  }

  private async recordActivity(
    context: ChangeContext,
    taskId: string,
    kind: IntegrationActivityKind,
    fromStatus: TaskStatus | null,
    toStatus: TaskStatus | null,
  ): Promise<void> {
    await this.prisma.integrationActivity.create({
      data: {
        organizationId: context.organizationId,
        projectId: context.projectId,
        taskId,
        kind,
        fromStatus,
        toStatus,
        actorName: context.actorName ?? null,
      },
    });
  }

  private findItem(context: ChangeContext, externalId: string) {
    return this.prisma.task.findFirst({
      where: {
        organizationId: context.organizationId,
        projectId: context.projectId,
        externalSource: context.sources.item,
        externalId,
        parentTaskId: null,
      },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        externalGroupId: true,
        externalSnapshot: true,
        priority: true,
        dueDate: true,
      },
    });
  }

  private subtaskData(
    context: ChangeContext,
    parentTaskId: string,
    parent: { priority: NormalizedItem['priority']; dueDate?: Date | null },
    subItem: NormalizedSubItem,
  ): Prisma.TaskCreateManyInput {
    return {
      title: subItem.title,
      description: subItem.description,
      status: subItem.status,
      priority: parent.priority,
      dueDate: parent.dueDate,
      externalSource: context.sources.subItem,
      externalId: subItem.externalId,
      externalSnapshot: asJson(toSubItemSnapshot(subItem)),
      projectId: context.projectId,
      parentTaskId,
      organizationId: context.organizationId,
    };
  }
}
