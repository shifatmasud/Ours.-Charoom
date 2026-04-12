import { AccessToken } from "livekit-server-sdk";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const room = req.query.room as string;
  const identity = req.query.identity as string;
  const metadata = req.query.metadata as string;

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
      metadata: metadata,
    });
    at.addGrant({ roomJoin: true, room: room });

    return res.json({ 
      token: await at.toJwt(),
      serverUrl: wsUrl
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
