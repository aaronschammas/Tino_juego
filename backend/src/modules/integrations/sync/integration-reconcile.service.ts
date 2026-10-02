/**
 * Revision de respaldo: compara la foto actual del proveedor con lo que hay en
 * Tino y aplica lo que se perdio (avisos que el webhook no recibio). Es comun a
 * todos los proveedores y escribe siempre a traves de `IntegrationChangeService`,
 * con las mismas reglas que los webhooks.
 *
 * Qué contiene:
 * - `reconcileSnapshot()`: en este orden:
 *   1. Listas: registra las nuevas y renombra las existentes.
 *   2. Tareas: crea las que faltan, restaura las archivadas que volvieron y,
 *      para las existentes, compara el proveedor contra el ultimo estado visto
 *      (\`externalSnapshot\`) y aplica solo los campos que cambiaron alla. Si la
 *      tarea no tenia snapshot (importada antes de esta fase) solo guarda la
 *      linea base, sin tocar nada de Tino.
 *   3. Subtareas: crea/archiva/restaura cuando el conjunto cambio y aplica los
 *      cambios de nombre o estado con la misma comparacion por snapshot.
 *   4. Archiva las tareas que ya no estan en el proveedor.
 *   5. Comentarios: agrega los que faltan y actualiza los editados.
 *   Devuelve contadores de lo que hizo.
 * - `loadTasks()` / `loadComments()`: lo que ya existe en Tino para comparar.
 * - `reconcileSubItems()`: paso 3 para una tarea.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { NormalizedItem, NormalizedSnapshot } from '../integration.types';
import { ChangeContext, ChangeOutcome } from './external-change';
import { IntegrationChangeService } from './integration-change.service';
import {
  diffItemSnapshot,
  diffSubItemSnapshot,
  parseItemSnapshot,
  parseSubItemSnapshot,
  toItemSnapshot,
  toSubItemSnapshot,
} from './item-snapshot';

export interface ReconcileStats {
  groupsAdded: number;
  created: number;
  updated: number;
  restored: number;
  archived: number;
  subtasksChanged: number;
  commentsAdded: number;
  commentsUpdated: number;
  baselined: number;
}

type TaskRow = Awaited<
  ReturnType<IntegrationReconcileService['loadTasks']>
>[number];

@Injectable()
export class IntegrationReconcileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changes: IntegrationChangeService,
  ) {}

  async reconcileSnapshot(
    context: ChangeContext,
    snapshot: NormalizedSnapshot,
  ): Promise<ReconcileStats> {
    const stats: ReconcileStats = {
      groupsAdded: 0,
      created: 0,
      updated: 0,
      restored: 0,
      archived: 0,
      subtasksChanged: 0,
      commentsAdded: 0,
      commentsUpdated: 0,
      baselined: 0,
    };

    const knownGroups = new Set(
      (
        await this.prisma.integrationStatusMapping.findMany({
          where: { connectionId: context.connectionId },
          select: { externalGroupId: true },
        })
      ).map((mapping) => mapping.externalGroupId),
    );
    for (const group of snapshot.groups) {
      await this.changes.apply(context, {
        kind: 'GROUP_UPSERTED',
        externalId: group.externalId,
        name: group.name,
      });
      if (!knownGroups.has(group.externalId)) stats.groupsAdded += 1;
    }

    const tasks = await this.loadTasks(context);
    const parents = new Map(
      tasks
        .filter(
          (task) =>
            !task.parentTaskId && task.externalSource === context.sources.item,
        )
        .map((task) => [task.externalId!, task]),
    );
    const childrenByParent = new Map<string, TaskRow[]>();
    for (const task of tasks.filter((row) => row.parentTaskId)) {
      const siblings = childrenByParent.get(task.parentTaskId!) ?? [];
      siblings.push(task);
      childrenByParent.set(task.parentTaskId!, siblings);
    }

    for (const item of snapshot.items) {
      const existing = parents.get(item.externalId);
      if (!existing) {
        await this.changes.apply(context, { kind: 'ITEM_CREATED', item });
        stats.created += 1;
        continue;
      }

      if (existing.archivedAt) {
        await this.changes.apply(context, {
          kind: 'ITEM_ARCHIVED',
          externalId: item.externalId,
          archived: false,
        });
        stats.restored += 1;
      }

      const previous = parseItemSnapshot(existing.externalSnapshot);
      if (!previous) {
        await this.changes.recordSnapshot(existing.id, toItemSnapshot(item));
        stats.baselined += 1;
      } else {
        const fieldChanges = diffItemSnapshot(previous, toItemSnapshot(item));
        if (Object.keys(fieldChanges).length > 0) {
          await this.changes.apply(context, {
            kind: 'ITEM_UPDATED',
            externalId: item.externalId,
            changes: fieldChanges,
          });
          stats.updated += 1;
        }
      }

      const subStats = await this.reconcileSubItems(
        context,
        item,
        childrenByParent.get(existing.id) ?? [],
      );
      stats.subtasksChanged += subStats.changed;
      stats.baselined += subStats.baselined;
    }

    const incomingIds = new Set(snapshot.items.map((item) => item.externalId));
    for (const [externalId, task] of parents) {
      if (!task.archivedAt && !incomingIds.has(externalId)) {
        await this.changes.apply(context, {
          kind: 'ITEM_ARCHIVED',
          externalId,
          archived: true,
        });
        stats.archived += 1;
      }
    }

    const comments = snapshot.comments ?? [];
    const existingComments = await this.loadComments(
      context,
      comments.map((comment) => comment.externalId),
    );
    for (const comment of comments) {
      const current = existingComments.get(comment.externalId);
      if (current && (current.deletedAt || current.content === comment.text)) {
        continue;
      }
      const outcome: ChangeOutcome = await this.changes.apply(context, {
        kind: 'COMMENT_UPSERTED',
        externalId: comment.externalId,
        itemExternalId: comment.itemExternalId,
        text: comment.text,
        authorName: comment.authorName,
        createdAt: comment.createdAt,
      });
      if (outcome === 'APPLIED') {
        if (current) stats.commentsUpdated += 1;
        else stats.commentsAdded += 1;
      }
    }

    return stats;
  }

  private async reconcileSubItems(
    context: ChangeContext,
    item: NormalizedItem,
    children: TaskRow[],
  ): Promise<{ changed: number; baselined: number }> {
    let changed = 0;
    let baselined = 0;
    const activeIds = new Set(
      children
        .filter((child) => !child.archivedAt)
        .map((child) => child.externalId),
    );
    const incomingIds = new Set(item.subItems.map((sub) => sub.externalId));
    const setChanged =
      activeIds.size !== incomingIds.size ||
      [...incomingIds].some((id) => !activeIds.has(id));

    if (setChanged) {
      await this.changes.apply(context, {
        kind: 'SUBITEMS_SYNCED',
        itemExternalId: item.externalId,
        subItems: item.subItems,
      });
      changed += 1;
    }

    const childByExternalId = new Map(
      children.map((child) => [child.externalId, child]),
    );
    for (const subItem of item.subItems) {
      const child = childByExternalId.get(subItem.externalId);
      if (!child) continue;

      const previous = parseSubItemSnapshot(child.externalSnapshot);
      const current = toSubItemSnapshot(subItem);
      if (!previous) {
        await this.changes.recordSnapshot(child.id, current);
        baselined += 1;
        continue;
      }
      const subChanges = diffSubItemSnapshot(previous, current);
      if (Object.keys(subChanges).length > 0) {
        await this.changes.apply(context, {
          kind: 'SUBITEM_UPDATED',
          externalId: subItem.externalId,
          changes: subChanges,
        });
        changed += 1;
      }
    }

    return { changed, baselined };
  }

  loadTasks(context: ChangeContext) {
    return this.prisma.task.findMany({
      where: {
        organizationId: context.organizationId,
        projectId: context.projectId,
        externalSource: {
          in: [context.sources.item, context.sources.subItem],
        },
      },
      select: {
        id: true,
        externalId: true,
        externalSource: true,
        parentTaskId: true,
        archivedAt: true,
        externalSnapshot: true,
      },
    });
  }

  private async loadComments(
    context: ChangeContext,
    externalIds: string[],
  ): Promise<Map<string | null, { content: string; deletedAt: Date | null }>> {
    if (externalIds.length === 0) return new Map();
    const rows = await this.prisma.taskComment.findMany({
      where: {
        organizationId: context.organizationId,
        externalSource: context.sources.comment,
        externalId: { in: externalIds },
      },
      select: { externalId: true, content: true, deletedAt: true },
    });
    return new Map(rows.map((row) => [row.externalId, row]));
  }
}
