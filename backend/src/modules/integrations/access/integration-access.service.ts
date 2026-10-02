/**
 * Control de acceso a las integraciones. Una organizacion puede usarlas solo si
 * pasan los tres candados, en este orden:
 * 1. Configuracion: `INTEGRATIONS_ENABLED=true`, api key de Trello y clave de
 *    cifrado validas (ver `IntegrationsConfig`). Asi el codigo puede estar en
 *    produccion apagado y encenderse solo en QA.
 * 2. Plan: la organizacion activa tiene un plan con `hasIntegrations` (Plan Max).
 * 3. Rol: el usuario es owner de la organizacion.
 *
 * Qué contiene:
 * - `getAvailability()`: el estado para el frontend (`enabled`, `canManage` y el
 *   motivo cuando algo falta), sin lanzar errores.
 * - `assertCanManage()`: el mismo control para los endpoints; lanza 403 con el
 *   motivo si algun candado no se cumple.
 */
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { isOrgOwner, PermissionUser } from 'src/common/permissions';
import {
  IntegrationsConfig,
  IntegrationsConfigIssue,
} from '../integrations.config';

export type IntegrationAvailabilityReason =
  | IntegrationsConfigIssue
  | 'PLAN_REQUIRED'
  | 'OWNER_REQUIRED';

export interface IntegrationAvailability {
  enabled: boolean;
  canManage: boolean;
  reason: IntegrationAvailabilityReason | null;
}

const REASON_MESSAGES: Record<IntegrationAvailabilityReason, string> = {
  FEATURE_DISABLED: 'Las integraciones no estan habilitadas en este entorno',
  TRELLO_NOT_CONFIGURED: 'La integracion con Trello no esta configurada',
  ENCRYPTION_NOT_CONFIGURED: 'Falta la clave de cifrado de integraciones',
  PLAN_REQUIRED: 'Las integraciones requieren el Plan Max',
  OWNER_REQUIRED:
    'Solo el owner de la organizacion puede conectar integraciones',
};

@Injectable()
export class IntegrationAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: IntegrationsConfig,
  ) {}

  async getAvailability(
    user: PermissionUser,
    organizationId: string,
  ): Promise<IntegrationAvailability> {
    const configIssue = this.config.issue();
    if (configIssue) {
      return { enabled: false, canManage: false, reason: configIssue };
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, isActive: true },
      select: { plan: { select: { hasIntegrations: true } } },
    });
    if (!organization?.plan?.hasIntegrations) {
      return { enabled: false, canManage: false, reason: 'PLAN_REQUIRED' };
    }

    const owner = await isOrgOwner(user, organizationId, this.prisma);
    return owner
      ? { enabled: true, canManage: true, reason: null }
      : { enabled: true, canManage: false, reason: 'OWNER_REQUIRED' };
  }

  async assertCanManage(
    user: PermissionUser,
    organizationId: string,
  ): Promise<void> {
    const availability = await this.getAvailability(user, organizationId);
    if (!availability.canManage) {
      throw new ForbiddenException(
        REASON_MESSAGES[availability.reason ?? 'OWNER_REQUIRED'],
      );
    }
  }
}
