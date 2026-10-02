/**
 * Tipos de Trello.
 *
 * - `TrelloCredentials`: api key de la app de Tino + token del usuario.
 * - `TRELLO_SOURCES`: valores de `externalSource` con los que se guardan en Tino
 *   el tablero (proyecto), las tarjetas (tareas), los items de checklist
 *   (subtareas) y los comentarios.
 * - `TrelloBoard`, `TrelloList`, `TrelloCard`, etc.: respuestas de la API, solo
 *   con los campos que pide `TrelloClient`.
 * - `TrelloAction` / `TrelloWebhookPayload`: aviso que Trello envia al webhook.
 *   `data` trae solo lo que cambio: en `updateCard`, `data.card` tiene el valor
 *   nuevo de los campos modificados y `data.old` el valor anterior.
 */
export interface TrelloCredentials {
  apiKey: string;
  token: string;
}

export const TRELLO_SOURCES = {
  container: 'TRELLO_BOARD',
  item: 'TRELLO_CARD',
  subItem: 'TRELLO_CHECKLIST_ITEM',
  comment: 'TRELLO_COMMENT',
} as const;

export interface TrelloBoard {
  id: string;
  name: string;
  desc?: string;
  url?: string;
  closed?: boolean;
}

export interface TrelloList {
  id: string;
  name: string;
  closed?: boolean;
}

export interface TrelloLabel {
  name?: string;
  color?: string | null;
}

export interface TrelloCheckItem {
  id: string;
  name?: string;
  state?: 'complete' | 'incomplete';
}

export interface TrelloChecklist {
  name?: string;
  checkItems?: TrelloCheckItem[];
}

export interface TrelloCard {
  id: string;
  name?: string;
  desc?: string;
  due?: string | null;
  dueComplete?: boolean;
  idList: string;
  closed?: boolean;
  url?: string;
  labels?: TrelloLabel[];
  checklists?: TrelloChecklist[];
}

export interface TrelloActionData {
  card?: {
    id: string;
    name?: string;
    desc?: string;
    due?: string | null;
    dueComplete?: boolean;
    idList?: string;
    closed?: boolean;
  };
  old?: Record<string, unknown>;
  list?: { id: string; name?: string; closed?: boolean };
  listAfter?: { id: string; name?: string };
  listBefore?: { id: string; name?: string };
  board?: { id: string; name?: string };
  text?: string;
  action?: { id: string; text?: string };
  checklist?: { id: string; name?: string };
  checkItem?: { id: string; name?: string; state?: 'complete' | 'incomplete' };
}

export interface TrelloAction {
  id: string;
  type: string;
  date?: string;
  idMemberCreator?: string;
  memberCreator?: { id?: string; fullName?: string; username?: string };
  data: TrelloActionData;
}

export interface TrelloWebhookPayload {
  action?: TrelloAction;
  model?: { id: string };
}
