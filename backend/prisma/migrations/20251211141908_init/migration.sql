-- CreateTable
CREATE TABLE "tracked_emails" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "recipient" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tracked_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_events" (
    "id" TEXT NOT NULL,
    "trackedEmailId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "device" TEXT,
    "location" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "open_events_trackedEmailId_fkey" FOREIGN KEY ("trackedEmailId") REFERENCES "tracked_emails" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
