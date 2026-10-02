/**
 * Cartel "Novedades de Trello" del dashboard web y del inicio de Tino Mobile.
 *
 * - `IntegrationActivityBanner()`: usa `useIntegrationActivity()` y no dibuja
 *   nada si no hay novedades (o si la organizacion no tiene integraciones).
 *   Muestra una linea con los numeros y, debajo, quien trabajo cuanto y en que
 *   tareas (hasta `MAX_WORKERS` personas, el resto como "y N personas más").
 *   La cruz lo cierra hasta que haya novedades nuevas.
 */
import NoticeBanner from '@/components/ui/NoticeBanner';
import { useIntegrationActivity } from '@/hooks/useIntegrationActivity';
import { describeIntegrationActivity } from '@/lib/integrationActivity';

const MAX_WORKERS = 4;

export default function IntegrationActivityBanner({ className }: { className?: string }) {
  const { summary, visible, dismiss } = useIntegrationActivity();
  if (!visible || !summary) return null;

  const { headline, work } = describeIntegrationActivity(summary);
  const shownWork = work.slice(0, MAX_WORKERS);
  const hiddenWorkers = work.length - shownWork.length;

  return (
    <NoticeBanner
      title="Novedades de Trello"
      tone="info"
      className={className}
      onDismiss={() => void dismiss()}
    >
      <div role="status" aria-live="polite">
        {headline ? <p>{headline}</p> : null}
        {shownWork.length > 0 ? (
          <ul className="mt-1 list-disc pl-5">
            {shownWork.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {hiddenWorkers > 0 ? <li>y {hiddenWorkers} personas más</li> : null}
          </ul>
        ) : null}
      </div>
    </NoticeBanner>
  );
}
