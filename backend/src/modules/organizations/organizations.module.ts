import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from 'src/database/database.module';
import { PlanPolicyModule } from 'src/common/plans/plan-policy.module';
import { OrganizationsService } from './organizations.service';
import {
  OrganizationsController,
  InvitesPublicController,
} from './organizations.controller';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

@Module({
  imports: [
    DatabaseModule,
    PlanPolicyModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.ACCESS_TOKEN_TTL || '15m') as any },
    }),
  ],
  controllers: [OrganizationsController, InvitesPublicController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
