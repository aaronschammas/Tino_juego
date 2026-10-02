import {
  ASSISTANT_MENU_ITEMS,
  buildOrganizationMenuRows,
  buildQueryMenuRows,
  MENU_DESCRIPTION_LIMIT,
  MENU_ROW_LIMIT,
  MENU_TITLE_LIMIT,
  parseMenuSelection,
} from './whatsapp-menu';

describe('whatsapp menu', () => {
  it('respects the Meta limits for interactive lists', () => {
    const rows = buildQueryMenuRows('org-1', true);

    expect(rows.length).toBeLessThanOrEqual(MENU_ROW_LIMIT);
    for (const row of rows) {
      expect(row.title.length).toBeLessThanOrEqual(MENU_TITLE_LIMIT);
      expect((row.description ?? '').length).toBeLessThanOrEqual(
        MENU_DESCRIPTION_LIMIT,
      );
    }
  });

  it('offers every assistant query and hides the switch row with one organization', () => {
    const single = buildQueryMenuRows('org-1');
    const multiple = buildQueryMenuRows('org-1', true);

    expect(single).toHaveLength(ASSISTANT_MENU_ITEMS.length);
    expect(multiple).toHaveLength(ASSISTANT_MENU_ITEMS.length + 1);
    expect(single.some((row) => row.id.startsWith('s:'))).toBe(false);
  });

  it('keeps the organization inside every row id', () => {
    for (const row of buildQueryMenuRows('org-9')) {
      const selection = parseMenuSelection(row.id);

      expect(selection?.kind).toBe('query');
      if (selection?.kind === 'query') {
        expect(selection.organizationId).toBe('org-9');
      }
    }
  });

  it('round-trips each intent through its row id', () => {
    for (const item of ASSISTANT_MENU_ITEMS) {
      expect(parseMenuSelection(`q:org-1:${item.intent}`)).toEqual({
        kind: 'query',
        organizationId: 'org-1',
        intent: item.intent,
      });
    }
  });

  it('reads organization rows and the switch row', () => {
    const rows = buildOrganizationMenuRows([
      { id: 'org-1', name: 'Empresa uno' },
      { id: 'org-2', name: 'Empresa dos' },
    ]);

    expect(rows.map((row) => row.id)).toEqual(['o:org-1', 'o:org-2']);
    expect(parseMenuSelection('o:org-2')).toEqual({
      kind: 'organization',
      organizationId: 'org-2',
    });
    expect(parseMenuSelection('s:switch')).toEqual({ kind: 'switch' });
  });

  it('cuts long organization names to the title limit', () => {
    const rows = buildOrganizationMenuRows([
      { id: 'org-1', name: 'Una organización con un nombre larguísimo' },
    ]);

    expect(rows[0].title.length).toBeLessThanOrEqual(MENU_TITLE_LIMIT);
  });

  it('ignores unknown or malformed ids', () => {
    expect(parseMenuSelection(undefined)).toBeNull();
    expect(parseMenuSelection('q:org-1:inventada')).toBeNull();
    expect(parseMenuSelection('q:org-1:unknown')).toBeNull();
    expect(parseMenuSelection('cualquier-cosa')).toBeNull();
  });
});
