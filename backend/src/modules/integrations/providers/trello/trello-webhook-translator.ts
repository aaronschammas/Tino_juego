/**
 * Traduce cada accion que Trello envia al webhook a una lista de
 * `ExternalChange` genericos. Es la unica parte del flujo de webhooks que conoce
 * la forma de las acciones de Trello.
 *
 * Qué contiene:
 * - `translate()`: segun `action.type`:
 *   - tarjeta creada, copiada, convertida, recibida por mail o traida de otro
 *     tablero: se descarga la tarjeta completa -> `ITEM_CREATED`.
 *   - `updateCard`: mira `data.old` para saber que campos cambiaron y solo esos
 *     pasan a `ITEM_UPDATED` (nombre, descripcion, vencimiento, completada,
 *     lista). Si cambio `closed` -> `ITEM_ARCHIVED`. Si cambio de lista primero
 *     registra la lista (`GROUP_UPSERTED`) por si es nueva.
 *   - tarjeta borrada o llevada a otro tablero -> `ITEM_ARCHIVED`.
 *   - etiquetas agregadas o quitadas: descarga la tarjeta y recalcula solo la prioridad.
 *   - checklists o items agregados/quitados: descarga la tarjeta -> `SUBITEMS_SYNCED`.
 *   - item tildado o renombrado -> `SUBITEM_UPDATED`.
 *   - comentarios creados, editados o borrados -> `COMMENT_UPSERTED` / `COMMENT_DELETED`.
 *   - lista creada o renombrada -> `GROUP_UPSERTED`.
 *   - cualquier otra accion -> lista vacia (el evento queda como ignorado).
 * - `actorOf()`: id y nombre de quien hizo el cambio en Trello.
 */
import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { ExternalChange, ItemFieldChanges } from '../../sync/external-change';
import { TrelloAdapter } from './trello.adapter';
import { TrelloClient } from './trello.client';
import { TrelloAction, TrelloCredentials } from './trello.types';

const CARD_CREATED = new Set([
  'createCard',
  'copyCard',
  'convertToCardFromCheckItem',
  'emailCard',
  'moveCardToBoard',
]);
const CARD_REMOVED = new Set(['deleteCard', 'moveCardFromBoard']);
const LABEL_CHANGED = new Set(['addLabelToCard', 'removeLabelFromCard']);
const CHECKLIST_CHANGED = new Set([
  'addChecklistToCard',
  'removeChecklistFromCard',
  'copyChecklist',
  'createCheckItem',
  'deleteCheckItem',
]);

@Injectable()
export class TrelloWebhookTranslator {
  constructor(
    private readonly trello: TrelloClient,
    private readonly adapter: TrelloAdapter,
  ) {}

  actorOf(action: TrelloAction) {
    return {
      id: action.memberCreator?.id ?? action.idMemberCreator ?? null,
      name: action.memberCreator?.fullName ?? null,
    };
  }

  async translate(
    action: TrelloAction,
    credentials: TrelloCredentials,
  ): Promise<ExternalChange[]> {
    const { type, data } = action;
    const cardId = data.card?.id;

    if (CARD_CREATED.has(type) && cardId) {
      return [await this.createdCard(cardId, data.list?.name, credentials)];
    }
    if (type === 'updateCard' && cardId) return this.updatedCard(action);
    if (CARD_REMOVED.has(type) && cardId) {
      return [{ kind: 'ITEM_ARCHIVED', externalId: cardId, archived: true }];
    }
    if (LABEL_CHANGED.has(type) && cardId) {
      const card = await this.trello.getCard(cardId, credentials);
      return [
        {
          kind: 'ITEM_UPDATED',
          externalId: cardId,
          changes: {
            priority: this.adapter.priorityFromLabels(card.labels || []),
          },
        },
      ];
    }
    if (CHECKLIST_CHANGED.has(type) && cardId) {
      const card = await this.trello.getCard(cardId, credentials);
      return [
        {
          kind: 'SUBITEMS_SYNCED',
          itemExternalId: cardId,
          subItems: this.adapter.normalizeChecklistItems(card.checklists || []),
        },
      ];
    }
    if (
      (type === 'updateCheckItemStateOnCard' || type === 'updateCheckItem') &&
      data.checkItem
    ) {
      return this.updatedCheckItem(action);
    }
    return this.commentOrListChange(action);
  }

  private async createdCard(
    cardId: string,
    listName: string | undefined,
    credentials: TrelloCredentials,
  ): Promise<ExternalChange> {
    const card = await this.trello.getCard(cardId, credentials);
    const [item] = this.adapter.normalizeCards(
      [card],
      [{ id: card.idList, name: listName || 'Sin lista' }],
    );
    return { kind: 'ITEM_CREATED', item };
  }

  private updatedCard(action: TrelloAction): ExternalChange[] {
    const card = action.data.card!;
    const old = action.data.old ?? {};
    const changed = (field: string) => field in old;
    const changes: ItemFieldChanges = {};
    const result: ExternalChange[] = [];

    if (changed('name') && card.name !== undefined) changes.title = card.name;
    if (changed('desc')) changes.description = card.desc?.trim() || null;
    if (changed('due')) changes.dueDate = card.due ? new Date(card.due) : null;
    if (changed('dueComplete')) changes.isCompleted = !!card.dueComplete;
    if (changed('idList')) {
      const listId = action.data.listAfter?.id ?? card.idList;
      if (listId) {
        changes.groupExternalId = listId;
        if (action.data.listAfter?.name) {
          result.push({
            kind: 'GROUP_UPSERTED',
            externalId: listId,
            name: action.data.listAfter.name,
          });
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      result.push({ kind: 'ITEM_UPDATED', externalId: card.id, changes });
    }
    if (changed('closed')) {
      result.push({
        kind: 'ITEM_ARCHIVED',
        externalId: card.id,
        archived: !!card.closed,
      });
    }
    return result;
  }

  private updatedCheckItem(action: TrelloAction): ExternalChange[] {
    const item = action.data.checkItem!;
    const old = action.data.old ?? {};
    const changes: { title?: string; status?: TaskStatus } = {};

    if (action.type === 'updateCheckItemStateOnCard' || 'state' in old) {
      changes.status =
        item.state === 'complete' ? TaskStatus.DONE : TaskStatus.TODO;
    }
    if ('name' in old && item.name) changes.title = item.name;

    return Object.keys(changes).length > 0
      ? [{ kind: 'SUBITEM_UPDATED', externalId: item.id, changes }]
      : [];
  }

  private commentOrListChange(action: TrelloAction): ExternalChange[] {
    const { type, data } = action;

    if (type === 'commentCard' && data.card && data.text !== undefined) {
      return [
        {
          kind: 'COMMENT_UPSERTED',
          externalId: action.id,
          itemExternalId: data.card.id,
          text: data.text,
          authorName: this.actorOf(action).name,
          ...(action.date ? { createdAt: new Date(action.date) } : {}),
        },
      ];
    }
    if (type === 'updateComment' && data.card && data.action?.text) {
      return [
        {
          kind: 'COMMENT_UPSERTED',
          externalId: data.action.id,
          itemExternalId: data.card.id,
          text: data.action.text,
          authorName: this.actorOf(action).name,
        },
      ];
    }
    if (type === 'deleteComment' && data.action) {
      return [{ kind: 'COMMENT_DELETED', externalId: data.action.id }];
    }
    if (
      data.list?.name &&
      (type === 'createList' ||
        (type === 'updateList' && 'name' in (data.old ?? {})))
    ) {
      return [
        {
          kind: 'GROUP_UPSERTED',
          externalId: data.list.id,
          name: data.list.name,
        },
      ];
    }
    return [];
  }
}
