import * as THREE from 'three';
import { Game } from '../Game';
import { eventBus } from '../EventBus';

export interface RemotePlayer {
  id: string;
  name: string;
  skin: string;
  mesh: THREE.Group;
  targetPos: THREE.Vector3;
  targetYaw: number;
  targetPitch: number;
  lastUpdate: number;
}

export class MultiplayerManager {
  private game: Game;
  private socket: WebSocket | null = null;
  private isConnected = false;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private lastSendTime = 0;
  private sendInterval = 50; // position syncing tick rate (20 hz)

  constructor(game: Game) {
    this.game = game;
    this.setupLocalEventListeners();
  }

  public connect(url: string, username: string): void {
    if (this.isConnected || this.socket) {
      this.disconnect();
    }

    const wsUrl = url.trim() || "ws://localhost:8787/ws";
    this.updateStatus("Connecting...");

    try {
      this.socket = new WebSocket(wsUrl);
    } catch (err: any) {
      this.updateStatus("Error: " + err.message);
      return;
    }

    this.socket.addEventListener("open", () => {
      this.isConnected = true;
      this.updateStatus("Connected");
      eventBus.emit('show_toast', `Connected to server!`);

      // Retrieve selected skin
      const skinName = (document.querySelector('.skin-option.selected')?.getAttribute('data-skin')) || 'steve';
      const pos = this.game.player.position;
      
      this.send({
        type: "join",
        name: username || "Steve",
        skin: skinName,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: this.game.player.yaw,
        pitch: this.game.player.pitch
      });
    });

    this.socket.addEventListener("close", () => {
      this.cleanup();
    });

    this.socket.addEventListener("error", (e) => {
      console.error("Multiplayer socket error:", e);
      this.updateStatus("Error");
      this.cleanup();
    });

    this.socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (err) {
        console.error("Failed to parse socket message:", err);
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isConnected = false;
    this.socket = null;
    
    // Clear peer meshes from Three scene
    for (const player of this.remotePlayers.values()) {
      this.game.renderer.scene.remove(player.mesh);
    }
    this.remotePlayers.clear();
    this.updateStatus("Offline");
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case "welcome":
        break;

      case "join":
        this.spawnRemotePlayer(data);
        break;

      case "move":
        const p = this.remotePlayers.get(data.id);
        if (p) {
          p.targetPos.set(data.x, data.y, data.z);
          p.targetYaw = data.yaw;
          p.targetPitch = data.pitch;
          p.lastUpdate = performance.now();
        }
        break;

      case "leave":
        const lp = this.remotePlayers.get(data.id);
        if (lp) {
          this.game.renderer.scene.remove(lp.mesh);
          this.remotePlayers.delete(data.id);
          eventBus.emit('show_toast', `${lp.name} left the game.`);
        }
        break;

      case "block":
        const { x, y, z, blockId } = data;
        this.game.chunkManager.setBlock(x, y, z, blockId);
        
        // Mark chunk and neighbors dirty
        const markDirty = (cx: number, cz: number) => {
          const chunk = this.game.chunkManager.getChunk(cx, cz);
          if (chunk) chunk.isDirty = true;
        };
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        markDirty(cx, cz);
        if ((x % 16) === 0) markDirty(cx - 1, cz);
        if ((x % 16) === 15) markDirty(cx + 1, cz);
        if ((z % 16) === 0) markDirty(cx, cz - 1);
        if ((z % 16) === 15) markDirty(cx, cz + 1);
        break;

      case "chat":
        eventBus.emit('show_toast', `<${data.name}> ${data.message}`);
        break;
    }
  }

  private spawnRemotePlayer(data: any): void {
    if (this.remotePlayers.has(data.id)) return;

    const mesh = this.game.renderer.createRemotePlayerMesh(data.skin, data.name);
    mesh.position.set(data.x, data.y, data.z);

    this.remotePlayers.set(data.id, {
      id: data.id,
      name: data.name,
      skin: data.skin,
      mesh: mesh,
      targetPos: new THREE.Vector3(data.x, data.y, data.z),
      targetYaw: data.yaw,
      targetPitch: data.pitch,
      lastUpdate: performance.now()
    });

    eventBus.emit('show_toast', `${data.name} joined the game.`);
  }

  private send(packet: any): void {
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(packet));
    }
  }

  public update(now: number): void {
    if (!this.isConnected) return;

    // Send local movements to server
    if (now - this.lastSendTime > this.sendInterval) {
      const pos = this.game.player.position;
      this.send({
        type: "move",
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: this.game.player.yaw,
        pitch: this.game.player.pitch
      });
      this.lastSendTime = now;
    }

    // Interpolate remote players positions/rotations and swing limbs
    for (const player of this.remotePlayers.values()) {
      const lerpFactor = 0.2;
      player.mesh.position.lerp(player.targetPos, lerpFactor);

      // Interpolate horizontal rotation
      player.mesh.rotation.y = player.mesh.rotation.y + (player.targetYaw + Math.PI - player.mesh.rotation.y) * lerpFactor;
      
      const head = player.mesh.getObjectByName('head');
      if (head) {
        head.rotation.x = head.rotation.x + (-player.targetPitch - head.rotation.x) * lerpFactor;
      }

      // Limb swing animations based on distance moved
      const distMoved = player.mesh.position.distanceTo(player.targetPos);
      const isMoving = distMoved > 0.02;
      
      const leftLeg = player.mesh.getObjectByName('leftLeg');
      const rightLeg = player.mesh.getObjectByName('rightLeg');
      const leftArm = player.mesh.getObjectByName('leftArm');
      const rightArm = player.mesh.getObjectByName('rightArm');

      if (isMoving) {
        const swingSpeed = 12.0;
        const swingAngle = 0.6 * Math.sin(now * 0.0015 * swingSpeed);
        if (leftLeg) leftLeg.rotation.x = swingAngle;
        if (rightLeg) rightLeg.rotation.x = -swingAngle;
        if (leftArm) leftArm.rotation.x = -swingAngle;
        if (rightArm) rightArm.rotation.x = swingAngle;
      } else {
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
        if (leftArm) leftArm.rotation.x = 0;
        if (rightArm) rightArm.rotation.x = 0;
      }
    }
  }

  private setupLocalEventListeners(): void {
    // Listen to local changes to broadcast them
    eventBus.on('block_placed', (data: { x: number; y: number; z: number; blockId: number }) => {
      this.send({
        type: "block",
        x: data.x,
        y: data.y,
        z: data.z,
        blockId: data.blockId
      });
    });

    eventBus.on('block_broken', (data: { x: number; y: number; z: number }) => {
      this.send({
        type: "block",
        x: data.x,
        y: data.y,
        z: data.z,
        blockId: 0
      });
    });
  }

  public sendChatMessage(message: string): void {
    if (!message.trim()) return;
    this.send({
      type: "chat",
      message: message
    });
  }

  private updateStatus(status: string): void {
    const el = document.getElementById("mp-status-msg");
    if (el) {
      el.textContent = status;
      if (status === "Connected") {
        el.style.color = "#2ecc71";
      } else if (status.startsWith("Connecting")) {
        el.style.color = "#f1c40f";
      } else {
        el.style.color = "#e25858";
      }
    }
    const btn = document.getElementById("btn-mp-connect") as HTMLButtonElement;
    if (btn) {
      btn.textContent = status === "Connected" ? "Disconnect" : "Connect";
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}
