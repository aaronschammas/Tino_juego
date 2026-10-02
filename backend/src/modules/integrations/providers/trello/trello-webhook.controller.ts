/**
 * Endpoints publicos que llama Trello (sin sesion de Tino: la seguridad es la
 * firma del aviso, que verifica `TrelloWebhookService`).
 *
 * - `HEAD /integrations/trello/webhook/:connectionId`: Trello lo llama al crear
 *   el webhook y exige un 200 para aceptarlo.
 * - `POST /integrations/trello/webhook/:connectionId`: cada cambio del tablero.
 *   Pasa el cuerpo original (`rawBody`) para poder verificar la firma.
 */
import {
  Body,
  Controller,
  Head,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { TRELLO_WEBHOOK_PATH } from '../../integrations.config';
import type { TrelloWebhookPayload } from './trello.types';
import { TrelloWebhookService } from './trello-webhook.service';

@Controller(TRELLO_WEBHOOK_PATH.replace(/^\//, ''))
export class TrelloWebhookController {
  constructor(private readonly webhooks: TrelloWebhookService) {}

  @Head(':connectionId')
  @HttpCode(200)
  verify(): void {}

  @Post(':connectionId')
  @HttpCode(200)
  async receive(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-trello-webhook') signature: string | undefined,
    @Body() payload: TrelloWebhookPayload,
  ) {
    const result = await this.webhooks.handle(
      connectionId,
      request.rawBody,
      signature,
      payload,
    );
    return { received: true, result };
  }
}
