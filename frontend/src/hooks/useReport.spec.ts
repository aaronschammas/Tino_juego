import { buildReportQuery, createDefaultReportFilters } from './useReport';

describe('report filter helpers', () => {
  it('serializes every selected report filter with backend parameter names', () => {
    const query = new URLSearchParams(
      buildReportQuery({
        projectId: 'project-1',
        userId: 'user-1',
        status: 'DONE',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      }),
    );

    expect(Object.fromEntries(query)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      projectIds: 'project-1',
      userIds: 'user-1',
      statuses: 'DONE',
    });
  });

  it('omits all-valued and empty filters', () => {
    expect(
      buildReportQuery({
        projectId: 'all',
        userId: 'all',
        status: 'all',
        startDate: '',
        endDate: '',
      }),
    ).toBe('');
  });

  it('starts with no report filters applied', () => {
    expect(createDefaultReportFilters()).toEqual({
      projectId: 'all',
      userId: 'all',
      status: 'all',
      startDate: null,
      endDate: null,
    });
  });
});
