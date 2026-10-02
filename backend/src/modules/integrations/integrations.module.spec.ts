/**
 * Comprueba que Nest arma el modulo de integraciones completo. `FakeGlobalsModule`
 * reemplaza los globales de la app (PrismaService, ActiveOrganizationService y
 * el JwtService que usa el AuthGuard).
 */
import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationAccessService } from './access/integration-access.service';
import { IntegrationConnectionsService } from './connections/integration-connections.service';
import { IntegrationsConfig } from './integrations.config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsModule } from './integrations.module';
import { TrelloConnectionService } from './providers/trello/trello-connection.service';
import { TrelloWebhookController } from './providers/trello/trello-webhook.controller';
import { TrelloWebhookService } from './providers/trello/trello-webhook.service';
import { IntegrationChangeService } from './sync/integration-change.service';
import { IntegrationReconcileService } from './sync/integration-reconcile.service';
import { IntegrationsReconcileController } from './integrations-reconcile.controller';
import { TrelloReconcileService } from './providers/trello/trello-reconcile.service';

@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: {} },
    { provide: JwtService, useValue: {} },
    { provide: ActiveOrganizationService, useValue: {} },
  ],
  exports: [PrismaService, JwtService, ActiveOrganizationService],
})
class FakeGlobalsModule {}

describe('IntegrationsModule', () => {
  it('resolves the controller and every provider', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalsModule, IntegrationsModule],
    }).compile();

    expect(moduleRef.get(IntegrationsController)).toBeInstanceOf(
      IntegrationsController,
    );
    expect(moduleRef.get(TrelloConnectionService)).toBeInstanceOf(
      TrelloConnectionService,
    );
    expect(moduleRef.get(IntegrationAccessService)).toBeInstanceOf(
      IntegrationAccessService,
    );
    expect(moduleRef.get(IntegrationConnectionsService)).toBeInstanceOf(
      IntegrationConnectionsService,
    );
    expect(moduleRef.get(TrelloWebhookController)).toBeInstanceOf(
      TrelloWebhookController,
    );
    expect(moduleRef.get(TrelloWebhookService)).toBeInstanceOf(
      TrelloWebhookService,
    );
    expect(moduleRef.get(IntegrationChangeService)).toBeInstanceOf(
      IntegrationChangeService,
    );
    expect(moduleRef.get(IntegrationsReconcileController)).toBeInstanceOf(
      IntegrationsReconcileController,
    );
    expect(moduleRef.get(TrelloReconcileService)).toBeInstanceOf(
      TrelloReconcileService,
    );
    expect(moduleRef.get(IntegrationReconcileService)).toBeInstanceOf(
      IntegrationReconcileService,
    );
    expect(moduleRef.get(IntegrationsConfig)).toBeInstanceOf(
      IntegrationsConfig,
    );
  });
});
