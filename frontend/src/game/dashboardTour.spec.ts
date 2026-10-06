import { cardOf, DASHBOARD_TOUR } from './dashboardTour';
import { FrameHighlighter } from './tinoCoach';

/** Dashboard mínimo, con las tarjetas como las arma Tino (bordes, sombras y esquinas redondeadas). */
function renderDashboard() {
  document.body.innerHTML = `
    <nav><a href="/dashboard">Dashboard</a><a href="/projects">Proyectos</a></nav>
    <div class="rounded-xl border"><select><option>Feria · La oficina en llamas</option></select></div>
    <div class="rounded-2xl border shadow-sm" id="kpi-total"><div><p>Total de tareas</p><h2>5</h2></div></div>
    <div class="app-card p-6 shadow-sm" id="kpi-completion"><div class="flex"><p>Tasa de completitud</p></div></div>
    <div class="rounded-2xl border shadow-sm"><p>Tiempo planificado</p></div>
    <div class="rounded-2xl border shadow-sm"><p>Tiempo registrado</p></div>
    <div class="rounded-3xl shadow" id="risk"><h3>Fricción y riesgo</h3></div>
    <div class="rounded-3xl shadow"><h3>Distribución de tareas</h3></div>
    <div class="rounded-3xl shadow"><h3>Distribución por prioridad</h3></div>
    <div class="rounded-3xl shadow"><h3>Desvío de esfuerzo por proyecto</h3></div>
    <div class="rounded-3xl shadow"><h3>Mapa de actividad</h3></div>
    <div class="rounded-3xl border"><h3>Tareas que requieren atención</h3></div>`;
}

describe('DASHBOARD_TOUR', () => {
  beforeEach(renderDashboard);

  it('finds every metric of the Dashboard', () => {
    for (const step of DASHBOARD_TOUR) {
      expect({ step: step.id, found: Boolean(step.find(document)) }).toEqual({ step: step.id, found: true });
    }
  });

  it('highlights the whole card of a metric, not only its title', () => {
    expect(DASHBOARD_TOUR.find((step) => step.id === 'total')!.find(document)?.element.id).toBe('kpi-total');
    expect(DASHBOARD_TOUR.find((step) => step.id === 'risk')!.find(document)?.element.id).toBe('risk');
    expect(DASHBOARD_TOUR.find((step) => step.id === 'completion')!.find(document)?.element.id).toBe('kpi-completion');
    expect(DASHBOARD_TOUR[0].find(document)?.element.tagName).toBe('SELECT');
    expect(DASHBOARD_TOUR.at(-1)!.find(document)?.element).toHaveTextContent('Proyectos');
  });

  it('cardOf skips wrappers without border or shadow', () => {
    const title = document.querySelector('#kpi-total p')!;
    expect(cardOf(title)?.id).toBe('kpi-total');
    expect(cardOf(document.body)).toBeNull();
  });

  it('draws the ring over the step card inside the Dashboard frame', () => {
    Element.prototype.scrollIntoView = jest.fn();
    const highlighter = new FrameHighlighter(() => ({ contentDocument: document }) as unknown as HTMLIFrameElement);
    highlighter.setFinder(DASHBOARD_TOUR[1].find);
    highlighter.tick();
    expect(document.getElementById('feria-coach-ring')!.hidden).toBe(false);
    expect(document.getElementById('feria-coach-label')).toHaveTextContent('Total de tareas');
  });
});
