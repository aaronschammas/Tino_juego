/**
 * Tests del adaptador de Trello con un TrelloClient simulado. El test de
 * credenciales pasa un objeto con forma de DTO (boardId, mode) para comprobar
 * que a Trello solo se envian key y token.
 */
import { Priority, TaskStatus } from '@prisma/client';
import { TrelloAdapter } from './trello.adapter';
import { TrelloClient } from './trello.client';
import { TRELLO_SOURCES } from './trello.types';

describe('TrelloAdapter', () => {
  const credentials = { apiKey: 'key', token: 'token' };
  const board = {
    id: 'board-1',
    name: 'Board',
    desc: '',
    url: 'https://trello.example/board-1',
    closed: false,
  };
  let client: jest.Mocked<
    Pick<
      TrelloClient,
      'listBoards' | 'getBoard' | 'getLists' | 'getCards' | 'getBoardComments'
    >
  >;
  let adapter: TrelloAdapter;

  beforeEach(() => {
    client = {
      listBoards: jest
        .fn()
        .mockResolvedValue([
          board,
          { ...board, id: 'board-closed', closed: true },
        ]),
      getBoard: jest.fn().mockResolvedValue(board),
      getBoardComments: jest.fn().mockResolvedValue([
        {
          id: 'act-1',
          type: 'commentCard',
          date: '2026-09-20T10:00:00.000Z',
          memberCreator: { fullName: 'Ana Trello' },
          data: { card: { id: 'card-doing' }, text: 'Primer comentario' },
        },
        { id: 'act-2', type: 'commentCard', data: { text: 'Sin tarjeta' } },
      ]),
      getLists: jest.fn().mockResolvedValue([
        { id: 'list-todo', name: 'Por hacer', closed: false },
        { id: 'list-doing', name: 'En progreso', closed: false },
        { id: 'list-qa', name: 'QA', closed: false },
        { id: 'list-old', name: 'Viejo', closed: true },
      ]),
      getCards: jest.fn().mockResolvedValue([
        {
          id: 'card-doing',
          name: 'Doing card',
          desc: '  Detalle  ',
          idList: 'list-doing',
          closed: false,
          url: 'https://trello.example/card-doing',
          labels: [{ name: 'Alta', color: 'yellow' }],
          due: '2026-10-01T12:00:00.000Z',
        },
        {
          id: 'card-qa',
          name: '',
          idList: 'list-qa',
          closed: false,
          labels: [],
        },
        {
          id: 'card-done',
          name: 'Due complete',
          idList: 'list-todo',
          dueComplete: true,
          closed: false,
          labels: [],
        },
        {
          id: 'card-closed',
          name: 'Archived',
          idList: 'list-todo',
          closed: true,
        },
      ]),
    };
    adapter = new TrelloAdapter(client as unknown as TrelloClient);
  });

  it('exposes the Trello external sources', () => {
    expect(adapter.provider).toBe('TRELLO');
    expect(adapter.sources).toEqual(TRELLO_SOURCES);
  });

  it('lists only open boards as normalized containers', async () => {
    await expect(adapter.listContainers(credentials)).resolves.toEqual([
      {
        externalId: 'board-1',
        name: 'Board',
        description: '',
        url: 'https://trello.example/board-1',
      },
    ]);
  });

  it('forwards only apiKey and token to the Trello client', async () => {
    const dto = { ...credentials, boardId: 'board-1', mode: 'NEW_PROJECT' };
    await adapter.fetchSnapshot('board-1', dto);

    expect(client.getBoard).toHaveBeenCalledWith('board-1', credentials);
    expect(client.getLists).toHaveBeenCalledWith('board-1', credentials);
    expect(client.getCards).toHaveBeenCalledWith('board-1', credentials);
  });

  it('builds a snapshot without closed lists or cards', async () => {
    const snapshot = await adapter.fetchSnapshot('board-1', credentials);

    expect(snapshot.container.externalId).toBe('board-1');
    expect(snapshot.groups.map((group) => group.externalId)).toEqual([
      'list-todo',
      'list-doing',
      'list-qa',
    ]);
    expect(snapshot.items.map((item) => item.externalId)).toEqual([
      'card-doing',
      'card-qa',
      'card-done',
    ]);
  });

  it('maps list, labels, due date and description of a card', async () => {
    const snapshot = await adapter.fetchSnapshot('board-1', credentials);
    const card = snapshot.items[0];

    expect(card).toEqual(
      expect.objectContaining({
        title: 'Doing card',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        dueDate: new Date('2026-10-01T12:00:00.000Z'),
        externalUrl: 'https://trello.example/card-doing',
        groupExternalId: 'list-doing',
        groupName: 'En progreso',
        isCompleted: false,
        sourceDescription: 'Detalle',
        statusWarning: undefined,
        description:
          'Detalle\n\nLista Trello original: En progreso\n\nURL Trello: https://trello.example/card-doing',
      }),
    );
  });

  it('falls back to TODO with a warning when the list has no equivalent', async () => {
    const snapshot = await adapter.fetchSnapshot('board-1', credentials);
    const card = snapshot.items[1];

    expect(card.title).toBe('Tarjeta sin titulo');
    expect(card.status).toBe(TaskStatus.TODO);
    expect(card.statusWarning).toBe('La lista "QA" se importara como TODO');
  });

  it('marks cards with a completed due date as DONE', async () => {
    const snapshot = await adapter.fetchSnapshot('board-1', credentials);

    expect(snapshot.items[2].status).toBe(TaskStatus.DONE);
    expect(snapshot.items[2].isCompleted).toBe(true);
  });

  it('turns checklist items into sub items', () => {
    expect(
      adapter.normalizeChecklistItems([
        {
          name: 'Deploy',
          checkItems: [
            { id: 'c1', name: 'Build', state: 'complete' },
            { id: 'c2', name: '', state: 'incomplete' },
          ],
        },
        { checkItems: [{ id: 'c3', name: 'Sin nombre', state: 'incomplete' }] },
      ]),
    ).toEqual([
      {
        externalId: 'c1',
        title: 'Build',
        description: 'Checklist Trello: Deploy',
        groupName: 'Deploy',
        status: TaskStatus.DONE,
      },
      {
        externalId: 'c2',
        title: 'Item sin titulo',
        description: 'Checklist Trello: Deploy',
        groupName: 'Deploy',
        status: TaskStatus.TODO,
      },
      {
        externalId: 'c3',
        title: 'Sin nombre',
        description: 'Checklist Trello: Checklist',
        groupName: 'Checklist',
        status: TaskStatus.TODO,
      },
    ]);
  });

  it.each([
    [[{ name: 'Crítica' }], Priority.CRITICAL],
    [[{ color: 'red' }], Priority.CRITICAL],
    [[{ name: 'high' }], Priority.HIGH],
    [[{ color: 'orange' }], Priority.HIGH],
    [[{ name: 'Baja' }], Priority.LOW],
    [[{ color: 'green' }], Priority.LOW],
    [[{ name: 'Otro', color: 'blue' }], Priority.MEDIUM],
    [[], Priority.MEDIUM],
  ])('maps labels %j to priority %s', (labels, expected) => {
    expect(adapter.priorityFromLabels(labels)).toBe(expected);
  });

  it('does not download comments unless asked', async () => {
    const snapshot = await adapter.fetchSnapshot('board-1', credentials);

    expect(client.getBoardComments).not.toHaveBeenCalled();
    expect(snapshot.comments).toBeUndefined();
  });

  it('includes the board comments when connecting', async () => {
    const snapshot = await adapter.fetchSnapshot('board-1', credentials, {
      includeComments: true,
    });

    expect(client.getBoardComments).toHaveBeenCalledWith(
      'board-1',
      credentials,
    );
    expect(snapshot.comments).toEqual([
      {
        externalId: 'act-1',
        itemExternalId: 'card-doing',
        text: 'Primer comentario',
        authorName: 'Ana Trello',
        createdAt: new Date('2026-09-20T10:00:00.000Z'),
      },
    ]);
  });
});
