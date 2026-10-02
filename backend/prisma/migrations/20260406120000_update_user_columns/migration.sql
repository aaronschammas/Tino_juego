ALTER TABLE "User"
ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isemailverified" BOOLEAN DEFAULT false;

UPDATE "User"
SET "isemailverified" = false
WHERE "isemailverified" IS NULL;

CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_googleId_idx" ON "User"("googleId");
