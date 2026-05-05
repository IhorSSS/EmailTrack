# EmailTrack: Professional Email Tracking Solution

**EmailTrack** is a high-performance, privacy-focused Chrome Extension designed to provide real-time insights into your email interactions. It seamlessly integrates with Gmail to track opens, identify recipient devices, and provide geographic location data without compromising user experience.

---

## 🚀 Features

-   **Real-time Open Tracking:** Get notified the instant your emails are opened.
-   **Advanced Analytics:** Track IP addresses, User Agents, device types, and approximate geographic locations.
-   **Seamless Gmail Integration:** Built on top of `InboxSDK` and `Gmail-JS` for a native feel.
-   **Privacy-First Design:** Direct communication between your extension and your self-hosted backend.
-   **Multi-Account Support:** Handles multiple senders and accounts within the same browser instance.
-   **Incognito/Anonymous Mode:** Robust local history tracking even without a cloud account.

---

## 🛠 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript, InboxSDK, Gmail-JS, Lucide React |
| **Backend** | Fastify, TypeScript, Prisma ORM, Zod, GeoIP-lite |
| **Database** | PostgreSQL |
| **DevOps** | Docker, Docker Compose, Vitest (Testing) |

---

## 📁 Project Structure

```text
EmailTrack/
├── backend/                # Fastify server & Prisma schema
│   ├── prisma/             # Database migrations & schema
│   ├── src/                # Backend logic (routes, services, utils)
│   └── vitest.config.ts    # Backend test configuration
├── extension/              # Chrome Extension source
│   ├── src/                # React components & background logic
│   ├── public/             # Static assets (icons, manifest)
│   └── vite.config.ts      # Extension build configuration
├── docker-compose.yml      # Infrastructure orchestration
└── README.md               # You are here
```

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
-   **Node.js** (v20 or higher recommended)
-   **npm** (comes with Node)
-   **Docker & Docker Compose** (for database and containerized deployment)
-   **Google Cloud Console Account** (for OAuth setup)

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

> Copy `backend/.env.example` to `backend/.env` and fill in your values.

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | Docker: auto | PostgreSQL connection string. Auto-built in Docker from `DB_PASSWORD`. |
| `DB_PASSWORD` | ✅ | Password for the PostgreSQL container (min 16 chars). |
| `JWT_SECRET` | ✅ prod | Secret key for signing session tokens (min 32 chars). Generate: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | ✅ | 32-character key for AES-256 data encryption. Generate: `openssl rand -hex 16` |
| `GOOGLE_CLIENT_ID` | ✅ | OAuth 2.0 Client ID from Google Cloud Console. |
| `EXTENSION_ID` | ✅ | Chrome extension ID (find at `chrome://extensions`). Used for CORS. |
| `PORT` | ❌ | Port the backend listens on. Default: `3000` |
| `BASE_URL` | ✅ prod | Public URL of the backend (e.g., `https://emailtrack.yourdomain.com`). Used for pixel URLs. |
| `CORS_ALLOWED_ORIGINS` | ❌ | Comma-separated allowed CORS origins. Dev defaults to `localhost`. |
| `RATE_LIMIT_ALLOW_LIST` | ❌ | Comma-separated IPs to exclude from rate limiting. Default: `127.0.0.1` |
| `VIRTUAL_HOST` | ❌ | Domain for nginx-proxy / Let's Encrypt (Docker only). |
| `LETSENCRYPT_EMAIL` | ❌ | Email for Let's Encrypt SSL certificate notifications (Docker only). |

### Extension (`extension/.env`)

> Copy `extension/.env.example` to `extension/.env` and fill in your values.
> These variables are injected at **build time** — after changing, rebuild with `npm run build`.

| Variable | Required | Description |
| :--- | :---: | :--- |
| `VITE_API_URL` | ✅ | URL of your backend server (e.g., `https://emailtrack.yourdomain.com`). |
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Must match `GOOGLE_CLIENT_ID` in the backend `.env`. |
| `VITE_DEBUG` | ❌ | Set to `true` for verbose logging. Default: `false`. Set `false` for production. |

---

## 🛠 Installation & Running (Local Development)

### Step 1: Clone and Install
```bash
git clone <your-repo-url>
cd EmailTrack

# Install backend dependencies
cd backend && npm install

# Install extension dependencies
cd ../extension && npm install
```

### Step 2: Infrastructure Setup
1. Create `.env` files in both `backend/` and `extension/` using the provided `.env.example` templates.
2. Start the PostgreSQL database:
```bash
docker-compose up -d postgres
```

### Step 3: Database Migrations
Run the following command from the `backend/` directory to set up the schema:
```bash
npm run migrate
```

### Step 4: Start Development Servers
**Backend:**
```bash
# In backend/ folder
npm run dev
```

**Extension:**
```bash
# In extension/ folder
npm run dev
```

### Step 5: Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder (ensure you have run `npm run build` at least once, or `npm run dev` is running).

---

## 📦 Build for Production

### Backend
```bash
cd backend
npm run build
# Start production server
npm start
```

### Extension
```bash
cd extension
npm run build
```
The production-ready artifacts will be located in `extension/dist`.

---

## 🏗 Architecture Overview

1.  **Tracking Pixel:** When an email is sent, the extension injects a unique, invisible 1x1 tracking pixel hosted on your backend.
2.  **Detection:** When the recipient opens the email, their client requests the image from your server.
3.  **Data Capture:** The backend (Fastify) extracts metadata from the request (IP, User Agent) and logs an `OpenEvent` via Prisma.
4.  **Syncing:** The extension periodically syncs local tracking data with the backend to provide a unified dashboard.

---

## 🛡 License

**Proprietary / Private**
Copyright © 2026. All rights reserved.
