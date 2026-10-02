CREATE INDEX "Task_organizationId_projectId_parentTaskId_idx" ON "Task"("organizationId", "projectId", "parentTaskId");
CREATE INDEX "Task_organizationId_projectId_status_idx" ON "Task"("organizationId", "projectId", "status");

CREATE INDEX "TimeEntry_organizationId_projectId_startTime_idx" ON "TimeEntry"("organizationId", "projectId", "startTime");
CREATE INDEX "TimeEntry_userId_endTime_idx" ON "TimeEntry"("userId", "endTime");
