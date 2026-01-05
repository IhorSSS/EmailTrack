import { defineConfig } from 'vite';
import path from 'path';

// Dedicated build for the injected logic script (IIFE format)
export default defineConfig(({ mode }) => ({
    build: {
        emptyOutDir: false, // Don't wipe dist (main build puts files there)
        lib: {
            entry: path.resolve(__dirname, 'src/injected/logic.ts'),
            name: 'EmailTrackLogic',
            fileName: () => 'logic.js',
            formats: ['iife']
        },
        rollupOptions: {
            output: {
                // Ensure it writes correctly to dist/logic.js
                dir: 'dist',
            }
        }
    },
    esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    define: {
        'process.env': {} // Polyfill to prevent crashes if libs access it
    }
}));

