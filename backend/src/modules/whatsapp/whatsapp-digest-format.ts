/**
 * Textos del resumen diario de Trello por WhatsApp.
 *
 * Esta pensado para alguien que no quiere entrar al sistema: cuenta lo general
 * en lenguaje natural, con pocas tareas nombradas por grupo ("y 3 más") para que
 * el mensaje no sea largo ni molesto. Los numeros salen de
 * `IntegrationActivityService.summarize()`; aca solo se redactan.
 *
 * Qué contiene:
 * - `formatMinutes()`: "45 min", "2 h", "2 h 10 min".
 * - `formatDigestMessage()`: el mensaje completo. Arma un parrafo por tema, solo
 *   si hubo algo: tareas nuevas, tareas completadas, otros cambios de estado
 *   (con quien las movio cuando se sabe), archivadas y horas registradas por
 *   persona (con la tarea en la que mas trabajo). Cierra con la ayuda del menu.
 * - `formatDigestHeadline()`: una sola linea con los numeros ("3 tareas nuevas,
 *   2 completadas y 5 h registradas"), para la plantilla de Meta que se usa
 *   cuando la ventana de 24 horas esta cerrada.
 * - `toTemplateParam()`: limpia un texto para usarlo como variable de plantilla
 *   (Meta rechaza saltos de linea, tabulaciones y mas de cuatro espacios seguidos)
 *   y lo recorta.
 * - `joinNatural()` y `listTitles()`: arman listas en castellano ("A, B y C").
 */
import { TaskStatus } from '@prisma/client';
import type { ActivitySummary } from '../integrations/activity/integration-activity.service';
import { MENU_HINT, truncateForWhatsApp } from './whatsapp-formatter';

export const DIGEST_NAMED_ITEMS = 3;
export const TEMPLATE_PARAM_LIMIT = 200;

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  BLOCKED: 'Bloqueada',
  DONE: 'Completada',
};

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function joinNatural(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

export function listTitles(titles: string[]): string {
  const named = titles
    .slice(0, DIGEST_NAMED_ITEMS)
    .map((title) => `*${title}*`);
  const hidden = titles.length - named.length;
  return joinNatural(hidden > 0 ? [...named, `${hidden} más`] : named);
}

export function formatDigestMessage(
  organizationName: string,
  summary: ActivitySummary,
): string {
  const blocks: string[] = [
    `¡Hola! Te cuento las novedades de Trello en *${organizationName}*:`,
  ];

  const created = summary.created.map((task) => task.title);
  if (created.length === 1) {
    blocks.push(`Se sumó una tarea nueva: ${listTitles(created)}.`);
  } else if (created.length > 1) {
    blocks.push(
      `Se sumaron ${created.length} tareas nuevas: ${listTitles(created)}.`,
    );
  }

  const completed = summary.statusChanges.filter(
    (change) => change.toStatus === TaskStatus.DONE,
  );
  if (completed.length === 1) {
    const [change] = completed;
    const who = change.actorName ? ` (la cerró ${change.actorName})` : '';
    blocks.push(`Se completó *${change.title}*${who}.`);
  } else if (completed.length > 1) {
    blocks.push(
      `Se completaron ${completed.length} tareas: ${listTitles(completed.map((change) => change.title))}.`,
    );
  }

  const moved = summary.statusChanges.filter(
    (change) => change.toStatus !== TaskStatus.DONE,
  );
  if (moved.length > 0) {
    const described = moved.slice(0, DIGEST_NAMED_ITEMS).map((change) => {
      const who = change.actorName ? ` (la movió ${change.actorName})` : '';
      return `*${change.title}* pasó a ${STATUS_LABELS[change.toStatus]}${who}`;
    });
    const hidden = moved.length - described.length;
    const list = joinNatural(
      hidden > 0 ? [...described, `${hidden} más cambiaron`] : described,
    );
    blocks.push(
      moved.length === 1
        ? `${list}.`
        : `${moved.length} tareas cambiaron de estado: ${list}.`,
    );
  }

  const archived = summary.archived.map((task) => task.title);
  if (archived.length === 1) {
    blocks.push(`Se archivó ${listTitles(archived)}.`);
  } else if (archived.length > 1) {
    blocks.push(`Se archivaron ${archived.length} tareas.`);
  }

  if (summary.work.length > 0) {
    const people = summary.work.slice(0, DIGEST_NAMED_ITEMS).map((worker) => {
      const top = worker.tasks[0];
      const where = top ? ` (sobre todo en *${top.title}*)` : '';
      return `${worker.name}, ${formatMinutes(worker.minutes)}${where}`;
    });
    const hidden = summary.work.length - people.length;
    const list = hidden > 0 ? [...people, `${hidden} personas más`] : people;
    blocks.push(
      `El equipo registró ${formatMinutes(summary.totalMinutes)} en estas tareas: ${list.join('; ')}.`,
    );
  }

  blocks.push(MENU_HINT);
  return truncateForWhatsApp(blocks.join('\n\n'));
}

export function formatDigestHeadline(summary: ActivitySummary): string {
  const completed = summary.statusChanges.filter(
    (change) => change.toStatus === TaskStatus.DONE,
  ).length;
  const moved = summary.statusChanges.length - completed;
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

  const parts: string[] = [];
  if (summary.created.length > 0) {
    parts.push(plural(summary.created.length, 'tarea nueva', 'tareas nuevas'));
  }
  if (completed > 0) {
    parts.push(plural(completed, 'completada', 'completadas'));
  }
  if (moved > 0) {
    parts.push(plural(moved, 'cambio de estado', 'cambios de estado'));
  }
  if (summary.archived.length > 0) {
    parts.push(plural(summary.archived.length, 'archivada', 'archivadas'));
  }
  if (summary.totalMinutes > 0) {
    parts.push(`${formatMinutes(summary.totalMinutes)} registradas`);
  }
  return parts.length > 0 ? joinNatural(parts) : 'sin novedades';
}

export function toTemplateParam(
  text: string,
  limit = TEMPLATE_PARAM_LIMIT,
): string {
  const clean = text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}
