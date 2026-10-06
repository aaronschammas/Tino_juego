// Coach: diálogos que enseñan a usar Tino paso a paso, según lo que está pasando en la partida.
import { mostUrgent, PRIORITY_LABEL, PRIORITY_RANK, STAGE_VERB } from './rules.js';

export const INTRO_SECONDS = 6;
export const REPOP_SECONDS = 8;
export const STEPS = 3;

/** Bienvenida: se muestra antes del primer timer, un diálogo tras otro. */
export const INTRO = [
  {
    id: 'intro:0',
    title: '¡Hola! Soy tu guía',
    text: 'Tu empresa está en problemas y los vas a resolver usando Tino de verdad. Te voy a ir mostrando qué tocar.',
  },
  {
    id: 'intro:1',
    title: 'A la izquierda está Tino',
    text: 'Ahí están las tareas del proyecto. Todo lo que hagas ahí es real: timers, estados y horas.',
    target: null,
    pointsLeft: true,
  },
  {
    id: 'intro:2',
    title: 'Acá está tu personaje',
    text: 'Cuando iniciás el timer de una tarea en Tino, el personaje camina hasta el problema y lo resuelve.',
  },
  {
    id: 'intro:3',
    title: 'Regla de oro: lo urgente primero',
    text: 'Crítica, después Alta, Media y Baja. Lo que dejás esperando empeora, y el doble si hacés algo menos urgente.',
  },
];

const label = (task) => (PRIORITY_LABEL[task.priority] ?? task.priority).toLowerCase();

/**
 * Paso del coach para el estado actual: qué explicar y qué control de Tino resaltar (`target`).
 *   paso 1  iniciar el timer de lo más urgente
 *   paso 2  mirar cómo trabaja el personaje (o corregir la prioridad)
 *   paso 3  marcar la tarea como Hecha
 * `needsAction` indica que el visitante tiene que hacer algo (si oculta el diálogo, vuelve a aparecer).
 * @param {Array<object>} tasks tareas ya evaluadas (rules.evaluateTasks)
 * @param {{ taskId: string | null, paused: boolean } | null} activeTimer
 * @param {{ status: string, reason: string | null }} round
 */
export function coachStep(tasks, activeTimer, round) {
  const problems = tasks.filter((task) => task.action);
  if (!problems.length) {
    return { id: 'loading', step: null, title: 'Conectando con Tino...', text: 'Preparando el escenario.', target: null, needsAction: false };
  }

  if (round.status === 'finished') {
    return {
      id: 'end',
      step: null,
      title: { cleared: '¡Apagaste todos los incendios!', ended: '¡Partida terminada!' }[round.reason] ?? '¡Se acabó el tiempo!',
      text: 'En unos segundos vas a ver tus números en el Dashboard real de Tino.',
      target: null,
      tone: 'good',
      needsAction: false,
    };
  }

  const urgent = mostUrgent(tasks);
  const active = activeTimer ? tasks.find((task) => task.id === activeTimer.taskId) : null;

  if (active && !active.action) {
    return {
      id: `parent:${active.id}`,
      step: 1,
      title: 'Ese timer va en una subtarea',
      text: `«${active.title}» se divide en subtareas. Detené ese timer y tocá el reloj de una subtarea.`,
      target: { kind: 'stop', title: active.title },
      tone: 'warn',
      needsAction: true,
    };
  }

  if (active?.action) {
    if (active.solved) return doneStep(active, true);
    if (activeTimer.paused) {
      return {
        id: `paused:${active.id}`,
        step: 2,
        title: 'El timer está en pausa',
        text: 'Reanudalo desde el Temporizador de Tino (abajo a la izquierda) para que el personaje siga trabajando.',
        target: null,
        pointsLeft: true,
        needsAction: true,
      };
    }
    if (urgent && PRIORITY_RANK[urgent.priority] > PRIORITY_RANK[active.priority]) {
      return {
        id: `wrong:${active.id}`,
        step: 2,
        title: '¡Ojo con la prioridad!',
        text: `«${urgent.title}» es ${label(urgent)} y empeora el doble mientras hacés «${active.title}» (${label(active)}). Podés detener este timer y empezar por lo más urgente.`,
        target: { kind: 'stop', title: active.title },
        tone: 'warn',
        needsAction: true,
      };
    }
    return {
      id: `work:${active.id}`,
      step: 2,
      title: 'Paso 2 · Mirá cómo trabaja',
      text: `Mientras corre el timer de «${active.title}», el personaje lo resuelve. Cuando termina, Tino apaga el timer solo.`,
      target: null,
      needsAction: false,
    };
  }

  const toClose = problems.find((task) => task.solved && task.status !== 'DONE');
  if (toClose) return doneStep(toClose, false);

  if (urgent) {
    const doneCount = problems.filter((task) => task.status === 'DONE').length;
    const hurry =
      urgent.remaining !== null && urgent.remaining !== undefined && urgent.remaining < 12 && urgent.nextStage
        ? ` ¡Apurate, que ${STAGE_VERB[urgent.nextStage.kind]}!`
        : '';
    return {
      id: `start:${urgent.id}`,
      step: 1,
      title: doneCount ? '¡Un problema menos! Vamos con el siguiente' : 'Paso 1 · Iniciá el timer',
      text: `Lo más urgente es «${urgent.title}» (${label(urgent)}). En Tino tocá el reloj ⏱ de esa tarea y después «Iniciar cronómetro».${hurry}`,
      target: { kind: 'start', title: urgent.title },
      tone: hurry ? 'warn' : undefined,
      needsAction: true,
    };
  }

  return { id: 'wait', step: null, title: 'Esperando a Tino...', text: 'Ya casi.', target: null, needsAction: false };
}

/** Paso 3: marcar como Hecha una tarea ya resuelta (si el timer sigue corriendo, se apaga solo). */
function doneStep(task, timerRunning) {
  return {
    id: `done:${task.id}`,
    step: 3,
    title: 'Paso 3 · Marcala como Hecha',
    text: `${timerRunning ? 'El personaje terminó y Tino apaga el timer solo. ' : ''}En «${task.title}» tocá el botón de estado y elegí «${task.status === 'TODO' ? 'Marcar como completada' : 'Mover a Completadas'}».`,
    target: { kind: 'done', title: task.title },
    tone: 'good',
    needsAction: true,
  };
}

/**
 * Qué diálogo se ve en cada momento: primero la bienvenida (avanza sola o con "Siguiente"), después el paso
 * actual. Cada diálogo nuevo "salta" (`popped`); si el visitante lo oculta y no avanza, vuelve a saltar a los
 * REPOP_SECONDS.
 */
export class CoachFlow {
  constructor() {
    this.introIndex = 0;
    this.introTime = 0;
    this.shownId = null;
    this.hidden = false;
    this.hiddenTime = 0;
  }

  /** Avanza la bienvenida (o la termina si era el último diálogo). */
  next() {
    this.introIndex += 1;
    this.introTime = 0;
  }

  /** Saltea lo que quede de la bienvenida. */
  skipIntro() {
    this.introIndex = INTRO.length;
  }

  /** Oculta el diálogo actual: queda solo el título hasta que cambie el paso. */
  hide() {
    this.hidden = true;
    this.hiddenTime = 0;
  }

  show() {
    this.hidden = false;
  }

  /** Botón "Saltar"/"Entendido": durante la bienvenida la saltea; después oculta el paso actual. */
  dismiss() {
    if (this.introIndex < INTRO.length) this.skipIntro();
    else this.hide();
  }

  /**
   * @param {number} dt
   * @param {object} step resultado de coachStep
   * @param {string} roundStatus
   * @returns {{ dialog: object, intro: { index: number, total: number } | null, hidden: boolean, popped: boolean }}
   */
  update(dt, step, roundStatus) {
    if (roundStatus !== 'waiting' || step.id === 'end') this.skipIntro();
    const inIntro = this.introIndex < INTRO.length && step.id !== 'loading';
    if (inIntro) {
      this.introTime += dt;
      if (this.introTime >= INTRO_SECONDS) this.next();
    }
    const intro = this.introIndex < INTRO.length && step.id !== 'loading';
    const dialog = intro ? { ...INTRO[this.introIndex], step: null, needsAction: false } : step;

    let popped = false;
    if (dialog.id !== this.shownId) {
      this.shownId = dialog.id;
      this.hidden = false;
      popped = true;
    } else if (this.hidden && dialog.needsAction) {
      this.hiddenTime += dt;
      if (this.hiddenTime >= REPOP_SECONDS) {
        this.hidden = false;
        popped = true;
      }
    }
    return { dialog, intro: intro ? { index: this.introIndex, total: INTRO.length } : null, hidden: this.hidden, popped };
  }
}
