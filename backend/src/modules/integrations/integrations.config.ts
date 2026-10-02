/**
 * Configuracion de las integraciones leida de variables de entorno.
 *
 * - `INTEGRATIONS_ENABLED`: interruptor general. Solo vale `true` en el entorno
 *   de QA/testing; en produccion queda apagado aunque la migracion este aplicada.
 * - `TRELLO_API_KEY`: api key publica de la app de Trello de Tino.
 * - `INTEGRATIONS_ENCRYPTION_KEY`: 32 bytes en base64 para cifrar los tokens.
 * - `TRELLO_API_SECRET`: secreto de la app de Trello, con el que Trello firma
 *   los webhooks.
 * - `INTEGRATIONS_WEBHOOK_BASE_URL`: URL publica del backend a la que Trello
 *   envia los avisos (ej: la URL de Cloud Run de testing).
 * - `INTEGRATIONS_RECONCILE_TOKEN`: secreto que Cloud Scheduler envia en el header
 *   `X-Reconcile-Token` al llamar la revision diaria.
 *
 * Qué contiene:
 * - `IntegrationsConfig.issue()`: primer motivo por el que la funcion no puede
 *   usarse (apagada, falta la api key o la clave de cifrado) o `null`.
 * - `IntegrationsConfig.liveSyncIssue()`: motivo por el que no se pueden recibir
 *   actualizaciones automaticas (falta secreto o URL publica). Sin esto la
 *   conexion y la importacion inicial funcionan igual, pero sin webhooks.
 * - `IntegrationsConfig.webhookUrl()`: arma la URL de callback de una conexion.
 * - `IntegrationsConfig.encryptionKey()`: decodifica la clave y exige 32 bytes.
 * - `IntegrationsConfig.isValidReconcileToken()`: compara el token recibido en
 *   tiempo constante; sin token configurado siempre es invalido.
 */
import { timingSafeEqual } from 'crypto';

export type IntegrationsConfigIssue =
  | 'FEATURE_DISABLED'
  | 'TRELLO_NOT_CONFIGURED'
  | 'ENCRYPTION_NOT_CONFIGURED';

export type LiveSyncConfigIssue =
  | 'WEBHOOK_SECRET_MISSING'
  | 'WEBHOOK_URL_MISSING';

export const TRELLO_WEBHOOK_PATH = '/integrations/trello/webhook';

export class IntegrationsConfig {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  get enabled(): boolean {
    return this.env.INTEGRATIONS_ENABLED?.trim().toLowerCase() === 'true';
  }

  get trelloApiKey(): string | null {
    return this.env.TRELLO_API_KEY?.trim() || null;
  }

  get trelloApiSecret(): string | null {
    return this.env.TRELLO_API_SECRET?.trim() || null;
  }

  get webhookBaseUrl(): string | null {
    const raw = this.env.INTEGRATIONS_WEBHOOK_BASE_URL?.trim();
    if (!raw) return null;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? url.toString().replace(/\/+$/, '')
        : null;
    } catch {
      return null;
    }
  }

  encryptionKey(): Buffer | null {
    const raw = this.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
    if (!raw) return null;
    const key = Buffer.from(raw, 'base64');
    return key.length === 32 ? key : null;
  }

  issue(): IntegrationsConfigIssue | null {
    if (!this.enabled) return 'FEATURE_DISABLED';
    if (!this.trelloApiKey) return 'TRELLO_NOT_CONFIGURED';
    if (!this.encryptionKey()) return 'ENCRYPTION_NOT_CONFIGURED';
    return null;
  }

  liveSyncIssue(): LiveSyncConfigIssue | null {
    if (!this.trelloApiSecret) return 'WEBHOOK_SECRET_MISSING';
    if (!this.webhookBaseUrl) return 'WEBHOOK_URL_MISSING';
    return null;
  }

  isValidReconcileToken(received: string | undefined): boolean {
    const expected = this.env.INTEGRATIONS_RECONCILE_TOKEN?.trim();
    if (!expected || !received) return false;
    const a = Buffer.from(received.trim(), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  webhookUrl(connectionId: string): string | null {
    const base = this.webhookBaseUrl;
    return base ? `${base}${TRELLO_WEBHOOK_PATH}/${connectionId}` : null;
  }
}
