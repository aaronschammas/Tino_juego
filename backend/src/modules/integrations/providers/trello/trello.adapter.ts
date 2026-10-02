/**
 * Adaptador de Trello: traduce tableros, listas y tarjetas a los tipos comunes
 * de integraciones. Es lo unico del flujo que conoce la forma de la API de Trello.
 *
 * Qué contiene:
 * - `listContainers()`: tableros abiertos del usuario.
 * - `fetchSnapshot()`: pide tablero, listas y tarjetas en paralelo (y los
 *   comentarios si se piden), descarta lo archivado y arma el snapshot.
 * - `normalizeComments()`: acciones `commentCard` -> comentarios con autor y fecha.
 * - `normalizeCards()`: cada tarjeta pasa a tarea. El estado sale de adivinar el
 *   nombre de su lista (TODO con aviso si no hay equivalencia) y una tarjeta con
 *   vencimiento cumplido queda DONE. La prioridad sale de las etiquetas y la
 *   descripcion suma la lista original y la URL de la tarjeta.
 * - `normalizeChecklistItems()`: cada item de checklist pasa a subtarea.
 * - `priorityFromLabels()`: busca palabras o colores en las etiquetas (rojo o
 *   "critica" = CRITICAL, naranja o "alta" = HIGH, verde o "baja" = LOW).
 * - `pickCredentials()`: envia a Trello solo key y token aunque llegue un DTO
 *   con mas campos.
 */
import { Injectable } from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import {
  FetchSnapshotOptions,
  IntegrationProviderAdapter,
} from '../../provider-adapter';
import {
  NormalizedComment,
  NormalizedContainer,
  NormalizedItem,
  NormalizedSnapshot,
  NormalizedSubItem,
} from '../../integration.types';
import { guessTaskStatus, normalizeText } from '../../mapping/status-guess';
import { TrelloClient } from './trello.client';
import {
  TRELLO_SOURCES,
  TrelloAction,
  TrelloBoard,
  TrelloCard,
  TrelloChecklist,
  TrelloCredentials,
  TrelloLabel,
  TrelloList,
} from './trello.types';

@Injectable()
export class TrelloAdapter implements IntegrationProviderAdapter<TrelloCredentials> {
  readonly provider = 'TRELLO' as const;
  readonly sources = TRELLO_SOURCES;

  constructor(private readonly trello: TrelloClient) {}

  async listContainers(
    credentials: TrelloCredentials,
  ): Promise<NormalizedContainer[]> {
    const boards = await this.trello.listBoards(
      this.pickCredentials(credentials),
    );

    return boards
      .filter((board) => !board.closed)
      .map((board) => this.toContainer(board));
  }

  async fetchSnapshot(
    boardId: string,
    credentials: TrelloCredentials,
    options: FetchSnapshotOptions = {},
  ): Promise<NormalizedSnapshot> {
    const auth = this.pickCredentials(credentials);
    const [board, lists, cards, comments] = await Promise.all([
      this.trello.getBoard(boardId, auth),
      this.trello.getLists(boardId, auth),
      this.trello.getCards(boardId, auth),
      options.includeComments
        ? this.trello.getBoardComments(boardId, auth)
        : Promise.resolve(null),
    ]);

    const openLists = lists.filter((list) => !list.closed);

    return {
      container: this.toContainer(board),
      groups: openLists.map((list) => ({
        externalId: list.id,
        name: list.name,
      })),
      items: this.normalizeCards(
        cards.filter((card) => !card.closed),
        openLists,
      ),
      ...(comments ? { comments: this.normalizeComments(comments) } : {}),
    };
  }

  normalizeComments(actions: TrelloAction[]): NormalizedComment[] {
    return actions
      .filter((action) => action.data.card?.id && action.data.text)
      .map((action) => ({
        externalId: action.id,
        itemExternalId: action.data.card!.id,
        text: action.data.text!,
        authorName: action.memberCreator?.fullName ?? null,
        ...(action.date ? { createdAt: new Date(action.date) } : {}),
      }));
  }

  normalizeCards(cards: TrelloCard[], lists: TrelloList[]): NormalizedItem[] {
    const listNames = new Map<string, string>(
      lists.map((list) => [list.id, list.name]),
    );

    return cards.map((card) => {
      const listName = listNames.get(card.idList) || 'Sin lista';
      const guessedStatus = guessTaskStatus(listName);
      const isCompleted = !!card.dueComplete;

      return {
        externalId: card.id,
        title: card.name || 'Tarjeta sin titulo',
        description: this.buildDescription(card.desc, card.url, listName),
        sourceDescription: card.desc?.trim() ?? '',
        status: isCompleted
          ? TaskStatus.DONE
          : (guessedStatus ?? TaskStatus.TODO),
        priority: this.priorityFromLabels(card.labels || []),
        dueDate: card.due ? new Date(card.due) : undefined,
        externalUrl: card.url,
        groupExternalId: card.idList,
        groupName: listName,
        isCompleted,
        subItems: this.normalizeChecklistItems(card.checklists || []),
        statusWarning: guessedStatus
          ? undefined
          : `La lista "${listName}" se importara como TODO`,
      };
    });
  }

  normalizeChecklistItems(checklists: TrelloChecklist[]): NormalizedSubItem[] {
    return checklists.flatMap((checklist) => {
      const checklistName = checklist.name || 'Checklist';

      return (checklist.checkItems || []).map((item) => ({
        externalId: item.id,
        title: item.name || 'Item sin titulo',
        description: `Checklist Trello: ${checklistName}`,
        groupName: checklistName,
        status: item.state === 'complete' ? TaskStatus.DONE : TaskStatus.TODO,
      }));
    });
  }

  priorityFromLabels(labels: TrelloLabel[]): Priority {
    const normalizedLabels = labels
      .map((label) => `${label.name || ''} ${label.color || ''}`)
      .map((value) => normalizeText(value));
    const hasAny = (...words: string[]) =>
      normalizedLabels.some((label) =>
        words.some((word) => label.includes(word)),
      );

    if (hasAny('critical', 'critica', 'red')) return Priority.CRITICAL;
    if (hasAny('high', 'alta', 'orange')) return Priority.HIGH;
    if (hasAny('low', 'baja', 'green')) return Priority.LOW;
    return Priority.MEDIUM;
  }

  private buildDescription(
    description?: string,
    url?: string,
    listName?: string,
  ) {
    const parts = [description?.trim()].filter(Boolean) as string[];
    if (listName) parts.push(`Lista Trello original: ${listName}`);
    if (url) parts.push(`URL Trello: ${url}`);
    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }

  private toContainer(board: TrelloBoard): NormalizedContainer {
    return {
      externalId: board.id,
      name: board.name,
      description: board.desc || '',
      url: board.url,
    };
  }

  private pickCredentials({
    apiKey,
    token,
  }: TrelloCredentials): TrelloCredentials {
    return { apiKey, token };
  }
}
