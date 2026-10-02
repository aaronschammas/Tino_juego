ALTER TABLE "Project" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Project" ADD COLUMN "externalId" TEXT;

ALTER TABLE "Task" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Task" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "Project_organizationId_externalSource_externalId_key" ON "Project"("organizationId", "externalSource", "externalId");
CREATE UNIQUE INDEX "Task_organizationId_externalSource_externalId_key" ON "Task"("organizationId", "externalSource", "externalId");
