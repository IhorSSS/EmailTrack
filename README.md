# EmailTrack

An advanced Chrome Extension and Backend system to track email opens in Gmail.

## Features
- **Gmail Integration**: Adds "Track" toggle to Compose window.
- **Tracking**: Injects 1x1 invisible pixel into sent emails.
- **Analytics**: Tracks IP, Device, Location, and Time of email opens.
- **Security**: Emails are registered securely.
- **Dashboard**: Extension popup shows global stats; In-Gmail UI shows per-email stats in Sent folder.

## Setup Instructions

### 1. Backend Setup
The backend handles tracking and data storage.

**Prerequisites:** Docker & Docker Compose (or local Node.js + PostgreSQL).

1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Start Database:
   ```bash
   # From root
   docker compose up -d postgres
   ```
3. Install Dependencies & Setup DB:
   ```bash
   npm install
   npx prisma generate
   npx prisma push # or migrate dev
   ```
4. Start Server:
   ```bash
   npm run dev
   # Server runs on http://localhost:3000
   ```
   
> **Note**: For production, update `.env` and `docker-compose.yml`.

### 2. Extension Setup
The extension injects into Gmail.

1. Navigate to `extension`:
   ```bash
   cd extension
   ```
2. Install Dependencies:
   ```bash
   npm install
   ```
3. Build for Production:
   ```bash
   npm run build
   ```
4. Load into Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer Mode"
   - Click "Load unpacked"
   - Select `EmailTrack/extension/dist` folder.

## Usage
1. Open Gmail.
2. Click "Compose".
3. You will see an "Eye" icon near the toolbar. Click it to enable tracking (turns blue).
4. Send email.
5. Go to "Sent" folder/items.
6. Open the email. You should see "0 Opens" (or more) near the sender name/subject.
7. Click the Extension icon in Chrome toolbar to see a dashboard of all tracked emails.

## Tech Stack
- **Backend**: Fastify, TypeScript, Prisma, PostgreSQL, GeoIP Lite.
- **Frontend**: React, Vite, CRXJS, Vanilla CSS (Dark Mode).
- **Testing**: Vitest (TDD Application).
