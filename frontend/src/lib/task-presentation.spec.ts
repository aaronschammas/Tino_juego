import { dueDatePresentation } from './task-presentation';
describe('task presentation', () => {
  it('does not invent a due date and identifies an old date as overdue', () => {
    expect(dueDatePresentation(null)).toBeNull();
    expect(dueDatePresentation('2020-01-01T00:00:00.000Z')?.overdue).toBe(true);
  });
});
