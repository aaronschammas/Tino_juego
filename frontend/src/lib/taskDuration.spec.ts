import { MAX_TASK_TOTAL_MINUTES, parseTaskDuration } from './taskDuration';

describe('task duration limits', () => {
  it.each([
    ['0', '0', 0],
    ['0', '59', 59],
    ['999', '59', MAX_TASK_TOTAL_MINUTES],
  ])('accepts %s h %s min', (hours, minutes, expected) => {
    expect(parseTaskDuration(hours, minutes)).toBe(expected);
  });

  it.each([
    ['1000', '0'], ['0', '60'], ['-1', '0'], ['1.5', '0'], ['1e2', '0'],
    ['9'.repeat(10_000), '0'],
  ])('rejects %s h %s min', (hours, minutes) => {
    expect(parseTaskDuration(hours, minutes)).toBeNull();
  });
});
