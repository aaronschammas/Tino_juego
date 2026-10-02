/**
 * Tests del controller de integraciones: que cada endpoint resuelva la
 * organizacion activa y delegue con ella, que el cartel de novedades no muestre
 * nada cuando las integraciones no estan disponibles, y que los DTOs rechacen
 * datos invalidos con las mismas reglas que el ValidationPipe global
 * (whitelist + forbidNonWhitelisted).
 */
import { ForbiddenException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import { IntegrationAccessService } from './access/integration-access.service';
import { IntegrationActivityService } from './activity/integration-activity.service';
import { IntegrationConnectionsService } from './connections/integration-connections.service';
import {
  TrelloAuthorizeUrlQueryDto,
  TrelloConnectDto,
} from './dto/trello-connection.dto';
import { IntegrationsController } from './integrations.controller';
import { TrelloConnectionService } from './providers/trello/trello-connection.service';
import { TrelloReconcileService } from './providers/trello/trello-reconcile.service';

describe('IntegrationsController', () => {
  const user = { id: 'user-1', role: 'USER' };
  const scoped = { ...user, organizationId: 'org-active' };
  const request = {} as Request;
  let activeOrganization: { resolveScopedUser: jest.Mock };
  let access: { getAvailability: jest.Mock; assertCanManage: jest.Mock };
  let connections: { findByProject: jest.Mock; disconnect: jest.Mock };
  let trello: {
    buildAuthorizeUrl: jest.Mock;
    listBoards: jest.Mock;
    preview: jest.Mock;
    connect: jest.Mock;
    disconnect: jest.Mock;
    enableLiveSync: jest.Mock;
    updateStatusMappings: jest.Mock;
  };
  let reconcile: { reconcileProject: jest.Mock };
  let activity: { summarizeForViewer: jest.Mock; markSeen: jest.Mock };
  let controller: IntegrationsController;

  beforeEach(() => {
    activeOrganization = {
      resolveScopedUser: jest.fn().mockResolvedValue(scoped),
    };
    access = {
      getAvailability: jest.fn().mockResolvedValue({ enabled: true }),
      assertCanManage: jest.fn().mockResolvedValue(undefined),
    };
    connections = {
      findByProject: jest.fn().mockResolvedValue(null),
      disconnect: jest.fn().mockResolvedValue({ disconnected: true }),
    };
    trello = {
      buildAuthorizeUrl: jest.fn().mockResolvedValue({ url: 'u' }),
      listBoards: jest.fn().mockResolvedValue([]),
      preview: jest.fn().mockResolvedValue({}),
      connect: jest.fn().mockResolvedValue({}),
      disconnect: jest.fn().mockResolvedValue({ disconnected: true }),
      enableLiveSync: jest
        .fn()
        .mockResolvedValue({ active: true, reason: null }),
      updateStatusMappings: jest
        .fn()
        .mockResolvedValue({ updated: 1, tasksUpdated: 2 }),
    };
    reconcile = {
      reconcileProject: jest.fn().mockResolvedValue({ created: 1 }),
    };
    activity = {
      summarizeForViewer: jest.fn().mockResolvedValue({ isEmpty: true }),
      markSeen: jest.fn().mockResolvedValue({ seenAt: new Date(0) }),
    };
    controller = new IntegrationsController(
      activeOrganization as unknown as ActiveOrganizationService,
      access as unknown as IntegrationAccessService,
      connections as unknown as IntegrationConnectionsService,
      trello as unknown as TrelloConnectionService,
      reconcile as unknown as TrelloReconcileService,
      activity as unknown as IntegrationActivityService,
    );
  });

  it('returns the activity summary for the viewer of the active organization', async () => {
    await expect(controller.activitySummary(user, request)).resolves.toEqual({
      available: true,
      summary: { isEmpty: true },
    });
    expect(access.getAvailability).toHaveBeenCalledWith(scoped, 'org-active');
    expect(activity.summarizeForViewer).toHaveBeenCalledWith(
      scoped,
      'org-active',
    );
  });

  it('hides the activity banner when integrations are not available', async () => {
    access.getAvailability.mockResolvedValue({
      enabled: false,
      reason: 'PLAN_REQUIRED',
    });

    await expect(controller.activitySummary(user, request)).resolves.toEqual({
      available: false,
      summary: null,
    });
    expect(activity.summarizeForViewer).not.toHaveBeenCalled();
  });

  it('marks the activity banner as seen', async () => {
    await expect(controller.activitySeen(user, request)).resolves.toEqual({
      seenAt: new Date(0),
    });
    expect(activity.markSeen).toHaveBeenCalledWith(scoped, 'org-active');
  });

  it('scopes every call to the active organization', async () => {
    const connectDto = { token: 't' } as TrelloConnectDto;

    await controller.availability(user, request);
    await controller.trelloAuthorizeUrl(
      { returnOrigin: 'https://qa.tino.test' },
      user,
      request,
    );
    await controller.trelloBoards({ token: 't' }, user, request);
    await controller.trelloConnect(connectDto, user, request);

    expect(activeOrganization.resolveScopedUser).toHaveBeenCalledWith(
      user,
      request,
    );
    expect(access.getAvailability).toHaveBeenCalledWith(scoped, 'org-active');
    expect(trello.buildAuthorizeUrl).toHaveBeenCalledWith(
      scoped,
      'org-active',
      'https://qa.tino.test',
    );
    expect(trello.listBoards).toHaveBeenCalledWith(scoped, 'org-active', 't');
    expect(trello.connect).toHaveBeenCalledWith(
      connectDto,
      scoped,
      'org-active',
    );
  });

  it('wraps the project connection in an object', async () => {
    await expect(
      controller.projectConnection('project-1', user, request),
    ).resolves.toEqual({ connection: null });
    expect(connections.findByProject).toHaveBeenCalledWith(
      scoped,
      'org-active',
      'project-1',
    );
  });

  it('disconnects through the Trello flow so the webhook is removed', async () => {
    await expect(
      controller.disconnect('project-1', user, request),
    ).resolves.toEqual({ disconnected: true });
    expect(trello.disconnect).toHaveBeenCalledWith(
      scoped,
      'org-active',
      'project-1',
    );
    expect(connections.disconnect).not.toHaveBeenCalled();
  });

  it('propagates the access error of a disconnect', async () => {
    trello.disconnect.mockRejectedValue(new ForbiddenException());

    await expect(
      controller.disconnect('project-1', user, request),
    ).rejects.toThrow(ForbiddenException);
  });

  it('runs the manual sync of a project', async () => {
    await expect(
      controller.syncNow('project-1', user, request),
    ).resolves.toEqual({ created: 1 });
    expect(reconcile.reconcileProject).toHaveBeenCalledWith(
      scoped,
      'org-active',
      'project-1',
    );
  });

  it('retries the live sync and updates status mappings', async () => {
    await expect(
      controller.enableLiveSync('project-1', user, request),
    ).resolves.toEqual({ active: true, reason: null });
    expect(trello.enableLiveSync).toHaveBeenCalledWith(
      scoped,
      'org-active',
      'project-1',
    );

    const statusMapping = [
      { externalGroupId: 'l-qa', status: TaskStatus.BLOCKED },
    ];
    await expect(
      controller.updateStatusMappings(
        'project-1',
        { statusMapping },
        user,
        request,
      ),
    ).resolves.toEqual({ updated: 1, tasksUpdated: 2 });
    expect(trello.updateStatusMappings).toHaveBeenCalledWith(
      scoped,
      'org-active',
      'project-1',
      statusMapping,
    );
  });

  describe('DTO validation', () => {
    const errorsFor = async <T extends object>(
      type: new () => T,
      body: Record<string, unknown>,
    ) =>
      validate(plainToInstance(type, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

    it('accepts a complete connect request', async () => {
      await expect(
        errorsFor(TrelloConnectDto, {
          token: 't',
          boardId: 'b',
          mode: 'NEW_PROJECT',
          statusMapping: [{ externalGroupId: 'l1', status: TaskStatus.DONE }],
        }),
      ).resolves.toHaveLength(0);
    });

    it('rejects an invalid status, a missing token and the old apiKey field', async () => {
      const errors = await errorsFor(TrelloConnectDto, {
        boardId: 'b',
        mode: 'NEW_PROJECT',
        apiKey: 'should-not-be-sent',
        statusMapping: [{ externalGroupId: 'l1', status: 'FINISHED' }],
      });

      expect(errors.map((error) => error.property).sort()).toEqual([
        'apiKey',
        'statusMapping',
        'token',
      ]);
    });

    it('rejects a non http return origin', async () => {
      await expect(
        errorsFor(TrelloAuthorizeUrlQueryDto, {
          returnOrigin: 'javascript:alert(1)',
        }),
      ).resolves.toHaveLength(1);
    });
  });
});
