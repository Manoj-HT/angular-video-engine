import { defineConfig, Plugin } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

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
