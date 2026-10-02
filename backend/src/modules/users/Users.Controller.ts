import { UsersService } from "./Users.Service";
import { Body, Controller, Get, Param, Post, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CreateUserDto } from "./dto/CreateUserDto";
import { UpdateUserDto } from "./dto/UpdateUserDto";
import { AuthGuard } from "src/modules/auth/guards/auth.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { ActiveOrganizationService } from "src/common/active-organization/active-organization.service";

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
    constructor (
        private readonly usersService:UsersService,
        private readonly activeOrganization: ActiveOrganizationService,
    ){}

    @Post()
    @Roles('SUPERADMIN')
    createUser(@Body() dto:CreateUserDto){
        return this.usersService.createUser (dto);
    }
    
    @Get()
    async getUsers(@CurrentUser() user: any, @Req() req: Request){
        const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
        return this.usersService.getUsers(scopedUser);
    }

    @Get('me')
    async getCurrentUser(@CurrentUser() user: any, @Req() req: Request) {
        const context = await this.activeOrganization.getContextForRequest(user, req);
        return {
            ...context.user,
            activeOrganization: context.activeOrganization,
            activeMembership: context.activeMembership,
            memberships: context.memberships,
            features: context.features,
        };
    }

    @Get(':id')
    getUserById(@Param('id') id: string, @CurrentUser() user: any) {
        return this.usersService.getUserById(id, user);
    }
    @Patch(':id')
    updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
        return this.usersService.updateUser(id, dto, user);
    }
    @Patch(':id/deactivate')
    @Roles('SUPERADMIN')
    deactivateUser(@Param('id') id: string, @CurrentUser() user: any) {
        return this.usersService.deactivateUser(id, user);
    }
    @Patch(':id/activate')
    @Roles('SUPERADMIN')
    activateUser(@Param('id') id: string, @CurrentUser() user: any) {
        return this.usersService.activateUser(id, user);
    }

    /**
     * Endpoint para vincular cuenta Google: setea googleId y googleStatus=true
     */
    @Patch(':id/link-google')
    @Roles('SUPERADMIN')
    async linkGoogle(@Param('id') id: string, @Body('googleId') googleId: string, @CurrentUser() user: any) {
        return this.usersService.linkGoogleAccount(id, googleId, user);
    }

    /**
     * Endpoint para desvincular cuenta Google: setea googleStatus=false, mantiene googleId
     */
    @Patch(':id/unlink-google')
    @Roles('SUPERADMIN')
    async unlinkGoogle(@Param('id') id: string, @CurrentUser() user: any) {
        return this.usersService.unlinkGoogleAccount(id, user);
    }

    /**
     * Endpoint para eliminar la cuenta (y la organización si es admin)
     */
    @Delete('me')
    async deleteMyAccount(@CurrentUser() user: any) {
        return this.usersService.deleteAccount(user.id);
    }
}
