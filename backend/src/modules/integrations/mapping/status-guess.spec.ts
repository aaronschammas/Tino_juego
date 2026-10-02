import { TaskStatus } from '@prisma/client';
import { guessTaskStatus, normalizeText } from './status-guess';

describe('status-guess', () => {
  it('normalizes case, accents and surrounding spaces', () => {
    expect(normalizeText('  Crítica EN Progreso ')).toBe('critica en progreso');
  });

  it.each([
    ['To do', TaskStatus.TODO],
    ['Pendiente', TaskStatus.TODO],
    ['En progreso', TaskStatus.IN_PROGRESS],
    ['DOING', TaskStatus.IN_PROGRESS],
    ['Bloqueada', TaskStatus.BLOCKED],
    ['Finalizado', TaskStatus.DONE],
    ['hecho', TaskStatus.DONE],
  ])('maps "%s" to %s', (name, expected) => {
    expect(guessTaskStatus(name)).toBe(expected);
  });

  it('returns null when there is no equivalent status', () => {
    expect(guessTaskStatus('Backlog QA')).toBeNull();
  });

  it('only matches full names, not partial words', () => {
    expect(guessTaskStatus('Done por revisar')).toBeNull();
  });
});
