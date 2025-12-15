-- AlterTable tracked_emails add columns body and user if they don't exist
ALTER TABLE tracked_emails 
ADD COLUMN IF NOT EXISTS body TEXT,
ADD COLUMN IF NOT EXISTS "user" TEXT;
