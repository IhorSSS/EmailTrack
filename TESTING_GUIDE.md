# Local Testing Guide for EmailTrack

To verify the extension and backend works—especially the **Tracking Pixel** inside Gmail—you need to expose your local backend to the internet. 

**Why?** Gmail proxies all images through Google's servers (`googleusercontent.com`). These servers cannot reach your `localhost`.

I have prepared a workflow to make this easy.

## 1. Start the Backend
Open a terminal in `EmailTrack/backend`:
```bash
npm run dev
```
(Ensure your database is running via `docker compose up -d postgres`)

## 2. Expose Backend (The "Better Way")
In a **new** terminal window, run:
```bash
npx localtunnel --port 3000
```
This will give you a URL like `https://warm-river-42.loca.lt`. **Copy this URL.**

> **Note**: `localtunnel` sometimes asks for a password on first visit. If so, visit the URL in your browser and enter the password it tells you to (usually your IP). Or use `ngrok` if you prefer.

## 3. Configure the Extension
Since we are testing with a dynamic URL, we need to quickly update the extension to use this tunnel URL instead of `localhost`.

1. Open `EmailTrack/extension/src/background/index.ts`
2. Change `API_BASE`:
   ```typescript
   // const API_BASE = 'http://localhost:3000';
   const API_BASE = 'https://YOUR-TUNNEL-URL.loca.lt'; 
   ```
3. Open `EmailTrack/extension/src/content/index.tsx`
4. Change `host` in `injectStats` and `handleSendClick` (or `TRACKING_PIXEL_DOMAIN`):
   ```typescript
   // const host = 'http://localhost:3000';
   const host = 'https://YOUR-TUNNEL-URL.loca.lt';
   ```
5. **Rebuild the extension**:
   ```bash
   cd EmailTrack/extension
   npm run build
   ```

## 4. Install in Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in top right).
3. Click **Load unpacked**.
4. Select the `EmailTrack/extension/dist` folder.

## 5. Test It!
1. Open Gmail.
2. Compose a new email.
3. Click the **Eye Icon** (Track) in the toolbar.
4. Send the email to yourself (or another address).
5. Open the email in your Inbox (or Sent folder).
6. **Wait a moment**: Google will fetch the pixel from your Tunnel URL.
7. Check the Extension Popup or the "Opened" status in Gmail.

## Summary of Folders
- `backend/` : Run server here.
- `extension/dist/` : This is the folder you load into Chrome.
