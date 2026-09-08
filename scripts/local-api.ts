import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadEnv, type Plugin } from 'vite'

type Handler = typeof import('../api/chat')['default']
const MAX_BODY_BYTES = 8 * 1024 * 1024

/** Local-only adapter for the same handler used by the Vercel deployment. */
export function localApi(): Plugin {
  const middleware = (loadHandler: () => Promise<Handler>) =>
    async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (req.url?.split('?')[0] !== '/api/chat') { next(); return }
      const json = (status: number, body: unknown) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(body))
      }
      if (req.method !== 'POST') { json(405, { error: 'Use POST for this endpoint.' }); return }
      // The local runner is for this browser only; reject cross-origin callers.
      const origin = req.headers.origin
      if (origin && origin !== `http://${req.headers.host}`) {
        json(403, { error: 'Request origin does not match this local app.' }); return
      }
      let size = 0
      const chunks: Buffer[] = []
      try {
        for await (const chunk of req) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          size += bytes.length
          if (size > MAX_BODY_BYTES) { json(413, { error: 'Request is too large.' }); return }
          chunks.push(bytes)
        }
        let body: unknown
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
        catch { json(400, { error: 'Invalid JSON request.' }); return }
        const handler = await loadHandler()
        const response = {
          status(code: number) { res.statusCode = code; return response },
          json(body: unknown) { json(res.statusCode, body) },
          setHeader(name: string, value: string) { res.setHeader(name, value) },
          write(chunk: string) { res.write(chunk) },
          end() { res.end() },
        }
        await handler({ method: req.method, body }, response)
      } catch {
        if (!res.headersSent) json(500, { error: 'Local server could not complete the request. Check the setup instructions.' })
        else res.end()
      }
    }

  return {
    name: 'leopa-local-api',
    configResolved(config) {
      const values = loadEnv(config.mode, config.envDir, 'ANTHROPIC_')
      if (!process.env.ANTHROPIC_API_KEY && values.ANTHROPIC_API_KEY) {
        process.env.ANTHROPIC_API_KEY = values.ANTHROPIC_API_KEY
      }
    },
    configureServer(server) {
      server.middlewares.use(middleware(async () => {
        const module = await server.ssrLoadModule('/api/chat.ts')
        return module.default as Handler
      }))
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(async () => {
        const module = await import(pathToFileURL(resolve(server.config.root, 'dist-server/chat.js')).href)
        return module.default as Handler
      }))
    },
  }
}
