-- Close duplicate active timers keeping only the most recent active entry per user
WITH ranked_active AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "startTime" DESC, id DESC) AS rn
  FROM "TimeEntry"
  WHERE "endTime" IS NULL
)
UPDATE "TimeEntry" te
SET "endTime" = NOW()
FROM ranked_active ra
WHERE te.id = ra.id
  AND ra.rn > 1;

-- Enforce: one active timer per user
CREATE UNIQUE INDEX "TimeEntry_userId_active_unique"
ON "TimeEntry" ("userId")
WHERE "endTime" IS NULL;
