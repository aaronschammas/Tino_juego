-- Add DISABLED status to UserStatus enum
ALTER TYPE "UserStatus" ADD VALUE 'DISABLED' AFTER 'PENDING';

-- Add organizationId and organizationIndex to Task
ALTER TABLE "Task" 
ADD COLUMN "organizationId" TEXT;

-- Update existing tasks to use their project's organizationId
UPDATE "Task" t
SET "organizationId" = p."organizationId"
FROM "Project" p
WHERE t."projectId" = p.id;

-- Make organizationId NOT NULL
ALTER TABLE "Task" 
ALTER COLUMN "organizationId" SET NOT NULL,
ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes to Task
CREATE INDEX "Task_organizationId_idx" ON "Task"("organizationId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- Add organizationId and organizationIndex to TimeEntry
ALTER TABLE "TimeEntry"
ADD COLUMN "organizationId" TEXT;

-- Update existing time entries to use their project's organizationId
UPDATE "TimeEntry" te
SET "organizationId" = p."organizationId"
FROM "Project" p
WHERE te."projectId" = p.id;

-- Make organizationId NOT NULL
ALTER TABLE "TimeEntry"
ALTER COLUMN "organizationId" SET NOT NULL,
ADD CONSTRAINT "TimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes to TimeEntry
CREATE INDEX "TimeEntry_organizationId_idx" ON "TimeEntry"("organizationId");
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");

-- Add UNIQUE constraint to Organization.name (but handle duplicates first)
-- If there are duplicate org names, this will fail - handle manually if needed
ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_name_key" UNIQUE ("name");

-- Add indexes to User for better queries
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- Add index to Organization
CREATE INDEX "Organization_isActive_idx" ON "Organization"("isActive");

-- Add indexes to Project
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");

-- Add index to ProjectMember
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
