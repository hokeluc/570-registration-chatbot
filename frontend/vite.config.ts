import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

// Flask runs on 5001 because macOS AirPlay Receiver holds 5000.
const FLASK_PORT = process.env.FLASK_PORT ?? '5001'
// Override with FLASK_PYTHON=/path/to/python if the default python3 lacks Flask.
const PYTHON = process.env.FLASK_PYTHON ?? 'python3'

// Starts the Flask backend with `npm run dev` and stops it when Vite exits.
function flaskBackend(): Plugin {
  return {
    name: 'flask-backend',
    apply: 'serve',
    configureServer(server) {
      const backendDir = resolve(__dirname, '../backend')
      const flask = spawn(PYTHON, ['app.py'], {
        cwd: backendDir,
        env: { ...process.env, PORT: FLASK_PORT },
        stdio: 'inherit',
      })
      flask.on('error', (err) => console.error(`[flask] failed to start with "${PYTHON}":`, err.message))

      const stop = () => {
        if (!flask.killed) flask.kill()
      }
      server.httpServer?.on('close', stop)
      process.on('exit', stop)
      process.on('SIGINT', () => {
        stop()
        process.exit()
      })
      process.on('SIGTERM', () => {
        stop()
        process.exit()
      })
    },
  }
}

// In dev, /api/* is forwarded to the Flask backend so we avoid CORS.
export default defineConfig({
  plugins: [react(), flaskBackend()],
  server: {
    proxy: {
      '/api': `http://localhost:${FLASK_PORT}`,
    },
  },
})
