/**
 * Vinculación entre una organización y el WhatsApp de su owner.
 *
 * El dato que queda guardado es simple: la organización tiene o no un WhatsApp
 * vinculado. Nunca se guarda el teléfono. Lo que se almacena es el `user_id` que
 * Meta manda en cada mensaje (business-scoped user ID): no es el número, Meta no
 * ofrece forma de convertirlo en número y solo sirve dentro de la cuenta de Meta
 * de Tino.
 *
 * Qué contiene:
 * - `createLinkCode()`: valida que sea owner y que el plan tenga WhatsApp, borra
 *   los códigos anteriores de esa organización y devuelve un código nuevo junto
 *   con el link `wa.me` ya armado.
 * - `consumeCode()`: canjea el código cuando llega por WhatsApp y deja la
 *   organización vinculada al `user_id` de quien lo envió.
 * - `getStatus()`: el "Sí / No" que muestra el perfil, con fecha y quién activó.
 * - `unlink()` y `unlinkAllForUser()`: cortan el acceso, desde la app o cuando el
 *   owner deja de tener el rol.
 * - `findLinkedOrganizations()`: las organizaciones que ese `user_id` puede
 *   consultar, ya filtradas por plan, por organización activa y por que quien
 *   activó siga siendo owner.
 * - `assertCanManage()`: el control que usan los endpoints del perfil.
 *
 * Los códigos se guardan hasheados con SHA-256, duran diez minutos y sirven una
 * sola vez. Son de diez caracteres de un alfabeto sin letras ambiguas: el owner
 * no los tipea, van escritos en el link, así que pueden ser largos.
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { isOrgOwner, type PermissionUser } from 'src/common/permissions';
import { buildWhatsAppLinkUrl } from './whatsapp.config';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;
const CODE_TTL_MS = 10 * 60 * 1000;

export interface WhatsAppLinkStatus {
  linked: boolean;
  linkedAt: Date | null;
  linkedBy: { id: string; name: string } | null;
}

export interface WhatsAppLinkCodeResult {
  code: string;
  expiresAt: Date;
  whatsappUrl: string | null;
}

export interface LinkedOrganization {
  id: string;
  name: string;
  ownerId: string;
}

@Injectable()
export class WhatsAppLinkService {
  private readonly logger = new Logger(WhatsAppLinkService.name);

  constructor(private readonly prisma: PrismaService) {}

  static hashCode(code: string): string {
    return createHash('sha256')
      .update(code.trim().toUpperCase(), 'utf8')
      .digest('hex');
  }

  static generateCode(): string {
    let code = '';
    for (let index = 0; index < CODE_LENGTH; index += 1) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return code;
  }

  async assertCanManage(
    user: PermissionUser,
    organizationId: string,
  ): Promise<void> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, isActive: true },
      select: { id: true, plan: { select: { hasWhatsApp: true } } },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    if (!organization.plan?.hasWhatsApp) {
      throw new ForbiddenException('WhatsApp requires the Max plan');
    }

    const owner = await isOrgOwner(user, organizationId, this.prisma);
    if (!owner) {
      throw new ForbiddenException('Only organization owners can use WhatsApp');
    }
  }

  async createLinkCode(
    user: PermissionUser,
    organizationId: string,
  ): Promise<WhatsAppLinkCodeResult> {
    await this.assertCanManage(user, organizationId);

    const code = WhatsAppLinkService.generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await this.prisma.whatsAppLinkCode.deleteMany({
      where: { organizationId },
    });
    await this.prisma.whatsAppLinkCode.create({
      data: {
        organizationId,
        createdByUserId: user.id,
        codeHash: WhatsAppLinkService.hashCode(code),
        expiresAt,
      },
    });

    return { code, expiresAt, whatsappUrl: buildWhatsAppLinkUrl(code) };
  }

  async consumeCode(
    code: string,
    senderUserId: string,
  ): Promise<LinkedOrganization | null> {
    const pending = await this.prisma.whatsAppLinkCode.findUnique({
      where: { codeHash: WhatsAppLinkService.hashCode(code) },
      select: {
        id: true,
        organizationId: true,
        createdByUserId: true,
        expiresAt: true,
      },
    });
    if (!pending) return null;

    await this.prisma.whatsAppLinkCode.delete({ where: { id: pending.id } });
    if (pending.expiresAt.getTime() <= Date.now()) return null;

    const [account, eligibleOrganization] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: pending.createdByUserId },
        select: { isActive: true },
      }),
      this.prisma.organization.findFirst({
        where: {
          id: pending.organizationId,
          isActive: true,
          plan: { hasWhatsApp: true },
        },
        select: { id: true },
      }),
    ]);
    if (!account?.isActive || !eligibleOrganization) return null;

    const owner = await isOrgOwner(
      { id: pending.createdByUserId },
      pending.organizationId,
      this.prisma,
    );
    if (!owner) return null;

    const organization = await this.prisma.organization.update({
      where: { id: pending.organizationId },
      data: {
        whatsappUserId: senderUserId,
        whatsappLinkedByUserId: pending.createdByUserId,
        whatsappLinkedAt: new Date(),
      },
      select: { id: true, name: true },
    });

    this.logger.log(`WhatsApp vinculado en la organización ${organization.id}`);

    return { ...organization, ownerId: pending.createdByUserId };
  }

  async getStatus(organizationId: string): Promise<WhatsAppLinkStatus> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappUserId: true,
        whatsappLinkedAt: true,
        whatsappLinkedByUserId: true,
      },
    });
    if (!organization?.whatsappUserId) {
      return { linked: false, linkedAt: null, linkedBy: null };
    }

    const linkedBy = organization.whatsappLinkedByUserId
      ? await this.prisma.user.findUnique({
          where: { id: organization.whatsappLinkedByUserId },
          select: { id: true, name: true, lastname: true },
        })
      : null;

    return {
      linked: true,
      linkedAt: organization.whatsappLinkedAt,
      linkedBy: linkedBy
        ? {
            id: linkedBy.id,
            name: `${linkedBy.name} ${linkedBy.lastname}`.trim(),
          }
        : null,
    };
  }

  async unlink(organizationId: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        whatsappUserId: null,
        whatsappLinkedByUserId: null,
        whatsappLinkedAt: null,
      },
    });
    await this.prisma.whatsAppLinkCode.deleteMany({
      where: { organizationId },
    });
  }

  async unlinkAllForUser(userId: string): Promise<void> {
    await this.prisma.organization.updateMany({
      where: { whatsappLinkedByUserId: userId },
      data: {
        whatsappUserId: null,
        whatsappLinkedByUserId: null,
        whatsappLinkedAt: null,
      },
    });
  }

  async findLinkedOrganizations(
    senderUserId: string,
  ): Promise<LinkedOrganization[]> {
    const organizations = await this.prisma.organization.findMany({
      where: {
        whatsappUserId: senderUserId,
        isActive: true,
        plan: { hasWhatsApp: true },
      },
      select: { id: true, name: true, whatsappLinkedByUserId: true },
    });

    const linked: LinkedOrganization[] = [];
    for (const organization of organizations) {
      if (!organization.whatsappLinkedByUserId) continue;

      const account = await this.prisma.user.findUnique({
        where: { id: organization.whatsappLinkedByUserId },
        select: { isActive: true },
      });
      const owner =
        account?.isActive === true &&
        (await isOrgOwner(
          { id: organization.whatsappLinkedByUserId },
          organization.id,
          this.prisma,
        ));
      if (!owner) {
        await this.unlink(organization.id);
        continue;
      }

      linked.push({
        id: organization.id,
        name: organization.name,
        ownerId: organization.whatsappLinkedByUserId,
      });
    }

    return linked;
  }
}
