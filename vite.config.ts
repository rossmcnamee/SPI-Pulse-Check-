import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const run = promisify(execFile)

// Local dev API: serves live data by running the backend Python scripts (the
// single source of truth for each platform's rules). Results are cached to disk
// so the dashboard stays snappy; a slow upstream crawl only happens on the first
// load (or after the TTL expires).
//   /api/new-patients -> new_patients_json.py  (Cliniko, last 12 weeks)
//   /api/ad-rows       -> ad_rows_json.py       (Google + Meta + YouTube, last 52 weeks)
function liveDataApi(): Plugin {
  const root = __dirname
  const TTL_MS = 30 * 60 * 1000 // 30 minutes

  // Run a backend script (cached) and return its JSON stdout.
  async function cachedScript(script: string, cacheFile: string, weeks: string, force: boolean): Promise<string> {
    if (!force && existsSync(cacheFile) && Date.now() - statSync(cacheFile).mtimeMs < TTL_MS) {
      return readFileSync(cacheFile, 'utf8')
    }
    const { stdout } = await run('python3', [script, weeks], {
      cwd: root,
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    })
    mkdirSync(dirname(cacheFile), { recursive: true })
    writeFileSync(cacheFile, stdout)
    return stdout
  }

  function endpoint(server: import('vite').ViteDevServer, path: string, script: string, cacheFile: string, defaultWeeks: string, failMsg: string) {
    server.middlewares.use(path, async (req, res) => {
      const params = new URL(req.url ?? '', 'http://x').searchParams
      const weeks = params.get('weeks') ?? defaultWeeks
      const force = params.get('refresh') === '1'
      res.setHeader('Content-Type', 'application/json')
      try {
        res.end(await cachedScript(script, cacheFile, weeks, force))
      } catch (e) {
        res.statusCode = 502
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : failMsg }))
      }
    })
  }

  return {
    name: 'spi-live-data-api',
    configureServer(server) {
      endpoint(
        server, '/api/new-patients',
        resolve(root, 'backend/scripts/new_patients_json.py'),
        resolve(root, 'backend/.cache/new_patients.json'),
        '12', 'Cliniko fetch failed',
      )
      endpoint(
        server, '/api/ad-rows',
        resolve(root, 'backend/scripts/ad_rows_json.py'),
        resolve(root, 'backend/.cache/ad_rows.json'),
        '52', 'Ad platform fetch failed',
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), liveDataApi()],
  server: { host: true },
})
