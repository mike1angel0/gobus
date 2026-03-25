-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_userId_status_createdAt_idx" ON "Booking"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BookingSeat_scheduleId_tripDate_idx" ON "BookingSeat"("scheduleId", "tripDate");

-- CreateIndex
CREATE INDEX "Delay_scheduleId_tripDate_active_idx" ON "Delay"("scheduleId", "tripDate", "active");

-- CreateIndex
CREATE INDEX "Schedule_routeId_status_tripDate_idx" ON "Schedule"("routeId", "status", "tripDate");

-- CreateIndex
CREATE INDEX "Schedule_busId_status_tripDate_idx" ON "Schedule"("busId", "status", "tripDate");

-- CreateIndex
CREATE INDEX "Schedule_driverId_status_idx" ON "Schedule"("driverId", "status");
