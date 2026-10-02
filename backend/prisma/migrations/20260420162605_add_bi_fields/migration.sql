-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "estimatedHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
