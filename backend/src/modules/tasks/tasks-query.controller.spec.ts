import { Test } from '@nestjs/testing';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import { TasksService } from './tasks.service';
import { TasksQueryController } from './tasks-query.controller';

describe('TasksQueryController', () => {
  it('resolves the active organization before listing', async () => {
    const scoped = { id: 'u1', organizationId: 'org-active' };
    const activeOrganization = {
      resolveScopedUser: jest.fn().mockResolvedValue(scoped),
    };
    const tasks = {
      listAccessibleTasks: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [TasksQueryController],
      providers: [
        { provide: TasksService, useValue: tasks },
        { provide: ActiveOrganizationService, useValue: activeOrganization },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = module.get(TasksQueryController);
    const query = { page: 1, pageSize: 25 };
    const request = { headers: { 'x-organization-id': 'org-active' } } as never;
    await controller.list(query, { id: 'u1' }, request);
    expect(activeOrganization.resolveScopedUser).toHaveBeenCalledWith(
      { id: 'u1' },
      request,
    );
    expect(tasks.listAccessibleTasks).toHaveBeenCalledWith(query, scoped);
  });
});
