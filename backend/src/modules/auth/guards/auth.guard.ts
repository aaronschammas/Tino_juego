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

@Injectable()
export class AuthGuard implements CanActivate {
    private static readonly USER_CACHE_TTL_MS = 60_000;
    private static readonly USER_CACHE_MAX_ENTRIES = 500;

    private readonly userCache = new Map<
        string,
        { expiresAt: number; user: ResolvedAuthUser }
    >();

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromCookie(request);

        if (!token) {
            throw new UnauthorizedException('Token no proporcionado');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: jwtSecret,
            });

            let resolvedUser = this.readCachedUser(payload?.sub);

            if (!resolvedUser) {
                const user = await this.prisma.user.findUnique({
                    where: { id: payload.sub },
                    include: { role: { select: { name: true } } },
                });

                if (!user) {
                    throw new UnauthorizedException('Usuario no encontrado');
                }

                if (!user.isActive) {
                    throw new UnauthorizedException('Usuario inactivo');
                }

                const { role, ...userFields } = user;

                resolvedUser = {
                    ...userFields,
                    sub: user.id,
                    role: role.name.trim(),
                };

                this.writeCachedUser(payload.sub, resolvedUser);
            }

            request.user = {
                ...resolvedUser,
                sessionId: payload.sid,
            };
        } catch {
            throw new UnauthorizedException('Token invalido o expirado');
        }

        return true;
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
