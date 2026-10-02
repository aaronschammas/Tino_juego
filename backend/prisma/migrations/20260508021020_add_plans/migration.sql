/*
  Warnings:

  - You are about to drop the column `plan` on the `Organization` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "plan",
ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxUsers" INTEGER,
    "maxProjects" INTEGER,
    "hasAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "hasSso" BOOLEAN NOT NULL DEFAULT false,
    "hasPrioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "hasEmailInvites" BOOLEAN NOT NULL DEFAULT false,
    "hasAdvancedPerms" BOOLEAN NOT NULL DEFAULT false,
    "hasAudit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
