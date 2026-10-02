/**
 * "Ultimo estado visto en el proveedor" de cada tarea y subtarea sincronizada
 * (columna `Task.externalSnapshot`). Permite que la revision diaria respete la
 * regla de convivencia: compara el proveedor contra lo que se vio la ultima vez
 * (no contra Tino), asi solo aplica lo que cambio en el proveedor y no pisa lo
 * editado en Tino.
 *
 * - `toItemSnapshot()` / `toSubItemSnapshot()`: snapshot a partir de lo que
 *   trae el proveedor. La descripcion se guarda tal como esta en el proveedor.
 * - `diffItemSnapshot()` / `diffSubItemSnapshot()`: campos que cambiaron entre
 *   el snapshot guardado y el actual, ya en el formato de `ItemFieldChanges`.
 * - `mergeItemSnapshot()` / `mergeSubItemSnapshot()`: snapshot guardado con los
 *   cambios de un aviso aplicados. Si no habia snapshot devuelve `null`: la
 *   proxima revision guarda la linea base completa.
 * - `parseItemSnapshot()` / `parseSubItemSnapshot()`: leen el JSON guardado y
 *   devuelven `null` si no tiene la forma esperada.
 * - `asJson()`: convierte un snapshot al tipo JSON que espera Prisma.
 */
import { Prisma, Priority, TaskStatus } from '@prisma/client';
import { NormalizedItem, NormalizedSubItem } from '../integration.types';
import { ItemFieldChanges } from './external-change';

export interface ItemSnapshot {
  title: string;
  description: string;
  dueDate: string | null;
  priority: Priority;
  groupExternalId: string;
  isCompleted: boolean;
}

export interface SubItemSnapshot {
  title: string;
  status: TaskStatus;
}

export function toItemSnapshot(item: NormalizedItem): ItemSnapshot {
  return {
    title: item.title,
    description: item.sourceDescription ?? '',
    dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    priority: item.priority,
    groupExternalId: item.groupExternalId,
    isCompleted: item.isCompleted,
  };
}

export function toSubItemSnapshot(subItem: NormalizedSubItem): SubItemSnapshot {
  return { title: subItem.title, status: subItem.status };
}

export function diffItemSnapshot(
  previous: ItemSnapshot,
  current: ItemSnapshot,
): ItemFieldChanges {
  const changes: ItemFieldChanges = {};
  if (previous.title !== current.title) changes.title = current.title;
  if (previous.description !== current.description) {
    changes.description = current.description || null;
  }
  if (previous.dueDate !== current.dueDate) {
    changes.dueDate = current.dueDate ? new Date(current.dueDate) : null;
  }
  if (previous.priority !== current.priority) {
    changes.priority = current.priority;
  }
  if (previous.groupExternalId !== current.groupExternalId) {
    changes.groupExternalId = current.groupExternalId;
  }
  if (previous.isCompleted !== current.isCompleted) {
    changes.isCompleted = current.isCompleted;
  }
  return changes;
}

export function diffSubItemSnapshot(
  previous: SubItemSnapshot,
  current: SubItemSnapshot,
): { title?: string; status?: TaskStatus } {
  const changes: { title?: string; status?: TaskStatus } = {};
  if (previous.title !== current.title) changes.title = current.title;
  if (previous.status !== current.status) changes.status = current.status;
  return changes;
}

export function mergeItemSnapshot(
  previous: ItemSnapshot | null,
  changes: ItemFieldChanges,
): ItemSnapshot | null {
  if (!previous) return null;
  return {
    title: changes.title ?? previous.title,
    description:
      changes.description !== undefined
        ? (changes.description ?? '')
        : previous.description,
    dueDate:
      changes.dueDate !== undefined
        ? (changes.dueDate?.toISOString() ?? null)
        : previous.dueDate,
    priority: changes.priority ?? previous.priority,
    groupExternalId: changes.groupExternalId ?? previous.groupExternalId,
    isCompleted: changes.isCompleted ?? previous.isCompleted,
  };
}

export function mergeSubItemSnapshot(
  previous: SubItemSnapshot | null,
  changes: { title?: string; status?: TaskStatus },
): SubItemSnapshot | null {
  if (!previous) return null;
  return {
    title: changes.title ?? previous.title,
    status: changes.status ?? previous.status,
  };
}

export function parseItemSnapshot(
  value: Prisma.JsonValue | null | undefined,
): ItemSnapshot | null {
  if (!isRecord(value)) return null;
  const {
    title,
    description,
    dueDate,
    priority,
    groupExternalId,
    isCompleted,
  } = value;
  const valid =
    typeof title === 'string' &&
    typeof description === 'string' &&
    (dueDate === null || typeof dueDate === 'string') &&
    typeof priority === 'string' &&
    priority in Priority &&
    typeof groupExternalId === 'string' &&
    typeof isCompleted === 'boolean';
  return valid
    ? {
        title,
        description,
        dueDate,
        priority: priority as Priority,
        groupExternalId,
        isCompleted,
      }
    : null;
}

export function parseSubItemSnapshot(
  value: Prisma.JsonValue | null | undefined,
): SubItemSnapshot | null {
  if (!isRecord(value)) return null;
  const { title, status } = value;
  return typeof title === 'string' &&
    typeof status === 'string' &&
    status in TaskStatus
    ? { title, status: status as TaskStatus }
    : null;
}

export function asJson(
  snapshot: ItemSnapshot | SubItemSnapshot,
): Prisma.InputJsonObject {
  return { ...snapshot };
}

function isRecord(
  value: Prisma.JsonValue | null | undefined,
): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
