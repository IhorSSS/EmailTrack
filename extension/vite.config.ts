import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const manifestWithEnv = {
    ...manifest,
    oauth2: {
      ...manifest.oauth2,
      client_id: env.VITE_GOOGLE_CLIENT_ID || manifest.oauth2.client_id
    },
    host_permissions: manifest.host_permissions.map(permission =>
      permission.includes('api.yourdomain.com') && env.VITE_API_URL
        ? `${env.VITE_API_URL}/*`
        : permission
    )
  }

  return {
    plugins: [
      react(),
      crx({ manifest: manifestWithEnv }),
    ],
    build: {
      rollupOptions: {
        input: {
          logic: 'src/injected/logic.ts'
        },
        output: {
          entryFileNames: '[name].js',
        }
      }
    }
  }
})
