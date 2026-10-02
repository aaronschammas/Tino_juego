/**
 * Cambios externos ya traducidos, comunes a todos los proveedores. Cada
 * traductor (hoy el de webhooks de Trello) convierte un aviso en una lista de
 * estos cambios y `IntegrationChangeService` los aplica en Tino.
 *
 * Regla de convivencia: un cambio solo trae los campos que se modificaron en el
 * proveedor (`ItemFieldChanges` es parcial), asi lo editado en Tino sobre otros
 * campos no se pisa.
 *
 * - `ITEM_CREATED`: tarea nueva completa (con sus subtareas).
 * - `ITEM_UPDATED`: solo los campos modificados. `groupExternalId` = se movio de
 *   grupo; `isCompleted` = se marco o desmarco como terminada.
 * - `ITEM_ARCHIVED`: se archivo (o se restauro) en el proveedor.
 * - `SUBITEMS_SYNCED`: lista actual de subtareas de una tarea, para crear las
 *   nuevas y archivar las quitadas.
 * - `SUBITEM_UPDATED`: nombre o estado de una subtarea.
 * - `COMMENT_UPSERTED` / `COMMENT_DELETED`: comentarios de una tarea.
 * - `GROUP_UPSERTED`: grupo nuevo o renombrado (lista de Trello).
 * - `ChangeContext`: conexion, organizacion, proyecto y fuentes donde aplicar.
 *   `actorName` es quien hizo el cambio en el proveedor (solo llega por webhook;
 *   la revision diaria no lo conoce) y queda en las novedades.
 */
import { Priority, TaskStatus } from '@prisma/client';
import {
  ExternalSources,
  NormalizedItem,
  NormalizedSubItem,
} from '../integration.types';

export interface ItemFieldChanges {
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: Priority;
  groupExternalId?: string;
  isCompleted?: boolean;
}

export type ExternalChange =
  | { kind: 'ITEM_CREATED'; item: NormalizedItem }
  | { kind: 'ITEM_UPDATED'; externalId: string; changes: ItemFieldChanges }
  | { kind: 'ITEM_ARCHIVED'; externalId: string; archived: boolean }
  | {
      kind: 'SUBITEMS_SYNCED';
      itemExternalId: string;
      subItems: NormalizedSubItem[];
    }
  | {
      kind: 'SUBITEM_UPDATED';
      externalId: string;
      changes: { title?: string; status?: TaskStatus };
    }
  | {
      kind: 'COMMENT_UPSERTED';
      externalId: string;
      itemExternalId: string;
      text: string;
      authorName: string | null;
      createdAt?: Date;
    }
  | { kind: 'COMMENT_DELETED'; externalId: string }
  | { kind: 'GROUP_UPSERTED'; externalId: string; name: string };

export interface ChangeContext {
  connectionId: string;
  organizationId: string;
  projectId: string;
  sources: ExternalSources;
  actorName?: string | null;
}

export type ChangeOutcome = 'APPLIED' | 'IGNORED';
