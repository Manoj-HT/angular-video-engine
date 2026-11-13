import { defineConfig, Plugin } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { updateCompositionInFile } from './packages/studio/src/server/composition-writer';
import {
  listAssets,
  createFolder,
  renameAsset,
  deleteAsset,
  getSafePath
} from './packages/studio/src/server/asset-manager';

function aveWebSocketPlugin(): Plugin {
  let wss: WebSocketServer | null = null;
  const sessionState = {
    activeCompositionId: 'KineticShowcase',
    frame: 0,
    isPlaying: false,
    speed: 1,
    props: {} as Record<string, unknown>,
    loopStart: 0,
    loopEnd: 599,
    audioDestination: 'studio' as 'studio' | 'remote',
    viewersCount: 0
  };

  return {
    name: 'ave-websocket-server',
    configureServer(server) {
      // Direct API endpoint for Video Properties backend code writing
      server.middlewares.use('/api/composition', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { id, newId, title, renderName, width, height, fps, durationInFrames } = data;
              if (!id) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Missing composition id' }));
                return;
              }
              const result = updateCompositionInFile(
                id,
                { id: newId, title, renderName, width, height, fps, durationInFrames },
                import.meta.dirname
              );
              res.statusCode = result.success ? 200 : 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err?.message || String(err) }));
            }
          });
          return;
        }
        next();
      });

      // Asset Library Management Endpoints
      server.middlewares.use('/api/assets', (req, res, next) => {
        const assetsBaseDir = path.resolve(import.meta.dirname, 'public/assets');
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        // 1. GET /api/assets?path=...
        if (req.method === 'GET' && (pathname === '/' || pathname === '')) {
          const relPath = url.searchParams.get('path') || '';
          const result = listAssets(assetsBaseDir, relPath);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }

        // 2. POST /api/assets/upload
        if (req.method === 'POST' && pathname === '/upload') {
          const rawRelPath = req.headers['x-asset-path'];
          const relPath = typeof rawRelPath === 'string' ? decodeURIComponent(rawRelPath) : '';
          const rawFileName = req.headers['x-asset-filename'];
          const fileName = typeof rawFileName === 'string'
            ? decodeURIComponent(rawFileName).trim().replace(/[\\/:*?"<>|]/g, '_')
            : `asset-${Date.now()}`;

          const targetDir = getSafePath(assetsBaseDir, relPath);
          if (!targetDir) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid path' }));
            return;
          }

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const targetFilePath = path.join(targetDir, fileName);
          const writeStream = fs.createWriteStream(targetFilePath);

          req.pipe(writeStream);

          writeStream.on('finish', () => {
            const relItem = path.relative(assetsBaseDir, targetFilePath).replace(/\\/g, '/');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              file: {
                name: fileName,
                path: relItem,
                url: `/assets/${relItem}`
              }
            }));
          });

          writeStream.on('error', (err) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          });
          return;
        }

        // 3. POST /api/assets/folder
        if (req.method === 'POST' && pathname === '/folder') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { path: relPath, folderName } = JSON.parse(body);
              const result = createFolder(assetsBaseDir, relPath || '', folderName);
              res.statusCode = result.success ? 200 : 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 4. POST /api/assets/rename
        if (req.method === 'POST' && pathname === '/rename') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { oldPath, newName } = JSON.parse(body);
              const result = renameAsset(assetsBaseDir, oldPath, newName);
              res.statusCode = result.success ? 200 : 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 5. DELETE /api/assets
        if (req.method === 'DELETE' && (pathname === '/' || pathname === '')) {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const targetPath = data.path || url.searchParams.get('path') || '';
              const result = deleteAsset(assetsBaseDir, targetPath);
              res.statusCode = result.success ? 200 : 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });

      if (!server.httpServer) return;

      wss = new WebSocketServer({ noServer: true });

      server.httpServer.on('upgrade', (request, socket, head) => {
        try {
          const { pathname } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
          if (pathname === '/ave-sync') {
            wss!.handleUpgrade(request, socket, head, (ws) => {
              wss!.emit('connection', ws, request);
            });
          }
        } catch (err) {
          console.error('[AVE-WS] Upgrade error:', err);
        }
      });

      function broadcastViewerCount() {
        if (!wss) return;
        let count = 0;
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) count++;
        }
        sessionState.viewersCount = Math.max(0, count - 1);
        // If all remote viewers have disconnected, automatically route audio back to studio
        if (sessionState.viewersCount === 0) {
          sessionState.audioDestination = 'studio';
        }
        const payload = JSON.stringify({
          type: 'VIEWERS_COUNT',
          count: sessionState.viewersCount,
          total: count,
          audioDestination: sessionState.audioDestination
        });

        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        }
      }

      wss.on('connection', (ws: WebSocket) => {
        let activeClients = 0;
        for (const client of wss!.clients) {
          if (client.readyState === WebSocket.OPEN) activeClients++;
        }
        // If this is the only connected client (new studio tab), start cleanly paused at frame 0
        if (activeClients <= 1) {
          sessionState.isPlaying = false;
          sessionState.frame = 0;
          sessionState.audioDestination = 'studio';
        }

        // Immediate handshake: send authoritative state snapshot
        ws.send(JSON.stringify({ type: 'INIT_STATE', state: sessionState }));

        broadcastViewerCount();

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());

            // Update in-memory session state
            if (msg.type === 'SEEK') sessionState.frame = msg.frame;
            if (msg.type === 'PLAY') {
              sessionState.isPlaying = true;
              sessionState.speed = msg.speed ?? 1;
            }
            if (msg.type === 'PAUSE') {
              sessionState.isPlaying = false;
              if (typeof msg.frame === 'number') sessionState.frame = msg.frame;
            }
            if (msg.type === 'PROPS_UPDATE') sessionState.props = msg.props;
            if (msg.type === 'COMPOSITION_CHANGE') sessionState.activeCompositionId = msg.id;
            if (msg.type === 'AUDIO_DESTINATION') sessionState.audioDestination = msg.destination;
            if (msg.type === 'UPDATE_COMPOSITION_METADATA') {
              updateCompositionInFile(msg.id, msg.metadata, import.meta.dirname);
            }
            if (msg.type === 'LOOP_CHANGE') {
              sessionState.loopStart = msg.loopStart;
              sessionState.loopEnd = msg.loopEnd;
            }

            // Relay message to all other connected clients
            if (wss) {
              for (const client of wss.clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify(msg));
                }
              }
            }
          } catch (e) {
            console.error('[AVE-WS] Error handling message:', e);
          }
        });

        ws.on('close', () => {
          broadcastViewerCount();
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [
    angular(),
    aveWebSocketPlugin()
  ],
  resolve: {
    alias: {
      '@angular-video/core': path.resolve(import.meta.dirname, './packages/core/src/index.ts'),
      '@angular-video/studio': path.resolve(import.meta.dirname, './packages/studio/src/index.ts')
    }
  },
  server: {
    port: 4250,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
