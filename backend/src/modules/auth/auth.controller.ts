import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterInitDto } from './dto/register-init.dto';
import { RegisterCompleteDto } from './dto/register-complete.dto';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { Request, Response } from 'express';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly activeOrganization: ActiveOrganizationService,
    ) {}

    @Post('login')
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const authResponse = await this.authService.login(dto, req);
        this.authService.setAuthCookies(res, authResponse);
        return { user: authResponse.user };
    }

    @Post('register/init')
    async registerInit(@Body() dto: RegisterInitDto) {
        return this.authService.registerInit(dto);
    }

    @Post('register/complete')
    async registerComplete(
        @Body() dto: RegisterCompleteDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const authResponse = await this.authService.registerComplete(dto, req);
        this.authService.setAuthCookies(res, authResponse);
        return { user: authResponse.user };
    }

    @Post('refresh')
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const authResponse = await this.authService.refresh(req.cookies?.refresh_token, req);
        this.authService.setAuthCookies(res, authResponse);
        return { user: authResponse.user };
    }

    @Post('logout')
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        await this.authService.logout(req.cookies?.refresh_token);
        this.authService.clearAuthCookies(res);
        return { success: true };
    }

    @Get('context')
    @UseGuards(AuthGuard)
    async getContext(@CurrentUser() user: any, @Req() req: Request) {
        return this.activeOrganization.getContextForRequest(user, req);
    }

    @Post('switch-organization')
    @UseGuards(AuthGuard)
    async switchOrganization(
        @CurrentUser() user: any,
        @Body('organizationId') organizationId: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const context = await this.activeOrganization.getContext(user, organizationId, {
            rejectInvalidRequested: true,
        });

        if (context.activeOrganization) {
            this.authService.setActiveOrganizationCookie(res, context.activeOrganization.id);
        }

        return context;
    }

    @Get('google/login-url')
    async createGoogleLoginUrl(@Query('returnTo') returnTo?: string) {
        return this.authService.createGoogleLoginUrl(returnTo);
    }

    @Get('google/register-url')
    async createGoogleRegisterUrl(@Query('returnTo') returnTo?: string) {
        return this.authService.createGoogleRegisterUrl(returnTo);
    }

    @Get('google/continue-url')
    async createGoogleContinueUrl(@Query('returnTo') returnTo?: string) {
        return this.authService.createGoogleContinueUrl(returnTo);
    }

    @Get('google/invite-url')
    async createGoogleInviteUrl(
        @Query('token') token: string,
        @Query('returnTo') returnTo?: string,
    ) {
        return this.authService.createGoogleInviteUrl(token, returnTo);
    }

    @Post('set-internal-password')
    @UseGuards(AuthGuard)
    async setInternalPassword(
        @CurrentUser() user: any,
        @Body('password') password: string,
    ) {
        return this.authService.setInternalPassword(user.id, password);
    }

    @Post('change-password')
    @UseGuards(AuthGuard)
    async changePassword(
        @CurrentUser() user: any,
        @Body('currentPassword') currentPassword: string | undefined,
        @Body('newPassword') newPassword: string | undefined,
        @Body('confirmPassword') confirmPassword?: string,
    ) {
        return this.authService.changePassword(
            user.id,
            currentPassword,
            newPassword,
            confirmPassword,
        );
    }

    @Get('google/login/callback')
    async googleLoginCallback(
        @Query('code') code: string | undefined,
        @Query('state') state: string | undefined,
        @Query('error') providerError: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const result = await this.authService.handleGoogleLoginCallback(code, state, req, providerError);

        if ('authResponse' in result && result.authResponse) {
            this.authService.setAuthCookies(res, result.authResponse);
        }

        return res.redirect(result.url);
    }

    @Get('google/register/callback')
    async googleRegisterCallback(
        @Query('code') code: string | undefined,
        @Query('state') state: string | undefined,
        @Query('error') providerError: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const result = await this.authService.handleGoogleRegisterCallback(code, state, req, providerError);

        if ('authResponse' in result && result.authResponse) {
            this.authService.setAuthCookies(res, result.authResponse);
        }

        return res.redirect(result.url);
    }

    @Get('google/continue/callback')
    async googleContinueCallback(
        @Query('code') code: string | undefined,
        @Query('state') state: string | undefined,
        @Query('error') providerError: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const result = await this.authService.handleGoogleContinueCallback(code, state, req, providerError);

        if ('authResponse' in result && result.authResponse) {
            this.authService.setAuthCookies(res, result.authResponse);
        }

        return res.redirect(result.url);
    }

    @Get('google/link-url')
    @UseGuards(AuthGuard)
    async createGoogleLinkUrl(
        @CurrentUser() user: any,
        @Query('returnTo') returnTo?: string,
    ) {
        return this.authService.createGoogleLinkUrl(user.id, returnTo);
    }

    @Get('google/callback')
    async googleCallback(
        @Query('code') code: string | undefined,
        @Query('state') state: string | undefined,
        @Res() res: Response,
    ) {
        const redirectUrl = await this.authService.handleGoogleLinkCallback(code, state);
        return res.redirect(redirectUrl);
    }

    @Delete('google/link')
    @UseGuards(AuthGuard)
    async unlinkGoogle(@CurrentUser() user: any) {
        return this.authService.unlinkGoogleAccount(user.id);
    }
}
