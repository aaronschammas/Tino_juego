/**
 * Menú de consultas que Tino manda por WhatsApp y lectura de lo que el owner toca.
 *
 * El jefe no escribe comandos: toca una opción de una lista interactiva. Cada
 * opción lleva escondido un id con la organización y la intención del asistente,
 * así que al tocarla Tino sabe exactamente qué consultar y sobre qué empresa, sin
 * pasar por las expresiones regulares del texto libre.
 *
 * Qué contiene:
 * - `ASSISTANT_MENU_ITEMS`: las nueve consultas disponibles, cada una atada a una
 *   intención de `assistant-intent.ts`.
 * - `buildQueryMenuRows()`: arma las filas para una organización y agrega la fila
 *   "Cambiar de organización" cuando hay más de una vinculada.
 * - `buildOrganizationMenuRows()`: lista de organizaciones para elegir.
 * - `parseMenuSelection()`: interpreta el id que devuelve WhatsApp.
 * - `MENU_COMMANDS` y `UNLINK_COMMANDS`: palabras que vuelven a mostrar el menú o
 *   desvinculan, para quien prefiere escribir.
 * - `DIGEST_COMMANDS`: palabras que piden el resumen de Trello de las últimas 24
 *   horas (es lo que invita a responder la plantilla del resumen diario). No va
 *   como fila del menú porque las diez filas ya están ocupadas.
 *
 * Los límites vienen de Meta: hasta 10 filas por lista, 24 caracteres de título y
 * 72 de descripción. Por eso los títulos son cortos y el detalle va en la
 * descripción. Hay un test que verifica esos largos.
 */
import type { AssistantIntent } from '../assistant/assistant-intent';
import type { WhatsAppMenuRow } from './whatsapp.types';

export const MENU_ROW_LIMIT = 10;
export const MENU_TITLE_LIMIT = 24;
export const MENU_DESCRIPTION_LIMIT = 72;

export type MenuIntent = Exclude<AssistantIntent, 'unknown'>;

export interface AssistantMenuItem {
  intent: MenuIntent;
  title: string;
  description: string;
}

export const ASSISTANT_MENU_ITEMS: AssistantMenuItem[] = [
  {
    intent: 'today_summary',
    title: 'Resumen de hoy',
    description: 'Horas y tareas del día en tu equipo',
  },
  {
    intent: 'weekly_summary',
    title: 'Resumen de la semana',
    description: 'Horas confirmadas y tareas activas de la semana',
  },
  {
    intent: 'overdue_tasks',
    title: 'Tareas atrasadas',
    description: 'Tareas vencidas sin completar',
  },
  {
    intent: 'unassigned_tasks',
    title: 'Tareas sin responsable',
    description: 'Tareas que nadie tomó todavía',
  },
  {
    intent: 'active_timers',
    title: 'Quién trabaja ahora',
    description: 'Timers activos en este momento',
  },
  {
    intent: 'top_project_by_time',
    title: 'Proyecto con más horas',
    description: 'Dónde se fue el tiempo del período',
  },
  {
    intent: 'workload_by_user',
    title: 'Carga del equipo',
    description: 'Tareas activas y horas por persona',
  },
  {
    intent: 'project_risk',
    title: 'Proyecto a revisar',
    description: 'Dónde hay más atrasos y tareas sin dueño',
  },
  {
    intent: 'meeting_summary',
    title: 'Resumen para reunión',
    description: 'Los números principales para contar en una reunión',
  },
];

export const SWITCH_ORGANIZATION_ID = 'switch';
export const MENU_COMMANDS = ['menu', 'hola', 'ayuda', 'buenas', 'buen dia'];
export const UNLINK_COMMANDS = ['desconectar', 'desvincular'];
export const DIGEST_COMMANDS = [
  'novedades',
  'novedades trello',
  'novedades de trello',
  'resumen trello',
  'resumen de trello',
  'trello',
];

export type MenuSelection =
  | { kind: 'query'; organizationId: string; intent: MenuIntent }
  | { kind: 'organization'; organizationId: string }
  | { kind: 'switch' };

export function buildQueryMenuRows(
  organizationId: string,
  includeSwitch = false,
): WhatsAppMenuRow[] {
  const rows: WhatsAppMenuRow[] = ASSISTANT_MENU_ITEMS.map((item) => ({
    id: `q:${organizationId}:${item.intent}`,
    title: item.title,
    description: item.description,
  }));

  if (includeSwitch) {
    rows.push({
      id: `s:${SWITCH_ORGANIZATION_ID}`,
      title: 'Cambiar de empresa',
      description: 'Consultar sobre otra organización vinculada',
    });
  }

  return rows.slice(0, MENU_ROW_LIMIT);
}

export function buildOrganizationMenuRows(
  organizations: { id: string; name: string }[],
): WhatsAppMenuRow[] {
  return organizations.slice(0, MENU_ROW_LIMIT).map((organization) => ({
    id: `o:${organization.id}`,
    title: organization.name.slice(0, MENU_TITLE_LIMIT),
    description: 'Ver las consultas de esta organización',
  }));
}

export function parseMenuSelection(
  id: string | undefined,
): MenuSelection | null {
  if (!id) return null;

  if (id === `s:${SWITCH_ORGANIZATION_ID}`) return { kind: 'switch' };

  const organizationMatch = /^o:([^:]+)$/.exec(id);
  if (organizationMatch) {
    return { kind: 'organization', organizationId: organizationMatch[1] };
  }

  const queryMatch = /^q:([^:]+):([a-z_]+)$/.exec(id);
  if (!queryMatch) return null;

  const intent = queryMatch[2] as MenuIntent;
  const known = ASSISTANT_MENU_ITEMS.some((item) => item.intent === intent);
  return known
    ? { kind: 'query', organizationId: queryMatch[1], intent }
    : null;
}
