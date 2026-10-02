import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from 'src/database/database.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.ACCESS_TOKEN_TTL || '15m') as any },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
