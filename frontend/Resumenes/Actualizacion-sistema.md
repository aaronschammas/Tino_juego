📌 Tino – Actualización Timer → KPI (Horas Trabajadas)
🎯 Objetivo del cambio

Corregir el comportamiento del sistema para que:

Al detener el timer, las horas trabajadas se reflejen automáticamente en el KPI “Horas Trabajadas” del dashboard.

El KPI muestre el tiempo en formato hh:mm:ss.

Se mantenga clean architecture sin acoplar componentes entre sí.

No sea necesario recargar la página (F5).

🔄 Problema Detectado

POST /time/stop guardaba correctamente el endTime.

GET /analytics/overview calculaba correctamente las horas.

Pero el dashboard solo llamaba fetchOverview() al montar el componente.

El KPI no se actualizaba hasta refrescar manualmente la página.

Además:

totalHoursWorked estaba redondeado a 2 decimales.

No era posible mostrar precisión real en hh:mm:ss.

🧠 Solución Implementada
1️⃣ Backend – Precisión en segundos
Archivo modificado:
src/modules/analytics/analytics.service.ts
Cambio realizado

Se agregó un nuevo campo en los 3 métodos:

getOverview

getProjectAnalytics

getUserAnalytics

const totalSecondsWorked = Math.floor(totalMs / 1000);

Y se añadió al return:

totalSecondsWorked,
totalHoursWorked: +(totalMs / 1000 / 60 / 60).toFixed(2),
Resultado del endpoint

GET /analytics/overview ahora devuelve:

{
  "totalTasks": 10,
  "completedTasks": 6,
  "completionRate": 60,
  "tasksInProgress": 2,
  "blockedTasks": 1,
  "overdueTasks": 1,
  "totalSecondsWorked": 3672,
  "totalHoursWorked": 1.02
}

✔ No se rompió compatibilidad
✔ Se agregó precisión real en segundos

2️⃣ Frontend – Actualización automática del KPI
A) Evento global al detener el timer

Archivo:

src/hooks/useTimer.ts

Dentro de stopTimer() se agregó:

if (typeof window !== 'undefined') {
  window.dispatchEvent(new Event('time:updated'));
}

Esto desacopla TimerWidget del Dashboard.

B) Dashboard escucha el evento

Archivo:

src/app/dashboard/page.tsx

Se agregó un nuevo useEffect:

useEffect(() => {
  const onTimeUpdated = () => {
    fetchOverview().catch(() =>
      setError('Error al cargar las métricas')
    );
  };

  window.addEventListener('time:updated', onTimeUpdated);
  return () => window.removeEventListener('time:updated', onTimeUpdated);
}, [fetchOverview]);

✔ Ahora el KPI se refresca automáticamente
✔ No requiere F5
✔ Arquitectura desacoplada

3️⃣ Formato hh:mm:ss

Se creó un helper:

Archivo:

src/lib/formatters/time.ts
export function secondsToHMS(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '00:00:00';

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

Y se actualizó el KPI:

value={secondsToHMS(overview.totalSecondsWorked)}

✔ Ahora el KPI muestra tiempo real
✔ Formato consistente con el TimerWidget

4️⃣ Estabilidad de Hooks (React Fix)

Se memoizó fetchOverview para evitar errores de useEffect:

Archivo:

src/hooks/useAnalytics.ts

Se utilizó useCallback:

const fetchOverview = useCallback(async () => {
  ...
}, []);

✔ Evita warnings de React
✔ Mantiene referencia estable
✔ Compatible con useEffect

🏗 Arquitectura Final del Flujo
Flujo completo actualizado

Usuario hace clic en “⏹ Detener Timer”

useTimer.stopTimer() ejecuta:

POST /time/stop

Emite evento time:updated

Dashboard escucha el evento

Se ejecuta fetchOverview()

Se actualiza el estado overview

KPI se renderiza con secondsToHMS

📁 Archivos Modificados
Backend

analytics.service.ts

Frontend

useTimer.ts

useAnalytics.ts

dashboard/page.tsx

src/lib/formatters/time.ts

types/analytics.ts

✅ Estado Final

KPI se actualiza automáticamente

No requiere recarga manual

Tiempo mostrado en hh:mm:ss

Clean architecture mantenida

Sin acoplamiento entre componentes

Sin warnings de React

Backend mantiene compatibilidad