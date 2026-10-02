/**
 * Tipos de las integraciones con herramientas externas (hoy Trello).
 *
 * - `IntegrationAvailability`: si la organizacion puede usar integraciones y el
 *   motivo cuando no (flag apagado, falta Plan Max, no es owner, etc.).
 * - `StatusMappingSuggestion`: una lista de Trello con el estado sugerido (o
 *   `null` si hay que definirlo a mano) y cuantas tarjetas tiene.
 * - `TrelloConnectionPreview` / `TrelloConnectionResult`: la vista previa de la
 *   importacion mas los datos propios de la conexion.
 * - `LiveSyncStatus`: si la actualizacion automatica (webhook) quedo activa y,
 *   si no, por que.
 * - `ProjectIntegrationConnection`: resumen de la conexion de un proyecto, con
 *   el estado de la actualizacion automatica.
 * - `ReconcileResult`: lo que hizo una revision ("Sincronizar ahora").
 * - `IntegrationActivitySummary` / `IntegrationActivityResponse`: novedades de
 *   Trello para el cartel (tareas nuevas, cambios de estado, archivadas y
 *   tiempo trabajado por persona). `available: false` = no mostrar nada.
 */
import { TaskStatus } from './task';
import { TrelloImportPreview, TrelloImportResult } from './trello-import';

export type IntegrationAvailabilityReason =
  | 'FEATURE_DISABLED'
  | 'TRELLO_NOT_CONFIGURED'
  | 'ENCRYPTION_NOT_CONFIGURED'
  | 'PLAN_REQUIRED'
  | 'OWNER_REQUIRED';

export interface IntegrationAvailability {
  enabled: boolean;
  canManage: boolean;
  reason: IntegrationAvailabilityReason | null;
}

export enum ConnectionTargetMode {
  NEW_PROJECT = 'NEW_PROJECT',
  EXISTING_PROJECT = 'EXISTING_PROJECT',
}

export interface StatusMappingSuggestion {
  externalGroupId: string;
  name: string;
  suggestedStatus: TaskStatus | null;
  itemCount: number;
}

export interface StatusMappingEntry {
  externalGroupId: string;
  status: TaskStatus;
}

export interface TrelloConnectionRequest {
  token: string;
  boardId: string;
  mode: ConnectionTargetMode;
  projectId?: string;
}

export interface TrelloConnectRequest extends TrelloConnectionRequest {
  statusMapping: StatusMappingEntry[];
}

export interface TrelloConnectionPreview extends TrelloImportPreview {
  blockedReason: string | null;
  statusMapping: StatusMappingSuggestion[];
}

export interface LiveSyncStatus {
  active: boolean;
  reason:
    | 'WEBHOOK_SECRET_MISSING'
    | 'WEBHOOK_URL_MISSING'
    | 'REGISTRATION_FAILED'
    | null;
}

export interface TrelloConnectionResult extends TrelloImportResult {
  liveSync?: LiveSyncStatus;
}

export interface ProjectIntegrationConnection {
  id: string;
  provider: 'TRELLO';
  status: string;
  container: { id: string; name: string; url: string | null };
  connectedAt: string;
  connectedBy: { id: string; name: string } | null;
  lastSyncedAt: string | null;
  liveSync: {
    active: boolean;
    lastEventAt: string | null;
    lastSyncError: string | null;
  };
  statusMappings: Array<{
    externalGroupId: string;
    name: string;
    status: TaskStatus | null;
  }>;
}

export interface ReconcileResult {
  groupsAdded: number;
  created: number;
  updated: number;
  restored: number;
  archived: number;
  subtasksChanged: number;
  commentsAdded: number;
  commentsUpdated: number;
  baselined: number;
  liveSyncActive: boolean;
}

export interface IntegrationActivityTask {
  taskId: string;
  title: string;
  projectName: string;
}

export interface IntegrationActivityStatusChange extends IntegrationActivityTask {
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  actorName: string | null;
}

export interface IntegrationActivityWorker {
  userId: string;
  name: string;
  minutes: number;
  tasks: Array<{ taskId: string; title: string; minutes: number }>;
}

export interface IntegrationActivitySummary {
  since: string;
  until: string;
  created: IntegrationActivityTask[];
  statusChanges: IntegrationActivityStatusChange[];
  archived: IntegrationActivityTask[];
  work: IntegrationActivityWorker[];
  totalMinutes: number;
  isEmpty: boolean;
}

export interface IntegrationActivityResponse {
  available: boolean;
  summary: IntegrationActivitySummary | null;
}
