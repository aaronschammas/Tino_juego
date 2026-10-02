-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PROCESSED', 'IGNORED', 'FAILED');

-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "externalAuthorName" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalSource" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "externalGroupId" TEXT;

-- AlterTable
ALTER TABLE "IntegrationConnection" ADD COLUMN     "lastEventAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT;

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "itemExternalId" TEXT,
    "actorExternalId" TEXT,
    "actorName" TEXT,
    "status" "IntegrationEventStatus" NOT NULL,
    "error" TEXT,
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationEvent_connectionId_receivedAt_idx" ON "IntegrationEvent"("connectionId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_connectionId_externalEventId_key" ON "IntegrationEvent"("connectionId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskComment_organizationId_externalSource_externalId_key" ON "TaskComment"("organizationId", "externalSource", "externalId");

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

