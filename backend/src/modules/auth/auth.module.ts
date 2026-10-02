import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { AuthCleanupService } from './auth-cleanup.service';
import { DatabaseModule } from 'src/database/database.module';
import { PlanPolicyModule } from 'src/common/plans/plan-policy.module';
import { OrganizationsModule } from 'src/modules/organizations/organizations.module';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
}

@Module({
    imports: [
        DatabaseModule,
        PlanPolicyModule,
        OrganizationsModule,
        JwtModule.register({
            global: true,
            secret: jwtSecret,
            signOptions: { expiresIn: (process.env.ACCESS_TOKEN_TTL || '15m') as any },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthGuard, AuthCleanupService],
    exports: [AuthService, AuthGuard],
})
export class AuthModule {}
