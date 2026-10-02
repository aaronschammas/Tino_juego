/**
 * Tests de la importacion manual de SUPERADMIN: importacion en una transaccion,
 * que la API key salga del servidor (el SUPERADMIN solo manda el token que le
 * dio Trello al autorizar) y la URL de la ventana de autorizacion.
 */
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationsConfig } from 'src/modules/integrations/integrations.config';
import {
  TrelloExecuteImportDto,
  TrelloImportMode,
  TrelloPreviewDto,
} from './dto/trello-import.dto';
import { TrelloImportService } from './trello-import.service';
import { TrelloClient } from 'src/modules/integrations/providers/trello/trello.client';
import { TrelloAdapter } from 'src/modules/integrations/providers/trello/trello.adapter';
import { IntegrationSyncService } from 'src/modules/integrations/sync/integration-sync.service';

describe('TrelloImportService', () => {
  const user = {
    id: 'user-1',
    organizationId: 'org-1',
    role: 'SUPERADMIN',
  };
  const dto: TrelloExecuteImportDto = {
    token: 'test-token',
    boardId: 'board-1',
    mode: TrelloImportMode.NEW_PROJECT,
  };
  const serverApiKey = 'server-api-key';
  const board = {
    id: 'board-1',
    name: 'Board',
    desc: 'Description',
    url: 'https://trello.example/board-1',
    closed: false,
  };
  const lists = [{ id: 'list-1', name: 'To do', closed: false }];
  const cards = [
    {
      id: 'card-1',
      name: 'Card',
      desc: 'Card description',
      idList: 'list-1',
      closed: false,
      url: 'https://trello.example/card-1',
      labels: [],
      checklists: [
        {
          name: 'Checklist',
          checkItems: [
            { id: 'check-1', name: 'Check item', state: 'incomplete' },
          ],
        },
      ],
    },
  ];

  let service: TrelloImportService;
  let prisma: any;
  let tx: any;
  let trello: {
    getBoard: jest.Mock;
    getLists: jest.Mock;
    getCards: jest.Mock;
    listBoards: jest.Mock;
  };
  let planPolicy: any;
  let committedState: { projects: any[]; tasks: any[] };
  let rollbackSpy: jest.Mock;

  beforeEach(() => {
    committedState = { projects: [], tasks: [] };
    rollbackSpy = jest.fn();
    tx = {
      project: {
        create: jest.fn(async ({ data }) => {
          const project = { id: 'project-1', name: data.name, ...data };
          committedState.projects.push(project);
          return { id: project.id, name: project.name };
        }),
      },
      projectMember: { create: jest.fn().mockResolvedValue({}) },
      task: {
        create: jest.fn(),
        createMany: jest.fn(async ({ data }) => {
          for (const item of data) {
            committedState.tasks.push({
              id: `task-${committedState.tasks.length + 1}`,
              ...item,
            });
          }
          return { count: data.length };
        }),
        findMany: jest.fn(async () =>
          committedState.tasks
            .filter((task) => task.externalSource === 'TRELLO_CARD')
            .map((task) => ({ id: task.id, externalId: task.externalId })),
        ),
      },
    };
    prisma = {
      project: { findFirst: jest.fn().mockResolvedValue(null) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback, options) => {
        const snapshot = structuredClone(committedState);
        try {
          return await callback(tx);
        } catch (error) {
          committedState = snapshot;
          rollbackSpy();
          throw error;
        }
      }),
    };
    trello = {
      getBoard: jest.fn().mockResolvedValue(board),
      getLists: jest.fn().mockResolvedValue(lists),
      getCards: jest.fn().mockResolvedValue(cards),
      listBoards: jest.fn().mockResolvedValue([board]),
    };
    planPolicy = {
      assertCanCreateProject: jest.fn().mockResolvedValue(undefined),
    };
    service = build({ TRELLO_API_KEY: serverApiKey });
  });

  function build(env: NodeJS.ProcessEnv) {
    return new TrelloImportService(
      new TrelloAdapter(trello as unknown as TrelloClient),
      new IntegrationSyncService(prisma as PrismaService),
      planPolicy as PlanPolicyService,
      new IntegrationsConfig(env),
    );
  }

  it('calls Trello with the server API key and the token of the authorization', async () => {
    await service.listBoards({ token: 'user-token' }, user);
    await service.preview(dto, user);

    expect(trello.listBoards).toHaveBeenCalledWith({
      apiKey: serverApiKey,
      token: 'user-token',
    });
    expect(trello.getBoard).toHaveBeenCalledWith('board-1', {
      apiKey: serverApiKey,
      token: 'test-token',
    });
  });

  it('builds a one hour, read only authorization URL for the frontend origin', () => {
    const { url } = service.buildAuthorizeUrl(
      user,
      'https://qa.tino.test/projects',
    );
    const params = new URL(url).searchParams;

    expect(url.startsWith('https://trello.com/1/authorize?')).toBe(true);
    expect(params.get('key')).toBe(serverApiKey);
    expect(params.get('expiration')).toBe('1hour');
    expect(params.get('scope')).toBe('read');
    expect(params.get('callback_method')).toBe('fragment');
    expect(params.get('return_url')).toBe(
      'https://qa.tino.test/integrations/trello/callback',
    );
  });

  it('reports whether the Trello authorization is available', () => {
    expect(service.getConnectionStatus(user)).toEqual(
      expect.objectContaining({ authorizationReady: true, status: 'READY' }),
    );
    expect(build({}).getConnectionStatus(user)).toEqual(
      expect.objectContaining({
        authorizationReady: false,
        status: 'NOT_CONFIGURED',
      }),
    );
  });

  it('answers 503 when the server has no Trello API key', async () => {
    const unconfigured = build({});

    expect(() =>
      unconfigured.buildAuthorizeUrl(user, 'https://qa.tino.test'),
    ).toThrow(ServiceUnavailableException);
    await expect(
      unconfigured.listBoards({ token: 'user-token' }, user),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(trello.listBoards).not.toHaveBeenCalled();
  });

  it('only lets SUPERADMIN ask for the authorization URL', () => {
    expect(() =>
      service.buildAuthorizeUrl(
        { ...user, role: 'ADMIN' },
        'https://qa.tino.test',
      ),
    ).toThrow(ForbiddenException);
  });

  it('imports a small board with project, task and subtask', async () => {
    const result = await service.executeImport(dto, user);

    expect(result.result).toEqual(
      expect.objectContaining({
        createdProject: true,
        createdTasks: 1,
        createdSubtasks: 1,
      }),
    );
    expect(committedState.projects).toHaveLength(1);
    expect(committedState.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalSource: 'TRELLO_CARD',
          externalId: 'card-1',
          status: TaskStatus.TODO,
          priority: Priority.MEDIUM,
        }),
        expect.objectContaining({
          externalSource: 'TRELLO_CHECKLIST_ITEM',
          externalId: 'check-1',
          parentTaskId: expect.any(String),
        }),
      ]),
    );
  });

  it('uses awaited bulk writes instead of detached task.create calls', async () => {
    await service.executeImport(dto, user);

    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.task.createMany).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    });
  });

  it('rolls back project data when parent task creation fails', async () => {
    tx.task.createMany.mockRejectedValueOnce(
      new Error('Prisma parent failure'),
    );

    await expect(service.executeImport(dto, user)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(rollbackSpy).toHaveBeenCalled();
    expect(committedState).toEqual({ projects: [], tasks: [] });
  });

  it('rolls back project and parent tasks when subtask creation fails', async () => {
    tx.task.createMany
      .mockImplementationOnce(async ({ data }) => {
        committedState.tasks.push(
          ...data.map((item, index) => ({ id: `parent-${index}`, ...item })),
        );
        return { count: data.length };
      })
      .mockRejectedValueOnce(new Error('Prisma subtask failure'));

    await expect(service.executeImport(dto, user)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(rollbackSpy).toHaveBeenCalled();
    expect(committedState).toEqual({ projects: [], tasks: [] });
  });

  it('does not expose raw Prisma errors', async () => {
    tx.task.createMany.mockRejectedValueOnce(
      new Error('Invalid prisma.task.create invocation: Transaction not found'),
    );

    await expect(service.executeImport(dto, user)).rejects.toMatchObject({
      response: {
        message: 'No se pudo completar la importación desde Trello.',
      },
    });
  });

  it('does not log Trello credentials when the transaction fails', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    tx.task.createMany.mockRejectedValueOnce(new Error('Database failed'));

    await expect(service.executeImport(dto, user)).rejects.toThrow();

    const logged = loggerSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain(serverApiKey);
    expect(logged).not.toContain(dto.token);
    loggerSpy.mockRestore();
  });

  it('allows SUPERADMIN to import', async () => {
    await expect(service.executeImport(dto, user)).resolves.toBeDefined();
  });

  it('rejects non-SUPERADMIN users before calling Trello', async () => {
    await expect(
      service.executeImport(dto, { ...user, role: 'ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
    expect(trello.getBoard).not.toHaveBeenCalled();
  });

  it('returns a controlled conflict for an already imported board', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'existing-project',
      name: 'Board',
    });

    await expect(service.executeImport(dto, user)).rejects.toThrow(
      new ConflictException('Este tablero de Trello ya fue importado'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects the old apiKey field and requires the token', async () => {
    const errors = await validate(
      plainToInstance(TrelloPreviewDto, {
        apiKey: 'pasted-key',
        boardId: 'board-1',
        mode: TrelloImportMode.NEW_PROJECT,
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors.map((error) => error.property).sort()).toEqual([
      'apiKey',
      'token',
    ]);
  });
});
