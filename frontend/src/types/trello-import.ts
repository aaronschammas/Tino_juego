/**
 * Tipos de la importacion manual de Trello (SUPERADMIN).
 *
 * - `TrelloImportRequest`: solo lleva el `token` que Trello entrega al autorizar
 *   en su ventana; la API key la pone el backend.
 * - `TrelloConnectionStatus`: si la autorizacion con Trello esta disponible en
 *   el servidor.
 * - `TrelloImportPreview` / `TrelloImportResult`: vista previa y resultado.
 */
import { Priority } from './project';
import { TaskStatus } from './task';

export enum TrelloImportMode {
  NEW_PROJECT = 'NEW_PROJECT',
  EXISTING_PROJECT = 'EXISTING_PROJECT',
}

export interface TrelloBoard {
  id: string;
  name: string;
  description?: string;
  url?: string;
}

export interface TrelloImportRequest {
  token: string;
  boardId: string;
  mode: TrelloImportMode;
  projectId?: string;
}

export interface TrelloConnectionStatus {
  authorizationReady: boolean;
  status: 'READY' | 'NOT_CONFIGURED';
  message: string;
}

export interface TrelloImportPreview {
  board: TrelloBoard;
  mode: TrelloImportMode;
  targetProject?: {
    id: string;
    name: string;
  } | null;
  alreadyImported: boolean;
  importDisabled: boolean;
  totals: {
    lists: number;
    cards: number;
    checklists: number;
    subtasks: number;
    newTasks: number;
    duplicateTasks: number;
    newSubtasks: number;
    duplicateSubtasks: number;
    warnings: number;
  };
  warnings: string[];
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: Priority;
    dueDate?: string;
    listName: string;
    duplicate: boolean;
    subtasks: Array<{
      id: string;
      title: string;
      status: TaskStatus;
      checklistName: string;
      duplicate: boolean;
    }>;
  }>;
}

export interface TrelloImportResult extends TrelloImportPreview {
  result: {
    project?: {
      id: string;
      name: string;
    } | null;
    createdProject: boolean;
    createdTasks: number;
    createdSubtasks: number;
    skippedTasks: number;
    skippedSubtasks: number;
  };
}
