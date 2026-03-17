
import ZoomVideo, { VideoClient } from '@zoom/videosdk';

class ZoomService {
  private client: VideoClient;
  private isInitialized = false;

  constructor() {
    this.client = ZoomVideo.createClient();
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      // Note: In a real app, you should generate the signature on the server
      // for security. This is a placeholder for the initialization logic.
      await this.client.init('en-US', 'Global', { patchJsMedia: true });
      this.isInitialized = true;
      console.log('Zoom Video SDK initialized');
    } catch (error) {
      console.error('Zoom Video SDK initialization failed:', error);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  async joinSession(sessionName: string, token: string, userName: string) {
    await this.init();
    return this.client.join(sessionName, token, userName);
  }

  async leaveSession() {
    return this.client.leave();
  }
}

export const zoomService = new ZoomService();
