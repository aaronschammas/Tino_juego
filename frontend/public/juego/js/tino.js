import { CONFIG } from './config.js';

/**
 * Cliente de Tino: cada POLL_MS hace un "tick" del escenario (el backend apaga el timer de la tarea
 * terminada y aplica las consecuencias) y avisa con `onState`, que trae los eventos que pasaron.
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
      const res = await fetch(CONFIG.TICK_URL, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: this.scenario }),
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
