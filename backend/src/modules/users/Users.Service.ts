import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateUserDto } from "./dto/CreateUserDto";
import { UpdateUserDto } from "./dto/UpdateUserDto";
import { PrismaService } from "src/database/prisma.service";
import { randomUUID } from 'crypto';
import { validateEmailDomain } from 'src/common/utils/email.util';
import { isSuperAdmin, PermissionUser } from 'src/common/permissions';

@Injectable()

export class UsersService {
    constructor(private readonly prisma:PrismaService){}

    private stripSensitiveUserFields(user: any) {
        const safeUser = { ...user };
        delete safeUser.password;
        return safeUser;
    }
    
    
    
    async createUser(dto: CreateUserDto) {
        const existingUser = await this.prisma.user.findFirst({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email already in use');
        }

        const userRole = await this.prisma.role.findUnique({ where: { name: 'USER' } });
        if (!userRole) throw new NotFoundException('USER role not found');

        const user = await this.prisma.user.create({
            data: {
                id: randomUUID(),
                roleId: userRole.id,
                isActive: true,
                ...dto,
            },
        });

        return this.stripSensitiveUserFields(user);
    }   

    async getCurrentUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                lastname: true,
                googleId: true,
                googleStatus: true,
                password: true,
                isEmailVerified: true,
                roleId: true,
                role: {
                    select: { name: true }
                },
                isActive: true,
                organizationId: true,
                organization: {
                    select: {
                        plan: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const { organization, role, password, ...safeUser } = user;

        return {
            ...safeUser,
            role: role.name.trim(),
            organizationPlan: organization?.plan ?? null,
            googleLinked: Boolean(user.googleId),
            isEmailVerified: Boolean((user as any).isEmailVerified),
            hasInternalPassword: Boolean(user.password),
            requiresInternalPasswordSetup: Boolean(
                user.googleId &&
                user.googleStatus === true &&
                !user.password,
            ),
        };
    }

    async getUserById(id: string, requestingUser: PermissionUser) {
        if (!requestingUser.organizationId && !isSuperAdmin(requestingUser)) {
            throw new NotFoundException('User not found');
        }

        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                projectMembers: {
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true,
                                isActive: true,
                            },
                        },
                    },
                    where: {
                        project: {
                            isActive: true,
                            ...(requestingUser.organizationId
                                ? { organizationId: requestingUser.organizationId }
                                : {}),
                        },
                    },
                },
                assignedTasks: {
                    where: {
                        project: {
                            isActive: true,
                            ...(requestingUser.organizationId
                                ? { organizationId: requestingUser.organizationId }
                                : {}),
                        },
                    },
                    select: {
                        id: true,
                    },
                },
                organizationMemberships: requestingUser.organizationId
                    ? {
                        where: { organizationId: requestingUser.organizationId },
                        select: { id: true },
                    }
                    : false,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const hasAccess =
            isSuperAdmin(requestingUser) ||
            Boolean((user as any).organizationMemberships?.length);

        if (!hasAccess) {
            throw new NotFoundException('User not found');
        }

        const safeUser = this.stripSensitiveUserFields(user);
        delete safeUser.organizationMemberships;
        return safeUser;
    }

    async getUsers(user: PermissionUser) {
        if (!user.organizationId) {
            throw new NotFoundException('User must belong to an organization');
        }

        // SECURITY: Return only users from the same organization
        const users = await this.prisma.user.findMany({
            where: { 
                isActive: true,
                organizationMemberships: { some: { organizationId: user.organizationId } }
            },
            select: {
                id: true,
                email: true,
                name: true,
                lastname: true,
                roleId: true,
                role: {
                    select: { name: true }
                },
                isActive: true,
                organizationId: true,
                projectMembers: {
                    select: {
                        id: true,
                        projectId: true,
                        userId: true,
                        role: true,
                        project: {
                            select: {
                                id: true,
                                name: true,
                                isActive: true,
                            },
                        },
                    },
                    where: {
                        project: { isActive: true, organizationId: user.organizationId },
                    },
                },
                assignedTasks: {
                    where: { project: { isActive: true, organizationId: user.organizationId } },
                    select: {
                        id: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const parentTasks = await this.prisma.task.findMany({
            where: {
                parentTaskId: null,
                archivedAt: null,
                project: { isActive: true, organizationId: user.organizationId },
            },
            select: {
                id: true,
                status: true,
                assignedToId: true,
                subTasks: {
                    select: {
                        assignedToId: true,
                    },
                },
            },
        });

        const assignedTasksByUser = new Map<string, Array<{ id: string; status: string }>>();
        for (const task of parentTasks) {
            const assigneeIds = new Set<string>();
            if (task.assignedToId) assigneeIds.add(task.assignedToId);
            for (const subTask of task.subTasks) {
                if (subTask.assignedToId) assigneeIds.add(subTask.assignedToId);
            }
            for (const assigneeId of assigneeIds) {
                const assignedTasks = assignedTasksByUser.get(assigneeId) ?? [];
                assignedTasks.push({ id: task.id, status: task.status });
                assignedTasksByUser.set(assigneeId, assignedTasks);
            }
        }

        return users.map((currentUser) => {
            const { role, ...safeUser } = this.stripSensitiveUserFields(currentUser);
            return {
                ...safeUser,
                assignedTasks: assignedTasksByUser.get(currentUser.id) ?? [],
                role: (role as any).name.trim(),
            };
        });
    }

    async updateUser(id: string, dto: UpdateUserDto, requestingUser: PermissionUser) {
        this.assertSelfOrSuperAdmin(id, requestingUser);
        const userToUpdate = await this.getUserById(id, requestingUser);

        if (dto.password) {
            throw new BadRequestException('Usá el flujo de seguridad para cambiar la contraseña.');
        }

        if (dto.email && dto.email.toLowerCase() !== userToUpdate.email.toLowerCase()) {
            await validateEmailDomain(dto.email);
        }

        const data = {
            ...dto,
            ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
        } as UpdateUserDto & { password?: string };

        const updatedUser = await this.prisma.user.update({
            where: { id },
            data,
        });

        return this.getCurrentUser(updatedUser.id);
    }

    async deactivateUser(id: string, requestingUser: PermissionUser) {
        this.assertSuperAdmin(requestingUser);
        await this.getUserById(id, requestingUser);
        return this.prisma.user.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async activateUser(id: string, requestingUser: PermissionUser) {
        this.assertSuperAdmin(requestingUser);
        await this.getUserById(id, requestingUser);
        return this.prisma.user.update({
            where: { id },
            data: { isActive: true },
        });
    }

    /**
     * Vincula una cuenta Google al usuario, seteando googleId y googleStatus=true.
     * @param userId ID del usuario
     * @param googleId ID de Google
     * @returns Usuario actualizado sin campos sensibles
     */
    async linkGoogleAccount(userId: string, googleId: string, requestingUser: PermissionUser) {
        this.assertSuperAdmin(requestingUser);
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                googleId,
                googleStatus: true,
            },
        });
        return this.stripSensitiveUserFields(user);
    }

    /**
     * Desvincula la cuenta Google: setea googleStatus=false, mantiene googleId
     */
    async unlinkGoogleAccount(userId: string, requestingUser: PermissionUser) {
        this.assertSuperAdmin(requestingUser);
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                googleStatus: false,
            },
        });
        return this.stripSensitiveUserFields(user);
    }

    private assertSelfOrSuperAdmin(userId: string, requestingUser: PermissionUser) {
        if (requestingUser.id !== userId && !isSuperAdmin(requestingUser)) {
            throw new ForbiddenException('You can only update your own account');
        }
    }

    private assertSuperAdmin(requestingUser: PermissionUser) {
        if (!isSuperAdmin(requestingUser)) {
            throw new ForbiddenException('Only SUPERADMIN can use this legacy endpoint');
        }
    }

    /**
     * Deletes the user account based on their role.
     * ADMIN: wipes the entire organization (all members, tasks, time entries, projects) and deletes itself.
     * MEMBER: orphans assigned tasks (assignedToId = null), handles project ownership, then deletes itself.
     * Both paths guarantee the email is fully freed for future re-registration.
     */
    async deleteAccount(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { role: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const ownerMembership = user.organizationId
            ? await this.prisma.organizationMembership.findUnique({
                where: { organizationId_userId: { organizationId: user.organizationId, userId } },
                select: { role: true },
            })
            : null;

        if (ownerMembership?.role === 'ORG_OWNER' && user.organizationId) {
            await this._deleteOrganizationAndAllMembers(user.organizationId);
        } else {
            await this._deleteMemberAccount(userId, user.organizationId);
        }

        return { success: true, message: 'Account deleted successfully' };
    }

    /**
     * Full organization wipe executed in explicit dependency order to satisfy all FK constraints.
     * Deletes: timeEntries → tasks → projectMembers → projects → invites → memberships
     *          → disconnects users from org → deletes org → deletes auth sessions → deletes users.
     * @param orgId ID of the organization to wipe
     */
    private async _deleteOrganizationAndAllMembers(orgId: string) {
        try {
            await this.prisma.$transaction(async (tx) => {
                const orgUsers = await tx.user.findMany({
                    where: { organizationId: orgId },
                    select: { id: true },
                });
                const userIds = orgUsers.map((u) => u.id);

                // 1. Delete time entries (references: org, project, user, task)
                await tx.timeEntry.deleteMany({ where: { organizationId: orgId } });

                // 2. Delete tasks (references: org, project, user)
                await tx.task.deleteMany({ where: { organizationId: orgId } });

                // 3. Delete project members (references: project, user)
                await tx.projectMember.deleteMany({ where: { project: { organizationId: orgId } } });

                // 4. Delete projects (references: org, user as owner)
                await tx.project.deleteMany({ where: { organizationId: orgId } });

                // 5. Delete org invites and memberships
                await tx.organizationInvite.deleteMany({ where: { organizationId: orgId } });
                await tx.organizationMembership.deleteMany({ where: { organizationId: orgId } });

                // 6. Disconnect users from org to allow the org record deletion
                //    (User.organizationId FK without onDelete would otherwise block this)
                await tx.user.updateMany({
                    where: { organizationId: orgId },
                    data: { organizationId: null },
                });

                // 7. Delete the organization record
                await tx.organization.delete({ where: { id: orgId } });

                // 8. Delete auth sessions for all org users
                if (userIds.length > 0) {
                    await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });

                    // 9. Delete all users that belonged to the organization
                    await tx.user.deleteMany({ where: { id: { in: userIds } } });
                }
            });
        } catch (error) {
            throw new InternalServerErrorException('Failed to delete organization and its members');
        }
    }

    /**
     * Deletes a single member account.
     * Tasks assigned to this user are orphaned (assignedToId = null).
     * Projects owned by this user are transferred to the org ADMIN; if no ADMIN exists, those projects are deleted.
     * @param userId ID of the member to delete
     * @param organizationId Organization the member belongs to (may be null)
     */
    private async _deleteMemberAccount(userId: string, organizationId: string | null) {
        try {
            await this.prisma.$transaction(async (tx) => {
                // 1. Orphan all tasks assigned to this user
                await tx.task.updateMany({
                    where: { assignedToId: userId },
                    data: { assignedToId: null },
                });

                // 2. Handle Project.ownerId FK (required field, cannot be set to null)
                if (organizationId) {
                    const orgAdmin = await tx.user.findFirst({
                        where: {
                            id: { not: userId },
                            isActive: true,
                            organizationMemberships: { some: { organizationId, role: 'ORG_OWNER' } },
                        },
                        select: { id: true },
                    });

                    if (orgAdmin) {
                        // Transfer ownership to the existing admin
                        await tx.project.updateMany({
                            where: { ownerId: userId },
                            data: { ownerId: orgAdmin.id },
                        });
                    } else {
                        // No admin to transfer to: delete those projects and their dependencies
                        const ownedProjectIds = (
                            await tx.project.findMany({
                                where: { ownerId: userId },
                                select: { id: true },
                            })
                        ).map((p) => p.id);

                        if (ownedProjectIds.length > 0) {
                            await tx.timeEntry.deleteMany({ where: { projectId: { in: ownedProjectIds } } });
                            await tx.task.deleteMany({ where: { projectId: { in: ownedProjectIds } } });
                            await tx.projectMember.deleteMany({ where: { projectId: { in: ownedProjectIds } } });
                            await tx.project.deleteMany({ where: { id: { in: ownedProjectIds } } });
                        }
                    }
                }

                // 3. Delete the user — Prisma cascades handle: authSessions, timeEntries, projectMembers, orgMemberships
                await tx.user.delete({ where: { id: userId } });
            });
        } catch (error) {
            throw new InternalServerErrorException('Failed to delete member account');
        }
    }
}

