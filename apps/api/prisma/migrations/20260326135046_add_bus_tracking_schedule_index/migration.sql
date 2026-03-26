-- AlterTable
ALTER TABLE "StopTime" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "BusTracking_scheduleId_idx" ON "BusTracking"("scheduleId");
