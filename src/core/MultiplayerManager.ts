import * as THREE from 'three';
import { Game } from '../Game';
import { eventBus } from '../EventBus';
import { 
  database, 
  ref, 
  set, 
  push, 
  onChildAdded, 
  onChildChanged, 
  onChildRemoved, 
  remove, 
  onDisconnect 
} from './FirebaseManager';

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
  private isConnected = false;
  private mySessionId: string | null = null;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private lastSendTime = 0;
  private sendInterval = 100; // syncing position tick rate (100 ms)
  private unsubscribes: (() => void)[] = [];

  constructor(game: Game) {
    this.game = game;
    this.setupLocalEventListeners();
  }

  public connect(_url: string, username: string): void {
    if (this.isConnected) {
      this.disconnect();
    }

    this.updateStatus("Connecting...");

    // Generate unique session ID
    this.mySessionId = 'player_' + Math.random().toString(36).substring(2, 9);
    
    const skinName = (document.querySelector('.skin-option.selected')?.getAttribute('data-skin')) || 'steve';
    const pos = this.game.player.position;

    const presenceRef = ref(database, 'players/' + this.mySessionId);
    const joinData = {
      id: this.mySessionId,
      name: username || "Steve",
      skin: skinName,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: this.game.player.yaw,
      pitch: this.game.player.pitch,
      lastUpdate: Date.now()
    };

    set(presenceRef, joinData)
      .then(() => {
        this.isConnected = true;
        this.updateStatus("Connected");
        eventBus.emit('show_toast', `Connected to lobby!`);

        // Setup presence onDisconnect cleanup
        onDisconnect(presenceRef).remove();

        // Bind listeners
        this.bindFirebaseListeners();
      })
      .catch((err) => {
        console.error("Firebase multiplayer join error:", err);
        this.updateStatus("Offline");
      });
  }

  public disconnect(): void {
    if (this.isConnected && this.mySessionId) {
      const presenceRef = ref(database, 'players/' + this.mySessionId);
      remove(presenceRef).catch(() => {});
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isConnected = false;
    
    // Call all Firebase unsubscribes
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];

    // Clear peer meshes from Three scene
    for (const player of this.remotePlayers.values()) {
      this.game.renderer.scene.remove(player.mesh);
    }
    this.remotePlayers.clear();
    this.mySessionId = null;
    this.updateStatus("Offline");
  }

  private bindFirebaseListeners(): void {
    this.unsubscribes = [];

    const playersRef = ref(database, 'players');
    
    // 1. Players joining
    this.unsubscribes.push(
      onChildAdded(playersRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.id !== this.mySessionId) {
          this.spawnRemotePlayer(data);
        }
      })
    );

    // 2. Players moving
    this.unsubscribes.push(
      onChildChanged(playersRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.id !== this.mySessionId) {
          const p = this.remotePlayers.get(snapshot.key!);
          if (p) {
            p.targetPos.set(data.x, data.y, data.z);
            p.targetYaw = data.yaw;
            p.targetPitch = data.pitch;
            p.lastUpdate = performance.now();
          }
        }
      })
    );

    // 3. Players leaving
    this.unsubscribes.push(
      onChildRemoved(playersRef, (snapshot) => {
        const id = snapshot.key!;
        const lp = this.remotePlayers.get(id);
        if (lp) {
          this.game.renderer.scene.remove(lp.mesh);
          this.remotePlayers.delete(id);
          eventBus.emit('show_toast', `${lp.name} left the lobby.`);
        }
      })
    );

    // 4. Block updates syncing
    const blocksRef = ref(database, 'blocks');
    
    const blockHandler = (snapshot: any) => {
      const key = snapshot.key!;
      const blockId = snapshot.val();
      
      const parts = key.split('_');
      if (parts.length === 3) {
        const x = parseInt(parts[0]);
        const y = parseInt(parts[1]);
        const z = parseInt(parts[2]);
        
        const currentBlock = this.game.chunkManager.getBlock(x, y, z);
        if (currentBlock !== blockId) {
          this.game.chunkManager.setBlock(x, y, z, blockId);
          
          const cx = Math.floor(x / 16);
          const cz = Math.floor(z / 16);
          const markDirty = (cx: number, cz: number) => {
            const chunk = this.game.chunkManager.getChunk(cx, cz);
            if (chunk) chunk.isDirty = true;
          };
          
          markDirty(cx, cz);
          if ((x % 16) === 0) markDirty(cx - 1, cz);
          if ((x % 16) === 15) markDirty(cx + 1, cz);
          if ((z % 16) === 0) markDirty(cx, cz - 1);
          if ((z % 16) === 15) markDirty(cx, cz + 1);
        }
      }
    };

    this.unsubscribes.push(onChildAdded(blocksRef, blockHandler));
    this.unsubscribes.push(onChildChanged(blocksRef, blockHandler));

    // 5. Chats syncing
    const chatsRef = ref(database, 'chats');
    const startTimestamp = Date.now();
    
    this.unsubscribes.push(
      onChildAdded(chatsRef, (snapshot) => {
        const data = snapshot.val();
        // Only show chat message if sent after we joined
        if (data && data.timestamp > startTimestamp) {
          eventBus.emit('show_toast', `<${data.name}> ${data.message}`);
        }
      })
    );
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

    eventBus.emit('show_toast', `${data.name} joined the lobby.`);
  }

  public update(now: number): void {
    if (!this.isConnected || !this.mySessionId) return;

    // Send local movements to Firebase RTDB periodically
    if (now - this.lastSendTime > this.sendInterval) {
      const pos = this.game.player.position;
      const presenceRef = ref(database, 'players/' + this.mySessionId);
      
      set(presenceRef, {
        id: this.mySessionId,
        name: localStorage.getItem("mp_username") || "Steve",
        skin: (document.querySelector('.skin-option.selected')?.getAttribute('data-skin')) || 'steve',
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: this.game.player.yaw,
        pitch: this.game.player.pitch,
        lastUpdate: Date.now()
      }).catch(() => {});
      
      this.lastSendTime = now;
    }

    // Interpolate remote players coordinates and swing limbs
    for (const player of this.remotePlayers.values()) {
      const lerpFactor = 0.2;
      player.mesh.position.lerp(player.targetPos, lerpFactor);

      player.mesh.rotation.y = player.mesh.rotation.y + (player.targetYaw + Math.PI - player.mesh.rotation.y) * lerpFactor;
      
      const head = player.mesh.getObjectByName('head');
      if (head) {
        head.rotation.x = head.rotation.x + (-player.targetPitch - head.rotation.x) * lerpFactor;
      }

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
    eventBus.on('block_placed', (data: { x: number; y: number; z: number; blockId: number }) => {
      if (!this.isConnected || !this.mySessionId) return;
      const key = `${data.x}_${data.y}_${data.z}`;
      set(ref(database, 'blocks/' + key), data.blockId).catch(() => {});
    });

    eventBus.on('block_broken', (data: { x: number; y: number; z: number }) => {
      if (!this.isConnected || !this.mySessionId) return;
      const key = `${data.x}_${data.y}_${data.z}`;
      set(ref(database, 'blocks/' + key), 0).catch(() => {});
    });
  }

  public sendChatMessage(message: string): void {
    if (!message.trim() || !this.isConnected || !this.mySessionId) return;
    const chatsRef = ref(database, 'chats');
    push(chatsRef, {
      name: localStorage.getItem("mp_username") || "Steve",
      message: message,
      timestamp: Date.now()
    }).catch(() => {});
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
