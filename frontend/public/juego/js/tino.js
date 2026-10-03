import { CONFIG } from './config.js';

/**
 * Cliente de Tino: pregunta el estado del escenario cada POLL_MS y avisa con `onState`.
 * Entre consultas, `workedSeconds` de la tarea con timer activo se extrapola en el juego.
 */
export class TinoClient {
  constructor(scenario, { onState, onError }) {
    this.scenario = scenario;
    this.onState = onState;
    this.onError = onError;
    this.timer = null;
    this.inFlight = false;
  }

  start() {
    this.poll();
    this.timer = setInterval(() => this.poll(), CONFIG.POLL_MS);
  }

  stop() {
    clearInterval(this.timer);
  }

  async poll() {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const res = await fetch(`${CONFIG.STATE_URL}?scenario=${encodeURIComponent(this.scenario)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      this.onState(body?.data ?? body);
    } catch (error) {
      this.onError(error);
    } finally {
      this.inFlight = false;
    }
  }
}
