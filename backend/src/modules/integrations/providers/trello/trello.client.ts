/**
 * Cliente HTTP minimo de la API REST de Trello (https://api.trello.com/1).
 *
 * - `listBoards()`, `getBoard()`, `getLists()`, `getCards()`, `getCard()`:
 *   piden solo los campos que usa el adaptador; las tarjetas vienen con sus checklists.
 * - `getBoardComments()`: ultimos comentarios del tablero (hasta 1000).
 * - `createWebhook()` / `deleteWebhook()`: alta y baja del aviso de cambios de
 *   un tablero. Al crearlo Trello hace un HEAD a la URL de callback y exige 200.
 * - `request()`: agrega key y token como query params y convierte cualquier
 *   respuesta no exitosa en un error generico, sin exponer el detalle de Trello.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  TrelloAction,
  TrelloBoard,
  TrelloCard,
  TrelloCredentials,
  TrelloList,
} from './trello.types';

interface TrelloRequestOptions extends TrelloCredentials {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, string>;
}

const CARD_FIELDS = 'id,name,desc,due,dueComplete,idList,closed,url,labels';

@Injectable()
export class TrelloClient {
  private readonly baseUrl = 'https://api.trello.com/1';

  async listBoards(credentials: TrelloCredentials) {
    return this.request<TrelloBoard[]>({
      ...credentials,
      path: '/members/me/boards',
      params: {
        fields: 'id,name,desc,url,closed',
        filter: 'open',
      },
    });
  }

  async getBoard(boardId: string, credentials: TrelloCredentials) {
    return this.request<TrelloBoard>({
      ...credentials,
      path: `/boards/${boardId}`,
      params: {
        fields: 'id,name,desc,url,closed',
      },
    });
  }

  async getLists(boardId: string, credentials: TrelloCredentials) {
    return this.request<TrelloList[]>({
      ...credentials,
      path: `/boards/${boardId}/lists`,
      params: {
        fields: 'id,name,closed',
      },
    });
  }

  async getCards(boardId: string, credentials: TrelloCredentials) {
    return this.request<TrelloCard[]>({
      ...credentials,
      path: `/boards/${boardId}/cards`,
      params: {
        fields: CARD_FIELDS,
        checklists: 'all',
      },
    });
  }

  async getCard(cardId: string, credentials: TrelloCredentials) {
    return this.request<TrelloCard>({
      ...credentials,
      path: `/cards/${cardId}`,
      params: { fields: CARD_FIELDS, checklists: 'all' },
    });
  }

  async getBoardComments(boardId: string, credentials: TrelloCredentials) {
    return this.request<TrelloAction[]>({
      ...credentials,
      path: `/boards/${boardId}/actions`,
      params: {
        filter: 'commentCard',
        limit: '1000',
        fields: 'id,type,date,data',
        memberCreator_fields: 'fullName',
      },
    });
  }

  async createWebhook(
    credentials: TrelloCredentials,
    webhook: { callbackURL: string; idModel: string; description: string },
  ) {
    return this.request<{ id: string }>({
      ...credentials,
      method: 'POST',
      path: '/webhooks',
      params: webhook,
    });
  }

  async deleteWebhook(webhookId: string, credentials: TrelloCredentials) {
    await this.request<unknown>({
      ...credentials,
      method: 'DELETE',
      path: `/webhooks/${webhookId}`,
    });
  }

  private async request<T>({
    path,
    apiKey,
    token,
    method = 'GET',
    params = {},
  }: TrelloRequestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('token', token);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url, { method });

    if (!response.ok) {
      throw new BadRequestException('No se pudo conectar con Trello');
    }

    return response.json() as Promise<T>;
  }
}
