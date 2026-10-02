-- Renombrar status a googleStatus y cambiar a boolean
ALTER TABLE "User" DROP COLUMN "status";
ALTER TABLE "User" ADD COLUMN "googleStatus" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "User_googleStatus_idx" ON "User"("googleStatus");
DROP INDEX IF EXISTS "User_status_idx";