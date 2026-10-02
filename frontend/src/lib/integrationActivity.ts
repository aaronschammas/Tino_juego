/**
 * Texto del cartel de novedades de Trello (web y Tino Mobile).
 *
 * A diferencia del resumen de WhatsApp, que cuenta el dia en lenguaje natural,
 * el cartel es un aviso corto con los numeros y quien trabajo en que.
 *
 * Qué contiene:
 * - `formatActivityMinutes()`: "45 min", "2 h", "2 h 10 min".
 * - `joinActivityList()`: "A, B y C"; con mas de `max` elementos agrega "y N más".
 * - `describeIntegrationActivity()`: devuelve
 *   - `headline`: "Se agregaron 3 tareas, 2 tareas cambiaron de estado y 1 tarea
 *     se archivó." (o `null` si solo hubo tiempo trabajado).
 *   - `work`: una linea por persona, "Ana trabajó 2 h 10 min en Login y Pagos".
 */
import type { IntegrationActivitySummary } from '@/types/integration';

export const ACTIVITY_LIST_MAX = 3;

export function formatActivityMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function joinActivityList(items: string[], max = items.length): string {
  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;
  const parts = hidden > 0 ? [...shown, `${hidden} más`] : shown;
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

export function describeIntegrationActivity(summary: IntegrationActivitySummary): {
  headline: string | null;
  work: string[];
} {
  const tasks = (count: number) => (count === 1 ? '1 tarea' : `${count} tareas`);
  const parts: string[] = [];
  if (summary.created.length > 0) {
    parts.push(
      summary.created.length === 1
        ? 'se agregó 1 tarea'
        : `se agregaron ${summary.created.length} tareas`,
    );
  }
  if (summary.statusChanges.length > 0) {
    const count = summary.statusChanges.length;
    parts.push(`${tasks(count)} ${count === 1 ? 'cambió' : 'cambiaron'} de estado`);
  }
  if (summary.archived.length > 0) {
    const count = summary.archived.length;
    parts.push(`${tasks(count)} ${count === 1 ? 'se archivó' : 'se archivaron'}`);
  }

  const sentence = joinActivityList(parts);
  const headline = sentence ? `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.` : null;

  const work = summary.work.map((worker) => {
    const titles = joinActivityList(
      worker.tasks.map((task) => task.title),
      ACTIVITY_LIST_MAX,
    );
    const where = titles ? ` en ${titles}` : '';
    return `${worker.name} trabajó ${formatActivityMinutes(worker.minutes)}${where}`;
  });

  return { headline, work };
}
