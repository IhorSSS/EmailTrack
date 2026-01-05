# EmailTrack

**EmailTrack** is a privacy-first Chrome Extension and Backend service for tracking email opens directly within Gmail. It empowers users with real-time analytics on who opens their emails, when, and from where, without relying on third-party SaaS subscriptions or sharing data with external providers.

## ✨ Features

- **Seamless Gmail Integration**: Adds a native "Track" toggle to the Gmail Compose window.
- **Real-Time Analytics**:
    - **Open Tracking**: See when your emails are read (updated in dashboard).
    - **Geo-Location**: See the city and country of the recipient.
    - **Device Info**: Detects if the email was opened on Mobile or Desktop.
    - **History**: View a detailed timeline of all interaction events.
- **Privacy-First Architecture**:
    - **Self-Hosted Backend**: You own the data. No third-party servers peering into your metadata.
    - **Secure Communication**: All tracking data is encrypted and stored in your own PostgreSQL database.
- **Dashboard**:
    - **Extension Popup**: Quick view of recent activity and global statistics.
    - **In-Box Indicators**: Visual indicators in your "Sent" folder showing read status at a glance.

## 🛠 Technology Stack

- **Extension**:
    - **Framework**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
    - **Manifest**: V3 (Future-proof)
    - **Build Tool**: [CRXJS](https://crxjs.dev/)
- **Backend**:
    - **Runtime**: [Node.js](https://nodejs.org/)
    - **Framework**: [Fastify](https://www.fastify.io/) (High performance)
    - **Database**: [PostgreSQL](https://www.postgresql.org/)
    - **ORM**: [Prisma](https://www.prisma.io/)
    - **Geolocation**: GeoIP Lite

## 🚀 Deployment Guide

This guide assumes you want to run the full stack (Backend + Extension) yourself.

### Prerequisites

- **Docker** & **Docker Compose**
- **Node.js** (v18+) for building the extension

### 1. Backend Deployment

The backend manages the invisible tracking pixels and stores analytics data.

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/yourusername/EmailTrack.git
    cd EmailTrack
    ```

2.  **Configuration**:
    Copy the example environment file for the backend.
    ```bash
    cp backend/.env.example backend/.env
    # Edit backend/.env and set a secure DB_PASSWORD and JWT_SECRET
    ```

3.  **Start Services**:
    Run the backend and database using Docker Compose (from the root directory).
    ```bash
    docker compose up -d --build
    ```
    The API will be available at `http://localhost:3000`.

### Updating the Application

Since this setup builds from your local source code, updating is simple:
1.  **Pull connection changes**:
    ```bash
    git pull origin main
    ```
2.  **Rebuild containers**:
    ```bash
    docker compose up -d --build
    ```
    *This will rebuild the backend with the latest code.*

### 2. Extension Installation

The extension interacts with Gmail and sends tracking data to your backend.

1.  **Navigate to Extension Directory**:
    ```bash
    cd ../extension
    ```

2.  **Configuration**:
    Create the environment config file.
    ```bash
    cp .env.example .env
    ```
    **Edit `.env`**:
    - `VITE_API_URL`: Set this to your backend URL (e.g., `http://localhost:3000` or `https://your-api-domain.com`).
    - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID (required for user authentication).

3.  **Build the Extension**:
    ```bash
    npm install
    npm run build
    ```

4.  **Load into Chrome**:
    1.  Open Chrome and navigate to `chrome://extensions`.
    2.  Enable **Developer mode** in the top right corner.
    3.  Click **Load unpacked**.
    4.  Select the `EmailTrack/extension/dist` folder generated in the previous step.

## 💻 Development

Want to contribute or modify the code?

**Backend Development**:
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

**Extension Development**:
```bash
cd extension
npm install
npm run dev
```
*The extension will auto-reload on code changes.*

## 🔒 Security

- **Data Ownership**: Since you host the backend, user tracking data never leaves your infrastructure.
- **Environment Variables**: Sensitive keys (DB passwords, OAuth secrets) are managed strictly via `.env` files and are never hardcoded.

## 📄 License

[MIT](LICENSE)
