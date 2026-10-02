import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ErrorCode, ERROR_MESSAGES } from '../dto/error-codes';

/**
 * Guard para asegurar que el usuario tiene acceso a la organización
 * Valida automáticamente que el usuario es miembro de la org
 */
@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.sub;
    const userOrgId = request.user?.organizationId;

    if (!userId) {
      throw new UnauthorizedException(
        ERROR_MESSAGES[ErrorCode.UNAUTHORIZED],
      );
    }

    // Si no hay organizationId en el request, usar la del usuario
    let orgId = request.params.orgId || request.query.orgId;
    
    if (!orgId && userOrgId) {
      orgId = userOrgId;
      request.params.orgId = orgId;
    }

    // Si aún no hay orgId, permitir (puede ser que se intente crear org)
    if (!orgId) {
      return true;
    }

    // Validar que el usuario es miembro de la org
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        ERROR_MESSAGES[ErrorCode.CROSS_ORG_ACCESS],
      );
    }

    // Validar que la org está activa
    if (!membership.organization.isActive) {
      throw new ForbiddenException(
        ERROR_MESSAGES[ErrorCode.ORG_INACTIVE],
      );
    }

    // Attach org info al request para uso posterior
    request.orgId = orgId;
    request.orgRole = membership.role;
    request.organization = membership.organization;

    return true;
  }
}

/**
 * Guard para asegurar que solo ORG_OWNER puede realizar la acción
 * Debe ser usado después de OrgAccessGuard
 */
@Injectable()
export class OrgOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.sub;
    const userOrgId = request.user?.organizationId;

    if (!userId) {
      throw new UnauthorizedException(
        ERROR_MESSAGES[ErrorCode.UNAUTHORIZED],
      );
    }

    // Si OrgAccessGuard ya se ejecutó, tendremos orgRole en el request
    if (request.orgRole) {
      if (request.orgRole !== 'ORG_OWNER') {
        throw new ForbiddenException(
          ERROR_MESSAGES[ErrorCode.ORG_OWNER_REQUIRED],
        );
      }
      return true;
    }

    // Si no, obtener la org ID e validar
    let orgId = request.params.orgId || request.query.orgId;
    if (!orgId && userOrgId) {
      orgId = userOrgId;
    }

    if (!orgId) {
      throw new ForbiddenException(
        ERROR_MESSAGES[ErrorCode.INVALID_ORG_CONTEXT],
      );
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!membership || membership.role !== 'ORG_OWNER') {
      throw new ForbiddenException(
        ERROR_MESSAGES[ErrorCode.ORG_OWNER_REQUIRED],
      );
    }

    request.orgId = orgId;
    request.orgRole = membership.role;

    return true;
  }
}

/**
 * Guard para validar que un usuario NO está en estado PENDING
 * Los usuarios PENDING no pueden usar el sistema hasta aceptar invitación
 */
@Injectable()
export class UserMustBeActiveGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.sub;

    if (!userId) {
      return true; // Allow guard to be chained without error
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException(
        ERROR_MESSAGES[ErrorCode.USER_NOT_FOUND],
      );
    }

    if (user.isActive === false) {
      throw new ForbiddenException(
        'User account has been disabled',
      );
    }
    return true;
  }
}
