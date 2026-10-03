import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { DEMO_SCENARIO_KEYS } from './demo-scenarios';
import { DemoService, type DemoUser } from './demo.service';

export class DemoScenarioDto {
  @IsString()
  @IsIn(DEMO_SCENARIO_KEYS)
  scenario: string;
}

/** Endpoints del juego de la feria. Solo existen con DEMO_MODE=true (ver app.module.ts). */
@Controller('demo')
@UseGuards(AuthGuard)
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('scenarios')
  scenarios() {
    return this.demo.listScenarios();
  }

  @Post('reset')
  @HttpCode(200)
  reset(@Body() dto: DemoScenarioDto, @CurrentUser() user: DemoUser) {
    return this.demo.reset(dto.scenario, user);
  }

  @Get('state')
  state(@Query() query: DemoScenarioDto, @CurrentUser() user: DemoUser) {
    return this.demo.getState(query.scenario, user);
  }
}
