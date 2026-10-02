import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { validateEmailDomain } from 'src/common/utils/email.util';
import { LoginDto } from './dto/login.dto';
import { RegisterInitDto } from './dto/register-init.dto';
import { RegisterCompleteDto } from './dto/register-complete.dto';
import { Request, Response } from 'express';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { OrganizationsService } from 'src/modules/organizations/organizations.service';
import { ACTIVE_ORGANIZATION_COOKIE } from 'src/common/active-organization/active-organization.service';

type AuthUser = {
    id: string;
    email: string;
    name: string;
    lastname: string;
    roleId: string;
    googleStatus: boolean;
    isActive: boolean;
    organizationId: string | null;
    password?: string | null;
};

type AuthCookieName = 'access_token' | 'refresh_token' | 'auth_token' | 'auth_user' | 'active_organization_id';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly planPolicy: PlanPolicyService,
        private readonly organizationsService: OrganizationsService,
    ) {}

    async registerInit(dto: RegisterInitDto) {
        const normalizedEmail = dto.email.trim().toLowerCase();
        await validateEmailDomain(normalizedEmail);

        const existing = await this.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (existing) {
            throw new BadRequestException('El email ya esta registrado');
        }

        const userRole = await this.prisma.role.findUnique({ where: { name: 'USER' } });
        if (!userRole) throw new BadRequestException('Configuracion de roles no inicializada');

        if (dto.googleToken) {
            throw new BadRequestException('El registro con Google debe completarse mediante OAuth');
        }

        if (!dto.password) throw new BadRequestException('Password requerido');
        const hash = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                id: randomUUID(), email: normalizedEmail, name: dto.nombre,
                lastname: dto.apellido, password: hash, roleId: userRole.id, isActive: true,
            },
        });

        return { userId: user.id };
    }

    async registerComplete(dto: RegisterCompleteDto, req?: Request) {
        this.planPolicy.assertPlanIsSelectable(dto.plan);

        const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
        if (!user) throw new BadRequestException('Usuario no encontrado');
        if (user.organizationId) throw new BadRequestException('El usuario ya pertenece a una organizacion');

        const orgExists = await this.prisma.organization.findFirst({ where: { name: dto.organizationName } });
        if (orgExists) throw new BadRequestException('El nombre de la organizacion ya existe');

        await this.prisma.$transaction(async (tx) => {
            const createdOrg = await tx.organization.create({
                data: {
                    name: dto.organizationName,
                    plan: {
                        connect: { name: dto.plan },
                    },
                    isActive: true,
                },
            });

            await tx.organizationMembership.create({
                data: {
                    organizationId: createdOrg.id,
                    userId: user.id,
                    role: 'ORG_OWNER',
                },
            });

            await tx.user.update({
                where: { id: user.id },
                data: { organizationId: createdOrg.id },
            });
        });

        const updatedUser = await this.prisma.user.findUnique({ where: { id: user.id } });
        if (!updatedUser) {
            throw new BadRequestException('No se pudo completar el registro del usuario');
        }

        return this.buildAuthResponse(updatedUser, req);
    }

    async login(dto: LoginDto, req?: Request) {
        const normalizedEmail = dto.email.trim().toLowerCase();

        const user = await this.prisma.user.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: 'insensitive',
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException('Credenciales invalidas');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Usuario inactivo');
        }

        if (!dto.password || !user.password) {
            throw new UnauthorizedException('Credenciales invalidas');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Credenciales invalidas');
        }

        return this.buildAuthResponse(user, req);
    }

    async refresh(refreshToken: string | undefined, req?: Request) {
        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token no proporcionado');
        }

        const refreshTokenHash = this.hashToken(refreshToken);
        const session = await this.prisma.authSession.findUnique({
            where: { refreshTokenHash },
            include: { user: true },
        });

        if (!session || session.revokedAt || session.expiresAt <= new Date()) {
            throw new UnauthorizedException('Refresh token invalido o expirado');
        }

        if (!session.user.isActive) {
            await this.revokeSession(session.id);
            throw new UnauthorizedException('Usuario inactivo');
        }

        const authResponse = await this.buildAuthResponse(session.user, req);

        await this.prisma.authSession.update({
            where: { id: session.id },
            data: {
                revokedAt: new Date(),
                replacedById: authResponse.sessionId,
            },
        });

        return authResponse;
    }

    async logout(refreshToken?: string) {
        if (refreshToken) {
            const refreshTokenHash = this.hashToken(refreshToken);
            const session = await this.prisma.authSession.findFirst({
                where: { refreshTokenHash, revokedAt: null },
                select: { userId: true, id: true },
            });
            if (session) {
                const activeTimer = await this.prisma.timeEntry.findFirst({
                    where: { userId: session.userId, endTime: null },
                });
                if (activeTimer) {
                    let finalPausedMs = activeTimer.totalPausedMs;
                    if (activeTimer.pausedAt) {
                        finalPausedMs += Date.now() - activeTimer.pausedAt.getTime();
                    }
                    await this.prisma.timeEntry.update({
                        where: { id: activeTimer.id },
                        data: {
                            endTime: new Date(),
                            pausedAt: null,
                            totalPausedMs: finalPausedMs,
                        },
                    });
                }
                await this.prisma.authSession.update({
                    where: { id: session.id },
                    data: { revokedAt: new Date() },
                });
            }
        }

        return { success: true };
    }

    async createGoogleLoginUrl(returnTo?: string) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new BadRequestException(
                'Google OAuth login no esta configurado (GOOGLE_CLIENT_ID/GOOGLE_LOGIN_REDIRECT_URI)',
            );
        }

        const sanitizedReturnTo = this.sanitizeReturnTo(returnTo, '/dashboard');
        const state = await this.jwtService.signAsync(
            {
                returnTo: sanitizedReturnTo,
                provider: 'google-login',
            },
            {
                expiresIn: '10m',
            },
        );

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent',
        });

        return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
    }

    async createGoogleRegisterUrl(returnTo?: string) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_REGISTER_REDIRECT_URI || process.env.GOOGLE_LOGIN_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new BadRequestException(
                'Google OAuth register no esta configurado (GOOGLE_CLIENT_ID/GOOGLE_REGISTER_REDIRECT_URI)',
            );
        }

        const sanitizedReturnTo = this.sanitizeReturnTo(returnTo, '/register?step=organization');
        const state = await this.jwtService.signAsync(
            {
                returnTo: sanitizedReturnTo,
                provider: 'google-register',
            },
            {
                expiresIn: '10m',
            },
        );

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent',
        });

        return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
    }

    async createGoogleContinueUrl(returnTo?: string) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_CONTINUE_REDIRECT_URI || process.env.GOOGLE_LOGIN_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new BadRequestException(
                'Google OAuth continue no esta configurado (GOOGLE_CLIENT_ID/GOOGLE_CONTINUE_REDIRECT_URI)',
            );
        }

        const sanitizedReturnTo = this.sanitizeReturnTo(returnTo, '/dashboard');
        const state = await this.jwtService.signAsync(
            {
                returnTo: sanitizedReturnTo,
                provider: 'google-continue',
            },
            {
                expiresIn: '10m',
            },
        );

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent',
        });

        return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
    }

    async createGoogleInviteUrl(token: string, returnTo?: string) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new BadRequestException(
                'Google OAuth invite no esta configurado (GOOGLE_CLIENT_ID/GOOGLE_LOGIN_REDIRECT_URI)',
            );
        }

        if (!token?.trim()) {
            throw new BadRequestException('Token de invitacion requerido');
        }

        const sanitizedReturnTo = this.sanitizeReturnTo(returnTo, '/dashboard');
        const state = await this.jwtService.signAsync(
            {
                returnTo: sanitizedReturnTo,
                provider: 'google-invite',
                inviteToken: token.trim(),
            },
            {
                expiresIn: '10m',
            },
        );

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent',
        });

        return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
    }

    async handleGoogleLoginCallback(code?: string, state?: string, req?: Request, providerError?: string) {
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://www.tinotime.com';

        if (!state) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'missing_params',
                }),
            };
        }

        let statePayload: {
            returnTo?: string;
            provider?: string;
        };

        try {
            statePayload = await this.jwtService.verifyAsync(state);
        } catch {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        if (statePayload.provider === 'google-register') {
            return this.handleGoogleRegisterCallback(code, state, req, providerError);
        }

        if (statePayload.provider === 'google-continue') {
            return this.handleGoogleContinueCallback(code, state, req, providerError);
        }

        if (statePayload.provider === 'google-invite') {
            return this.handleGoogleInviteCallback(code, state, req);
        }

        if (statePayload.provider !== 'google-login') {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        if (providerError) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: providerError === 'access_denied' ? 'provider_cancelled' : 'oauth_exchange_failed',
                }),
            };
        }

        if (!code) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'missing_params',
                }),
            };
        }

        const returnTo = this.sanitizeReturnTo(statePayload.returnTo, '/dashboard');

        const googleProfile = await this.fetchGoogleProfile(
            code,
            process.env.GOOGLE_LOGIN_REDIRECT_URI,
        );

        if ('reason' in googleProfile) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: googleProfile.reason,
                }),
            };
        }

        if (!googleProfile.email || !googleProfile.sub) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_google_profile',
                }),
            };
        }

        if (googleProfile.email_verified !== true) {
            return { url: this.buildFrontendLoginRedirect(frontendBaseUrl, { status: 'error', reason: 'email_not_verified' }) };
        }

        const user = await this.resolveUserForGoogleLogin(googleProfile.sub, googleProfile.email);

        if (!user || !user.googleId || user.googleStatus !== true) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'account_not_registered',
                }),
            };
        }

        if (!user.isActive) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'inactive_user',
                }),
            };
        }

        const authResponse = await this.buildAuthResponse(user, req);

        return {
            url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                status: 'success',
                next: returnTo,
            }),
            authResponse,
        };
    }

    async handleGoogleInviteCallback(code?: string, state?: string, req?: Request) {
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://www.tinotime.com';

        if (!code || !state) {
            return {
                url: this.buildFrontendInviteRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'missing_params',
                }),
            };
        }

        let statePayload: {
            returnTo?: string;
            provider?: string;
            inviteToken?: string;
        };

        try {
            statePayload = await this.jwtService.verifyAsync(state);
        } catch {
            return {
                url: this.buildFrontendInviteRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        if (statePayload.provider !== 'google-invite' || !statePayload.inviteToken) {
            return {
                url: this.buildFrontendInviteRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        const googleProfile = await this.fetchGoogleProfile(
            code,
            process.env.GOOGLE_LOGIN_REDIRECT_URI,
        );

        if ('reason' in googleProfile) {
            return {
                url: this.buildFrontendInviteRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: googleProfile.reason,
                    token: statePayload.inviteToken,
                }),
            };
        }

        try {
            const user = await this.organizationsService.acceptInviteWithGoogle(
                statePayload.inviteToken,
                {
                    sub: googleProfile.sub,
                    email: googleProfile.email,
                    email_verified: googleProfile.email_verified,
                    given_name: googleProfile.given_name,
                    family_name: googleProfile.family_name,
                    name: googleProfile.name,
                },
            );

            const authResponse = await this.buildAuthResponse(user, req);
            const next = authResponse.user.requiresInternalPasswordSetup
                ? '/auth/setup-password'
                : this.sanitizeReturnTo(statePayload.returnTo, '/dashboard');

            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'success',
                    next,
                }),
                authResponse,
            };
        } catch (error) {
            const reason = error instanceof BadRequestException
                ? 'invite_google_rejected'
                : 'invite_accept_failed';
            const message = error instanceof Error ? error.message : undefined;

            return {
                url: this.buildFrontendInviteRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason,
                    token: statePayload.inviteToken,
                    message,
                }),
            };
        }
    }

    async setInternalPassword(userId: string, password: string) {
        if (!password || password.length < 8) {
            throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, password: true },
        });

        if (!user) {
            throw new BadRequestException('Usuario no encontrado');
        }

        if (user.password) {
            throw new BadRequestException('El usuario ya tiene una contraseña interna configurada');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        return { user: await this.buildAuthUserPayload(updatedUser) };
    }

    async changePassword(
        userId: string,
        currentPassword: string | undefined,
        newPassword: string | undefined,
        confirmPassword?: string,
    ) {
        if (!newPassword || newPassword.length < 8) {
            throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            throw new BadRequestException('Las contraseñas no coinciden');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, password: true },
        });

        if (!user) {
            throw new BadRequestException('Usuario no encontrado');
        }

        if (!user.password) {
            throw new BadRequestException('Usá el flujo de crear contraseña interna');
        }

        if (!currentPassword) {
            throw new BadRequestException('La contraseña actual es requerida.');
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new BadRequestException('La contraseña actual es incorrecta.');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        return { message: 'Contraseña actualizada correctamente' };
    }

    async handleGoogleContinueCallback(code?: string, state?: string, req?: Request, providerError?: string) {
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://www.tinotime.com';

        if (!state) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'missing_params',
                }),
            };
        }

        let statePayload: {
            returnTo?: string;
            provider?: string;
        };

        try {
            statePayload = await this.jwtService.verifyAsync(state);
        } catch {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        if (statePayload.provider !== 'google-continue') {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        if (providerError) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: providerError === 'access_denied' ? 'provider_cancelled' : 'oauth_exchange_failed',
                }),
            };
        }

        if (!code) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'missing_params',
                }),
            };
        }

        const returnTo = this.sanitizeReturnTo(statePayload.returnTo, '/dashboard');

        const googleProfile = await this.fetchGoogleProfile(
            code,
            process.env.GOOGLE_CONTINUE_REDIRECT_URI || process.env.GOOGLE_LOGIN_REDIRECT_URI,
        );

        if ('reason' in googleProfile) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: googleProfile.reason,
                }),
            };
        }

        if (!googleProfile.email || !googleProfile.sub) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_google_profile',
                }),
            };
        }

        if (googleProfile.email_verified !== true) {
            return { url: this.buildFrontendLoginRedirect(frontendBaseUrl, { status: 'error', reason: 'email_not_verified' }) };
        }

        const user = await this.resolveUserForGoogleContinue({
            ...googleProfile,
            sub: googleProfile.sub,
            email: googleProfile.email,
        });

        if (!user.isActive) {
            return {
                url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'inactive_user',
                }),
            };
        }

        const authResponse = await this.buildAuthResponse(user, req);

        return {
            url: this.buildFrontendLoginRedirect(frontendBaseUrl, {
                status: 'success',
                next: returnTo,
            }),
            authResponse,
        };
    }

    async handleGoogleRegisterCallback(code?: string, state?: string, req?: Request, providerError?: string) {
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://www.tinotime.com';

        if (!state) {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'missing_params',
                }),
            };
        }

        let statePayload: {
            returnTo?: string;
            provider?: string;
        };

        try {
            statePayload = await this.jwtService.verifyAsync(state);
        } catch {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        if (statePayload.provider !== 'google-register') {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_state',
                }),
            };
        }

        if (providerError) {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: providerError === 'access_denied' ? 'provider_cancelled' : 'oauth_exchange_failed',
                }),
            };
        }

        if (!code) {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'missing_params',
                }),
            };
        }

        const returnTo = this.sanitizeReturnTo(statePayload.returnTo, '/register?step=organization');

        const googleProfile = await this.fetchGoogleProfile(
            code,
            process.env.GOOGLE_REGISTER_REDIRECT_URI || process.env.GOOGLE_LOGIN_REDIRECT_URI,
        );

        if ('reason' in googleProfile) {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: googleProfile.reason,
                }),
            };
        }

        if (!googleProfile.email || !googleProfile.sub) {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'invalid_google_profile',
                }),
            };
        }

        if (googleProfile.email_verified !== true) {
            return { url: this.buildFrontendRegisterRedirect(frontendBaseUrl, { status: 'error', reason: 'email_not_verified' }) };
        }

        const googleSub = googleProfile.sub;
        const normalizedEmail = googleProfile.email.trim().toLowerCase();

        let user = await this.resolveUserForGoogleRegister(googleSub, normalizedEmail);

        if (user && user.googleId && user.googleId !== googleSub) {
            return {
                url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                    status: 'error',
                    reason: 'google_already_linked',
                }),
            };
        }

        if (!user) {
            const names = this.extractGoogleNames(googleProfile);
            const userRole = await this.prisma.role.findUnique({ where: { name: 'USER' } });
            if (!userRole) throw new BadRequestException('Configuracion de roles no inicializada');

            user = await this.prisma.user.create({
                data: {
                    id: randomUUID(),
                    email: normalizedEmail,
                    name: names.name,
                    lastname: names.lastname,
                    googleId: googleSub,
                    roleId: userRole.id,
                    isActive: true,
                    googleStatus: true,
                    ...(googleProfile.email_verified ? ({ isEmailVerified: true } as any) : {}),
                },
            });
        } else if (!user.googleId || user.googleId !== googleSub) {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    googleId: googleSub,
                    googleStatus: true,
                    ...(googleProfile.email_verified ? ({ isEmailVerified: true } as any) : {}),
                },
            });
        }

        const authResponse = await this.buildAuthResponse(user, req);

        return {
            url: this.buildFrontendRegisterRedirect(frontendBaseUrl, {
                status: 'success',
                next: returnTo,
            }),
            authResponse,
        };
    }

    async createGoogleLinkUrl(userId: string, returnTo?: string) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri =
            process.env.GOOGLE_LINK_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new BadRequestException(
                'Google OAuth no esta configurado (GOOGLE_CLIENT_ID/GOOGLE_REDIRECT_URI)',
            );
        }

        const sanitizedReturnTo = this.sanitizeReturnTo(returnTo, '/profile');
        const state = await this.jwtService.signAsync(
            {
                sub: userId,
                returnTo: sanitizedReturnTo,
                provider: 'google-link',
            },
            {
                expiresIn: '10m',
            },
        );

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent',
        });

        return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
    }

    async handleGoogleLinkCallback(code?: string, state?: string) {
        const frontendBaseUrl = process.env.FRONTEND_URL || 'https://www.tinotime.com';

        if (!code || !state) {
            return this.buildFrontendRedirect(frontendBaseUrl, '/profile', 'error', 'missing_params');
        }

        let statePayload: {
            sub: string;
            returnTo?: string;
            provider?: string;
        };

        try {
            statePayload = await this.jwtService.verifyAsync(state);
        } catch {
            return this.buildFrontendRedirect(frontendBaseUrl, '/profile', 'error', 'invalid_state');
        }

        if (statePayload.provider !== 'google-link' || !statePayload.sub) {
            return this.buildFrontendRedirect(frontendBaseUrl, '/profile', 'error', 'invalid_state');
        }

        const sanitizedReturnTo = this.sanitizeReturnTo(statePayload.returnTo, '/profile');

        const googleProfile = await this.fetchGoogleProfile(
            code,
            process.env.GOOGLE_LINK_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
        );

        if ('reason' in googleProfile) {
            return this.buildFrontendRedirect(frontendBaseUrl, sanitizedReturnTo, 'error', googleProfile.reason);
        }

        if (googleProfile.email_verified !== true) {
            return this.buildFrontendRedirect(frontendBaseUrl, sanitizedReturnTo, 'error', 'email_not_verified');
        }

        try {
            const googleSub = googleProfile.sub;

            const linkedUser = await this.prisma.user.findFirst({
                where: { googleId: googleSub },
            });

            if (linkedUser && linkedUser.id !== statePayload.sub) {
                return this.buildFrontendRedirect(frontendBaseUrl, sanitizedReturnTo, 'error', 'google_already_linked');
            }

            await this.prisma.user.update({
                where: { id: statePayload.sub },
                data: {
                    googleId: googleSub,
                    googleStatus: true,
                    ...(googleProfile.email_verified
                        ? ({ isEmailVerified: true } as any)
                        : {}),
                },
            });

            return this.buildFrontendRedirect(frontendBaseUrl, sanitizedReturnTo, 'linked');
        } catch {
            return this.buildFrontendRedirect(frontendBaseUrl, sanitizedReturnTo, 'error', 'oauth_exchange_failed');
        }
    }

    async unlinkGoogleAccount(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                googleStatus: false,
            },
        });

        return {
            success: true,
            message: 'Cuenta de Google desvinculada correctamente',
        };
    }

    setAuthCookies(res: Response, authResponse: { accessToken: string; refreshToken: string }) {
        this.setCookie(res, 'access_token', authResponse.accessToken, this.accessTokenMaxAgeMs());
        this.setCookie(res, 'refresh_token', authResponse.refreshToken, this.refreshTokenMaxAgeMs());
        this.clearCookie(res, 'auth_token');
        this.clearCookie(res, 'auth_user');
    }

    setActiveOrganizationCookie(res: Response, organizationId: string) {
        this.setCookie(res, ACTIVE_ORGANIZATION_COOKIE as AuthCookieName, organizationId, this.refreshTokenMaxAgeMs());
    }

    clearAuthCookies(res: Response) {
        this.clearCookie(res, 'access_token');
        this.clearCookie(res, 'refresh_token');
        this.clearCookie(res, 'auth_token');
        this.clearCookie(res, 'auth_user');
        this.clearCookie(res, ACTIVE_ORGANIZATION_COOKIE as AuthCookieName);
    }

    private async fetchGoogleProfile(code: string, redirectUri?: string) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret || !redirectUri) {
            return { reason: 'oauth_not_configured' as const };
        }

        const tokenParams = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });

        const tokenResponse = await fetch(
            'https://oauth2.googleapis.com/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: tokenParams.toString(),
            },
        );

        if (!tokenResponse.ok) {
            return { reason: 'oauth_exchange_failed' as const };
        }

        const tokenData = (await tokenResponse.json()) as {
            access_token?: string;
        };

        const accessToken = tokenData.access_token;
        if (!accessToken) {
            return { reason: 'missing_access_token' as const };
        }

        const profileResponse = await fetch(
            'https://openidconnect.googleapis.com/v1/userinfo',
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        );

        if (!profileResponse.ok) {
            return { reason: 'invalid_google_profile' as const };
        }

        const profileData = (await profileResponse.json()) as {
            sub?: string;
            email?: string;
            email_verified?: boolean;
            given_name?: string;
            family_name?: string;
            name?: string;
        };

        if (!profileData.sub || !profileData.email) {
            return { reason: 'invalid_google_profile' as const };
        }

        return profileData;
    }

    private async buildAuthUserPayload(user: AuthUser) {
        const userWithRole = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: { role: true },
        });

        const roleName = (userWithRole?.role.name || 'USER').trim();

        const organizationWithPlan = user.organizationId
            ? await this.prisma.organization.findUnique({
                  where: { id: user.organizationId },
                  include: { plan: true },
              })
            : null;

        const planName = organizationWithPlan?.plan?.name || null;
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            role: roleName,
            googleStatus: Boolean(userWithRole?.googleStatus ?? user.googleStatus),
            isActive: user.isActive,
            organizationId: user.organizationId,
            organizationPlan: organizationWithPlan?.plan ?? null,
            hasInternalPassword: Boolean(userWithRole?.password ?? user.password),
            requiresInternalPasswordSetup: Boolean(
                userWithRole?.googleId &&
                userWithRole.googleStatus === true &&
                !userWithRole.password,
            ),
            planName,
        };
    }

    private async buildAuthResponse(user: AuthUser, req?: Request) {
        const { planName, ...userPayload } = await this.buildAuthUserPayload(user);
        const { sessionId, refreshToken } = await this.createSession(user.id, req);
        const accessToken = await this.createAccessToken(user, userPayload.role, planName, sessionId);

        return {
            accessToken,
            refreshToken,
            sessionId,
            user: userPayload,
        };
    }

    private async createAccessToken(user: AuthUser, role: string, plan: string | null, sessionId: string) {
        return this.jwtService.signAsync(
            {
                sub: user.id,
                email: user.email,
                role,
                organizationId: user.organizationId,
                plan,
                sid: sessionId,
            },
            {
                expiresIn: this.accessTokenTtl() as any,
            },
        );
    }

    private async createSession(userId: string, req?: Request) {
        const refreshToken = randomBytes(64).toString('base64url');
        const metadata = this.getRequestMetadata(req);
        const session = await this.prisma.authSession.create({
            data: {
                userId,
                refreshTokenHash: this.hashToken(refreshToken),
                expiresAt: new Date(Date.now() + this.refreshTokenMaxAgeMs()),
                userAgent: metadata.userAgent,
                ipAddress: metadata.ipAddress,
            },
        });

        return {
            sessionId: session.id,
            refreshToken,
        };
    }

    private async revokeSession(sessionId: string) {
        await this.prisma.authSession.updateMany({
            where: {
                id: sessionId,
                revokedAt: null,
            },
            data: { revokedAt: new Date() },
        });
    }

    private hashToken(token: string) {
        return createHash('sha256').update(token).digest('hex');
    }

    private getRequestMetadata(req?: Request) {
        const forwardedFor = req?.headers['x-forwarded-for'];
        const ipAddress = Array.isArray(forwardedFor)
            ? forwardedFor[0]
            : forwardedFor?.split(',')[0]?.trim() || req?.ip;

        return {
            userAgent: req?.headers['user-agent'],
            ipAddress,
        };
    }

    private accessTokenTtl() {
        return process.env.ACCESS_TOKEN_TTL || '15m';
    }

    private refreshTokenTtl() {
        return process.env.REFRESH_TOKEN_TTL || '7d';
    }

    private accessTokenMaxAgeMs() {
        return this.ttlToMs(this.accessTokenTtl(), 15 * 60 * 1000);
    }

    private refreshTokenMaxAgeMs() {
        return this.ttlToMs(this.refreshTokenTtl(), 7 * 24 * 60 * 60 * 1000);
    }

    private ttlToMs(value: string, fallback: number) {
        const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
        if (!match) return fallback;

        const amount = Number(match[1]);
        const unit = match[2];
        const multipliers: Record<string, number> = {
            ms: 1,
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };

        return amount * multipliers[unit];
    }

    private resolveCookieSettings() {
        const isProduction = process.env.NODE_ENV === 'production';

        return {
            secure: isProduction,
            sameSite: 'lax' as const,
        };
    }

    private setCookie(res: Response, name: AuthCookieName, value: string, maxAge: number) {
        const settings = this.resolveCookieSettings();
        res.cookie(name, value, {
            httpOnly: true,
            secure: settings.secure,
            sameSite: settings.sameSite,
            signed: false,
            maxAge,
            path: '/',
        });
    }

    private clearCookie(res: Response, name: AuthCookieName) {
        const settings = this.resolveCookieSettings();
        res.clearCookie(name, {
            httpOnly: true,
            path: '/',
            sameSite: settings.sameSite,
            secure: settings.secure,
        });
    }

    private async resolveUserForGoogleLogin(googleSub: string, email?: string) {
        const linkedUser = await this.prisma.user.findFirst({
            where: { googleId: googleSub },
        });

        if (linkedUser) {
            return linkedUser;
        }

        if (email) {
            const emailUser = await this.prisma.user.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } },
            });

            if (emailUser) {
                return this.prisma.user.update({
                    where: { id: emailUser.id },
                    data: {
                        googleId: googleSub,
                        googleStatus: true,
                    },
                });
            }
        }

        return null;
    }

    private async resolveUserForGoogleRegister(googleSub: string, email: string) {
        const linkedUser = await this.prisma.user.findFirst({
            where: { googleId: googleSub },
        });
        if (linkedUser) return linkedUser;
        return this.prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
        });
    }

    private async resolveUserForGoogleContinue(profile: {
        sub: string;
        email: string;
        email_verified?: boolean;
        given_name?: string;
        family_name?: string;
        name?: string;
    }) {
        const googleSub = profile.sub;
        const normalizedEmail = profile.email.trim().toLowerCase();

        const linkedUser = await this.prisma.user.findFirst({
            where: { googleId: googleSub },
        });

        if (linkedUser) {
            return linkedUser;
        }

        const emailUser = await this.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        if (emailUser) {
            if (!emailUser.isActive) {
                return emailUser;
            }

            return this.prisma.user.update({
                where: { id: emailUser.id },
                data: {
                    googleId: googleSub,
                    googleStatus: true,
                    ...(profile.email_verified ? ({ isEmailVerified: true } as any) : {}),
                },
            });
        }

        const names = this.extractGoogleNames(profile);
        const userRole = await this.prisma.role.findUnique({ where: { name: 'USER' } });
        if (!userRole) throw new BadRequestException('Configuracion de roles no inicializada');

        return this.prisma.user.create({
            data: {
                id: randomUUID(),
                email: normalizedEmail,
                name: names.name,
                lastname: names.lastname,
                googleId: googleSub,
                roleId: userRole.id,
                isActive: true,
                googleStatus: true,
                ...(profile.email_verified ? ({ isEmailVerified: true } as any) : {}),
            },
        });
    }

    private extractGoogleNames(profile: {
        given_name?: string;
        family_name?: string;
        name?: string;
    }) {
        const fallbackName = profile.name?.trim() || 'Usuario';
        const parts = fallbackName.split(/\s+/).filter(Boolean);

        return {
            name: profile.given_name?.trim() || parts[0] || 'Usuario',
            lastname: profile.family_name?.trim() || parts.slice(1).join(' ') || 'Google',
        };
    }

    private sanitizeReturnTo(returnTo?: string, fallback = '/profile') {
        if (!returnTo) return fallback;
        if (!returnTo.startsWith('/')) return fallback;
        if (returnTo.startsWith('//')) return fallback;
        return returnTo;
    }

    private buildFrontendLoginRedirect(
        frontendBaseUrl: string,
        options: {
            status: 'success' | 'error';
            next?: string;
            reason?: string;
        },
    ) {
        const url = new URL('/login', frontendBaseUrl);
        url.searchParams.set('google', options.status);

        if (options.status === 'success' && options.next) {
            url.searchParams.set('next', options.next);
        }

        if (options.status === 'error' && options.reason) {
            url.searchParams.set('reason', options.reason);
        }

        return url.toString();
    }

    private buildFrontendInviteRedirect(
        frontendBaseUrl: string,
        options: {
            status: 'error';
            reason: string;
            token?: string;
            message?: string;
        },
    ) {
        const url = new URL('/invite', frontendBaseUrl);
        url.searchParams.set('google', options.status);
        url.searchParams.set('reason', options.reason);

        if (options.token) {
            url.searchParams.set('token', options.token);
        }

        if (options.message) {
            url.searchParams.set('message', options.message);
        }

        return url.toString();
    }

    private buildFrontendRegisterRedirect(
        frontendBaseUrl: string,
        options: {
            status: 'success' | 'error';
            next?: string;
            reason?: string;
        },
    ) {
        const url = new URL('/register', frontendBaseUrl);
        url.searchParams.set('google', options.status);

        if (options.status === 'success' && options.next) {
            url.searchParams.set('next', options.next);
        }

        if (options.status === 'error' && options.reason) {
            url.searchParams.set('reason', options.reason);
        }

        return url.toString();
    }

    private buildFrontendRedirect(
        frontendBaseUrl: string,
        returnTo: string,
        status: 'linked' | 'error',
        reason?: string,
    ) {
        const url = new URL(returnTo, frontendBaseUrl);
        url.searchParams.set('google', status);
        if (reason) {
            url.searchParams.set('reason', reason);
        }
        return url.toString();
    }
}
