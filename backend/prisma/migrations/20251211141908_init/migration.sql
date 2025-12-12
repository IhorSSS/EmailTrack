-- CreateTable
CREATE TABLE "tracked_emails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT,
    "recipient" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "open_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackedEmailId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "device" TEXT,
    "location" TEXT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_events_trackedEmailId_fkey" FOREIGN KEY ("trackedEmailId") REFERENCES "tracked_emails" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
