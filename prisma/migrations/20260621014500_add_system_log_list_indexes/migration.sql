-- Covers system log list filters that page by createdAt descending.
CREATE INDEX "SystemLog_status_createdAt_idx" ON "SystemLog"("status", "createdAt");
CREATE INDEX "SystemLog_level_status_createdAt_idx" ON "SystemLog"("level", "status", "createdAt");
CREATE INDEX "SystemLog_module_action_createdAt_idx" ON "SystemLog"("module", "action", "createdAt");
CREATE INDEX "SystemLog_userId_createdAt_idx" ON "SystemLog"("userId", "createdAt");
