/**
 * Tests del texto del cartel de novedades de Trello: los numeros en una linea y
 * una linea por persona con el tiempo trabajado.
 */
import { TaskStatus } from '@/types/task';
import type { IntegrationActivitySummary } from '@/types/integration';
import {
  describeIntegrationActivity,
  formatActivityMinutes,
  joinActivityList,
} from './integrationActivity';

function summary(overrides: Partial<IntegrationActivitySummary> = {}): IntegrationActivitySummary {
  return {
    since: '2026-09-28T09:00:00.000Z',
    until: '2026-09-29T09:00:00.000Z',
    created: [],
    statusChanges: [],
    archived: [],
    work: [],
    totalMinutes: 0,
    isEmpty: false,
    ...overrides,
  };
}

const task = (taskId: string, title: string) => ({ taskId, title, projectName: 'Web' });
const change = (taskId: string) => ({
  ...task(taskId, taskId),
  fromStatus: TaskStatus.TODO,
  toStatus: TaskStatus.DONE,
  actorName: null,
});

describe('integrationActivity', () => {
  it('formats minutes and lists', () => {
    expect(formatActivityMinutes(45)).toBe('45 min');
    expect(formatActivityMinutes(60)).toBe('1 h');
    expect(formatActivityMinutes(130)).toBe('2 h 10 min');
    expect(joinActivityList(['A', 'B', 'C'])).toBe('A, B y C');
    expect(joinActivityList(['A', 'B', 'C', 'D', 'E'], 3)).toBe('A, B, C y 2 más');
  });

  it('describes the numbers in one line and the work per person', () => {
    const result = describeIntegrationActivity(
      summary({
        created: [task('t1', 'Login'), task('t2', 'Pagos'), task('t3', 'API')],
        statusChanges: [change('t4'), change('t5')],
        archived: [task('t6', 'Viejo')],
        work: [
          {
            userId: 'u1',
            name: 'Ana',
            minutes: 130,
            tasks: [
              { taskId: 't1', title: 'Login', minutes: 70 },
              { taskId: 't2', title: 'Pagos', minutes: 60 },
            ],
          },
          { userId: 'u2', name: 'Luis', minutes: 45, tasks: [] },
        ],
      }),
    );

    expect(result).toEqual({
      headline: 'Se agregaron 3 tareas, 2 tareas cambiaron de estado y 1 tarea se archivó.',
      work: ['Ana trabajó 2 h 10 min en Login y Pagos', 'Luis trabajó 45 min'],
    });
  });

  it('uses singular forms and no headline when only time was logged', () => {
    expect(
      describeIntegrationActivity(summary({ created: [task('t1', 'Login')], statusChanges: [change('t2')] }))
        .headline,
    ).toBe('Se agregó 1 tarea y 1 tarea cambió de estado.');

    expect(
      describeIntegrationActivity(
        summary({ work: [{ userId: 'u1', name: 'Ana', minutes: 30, tasks: [] }] }),
      ).headline,
    ).toBeNull();
  });
});
