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

  /** Botón "Finalizar partida" de /feria: termina la partida ahora y devuelve el estado con el puntaje. */
  @Post('finish')
  @HttpCode(200)
  finish(@Body() dto: DemoScenarioDto, @CurrentUser() user: DemoUser) {
    return this.demo.finish(dto.scenario, user);
  }

  /** Lo llama /feria al volver al inicio: borra las partidas para que el próximo visitante empiece de cero. */
  @Post('reset-all')
  @HttpCode(200)
  resetAll(@CurrentUser() user: DemoUser) {
    return this.demo.resetAll(user);
  }

  @Get('state')
  state(@Query() query: DemoScenarioDto, @CurrentUser() user: DemoUser) {
    return this.demo.getState(query.scenario, user);
  }

  /** Lo llama el juego cada segundo: apaga timers terminados y aplica consecuencias. */
  @Post('tick')
  @HttpCode(200)
  tick(@Body() dto: DemoScenarioDto, @CurrentUser() user: DemoUser) {
    return this.demo.tick(dto.scenario, user);
  }
}
