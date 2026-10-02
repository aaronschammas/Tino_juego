-- CreateEnum
CREATE TYPE "IntegrationActivityKind" AS ENUM ('TASK_CREATED', 'STATUS_CHANGED', 'TASK_ARCHIVED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "whatsappDigestSentAt" TIMESTAMP(3),
ADD COLUMN     "whatsappLastInboundAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationMembership" ADD COLUMN     "activitySeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IntegrationActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" "IntegrationActivityKind" NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus",
    "actorName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationActivity_organizationId_occurredAt_idx" ON "IntegrationActivity"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "IntegrationActivity_taskId_idx" ON "IntegrationActivity"("taskId");

-- AddForeignKey
ALTER TABLE "IntegrationActivity" ADD CONSTRAINT "IntegrationActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationActivity" ADD CONSTRAINT "IntegrationActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationActivity" ADD CONSTRAINT "IntegrationActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
