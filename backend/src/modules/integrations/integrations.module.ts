/**
 * Modulo de integraciones con herramientas externas (hoy Trello).
 *
 * Exporta el adaptador de Trello, el motor de sincronizacion e
 * `IntegrationsConfig` (API key de la app de Trello) para que la importacion
 * manual de SUPERADMIN los reutilice. `IntegrationsConfig` se crea
 * desde `process.env` al iniciar la app. `TrelloWebhookController` es publico
 * (lo llama Trello) y se protege con la firma de cada aviso;
 * `IntegrationsReconcileController` y `IntegrationsDigestController` tambien son
 * publicos (los llama Cloud Scheduler) y se protegen con
 * `INTEGRATIONS_RECONCILE_TOKEN`. Las novedades salen de
 * `IntegrationActivityModule` y el resumen diario se manda con el
 * `WhatsAppDigestService` de `WhatsAppModule`.
 */
import { Module } from '@nestjs/common';
import { PlanPolicyModule } from 'src/common/plans/plan-policy.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { IntegrationAccessService } from './access/integration-access.service';
import { IntegrationActivityModule } from './activity/integration-activity.module';
import { IntegrationConnectionsService } from './connections/integration-connections.service';
import { IntegrationsConfig } from './integrations.config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsDigestController } from './integrations-digest.controller';
import { IntegrationsReconcileController } from './integrations-reconcile.controller';
import { TrelloAdapter } from './providers/trello/trello.adapter';
import { TrelloClient } from './providers/trello/trello.client';
import { TrelloConnectionService } from './providers/trello/trello-connection.service';
import { TrelloLiveSyncService } from './providers/trello/trello-live-sync.service';
import { TrelloReconcileService } from './providers/trello/trello-reconcile.service';
import { TrelloWebhookController } from './providers/trello/trello-webhook.controller';
import { TrelloWebhookService } from './providers/trello/trello-webhook.service';
import { TrelloWebhookTranslator } from './providers/trello/trello-webhook-translator';
import { IntegrationChangeService } from './sync/integration-change.service';
import { IntegrationReconcileService } from './sync/integration-reconcile.service';
import { IntegrationSyncService } from './sync/integration-sync.service';

@Module({
  imports: [PlanPolicyModule, IntegrationActivityModule, WhatsAppModule],
  controllers: [
    IntegrationsController,
    TrelloWebhookController,
    IntegrationsReconcileController,
    IntegrationsDigestController,
  ],
  providers: [
    { provide: IntegrationsConfig, useFactory: () => new IntegrationsConfig() },
    TrelloClient,
    TrelloAdapter,
    IntegrationSyncService,
    IntegrationChangeService,
    IntegrationAccessService,
    IntegrationConnectionsService,
    TrelloConnectionService,
    TrelloWebhookTranslator,
    TrelloWebhookService,
    TrelloLiveSyncService,
    IntegrationReconcileService,
    TrelloReconcileService,
  ],
  exports: [TrelloAdapter, IntegrationSyncService, IntegrationsConfig],
})
export class IntegrationsModule {}
