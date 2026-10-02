import { Module } from '@nestjs/common';
import { UsersService } from "./Users.Service";
import { UsersController } from "./Users.Controller";
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
