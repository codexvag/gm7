import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

function gameWebSocketPlugin() {
  return {
    name: "game-websocket-server",
    configureServer(server) {
      server.httpServer?.on("upgrade", async (req, socket, head) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          if (url.pathname === "/api/game/ws") {
            const { WebSocketServer } = await import("ws");
            if (!server.__gameWss) {
              server.__gameWss = new WebSocketServer({ noServer: true });
              server.__gameRooms = new Map();
            }
            const wss = server.__gameWss;
            const rooms = server.__gameRooms;
            
            wss.handleUpgrade(req, socket, head, async (clientWs) => {
              const roomId = url.searchParams.get("room") || "mmo-world-village";
              if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
              }
              const roomClients = rooms.get(roomId);
              roomClients.add(clientWs);
              
              clientWs.on("message", (message) => {
                for (const client of roomClients) {
                  if (client !== clientWs && client.readyState === 1) {
                    client.send(message.toString());
                  }
                }
              });
              
              clientWs.on("close", () => {
                roomClients.delete(clientWs);
                if (roomClients.size === 0) rooms.delete(roomId);
              });
            });
          }
        } catch (err) {
          console.error("[Vite Game WS Upgrade Error]:", err);
        }
      });
    },
  };
}

export default defineConfig(async () => {
  return {
    server: {
      host: "0.0.0.0",
      port: 5173,
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      gameWebSocketPlugin()
    ],
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'express', 'ws']
      }
    },
    ssr: {
      external: ['better-sqlite3', 'express', 'ws']
    }
  };
});
