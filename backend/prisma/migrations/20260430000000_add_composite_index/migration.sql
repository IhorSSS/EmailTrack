-- CreateIndex
CREATE INDEX "tracked_emails_ownerId_updatedAt_idx" ON "tracked_emails"("ownerId", "updatedAt" DESC);
