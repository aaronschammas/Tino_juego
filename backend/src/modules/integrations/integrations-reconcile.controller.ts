/**
 * Endpoint que llama Cloud Scheduler una vez por dia para la revision de
 * respaldo. No usa la sesion de Tino: se protege con el header
 * `X-Reconcile-Token`, que tiene que coincidir con `INTEGRATIONS_RECONCILE_TOKEN`.
 *
 * - `POST /integrations/reconcile`: valida el token (401 si falta o no coincide)
 *   y revisa todas las conexiones activas. Devuelve el resumen de la corrida.
 */
import {
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { IntegrationsConfig } from './integrations.config';
import {
  ReconcileRunSummary,
  TrelloReconcileService,
} from './providers/trello/trello-reconcile.service';

@Controller('integrations/reconcile')
export class IntegrationsReconcileController {
  constructor(
    private readonly config: IntegrationsConfig,
    private readonly trello: TrelloReconcileService,
  ) {}

  @Post()
  @HttpCode(200)
  async run(
    @Headers('x-reconcile-token') token: string | undefined,
  ): Promise<ReconcileRunSummary> {
    if (!this.config.isValidReconcileToken(token)) {
      throw new UnauthorizedException('Invalid reconcile token');
    }
    return this.trello.reconcileAll();
  }
}
