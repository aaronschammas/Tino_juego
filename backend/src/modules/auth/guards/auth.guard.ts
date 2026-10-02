import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma.service';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
}

type ResolvedAuthUser = Record<string, any>;

/** Modo feria: sin login, toda request sin sesión válida actúa como el usuario demo. */
export function isPublicDemoMode(): boolean {
    return process.env.DEMO_MODE === 'true' && Boolean(process.env.DEMO_USER_EMAIL?.trim());
}

@Injectable()
export class AuthGuard implements CanActivate {
    private static readonly USER_CACHE_TTL_MS = 60_000;
    private static readonly USER_CACHE_MAX_ENTRIES = 500;

    private readonly userCache = new Map<
        string,
        { expiresAt: number; user: ResolvedAuthUser }
    >();
    private demoUserId: string | null = null;

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromCookie(request);
        const sessionUser = token ? await this.resolveSessionUser(token) : null;

        if (sessionUser) {
            request.user = sessionUser;
            return true;
        }

        if (isPublicDemoMode()) {
            request.user = await this.resolveDemoUser();
            return true;
        }

        throw new UnauthorizedException(
            token ? 'Token invalido o expirado' : 'Token no proporcionado',
        );
    }

    /** Usuario de la cookie de sesión; null si el token no es válido o el usuario no puede entrar. */
    private async resolveSessionUser(token: string): Promise<ResolvedAuthUser | null> {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: jwtSecret,
            });
            const user = await this.loadUser(payload?.sub);
            return user ? { ...user, sessionId: payload.sid } : null;
        } catch {
            return null;
        }
    }

    /** Usuario demo de DEMO_USER_EMAIL (lo crea prisma/seed-feria.ts). */
    private async resolveDemoUser(): Promise<ResolvedAuthUser> {
        if (!this.demoUserId) {
            const email = process.env.DEMO_USER_EMAIL!.trim().toLowerCase();
            const demo = await this.prisma.user.findUnique({
                where: { email },
                select: { id: true },
            });
            this.demoUserId = demo?.id ?? null;
        }

        const user = this.demoUserId ? await this.loadUser(this.demoUserId) : null;
        if (!user) {
            this.demoUserId = null;
            throw new UnauthorizedException('Usuario demo no cargado: corré prisma/seed-feria.ts');
        }
        return user;
    }

    /** Usuario activo con su rol, cacheado un minuto. */
    private async loadUser(userId: unknown): Promise<ResolvedAuthUser | null> {
        const cached = this.readCachedUser(userId);
        if (cached) return cached;
        if (typeof userId !== 'string' || userId.length === 0) return null;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { role: { select: { name: true } } },
        });
        if (!user || !user.isActive) return null;

        const { role, ...userFields } = user;
        const resolvedUser = {
            ...userFields,
            sub: user.id,
            role: role.name.trim(),
        };
        this.writeCachedUser(userId, resolvedUser);
        return resolvedUser;
    }

    invalidateCachedUser(userId: string) {
        this.userCache.delete(userId);
    }

    private readCachedUser(userId: unknown): ResolvedAuthUser | null {
        if (typeof userId !== 'string' || userId.length === 0) {
            return null;
        }

        const entry = this.userCache.get(userId);
        if (!entry) {
            return null;
        }

        if (entry.expiresAt <= Date.now()) {
            this.userCache.delete(userId);
            return null;
        }

        return entry.user;
    }

    private writeCachedUser(userId: unknown, user: ResolvedAuthUser) {
        if (typeof userId !== 'string' || userId.length === 0) {
            return;
        }

        if (this.userCache.size >= AuthGuard.USER_CACHE_MAX_ENTRIES) {
            const now = Date.now();
            for (const [key, entry] of this.userCache) {
                if (entry.expiresAt <= now) {
                    this.userCache.delete(key);
                }
            }

            if (this.userCache.size >= AuthGuard.USER_CACHE_MAX_ENTRIES) {
                const oldest = this.userCache.keys().next();
                if (!oldest.done) {
                    this.userCache.delete(oldest.value);
                }
            }
        }

        this.userCache.set(userId, {
            expiresAt: Date.now() + AuthGuard.USER_CACHE_TTL_MS,
            user,
        });
    }

    private extractTokenFromCookie(request: any): string | undefined {
        return request.cookies?.access_token;
    }
}
