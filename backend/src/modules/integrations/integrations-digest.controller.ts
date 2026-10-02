/**
 * Endpoint que llama Cloud Scheduler una vez por dia para mandar por WhatsApp
 * el resumen de novedades de Trello a cada owner. Igual que la revision diaria,
 * no usa la sesion de Tino: se protege con el header `X-Reconcile-Token`
 * (`INTEGRATIONS_RECONCILE_TOKEN`), asi no hace falta otro secreto.
 *
 * - `POST /integrations/digest`: valida el token (401 si falta o no coincide).
 *   Si las integraciones estan apagadas en el entorno responde `disabled: true`
 *   sin mandar nada. Si no, devuelve cuantas organizaciones proceso y como
 *   termino cada una.
 */
import {
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DigestRunSummary,
  WhatsAppDigestService,
} from '../whatsapp/whatsapp-digest.service';
import { IntegrationsConfig } from './integrations.config';

@Controller('integrations/digest')
export class IntegrationsDigestController {
  constructor(
    private readonly config: IntegrationsConfig,
    private readonly digest: WhatsAppDigestService,
  ) {}

  @Post()
  @HttpCode(200)
  async run(
    @Headers('x-reconcile-token') token: string | undefined,
  ): Promise<DigestRunSummary & { disabled: boolean }> {
    if (!this.config.isValidReconcileToken(token)) {
      throw new UnauthorizedException('Invalid reconcile token');
    }
    if (this.config.issue()) {
      return { disabled: true, processed: 0, results: [] };
    }
    const summary = await this.digest.sendDailyDigests();
    return { disabled: false, ...summary };
  }
}
