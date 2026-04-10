import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/index.ts') // must be build.lib.entry - top-level entry not supported
      }
    },
    resolve: {
      alias: {
        '@electron': resolve('electron')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload.ts') // same - must be build.lib.entry
      },
      rollupOptions: {
        output: {
          format: 'cjs',  // required for sandbox: true - Electron 30 cannot load ESM preloads under sandbox
          entryFileNames: '[name].js',  // output as .js not .mjs
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: resolve('index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],           // prevent Vite pre-bundling the full 1400-icon barrel
      include: ['lucide-react/dynamicIconImports'],  // pre-bundle the import map as a single chunk
    },
  }
})
