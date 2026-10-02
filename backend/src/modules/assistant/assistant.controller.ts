import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AssistantQueryDto } from './dto/assistant-query.dto';
import { ASSISTANT_SUGGESTIONS, AssistantService } from './assistant.service';

@Controller('mobile/assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  @Get('suggestions')
  suggestions() {
    return { items: ASSISTANT_SUGGESTIONS };
  }

  @Post('query')
  async query(
    @CurrentUser() user: PermissionUser,
    @Body() dto: AssistantQueryDto,
    @Req() request: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      request,
    );
    return this.assistant.query(scopedUser, dto);
  }
}
