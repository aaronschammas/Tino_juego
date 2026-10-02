export type AssistantIntent =
  | 'today_summary'
  | 'weekly_summary'
  | 'overdue_tasks'
  | 'unassigned_tasks'
  | 'active_timers'
  | 'top_project_by_time'
  | 'workload_by_user'
  | 'meeting_summary'
  | 'project_risk'
  | 'unknown';

export function normalizeAssistantQuery(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const rules: Array<{ intent: AssistantIntent; patterns: RegExp[] }> = [
  {
    intent: 'meeting_summary',
    patterns: [/resumen.*reunion/, /mostrar.*reunion/, /resumen.*cliente/],
  },
  {
    intent: 'project_risk',
    patterns: [/proyecto.*riesgo/, /revisar primero/, /donde hay problemas/],
  },
  {
    intent: 'unassigned_tasks',
    patterns: [/tareas?.*sin responsable/, /tareas?.*no tienen responsable/],
  },
  {
    intent: 'active_timers',
    patterns: [/timers?.*activos?/, /quien.*trabajando ahora/],
  },
  {
    intent: 'top_project_by_time',
    patterns: [
      /proyecto.*mas (tiempo|horas)/,
      /donde se fue.*tiempo/,
      /proyecto.*consumio.*tiempo/,
    ],
  },
  {
    intent: 'workload_by_user',
    patterns: [/quien.*mas (carga|tareas)/, /carga.*equipo/],
  },
  { intent: 'overdue_tasks', patterns: [/tareas?.*(atrasadas|vencidas)/] },
  {
    intent: 'weekly_summary',
    patterns: [
      /resumen semanal/,
      /que hicimos.*semana/,
      /cuantas horas.*semana/,
    ],
  },
  { intent: 'today_summary', patterns: [/que paso hoy/, /resumen de hoy/] },
];

export function detectAssistantIntent(value: string) {
  const normalized = normalizeAssistantQuery(value);
  const match = rules.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalized)),
  );
  return {
    intent: match?.intent ?? 'unknown',
    confidence: match ? 0.95 : 0.2,
    normalized,
  };
}
