/**
 * Tipos comunes a todos los proveedores externos (hoy Trello; a futuro ClickUp u otros).
 *
 * Cada adaptador traduce la API de su proveedor a estas formas, y el resto del
 * modulo (equivalencia de estados, motor de sincronizacion, vista previa) solo
 * trabaja con ellas:
 * - `ExternalSources`: valores de `externalSource` para proyecto, tarea, subtarea
 *   y comentario.
 * - `NormalizedContainer`: lo que se convierte en proyecto (tablero de Trello).
 * - `NormalizedGroup`: agrupador que define el estado (lista de Trello).
 * - `NormalizedItem` / `NormalizedSubItem`: tarea y subtarea ya en valores de Tino.
 *   `isCompleted` marca las que el proveedor da por terminadas sin importar el grupo;
 *   `sourceDescription` es la descripcion tal cual esta en el proveedor.
 * - `NormalizedComment`: comentario de una tarea con el nombre de su autor externo.
 * - `NormalizedSnapshot`: foto completa de un contenedor lista para importar.
 */
import { Priority, TaskStatus } from '@prisma/client';

export type IntegrationProvider = 'TRELLO';

export interface ExternalSources {
  container: string;
  item: string;
  subItem: string;
  comment: string;
}

export interface NormalizedContainer {
  externalId: string;
  name: string;
  description: string;
  url?: string;
}

export interface NormalizedGroup {
  externalId: string;
  name: string;
}

export interface NormalizedSubItem {
  externalId: string;
  title: string;
  description?: string;
  groupName: string;
  status: TaskStatus;
}

export interface NormalizedItem {
  externalId: string;
  title: string;
  description?: string;
  sourceDescription?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: Date;
  externalUrl?: string;
  groupExternalId: string;
  groupName: string;
  isCompleted: boolean;
  subItems: NormalizedSubItem[];
  statusWarning?: string;
}

export interface NormalizedComment {
  externalId: string;
  itemExternalId: string;
  text: string;
  authorName: string | null;
  createdAt?: Date;
}

export interface NormalizedSnapshot {
  container: NormalizedContainer;
  groups: NormalizedGroup[];
  items: NormalizedItem[];
  comments?: NormalizedComment[];
}
