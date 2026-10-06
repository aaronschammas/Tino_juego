const LAST_GAME_PROJECT_KEY = 'feria:last-game-project';

/** Proyecto de la última partida terminada (Tino lo marca en Proyectos), o null. */
export function readLastGameProject(): string | null {
  try {
    return window.localStorage.getItem(LAST_GAME_PROJECT_KEY);
  } catch {
    return null;
  }
}

/** Recuerda el proyecto de la partida que acaba de terminar. */
export function writeLastGameProject(projectId: string) {
  try {
    window.localStorage.setItem(LAST_GAME_PROJECT_KEY, projectId);
  } catch {
    // Sin localStorage (modo privado): Proyectos no marca la partida.
  }
}

/** Olvida la última partida (al volver al inicio todo empieza de cero). */
export function clearLastGameProject() {
  try {
    window.localStorage.removeItem(LAST_GAME_PROJECT_KEY);
  } catch {
    // Sin localStorage no hay nada que borrar.
  }
}

/** Pone primero el proyecto de la última partida del juego (si está en la lista). */
export function firstLastGame<T extends { id: string }>(projects: T[], lastGameProjectId: string | null): T[] {
  if (!lastGameProjectId) return projects;
  return [...projects].sort((a, b) => Number(b.id === lastGameProjectId) - Number(a.id === lastGameProjectId));
}
