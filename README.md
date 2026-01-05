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
| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `DB_PASSWORD` | Password for the PostgreSQL container (min 16 chars). |
| `JWT_SECRET` | Secret key for signing session tokens (min 32 chars). |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console. |
| `EXTENSION_ID` | The ID of your loaded Chrome extension (for CORS). |
| `ENCRYPTION_KEY` | 32-character hex key for data encryption (`openssl rand -hex 16`). |
| `PORT` | Port the backend server listens on (default: 3000). |

### Extension (`extension/.env`)
| Variable | Description |
| :--- | :--- |
| `VITE_API_URL` | URL of your backend server (e.g., `http://localhost:3000`). |
| `VITE_GOOGLE_CLIENT_ID` | Must match the `GOOGLE_CLIENT_ID` in the backend. |
| `VITE_DEBUG` | Set to `true` to enable verbose console logging. |

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
