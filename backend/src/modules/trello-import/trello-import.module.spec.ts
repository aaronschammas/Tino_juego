/**
 * Comprueba que Nest arma el modulo de importacion con los proveedores del modulo
 * de integraciones. `FakeGlobalsModule` reemplaza los globales de la app
 * (PrismaService, ActiveOrganizationService y el JwtService que usa el AuthGuard).
 */
import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import { PrismaService } from 'src/database/prisma.service';
import { TrelloAdapter } from 'src/modules/integrations/providers/trello/trello.adapter';
import { IntegrationSyncService } from 'src/modules/integrations/sync/integration-sync.service';
import { TrelloImportController } from './trello-import.controller';
import { TrelloImportModule } from './trello-import.module';
import { TrelloImportService } from './trello-import.service';

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

describe('TrelloImportModule', () => {
  it('resolves the import service with the shared integrations providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalsModule, TrelloImportModule],
    }).compile();

    expect(moduleRef.get(TrelloImportController)).toBeInstanceOf(
      TrelloImportController,
    );
    expect(moduleRef.get(TrelloImportService)).toBeInstanceOf(
      TrelloImportService,
    );
    expect(moduleRef.get(TrelloAdapter, { strict: false })).toBeInstanceOf(
      TrelloAdapter,
    );
    expect(
      moduleRef.get(IntegrationSyncService, { strict: false }),
    ).toBeInstanceOf(IntegrationSyncService);
  });
});
