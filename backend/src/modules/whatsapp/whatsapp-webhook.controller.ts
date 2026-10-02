/**
 * Puerta de entrada de Meta al backend.
 *
 * Son los dos únicos endpoints públicos del módulo, sin `AuthGuard`, porque los
 * llama Meta y no un usuario con sesión. Lo que reemplaza a la sesión es la firma
 * del mensaje.
 *
 * Qué contiene:
 * - `verify()`: atiende el GET de la verificación inicial, donde Meta manda
 *   `hub.mode`, `hub.verify_token` y `hub.challenge`, y espera el challenge de
 *   vuelta si el token coincide.
 * - `receive()`: atiende el POST con los mensajes. Valida la firma contra el
 *   cuerpo original y recién entonces se lo pasa a `WhatsAppService`.
 *
 * Dos detalles importantes de esta clase:
 * - La URL de este webhook tiene que apuntar directo al backend. El proxy `/api`
 *   del frontend rechaza los POST que no vienen del dominio de Tino, y Meta no
 *   envía ese origen.
 * - Siempre responde 200 cuando la firma es válida, incluso si el mensaje se
 *   ignora. Si respondiera un error, Meta reintentaría la entrega durante días.
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { readWhatsAppConfig } from './whatsapp.config';
import {
  resolveWebhookChallenge,
  verifyWhatsAppSignature,
} from './whatsapp-signature';
import { WhatsAppService } from './whatsapp.service';
import type {
  WhatsAppWebhookPayload,
  WhatsAppWebhookQuery,
} from './whatsapp.types';

@Controller('whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('webhook')
  verify(
    @Query() query: WhatsAppWebhookQuery,
    @Res() response: Response,
  ): void {
    const config = readWhatsAppConfig();
    if (!config.verifyToken) {
      throw new ServiceUnavailableException(
        'WhatsApp verification is not configured',
      );
    }
    const challenge = resolveWebhookChallenge(query, config.verifyToken);
    if (!challenge) throw new ForbiddenException('Invalid verify token');
    // Explicit native response: Meta needs plain text, not the API envelope.
    // @Res() disables automatic serialization only for this endpoint.
    response.type('text/plain').send(challenge);
  }

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: WhatsAppWebhookPayload,
  ): Promise<{ received: boolean }> {
    const config = readWhatsAppConfig();
    if (!config.appSecret || !config.phoneNumberId) {
      throw new ServiceUnavailableException(
        'WhatsApp webhook is not configured',
      );
    }
    const valid = verifyWhatsAppSignature(
      request.rawBody,
      signature,
      config.appSecret,
    );
    if (!valid) throw new ForbiddenException('Invalid signature');

    await this.whatsapp.handleWebhook(payload);
    return { received: true };
  }
}
