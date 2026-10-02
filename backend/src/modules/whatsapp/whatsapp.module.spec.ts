import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { AssistantService } from '../assistant/assistant.service';
import { WhatsAppModule } from './whatsapp.module';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppLinkService } from './whatsapp-link.service';
import { WhatsAppClientService } from './whatsapp-client.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppLinkController } from './whatsapp-link.controller';

// Reemplaza a los dos proveedores globales de la app: PrismaService, que viene
// de DatabaseModule, y JwtService, que AuthModule registra con `global: true` y
// que necesita el AuthGuard de los controllers con sesión.
@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: {} },
    { provide: JwtService, useValue: {} },
  ],
  exports: [PrismaService, JwtService],
})
class FakeGlobalsModule {}

describe('WhatsAppModule', () => {
  it('resolves every provider and controller through dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalsModule, WhatsAppModule],
    }).compile();

    expect(moduleRef.get(WhatsAppService)).toBeInstanceOf(WhatsAppService);
    expect(moduleRef.get(WhatsAppLinkService)).toBeInstanceOf(
      WhatsAppLinkService,
    );
    expect(moduleRef.get(WhatsAppClientService)).toBeInstanceOf(
      WhatsAppClientService,
    );
    expect(moduleRef.get(WhatsAppWebhookController)).toBeInstanceOf(
      WhatsAppWebhookController,
    );
    expect(moduleRef.get(WhatsAppLinkController)).toBeInstanceOf(
      WhatsAppLinkController,
    );
  });

  it('reuses the assistant exported by AssistantModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalsModule, WhatsAppModule],
    }).compile();

    expect(moduleRef.get(AssistantService, { strict: false })).toBeInstanceOf(
      AssistantService,
    );
  });
});
