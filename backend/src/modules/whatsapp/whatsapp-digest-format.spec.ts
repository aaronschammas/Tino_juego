/**
 * Tests de los textos del resumen diario de Trello: que cuenten lo general en
 * lenguaje natural, que no nombren demasiadas tareas y que la linea de la
 * plantilla de Meta respete sus reglas.
 */
import { TaskStatus } from '@prisma/client';
import type { ActivitySummary } from '../integrations/activity/integration-activity.service';
import {
  formatDigestHeadline,
  formatDigestMessage,
  formatMinutes,
  joinNatural,
  listTitles,
  toTemplateParam,
} from './whatsapp-digest-format';
import { MENU_HINT } from './whatsapp-formatter';

function summary(overrides: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    since: new Date('2026-09-28T09:00:00.000Z'),
    until: new Date('2026-09-29T09:00:00.000Z'),
    created: [],
    statusChanges: [],
    archived: [],
    work: [],
    totalMinutes: 0,
    isEmpty: false,
    ...overrides,
  };
}

const ref = (taskId: string, title: string) => ({
  taskId,
  title,
  projectName: 'Web',
});

describe('whatsapp digest format', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(130)).toBe('2 h 10 min');
  });

  it('joins lists the way people write them', () => {
    expect(joinNatural([])).toBe('');
    expect(joinNatural(['A'])).toBe('A');
    expect(joinNatural(['A', 'B', 'C'])).toBe('A, B y C');
    expect(listTitles(['A', 'B', 'C', 'D', 'E'])).toBe('*A*, *B*, *C* y 2 más');
  });

  it('tells the day in natural language, one paragraph per topic', () => {
    const text = formatDigestMessage(
      'Empresa',
      summary({
        created: [ref('t1', 'Login'), ref('t2', 'Pagos')],
        statusChanges: [
          {
            ...ref('t3', 'Diseño'),
            fromStatus: TaskStatus.IN_PROGRESS,
            toStatus: TaskStatus.DONE,
            actorName: 'Luis',
          },
          {
            ...ref('t4', 'API'),
            fromStatus: TaskStatus.TODO,
            toStatus: TaskStatus.IN_PROGRESS,
            actorName: 'Ana',
          },
        ],
        archived: [ref('t5', 'Viejo')],
        work: [
          {
            userId: 'u1',
            name: 'Ana Lopez',
            minutes: 190,
            tasks: [{ taskId: 't4', title: 'API', minutes: 150 }],
          },
          { userId: 'u2', name: 'Luis Diaz', minutes: 45, tasks: [] },
        ],
        totalMinutes: 235,
      }),
    );

    expect(text.split('\n\n')).toEqual([
      '¡Hola! Te cuento las novedades de Trello en *Empresa*:',
      'Se sumaron 2 tareas nuevas: *Login* y *Pagos*.',
      'Se completó *Diseño* (la cerró Luis).',
      '*API* pasó a En progreso (la movió Ana).',
      'Se archivó *Viejo*.',
      'El equipo registró 3 h 55 min en estas tareas: Ana Lopez, 3 h 10 min (sobre todo en *API*); Luis Diaz, 45 min.',
      MENU_HINT,
    ]);
  });

  it('keeps long days short by naming only a few tasks', () => {
    const moved = ['A', 'B', 'C', 'D', 'E'].map((title, index) => ({
      ...ref(`t${index}`, title),
      fromStatus: TaskStatus.TODO,
      toStatus: TaskStatus.BLOCKED,
      actorName: null,
    }));
    const text = formatDigestMessage(
      'Empresa',
      summary({
        created: [ref('n1', 'Una')],
        statusChanges: moved,
        archived: [ref('x1', 'X'), ref('x2', 'Y')],
      }),
    );

    expect(text).toContain('Se sumó una tarea nueva: *Una*.');
    expect(text).toContain(
      '5 tareas cambiaron de estado: *A* pasó a Bloqueada, *B* pasó a Bloqueada, *C* pasó a Bloqueada y 2 más cambiaron.',
    );
    expect(text).toContain('Se archivaron 2 tareas.');
    expect(text).not.toContain('*D*');
  });

  it('builds a one line headline with the numbers', () => {
    expect(
      formatDigestHeadline(
        summary({
          created: [ref('t1', 'A'), ref('t2', 'B'), ref('t3', 'C')],
          statusChanges: [
            {
              ...ref('t4', 'D'),
              fromStatus: TaskStatus.TODO,
              toStatus: TaskStatus.DONE,
              actorName: null,
            },
            {
              ...ref('t5', 'E'),
              fromStatus: TaskStatus.TODO,
              toStatus: TaskStatus.BLOCKED,
              actorName: null,
            },
          ],
          archived: [ref('t6', 'F')],
          totalMinutes: 320,
        }),
      ),
    ).toBe(
      '3 tareas nuevas, 1 completada, 1 cambio de estado, 1 archivada y 5 h 20 min registradas',
    );
    expect(formatDigestHeadline(summary())).toBe('sin novedades');
  });

  it('cleans template variables the way Meta requires', () => {
    expect(toTemplateParam('Línea 1\nLínea 2\t  con     espacios')).toBe(
      'Línea 1 Línea 2 con espacios',
    );
    expect(toTemplateParam('x'.repeat(300))).toHaveLength(200);
  });
});
