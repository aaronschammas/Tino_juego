import {
  detectAssistantIntent,
  normalizeAssistantQuery,
} from './assistant-intent';

describe('assistant intent parser', () => {
  it('normalizes accents, case and whitespace', () => {
    expect(normalizeAssistantQuery('  QUÉ   pasó HOY? ')).toBe('que paso hoy');
  });

  it.each([
    ['Qué pasó hoy en mi equipo', 'today_summary'],
    ['Cuántas horas trabajamos esta semana', 'weekly_summary'],
    ['Qué tareas están atrasadas', 'overdue_tasks'],
    ['Qué tareas no tienen responsable', 'unassigned_tasks'],
    ['Qué timers están activos', 'active_timers'],
    ['Qué proyecto consumió más tiempo', 'top_project_by_time'],
    ['Quién tiene más carga de trabajo', 'workload_by_user'],
    ['Dame un resumen para una reunión', 'meeting_summary'],
    ['Qué proyecto está en riesgo', 'project_risk'],
    ['Contame un chiste', 'unknown'],
  ])('maps %s to %s', (query, intent) => {
    expect(detectAssistantIntent(query).intent).toBe(intent);
  });
});
