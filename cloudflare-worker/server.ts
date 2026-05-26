// Cloudflare Worker Multiplayer Server utilizing Durable Objects for WebSocket syncing
export interface Env {
  ROOMS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // We handle all websocket traffic at /ws endpoint
    if (url.pathname === "/ws" || url.pathname === "/") {
      const id = env.ROOMS.idFromName("global-lobby");
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }
    
    return new Response("Tox'sCraft Multiplayer Hub. Connect using WebSockets at /ws", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }
};

export class ChatRoom {
  private state: DurableObjectState;
  private sessions: Map<string, {
    socket: WebSocket;
    name?: string;
    x?: number;
    y?: number;
    z?: number;
    yaw?: number;
    pitch?: number;
    skin?: string;
  }> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    await this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleSession(webSocket: WebSocket): Promise<void> {
    webSocket.accept();
    const sessionId = Math.random().toString(36).substring(2, 9);
    
    const session = { socket: webSocket };
    this.sessions.set(sessionId, session);

    // Initial greeting
    webSocket.send(JSON.stringify({
      type: "welcome",
      id: sessionId
    }));

    // Tell the client about all other active sessions
    for (const [id, s] of this.sessions.entries()) {
      if (id !== sessionId && s.name) {
        webSocket.send(JSON.stringify({
          type: "join",
          id: id,
          name: s.name,
          x: s.x ?? 0,
          y: s.y ?? 80,
          z: s.z ?? 0,
          yaw: s.yaw ?? 0,
          pitch: s.pitch ?? 0,
          skin: s.skin ?? "steve"
        }));
      }
    }

    webSocket.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        
        switch (data.type) {
          case "join":
            session.name = data.name;
            session.skin = data.skin;
            session.x = data.x;
            session.y = data.y;
            session.z = data.z;
            session.yaw = data.yaw;
            session.pitch = data.pitch;
            
            // Broadcast join details to all peer clients
            this.broadcast({
              type: "join",
              id: sessionId,
              name: session.name,
              x: session.x,
              y: session.y,
              z: session.z,
              yaw: session.yaw,
              pitch: session.pitch,
              skin: session.skin
            }, sessionId);
            break;

          case "move":
            session.x = data.x;
            session.y = data.y;
            session.z = data.z;
            session.yaw = data.yaw;
            session.pitch = data.pitch;
            
            this.broadcast({
              type: "move",
              id: sessionId,
              x: session.x,
              y: session.y,
              z: session.z,
              yaw: session.yaw,
              pitch: session.pitch
            }, sessionId);
            break;

          case "block":
            // Sync block changes
            this.broadcast({
              type: "block",
              id: sessionId,
              x: data.x,
              y: data.y,
              z: data.z,
              blockId: data.blockId
            }, sessionId);
            break;

          case "chat":
            this.broadcast({
              type: "chat",
              id: sessionId,
              name: session.name || "Player",
              message: data.message
            });
            break;
        }
      } catch (err) {
        console.error("Multiplayer message parse error:", err);
      }
    });

    const closeHandler = () => {
      this.sessions.delete(sessionId);
      this.broadcast({
        type: "leave",
        id: sessionId
      });
    };

    webSocket.addEventListener("close", closeHandler);
    webSocket.addEventListener("error", closeHandler);
  }

  private broadcast(message: any, excludeId?: string): void {
    const payload = JSON.stringify(message);
    for (const [id, session] of this.sessions.entries()) {
      if (id !== excludeId) {
        try {
          session.socket.send(payload);
        } catch (err) {
          // Session socket connection dead
        }
      }
    }
  }
}
