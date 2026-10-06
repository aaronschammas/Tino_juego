import type { ElementFinder } from './tinoCoach';

export interface TourStep {
  id: string;
  title: string;
  text: string;
  find: ElementFinder;
}

/** Tarjeta que contiene a `node`: el primer ancestro `app-card` de Tino, o con esquinas redondeadas y borde o sombra. */
export function cardOf(node: Element): HTMLElement | null {
  for (let current: Element | null = node.parentElement; current; current = current.parentElement) {
    const classes = typeof current.className === 'string' ? current.className : '';
    const framed = classes.includes('rounded') && (classes.includes('border') || classes.includes('shadow'));
    if (classes.includes('app-card') || framed) {
      return current as HTMLElement;
    }
  }
  return null;
}

/** Tarjeta del Dashboard cuyo título (o etiqueta de KPI) es `text`. */
function section(text: string, hint: string): ElementFinder {
  return (doc) => {
    const title = Array.from(doc.querySelectorAll('h2, h3, p')).find((node) => node.textContent?.trim() === text);
    const card = title ? cardOf(title) ?? (title as HTMLElement) : null;
    return card ? { element: card, hint } : null;
  };
}

/** Filtro de proyecto del Dashboard (el primer selector). */
const projectFilter: ElementFinder = (doc) => {
  const select = doc.querySelector<HTMLElement>('select');
  return select ? { element: select, hint: 'Filtrado por tu partida' } : null;
};

/** Enlace "Proyectos" del menú de Tino. */
const projectsLink: ElementFinder = (doc) => {
  const link = Array.from(doc.querySelectorAll<HTMLElement>('a, button')).find((node) => node.textContent?.trim() === 'Proyectos');
  return link ? { element: link, hint: 'Tu partida está marcada acá' } : null;
};

/** Recorrido por el Dashboard real de Tino: qué muestra cada métrica, usando los datos de la partida. */
export const DASHBOARD_TOUR: TourStep[] = [
  {
    id: 'filters',
    title: 'Los filtros',
    text: 'El Dashboard ya está filtrado por el proyecto de tu partida. Desde acá podés elegir otro proyecto, un estado o un rango de fechas.',
    find: projectFilter,
  },
  {
    id: 'total',
    title: 'Total de tareas',
    text: 'Cuántas tareas tuvo tu partida, contando las que aparecieron como consecuencia, y cuántas quedaron abiertas.',
    find: section('Total de tareas', 'Total de tareas'),
  },
  {
    id: 'completion',
    title: 'Tasa de completitud',
    text: 'Qué porcentaje de las tareas marcaste como completadas. Es la forma rápida de ver si el trabajo se cerró.',
    find: section('Tasa de completitud', 'Completitud'),
  },
  {
    id: 'planned',
    title: 'Tiempo planificado',
    text: 'La suma de lo que estimaba cada tarea: lo mismo que te mostraba el cronómetro antes de empezar.',
    find: section('Tiempo planificado', 'Planificado'),
  },
  {
    id: 'tracked',
    title: 'Tiempo registrado',
    text: 'El tiempo real de tus timers. Si se pasa de lo planificado, Tino lo marca para que lo veas enseguida.',
    find: section('Tiempo registrado', 'Registrado'),
  },
  {
    id: 'risk',
    title: 'Fricción y riesgo',
    text: 'Lo que pide atención ya: tareas vencidas, bloqueadas, sin tiempo cargado o sin responsable.',
    find: section('Fricción y riesgo', 'Riesgos'),
  },
  {
    id: 'status',
    title: 'Distribución de tareas',
    text: 'Cuántas tareas están por hacer, en progreso, bloqueadas o completadas.',
    find: section('Distribución de tareas', 'Estados'),
  },
  {
    id: 'priority',
    title: 'Distribución por prioridad',
    text: 'Cuántas tareas hay de cada prioridad. En el juego, las Críticas eran las que más rápido empeoraban.',
    find: section('Distribución por prioridad', 'Prioridades'),
  },
  {
    id: 'deviation',
    title: 'Desvío de esfuerzo',
    text: 'Compara, por proyecto, el tiempo real contra el estimado: muestra dónde se trabajó de más o de menos.',
    find: section('Desvío de esfuerzo por proyecto', 'Desvío'),
  },
  {
    id: 'heatmap',
    title: 'Mapa de actividad',
    text: 'Qué días y en qué horarios se trabajó. Tu partida aparece hoy, junto al historial de la empresa demo.',
    find: section('Mapa de actividad', 'Actividad'),
  },
  {
    id: 'attention',
    title: 'Tareas que requieren atención',
    text: 'La lista de tareas críticas o atrasadas para resolver primero, con su proyecto y prioridad.',
    find: section('Tareas que requieren atención', 'Atención'),
  },
  {
    id: 'projects',
    title: 'Y ahora, a explorar',
    text: 'En Proyectos vas a ver tu partida marcada como "Tu última partida". Entrá, mirá sus tareas y sus horas: es Tino de verdad.',
    find: projectsLink,
  },
];
