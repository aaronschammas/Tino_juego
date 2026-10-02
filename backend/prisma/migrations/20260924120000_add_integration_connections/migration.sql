-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('TRELLO');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "hasIntegrations" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "externalUrl" TEXT;

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalContainerId" TEXT NOT NULL,
    "externalContainerName" TEXT NOT NULL,
    "externalContainerUrl" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedByUserId" TEXT NOT NULL,
    "webhookId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationStatusMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalGroupId" TEXT NOT NULL,
    "externalGroupName" TEXT NOT NULL,
    "status" "TaskStatus",

    CONSTRAINT "IntegrationStatusMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_projectId_key" ON "IntegrationConnection"("projectId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_organizationId_idx" ON "IntegrationConnection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_organizationId_provider_externalConta_key" ON "IntegrationConnection"("organizationId", "provider", "externalContainerId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationStatusMapping_connectionId_externalGroupId_key" ON "IntegrationStatusMapping"("connectionId", "externalGroupId");

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationStatusMapping" ADD CONSTRAINT "IntegrationStatusMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Plan Max incluye integraciones
UPDATE "Plan" SET "hasIntegrations" = true WHERE "name" = 'max';
