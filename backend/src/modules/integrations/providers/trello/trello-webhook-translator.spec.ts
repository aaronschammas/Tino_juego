/**
 * Tests del traductor de acciones de Trello. Usa el adaptador real con un
 * TrelloClient simulado (para las acciones que descargan la tarjeta completa) y
 * acciones con la misma forma que manda el webhook de Trello.
 */
import { Priority, TaskStatus } from '@prisma/client';
import { TrelloAdapter } from './trello.adapter';
import { TrelloClient } from './trello.client';
import { TrelloAction, TrelloCard } from './trello.types';
import { TrelloWebhookTranslator } from './trello-webhook-translator';

describe('TrelloWebhookTranslator', () => {
  const credentials = { apiKey: 'key', token: 'tok' };
  const fullCard: TrelloCard = {
    id: 'card-1',
    name: 'Tarjeta',
    desc: 'Detalle',
    idList: 'list-doing',
    url: 'https://trello.com/c/1',
    labels: [{ name: 'Alta', color: 'orange' }],
    checklists: [
      {
        name: 'Pasos',
        checkItems: [{ id: 'ci-1', name: 'Uno', state: 'complete' }],
      },
    ],
  };
  const action = (
    type: string,
    data: TrelloAction['data'],
    extra: Partial<TrelloAction> = {},
  ): TrelloAction => ({
    id: 'act-1',
    type,
    date: '2026-09-25T12:00:00.000Z',
    idMemberCreator: 'member-1',
    memberCreator: { id: 'member-1', fullName: 'Ana Trello' },
    data,
    ...extra,
  });
  let client: { getCard: jest.Mock };
  let translator: TrelloWebhookTranslator;

  beforeEach(() => {
    client = { getCard: jest.fn().mockResolvedValue(fullCard) };
    translator = new TrelloWebhookTranslator(
      client as unknown as TrelloClient,
      new TrelloAdapter(client as unknown as TrelloClient),
    );
  });

  it('downloads a created card and translates it completely', async () => {
    const [change] = await translator.translate(
      action('createCard', {
        card: { id: 'card-1', name: 'Tarjeta' },
        list: { id: 'list-doing', name: 'En progreso' },
      }),
      credentials,
    );

    expect(client.getCard).toHaveBeenCalledWith('card-1', credentials);
    expect(change).toMatchObject({
      kind: 'ITEM_CREATED',
      item: {
        externalId: 'card-1',
        groupExternalId: 'list-doing',
        groupName: 'En progreso',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        subItems: [{ externalId: 'ci-1' }],
      },
    });
  });

  it('turns a rename into a title-only update', async () => {
    await expect(
      translator.translate(
        action('updateCard', {
          card: { id: 'card-1', name: 'Nuevo nombre', desc: 'no cambio' },
          old: { name: 'Viejo' },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { title: 'Nuevo nombre' },
      },
    ]);
    expect(client.getCard).not.toHaveBeenCalled();
  });

  it('registers the destination list and moves the card', async () => {
    await expect(
      translator.translate(
        action('updateCard', {
          card: { id: 'card-1', idList: 'list-qa' },
          old: { idList: 'list-doing' },
          listBefore: { id: 'list-doing', name: 'En progreso' },
          listAfter: { id: 'list-qa', name: 'QA' },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      { kind: 'GROUP_UPSERTED', externalId: 'list-qa', name: 'QA' },
      {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { groupExternalId: 'list-qa' },
      },
    ]);
  });

  it('translates description, due date and completion changes', async () => {
    const [change] = await translator.translate(
      action('updateCard', {
        card: {
          id: 'card-1',
          desc: '  ',
          due: '2026-10-01T00:00:00.000Z',
          dueComplete: true,
        },
        old: { desc: 'algo', due: null, dueComplete: false },
      }),
      credentials,
    );

    expect(change).toEqual({
      kind: 'ITEM_UPDATED',
      externalId: 'card-1',
      changes: {
        description: null,
        dueDate: new Date('2026-10-01T00:00:00.000Z'),
        isCompleted: true,
      },
    });
  });

  it('clears the due date', async () => {
    const [change] = await translator.translate(
      action('updateCard', {
        card: { id: 'card-1', due: null },
        old: { due: '2026-10-01T00:00:00.000Z' },
      }),
      credentials,
    );

    expect(change).toEqual(
      expect.objectContaining({ changes: { dueDate: null } }),
    );
  });

  it.each([
    ['archive', true],
    ['restore', false],
  ])('translates an %s', async (_label, closed) => {
    await expect(
      translator.translate(
        action('updateCard', {
          card: { id: 'card-1', closed },
          old: { closed: !closed },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      { kind: 'ITEM_ARCHIVED', externalId: 'card-1', archived: closed },
    ]);
  });

  it.each(['deleteCard', 'moveCardFromBoard'])(
    'archives a card on %s',
    async (type) => {
      await expect(
        translator.translate(
          action(type, { card: { id: 'card-1' } }),
          credentials,
        ),
      ).resolves.toEqual([
        { kind: 'ITEM_ARCHIVED', externalId: 'card-1', archived: true },
      ]);
    },
  );

  it('recalculates only the priority when labels change', async () => {
    await expect(
      translator.translate(
        action('addLabelToCard', { card: { id: 'card-1' } }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { priority: Priority.HIGH },
      },
    ]);
  });

  it('resyncs sub tasks when a checklist item is added', async () => {
    await expect(
      translator.translate(
        action('createCheckItem', {
          card: { id: 'card-1' },
          checklist: { id: 'cl-1', name: 'Pasos' },
          checkItem: { id: 'ci-1', name: 'Uno' },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'SUBITEMS_SYNCED',
        itemExternalId: 'card-1',
        subItems: [
          {
            externalId: 'ci-1',
            title: 'Uno',
            description: 'Checklist Trello: Pasos',
            groupName: 'Pasos',
            status: TaskStatus.DONE,
          },
        ],
      },
    ]);
  });

  it('updates the state of a checked item', async () => {
    await expect(
      translator.translate(
        action('updateCheckItemStateOnCard', {
          card: { id: 'card-1' },
          checkItem: { id: 'ci-1', name: 'Uno', state: 'complete' },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'SUBITEM_UPDATED',
        externalId: 'ci-1',
        changes: { status: TaskStatus.DONE },
      },
    ]);
  });

  it('updates the name of a renamed item', async () => {
    await expect(
      translator.translate(
        action('updateCheckItem', {
          card: { id: 'card-1' },
          checkItem: { id: 'ci-1', name: 'Nuevo', state: 'incomplete' },
          old: { name: 'Viejo' },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'SUBITEM_UPDATED',
        externalId: 'ci-1',
        changes: { title: 'Nuevo' },
      },
    ]);
  });

  it('translates new, edited and deleted comments', async () => {
    await expect(
      translator.translate(
        action('commentCard', { card: { id: 'card-1' }, text: 'Hola' }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'COMMENT_UPSERTED',
        externalId: 'act-1',
        itemExternalId: 'card-1',
        text: 'Hola',
        authorName: 'Ana Trello',
        createdAt: new Date('2026-09-25T12:00:00.000Z'),
      },
    ]);

    await expect(
      translator.translate(
        action('updateComment', {
          card: { id: 'card-1' },
          action: { id: 'act-0', text: 'Editado' },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'COMMENT_UPSERTED',
        externalId: 'act-0',
        itemExternalId: 'card-1',
        text: 'Editado',
        authorName: 'Ana Trello',
      },
    ]);

    await expect(
      translator.translate(
        action('deleteComment', {
          card: { id: 'card-1' },
          action: { id: 'act-0' },
        }),
        credentials,
      ),
    ).resolves.toEqual([{ kind: 'COMMENT_DELETED', externalId: 'act-0' }]);
  });

  it('registers created and renamed lists but ignores archived ones', async () => {
    await expect(
      translator.translate(
        action('createList', { list: { id: 'list-new', name: 'Revision' } }),
        credentials,
      ),
    ).resolves.toEqual([
      { kind: 'GROUP_UPSERTED', externalId: 'list-new', name: 'Revision' },
    ]);
    await expect(
      translator.translate(
        action('updateList', {
          list: { id: 'list-new', name: 'Revisión final' },
          old: { name: 'Revision' },
        }),
        credentials,
      ),
    ).resolves.toEqual([
      {
        kind: 'GROUP_UPSERTED',
        externalId: 'list-new',
        name: 'Revisión final',
      },
    ]);
    await expect(
      translator.translate(
        action('updateList', {
          list: { id: 'list-new', name: 'Revision', closed: true },
          old: { closed: false },
        }),
        credentials,
      ),
    ).resolves.toEqual([]);
  });

  it('ignores unrelated actions', async () => {
    await expect(
      translator.translate(action('addMemberToBoard', {}), credentials),
    ).resolves.toEqual([]);
    await expect(
      translator.translate(
        action('updateCard', { card: { id: 'card-1' }, old: { pos: 1 } }),
        credentials,
      ),
    ).resolves.toEqual([]);
  });

  it('exposes who made the change', () => {
    expect(translator.actorOf(action('commentCard', {}))).toEqual({
      id: 'member-1',
      name: 'Ana Trello',
    });
    expect(
      translator.actorOf(
        action('commentCard', {}, { memberCreator: undefined }),
      ),
    ).toEqual({ id: 'member-1', name: null });
  });
});
