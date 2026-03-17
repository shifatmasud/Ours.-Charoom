import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken } from "livekit-server-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // LiveKit Token Endpoint
  app.get("/api/get-livekit-token", async (req, res) => {
    const room = req.query.room as string;
    const identity = req.query.identity as string;

    if (!room || !identity) {
      return res.status(400).json({ error: "Missing room or identity" });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(500).json({ error: "LiveKit configuration missing on server" });
    }

    try {
      const at = new AccessToken(apiKey, apiSecret, {
        identity: identity,
      });
      at.addGrant({ roomJoin: true, room: room });

      res.json({ 
        token: await at.toJwt(),
        serverUrl: wsUrl
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
