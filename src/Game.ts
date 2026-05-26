/**
 * Tox'sCraft Game
 * Master orchestrator of the game loop, scene rendering, raycasting, block placement/removal,
 * state changes, and IndexedDB saving.
 */

import * as THREE from 'three';
import { Renderer } from './renderer/Renderer';
import { ChunkManager } from './world/ChunkManager';
import { Player } from './player/Player';
import { MovementController } from './player/MovementController';
import { InputManager } from './core/InputManager';
import { DayNightCycle } from './world/DayNightCycle';
import { Physics } from './physics/Physics';
import { Raycaster, RaycastResult } from './physics/Raycaster';
import { GreedyMesher } from './renderer/GreedyMesher';
import { WorldDatabase, WorldMetadata } from './save/WorldDatabase';
import { eventBus } from './EventBus';
import { getBlock } from './world/BlockRegistry';
import { createItemStack } from './inventory/ItemStack';
import { AssetLoader } from './core/AssetLoader';
import { MobManager } from './mobs/MobManager';
import { MobEntity, MobType } from './mobs/MobEntity';
import { settingsManager } from './core/SettingsManager';
import { AchievementManager } from './core/AchievementManager';
import { MultiplayerManager } from './core/MultiplayerManager';

// Helper mapping inventory item IDs to block placement IDs
const BLOCK_PLACEMENT_MAP: { [key: string]: number } = {
  "stone": 1,
  "dirt": 2,
  "grass_block": 3,
  "sand": 4,
  "gravel": 5,
  "oak_log": 6,
  "oak_leaves": 7,
  "glass": 8,
  "cobblestone": 19,
  "oak_planks": 20,
  "sandstone": 21,
  "snow_block": 24,
  "clay": 25,
  "obsidian": 26,
  "torch": 27,
  "crafting_table": 28,
  "furnace": 29,
  "chest": 31,
  "glowstone": 32,
  "mossy_cobblestone": 33,
  "bricks": 34,
  "bookshelf": 35,
  "sponge": 36,
  "white_wool": 37,
  "red_wool": 38,
  "green_wool": 39,
  "blue_wool": 40,
  "cactus": 46,
  "pumpkin": 56,
  "tnt": 59,
  "ladder": 62,
  "cobweb": 63,
  "mycelium": 65,
  "terracotta": 66,
  "red_mushroom_block": 67,
  "brown_mushroom_block": 68,
  "mushroom_stem": 69,
  "acacia_log": 70,
  "acacia_leaves": 71
};

export class Game {
  public renderer!: Renderer;
  public chunkManager!: ChunkManager;
  public player!: Player;
  public movementController!: MovementController;
  public inputManager!: InputManager;
  public dayNightCycle!: DayNightCycle;
  public mobManager!: MobManager;
  public multiplayerManager!: MultiplayerManager;

  // Active Save World State
  public activeWorld: WorldMetadata | null = null;
  private portalTimer = 0;
  private autoSaveTimer = 0;
  private totalPlaytime = 0;
  private chunkUpdateTimer = 0;
  public cameraMode: 'first' | 'third_back' | 'third_front' = 'first';

  // Loop & timing
  private lastTime = 0;
  private isRunning = false;
  public isPaused = false;

  // Raycasting Block Interaction
  public hitResult: RaycastResult | null = null;
  private selectionBox!: THREE.LineSegments;
  private miningProgress = 0;
  private miningTarget: { x: number; y: number; z: number } | null = null;
  private meshQueue: any[] = [];
  private isLeftClickHeld = false;

  // FPS calculation
  private fpsFrameCount = 0;
  private fpsLastTime = 0;
  private currentFps = 60;

  // Performance degradation tracking
  private lowFpsStreak = 0;
  private performanceDowngraded = false;

  constructor(canvas: HTMLCanvasElement) {
    // 1. Core Scaffolding
    this.renderer = new Renderer(canvas);
    this.inputManager = new InputManager(canvas);
    this.player = new Player();
    this.dayNightCycle = new DayNightCycle();
    this.multiplayerManager = new MultiplayerManager(this);

    this.createSelectionBox();
    this.initEventListeners();
  }

  private createSelectionBox(): void {
    // 1x1x1 Voxel Target Wireframe Highlight Box
    const geom = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(geom);
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    this.selectionBox = new THREE.LineSegments(edges, mat);
    this.selectionBox.visible = false;
    this.renderer.scene.add(this.selectionBox);
  }

  private initEventListeners(): void {
    // Input action clicks
    eventBus.on('click_left', () => {
      this.isLeftClickHeld = true;
      this.handleLeftClick();
    });
    eventBus.on('click_right', () => this.handleRightClick());
    eventBus.on('release_left', () => {
      this.isLeftClickHeld = false;
      this.resetMining();
    });

    eventBus.on('scroll', (dir: number) => {
      const idx = this.player.inventory.getHotbarSlotIndex();
      this.player.inventory.setHotbarSlotIndex(((idx + dir) % 9 + 9) % 9);
    });

    // Pause triggering
    eventBus.on('keydown', (code: string) => {
      if (code === 'Escape' && this.isRunning && !this.player.isDead) {
        this.togglePause();
      }

      if (code === 'KeyF5' || code === 'F5') {
        this.toggleCameraMode();
      }
      
      // Hotbar bindings 1-9
      if (code.startsWith('Digit')) {
        const val = parseInt(code.replace('Digit', ''));
        if (val >= 1 && val <= 9) {
          this.player.inventory.setHotbarSlotIndex(val - 1);
        }
      }
    });

    eventBus.on('pointerlockchange', (locked: boolean) => {
      if (!locked && this.isRunning && !this.isPaused && !this.player.isDead) {
        this.togglePause();
      }
    });

    eventBus.on('inventory_update', () => {
      if (this.player) {
        const slots = this.player.inventory.getSlots();
        AchievementManager.getInstance().checkAchievements(slots);
      }
    });
  }

  /**
   * Loads a world from IndexedDB and boots up the game loop
   */
  public async loadWorld(world: WorldMetadata): Promise<void> {
    this.activeWorld = world;
    this.totalPlaytime = world.playtime;
    this.dayNightCycle = new DayNightCycle();
    this.player.isCreative = (world.gameMode === 'creative');
    this.meshQueue = [];

    eventBus.emit('loading_progress', 'Connecting database...', 10);
    await WorldDatabase.init();

    eventBus.emit('loading_progress', 'Initializing chunk indices...', 30);
    this.chunkManager = new ChunkManager(world.seed, settingsManager.getValue('renderDistance'), world.id);

    // Try loading player save profile
    const savedPlayer = await WorldDatabase.loadPlayer(world.id);
    if (savedPlayer) {
      this.chunkManager.currentDimension = savedPlayer.dimension || 'overworld';
      this.player.position.set(savedPlayer.position.x, savedPlayer.position.y, savedPlayer.position.z);
      this.player.health = savedPlayer.health;
      this.player.hunger = savedPlayer.hunger;
      this.dayNightCycle.setTime(savedPlayer.timeOfDay);
      this.dayNightCycle.setDaysElapsed(savedPlayer.daysElapsed);
      
      this.player.level = savedPlayer.level !== undefined ? savedPlayer.level : 1;
      this.player.xp = savedPlayer.xp !== undefined ? savedPlayer.xp : 0;

      // Deserialize slots
      const savedInv = savedPlayer.inventory || [];
      for (let i = 0; i < 50; i++) {
        const item = savedInv[i];
        this.player.inventory.setItem(i, item ? item : null);
      }

      eventBus.emit('player_status_change');
      eventBus.emit('player_xp_change');
    } else {
      // First load, generate spawn position
      eventBus.emit('loading_progress', 'Generating spawn column...', 50);

      // Seeded RNG helper for spawn randomization
      const spawnSeed = world.seed;
      let h = 2166136261 >>> 0;
      for (let i = 0; i < spawnSeed.length; i++) {
        h = Math.imul(h ^ spawnSeed.charCodeAt(i), 16777619) >>> 0;
      }
      h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
      h = (h ^ (h >>> 16)) >>> 0;
      const seedRandomVal1 = h / 4294967296;
      h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
      const seedRandomVal2 = h / 4294967296;

      let spawnX = Math.floor(seedRandomVal1 * 300) - 150;
      let spawnZ = Math.floor(seedRandomVal2 * 300) - 150;
      let spawnY = 255;
      
      // Keep moving generation point until we find a non-ocean column (rough check using block height vs sea level, or just step forward until it's land)
      // Fast check: we just generate chunks incrementally until we are above sea level (63).
      let attempt = 0;
      while (attempt < 50) {
        await this.preloadSpawnChunks(spawnX, spawnZ);
        spawnY = 255;
        // Find surface y - skip water (id 8 and 9)
        while (spawnY > 0) {
          const blockId = this.chunkManager.getBlock(spawnX, spawnY, spawnZ);
          if (blockId !== 0 && blockId !== 8 && blockId !== 9) {
            break;
          }
          spawnY--;
        }

        if (spawnY >= 63) { // It's land! Sea level is 63
          break; // Good spawn
        }

        // Try another spot further out
        spawnX += 16 * 3; // Jump 3 chunks out
        spawnZ += 16 * 1;
        attempt++;
      }

      this.player.position.set(spawnX + 0.5, spawnY + 2.0, spawnZ + 0.5);
      
      // Default standard starting inventory
      this.giveStarterKit(spawnX, spawnY, spawnZ);
    }

    this.movementController = new MovementController(this.player, this.inputManager, this.chunkManager);

    // Pre-load surrounding chunks around player spawn position
    eventBus.emit('loading_progress', 'Building landscape chunks...', 70);
    
    // Warm up the core 3x3 chunks immediately before starting the loop so the player has somewhere to stand safely
    const playerChunkX = Math.floor(this.player.position.x / 16);
    const playerChunkZ = Math.floor(this.player.position.z / 16);
    const worldId = this.activeWorld?.id;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        await this.chunkManager.forceLoadChunk(playerChunkX + dx, playerChunkZ + dz, worldId);
      }
    }

    // Safe-spawn / Unstuck check: if the player Y is extremely low (e.g. Y < 12) or if they load stuck inside solid blocks
    const isStuck = Physics.checkCollision(this.player.position, this.player.radius, this.player.height, this.chunkManager);
    if (this.player.position.y < 12 || isStuck) {
      console.log(`Unstuck triggered on load: player was at Y=${this.player.position.y}, isStuck=${isStuck}`);
      await this.player.teleportToSurface(this.chunkManager);
    }
    
    // Mesh all active chunks on initial load to ensure the spawn chunks are rendered before gameplay begins
    const activeChunks = this.chunkManager.getActiveChunks();
    for (const chunk of activeChunks) {
      const meshData = GreedyMesher.generateGeometry(chunk, this.chunkManager);
      this.renderer.updateChunkMesh(chunk.x, chunk.z, meshData.solid, meshData.transparent);
    }

    eventBus.emit('loading_progress', 'Synthesizing ambient cues...', 90);
    AssetLoader.playProceduralMusic();

    this.mobManager = new MobManager(this.renderer.scene);

    // Start Loops
    this.isPaused = false;
    this.isRunning = true;
    this.lastTime = performance.now();
    
    eventBus.emit('player_status_change');
    eventBus.emit('player_xp_change');
    eventBus.emit('loading_complete');
    this.inputManager.requestLock();
  }

  /**
   * Saves player states and dirty chunks to IndexedDB
   */
  public async saveWorld(): Promise<void> {
    if (!this.activeWorld) return;

    eventBus.emit('saving_start');
    
    // 1. Update playtime metadata
    this.activeWorld.playtime = this.totalPlaytime;
    this.activeWorld.lastPlayed = Date.now();
    await WorldDatabase.saveWorldMetadata(this.activeWorld);

    // 2. Save active chunks
    const chunks = this.chunkManager.getActiveChunks();
    for (const chunk of chunks) {
      if (chunk.isDirty || true) { // save all loadable blocks
        const data = chunk.serialize();
        await WorldDatabase.saveChunk(this.activeWorld.id, chunk.x, chunk.z, data, this.chunkManager.currentDimension);
        chunk.isDirty = false;
      }
    }

    // 3. Save player profile
    const inventoryData = this.player.inventory.getSlots().map(s => s ? { id: s.id, count: s.count, durability: s.durability } : null);
    await WorldDatabase.savePlayer(this.activeWorld.id, {
      health: this.player.health,
      hunger: this.player.hunger,
      position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
      inventory: inventoryData,
      daysElapsed: this.dayNightCycle.getDaysElapsed(),
      timeOfDay: this.dayNightCycle.getTime(),
      level: this.player.level,
      xp: this.player.xp,
      dimension: this.chunkManager.currentDimension
    });

    eventBus.emit('saving_complete');
  }

  private async preloadSpawnChunks(spawnX: number, spawnZ: number): Promise<void> {
    // Generate chunks synchronously around the spawn point
    const { cx, cz } = this.chunkManager.getChunkCoords(spawnX, spawnZ);
    const worldId = this.activeWorld?.id;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        await this.chunkManager.forceLoadChunk(cx + dx, cz + dz, worldId);
      }
    }
  }

  private giveStarterKit(spawnX: number, spawnY: number, spawnZ: number): void {
    // Clear initial scaffolded slots first for a clean spawn kit
    this.player.inventory.clear();

    // Give starter items
    this.player.inventory.setItem(0, createItemStack('stone_pickaxe', 1));
    this.player.inventory.setItem(1, createItemStack('stone_sword', 1));
    this.player.inventory.setItem(2, createItemStack('flint_and_steel', 1));
    this.player.inventory.setItem(3, createItemStack('torch', 64));
    this.player.inventory.setItem(4, createItemStack('apple', 16));
    this.player.inventory.setItem(5, createItemStack('bread', 16));

    // Place bonus chest at (spawnX + 2, spawnZ + 2) surface height
    let cy = 255;
    while (cy > 0) {
      const b = this.chunkManager.getBlock(spawnX + 2, cy, spawnZ + 2);
      if (b !== 0 && b !== 8 && b !== 9) {
        break;
      }
      cy--;
    }
    if (cy <= 0) cy = spawnY;
    
    // Set chest and torch blocks
    this.chunkManager.setBlock(spawnX + 2, cy + 1, spawnZ + 2, 31); // Chest
    this.chunkManager.setBlock(spawnX + 2, cy + 2, spawnZ + 2, 27); // Torch on top
  }

  public async switchDimension(): Promise<void> {
    if (!this.activeWorld) return;

    eventBus.emit('show_toast', "Entering portal, switching dimensions...");
    
    // 1. Save current world and coordinates
    await this.saveWorld();

    // 2. Clear current visual meshes, chunk cache, and mobs
    this.renderer.clearAllMeshes();
    this.chunkManager.clear();
    if (this.mobManager) this.mobManager.clear();
    this.meshQueue = [];

    // 3. Teleport & Scale coords (1:8 ratio)
    const currentDim = this.chunkManager.currentDimension;
    const targetDim = currentDim === 'overworld' ? 'nether' : 'overworld';
    this.chunkManager.currentDimension = targetDim;

    const scale = targetDim === 'nether' ? 0.125 : 8.0;
    let tx = this.player.position.x * scale;
    let tz = this.player.position.z * scale;
    let ty = 64; // Default starting height search

    // 4. Pre-load chunks around destination coords
    const playerChunkX = Math.floor(tx / 16);
    const playerChunkZ = Math.floor(tz / 16);
    const worldId = this.activeWorld.id;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        await this.chunkManager.forceLoadChunk(playerChunkX + dx, playerChunkZ + dz, worldId);
      }
    }

    // 5. Scan column to find a safe air pocket with solid floor
    let foundSafe = false;
    for (let dy = 10; dy < 110; dy++) {
      const footB = this.chunkManager.getBlock(Math.floor(tx), dy, Math.floor(tz));
      const headB = this.chunkManager.getBlock(Math.floor(tx), dy + 1, Math.floor(tz));
      const standB = this.chunkManager.getBlock(Math.floor(tx), dy - 1, Math.floor(tz));
      if (footB === 0 && headB === 0 && standB !== 0 && standB !== 10 && standB !== 9) {
        ty = dy;
        foundSafe = true;
        break;
      }
    }

    if (!foundSafe) {
      // Area scan for a safe spot within a 5-block radius
      let scanFound = false;
      for (let ox = -5; ox <= 5 && !scanFound; ox++) {
        for (let oz = -5; oz <= 5 && !scanFound; oz++) {
          for (let dy = 10; dy < 110; dy++) {
            const footB = this.chunkManager.getBlock(Math.floor(tx) + ox, dy, Math.floor(tz) + oz);
            const headB = this.chunkManager.getBlock(Math.floor(tx) + ox, dy + 1, Math.floor(tz) + oz);
            const standB = this.chunkManager.getBlock(Math.floor(tx) + ox, dy - 1, Math.floor(tz) + oz);
            if (footB === 0 && headB === 0 && standB !== 0 && standB !== 10 && standB !== 9) {
              tx = tx + ox;
              tz = tz + oz;
              ty = dy;
              scanFound = true;
              break;
            }
          }
        }
      }
      // Platform builder if spawn is fully floating or inside solid ground
      if (!scanFound) {
        ty = 64;
        const platformBlock = targetDim === 'nether' ? 53 : 1; // Netherrack or Stone
        for (let ox = -1; ox <= 1; ox++) {
          for (let oz = -1; oz <= 1; oz++) {
            this.chunkManager.setBlock(Math.floor(tx) + ox, ty - 1, Math.floor(tz) + oz, platformBlock);
            this.chunkManager.setBlock(Math.floor(tx) + ox, ty, Math.floor(tz) + oz, 0);
            this.chunkManager.setBlock(Math.floor(tx) + ox, ty + 1, Math.floor(tz) + oz, 0);
          }
        }
      }
    }

    // 6. Build a return portal frame at the destination
    const basePX = Math.floor(tx);
    const basePZ = Math.floor(tz);
    // Build vertical Obsidian frame along X-axis
    for (let x = basePX - 1; x <= basePX + 2; x++) {
      this.chunkManager.setBlock(x, ty - 1, basePZ, 26); // bottom
      this.chunkManager.setBlock(x, ty + 3, basePZ, 26); // top
    }
    for (let y = ty; y <= ty + 2; y++) {
      this.chunkManager.setBlock(basePX - 1, y, basePZ, 26); // left
      this.chunkManager.setBlock(basePX + 2, y, basePZ, 26); // right
    }
    // Fill inner portal blocks (72)
    for (let x = basePX; x <= basePX + 1; x++) {
      for (let y = ty; y <= ty + 2; y++) {
        this.chunkManager.setBlock(x, y, basePZ, 72);
      }
    }

    // 7. Place player standing directly in front of the return portal
    this.player.position.set(basePX + 0.5, ty + 0.1, basePZ + 1.5);
    this.player.velocity.set(0, 0, 0);
    this.player.onGround = true;

    // 8. Remesh all active chunks immediately
    const activeChunks = this.chunkManager.getActiveChunks();
    for (const chunk of activeChunks) {
      const meshData = GreedyMesher.generateGeometry(chunk, this.chunkManager);
      this.renderer.updateChunkMesh(chunk.x, chunk.z, meshData.solid, meshData.transparent);
    }

    eventBus.emit('show_toast', targetDim === 'nether' ? "Entered the Nether" : "Returned to the Overworld");
    eventBus.emit('player_status_change');
  }

  public tryCreatePortal(tx: number, ty: number, tz: number): boolean {
    const targetBlock = this.chunkManager.getBlock(tx, ty, tz);
    if (targetBlock !== 0 && targetBlock !== 27) return false;

    // Verify frames in X-Y or Z-Y alignments
    const axes: ('x' | 'z')[] = ['x', 'z'];
    for (const axis of axes) {
      for (let ix = 0; ix < 2; ix++) {
        for (let iy = 0; iy < 3; iy++) {
          const x0 = axis === 'x' ? tx - ix : tx;
          const y0 = ty - iy;
          const z0 = axis === 'z' ? tz - ix : tz;

          if (this.checkPortalFrame(x0, y0, z0, axis)) {
            // Valid frame found, fill inner 2x3 area with portal blocks (72)
            for (let h = 0; h < 2; h++) {
              for (let v = 0; v < 3; v++) {
                const px = axis === 'x' ? x0 + h : x0;
                const py = y0 + v;
                const pz = axis === 'z' ? z0 + h : z0;
                this.chunkManager.setBlock(px, py, pz, 72);
              }
            }
            AssetLoader.playSound('place', 72);
            return true;
          }
        }
      }
    }
    return false;
  }

  private checkPortalFrame(x0: number, y0: number, z0: number, axis: 'x' | 'z'): boolean {
    const isObsidian = (bx: number, by: number, bz: number) => {
      return this.chunkManager.getBlock(bx, by, bz) === 26;
    };

    const frameOffsets = [
      { h: 0, v: -1 }, { h: 1, v: -1 }, // bottom
      { h: 0, v: 3 }, { h: 1, v: 3 },   // top
      { h: -1, v: 0 }, { h: -1, v: 1 }, { h: -1, v: 2 }, // left
      { h: 2, v: 0 }, { h: 2, v: 1 }, { h: 2, v: 2 }   // right
    ];

    for (const offset of frameOffsets) {
      const bx = axis === 'x' ? x0 + offset.h : x0;
      const by = y0 + offset.v;
      const bz = axis === 'z' ? z0 + offset.h : z0;
      if (!isObsidian(bx, by, bz)) {
        return false;
      }
    }
    return true;
  }

  public clearPortal(x: number, y: number, z: number): void {
    const directions = [
      { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
    ];
    for (const dir of directions) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      const nz = z + dir.z;
      if (this.chunkManager.getBlock(nx, ny, nz) === 72) {
        this.chunkManager.setBlock(nx, ny, nz, 0); // clear portal block
        this.clearPortal(nx, ny, nz); // recursive flood clear
      }
    }
  }

  /**
   * Main game tick update loop
   */
  public update(now: number): void {
    if (!this.isRunning) return;

    let deltaSec = (now - this.lastTime) * 0.001;
    this.lastTime = now;

    // Track FPS
    this.fpsFrameCount++;
    if (this.fpsLastTime === 0) this.fpsLastTime = now;
    if (now - this.fpsLastTime >= 1000) {
      this.currentFps = Math.round((this.fpsFrameCount * 1000) / (now - this.fpsLastTime));
      this.fpsFrameCount = 0;
      this.fpsLastTime = now;
      
      const fpsEl = document.getElementById('fps-val');
      if (fpsEl) {
        fpsEl.textContent = this.currentFps.toString();
      }

      // Dynamic Performance Degradation:
      // If FPS drops below 25 for 5 consecutive seconds, trigger downgrade
      if (this.currentFps < 25 && !this.isPaused && !this.player.isDead) {
        this.lowFpsStreak++;
        if (this.lowFpsStreak >= 5 && !this.performanceDowngraded) {
          this.downgradeGraphics();
        }
      } else {
        this.lowFpsStreak = 0;
      }
    }

    // Guard against massive frame lags
    if (deltaSec > 0.1) deltaSec = 0.1;

    if (!this.isPaused && !this.player.isDead) {
      this.totalPlaytime += deltaSec;
      
      // Update Celestial Time
      this.dayNightCycle.update(deltaSec);

      // Input, Physics & Movement Slide
      this.movementController.update(deltaSec);
      this.player.update(deltaSec);
      this.mobManager.update(deltaSec, this.player, this.chunkManager);
      this.multiplayerManager.update(now);

      // Portal Collision Check
      const px = Math.floor(this.player.position.x);
      const py = Math.floor(this.player.position.y);
      const pz = Math.floor(this.player.position.z);
      const footBlock = this.chunkManager.getBlock(px, py, pz);
      const headBlock = this.chunkManager.getBlock(px, py + 1, pz);
      if (footBlock === 72 || headBlock === 72) {
        this.portalTimer += deltaSec;
        if (Math.floor(this.portalTimer * 10) % 5 === 0) {
          eventBus.emit('show_toast', `Warping... ${(1.5 - this.portalTimer).toFixed(1)}s`);
        }
        if (this.portalTimer >= 1.5) {
          this.portalTimer = 0;
          this.switchDimension();
        }
      } else {
        this.portalTimer = 0;
      }

      // Async Chunk Loading update around player (throttled to 150ms to prevent CPU lag spikes)
      this.chunkUpdateTimer += deltaSec;
      if (this.chunkUpdateTimer >= 0.15) {
        this.chunkUpdateTimer = 0;
        const updates = this.chunkManager.update(this.player.position.x, this.player.position.z);
        
        // Load new meshes (queue them to optimize framerate and eliminate sprinting lag)
        if (updates.loaded && updates.loaded.length > 0) {
          this.meshQueue.push(...updates.loaded);
        }

        // Unload far meshes
        for (const key of updates.unloaded || []) {
          const parts = key.split(',');
          this.renderer.removeChunkMesh(parseInt(parts[0]), parseInt(parts[1]));
        }
      }

      // Process 1 queued chunk mesh per frame to ensure smooth gameplay
      if (this.meshQueue.length > 0) {
        const chunk = this.meshQueue.shift()!;
        if (this.chunkManager.isChunkLoaded(chunk.x, chunk.z)) {
          const meshData = GreedyMesher.generateGeometry(chunk, this.chunkManager);
          this.renderer.updateChunkMesh(chunk.x, chunk.z, meshData.solid, meshData.transparent);

          // Instantiate structural mobs when chunk mesh is first loaded
          if (chunk.pendingMobSpawns && chunk.pendingMobSpawns.length > 0) {
            for (const spawn of chunk.pendingMobSpawns) {
              const id = Math.random().toString(36).substring(2, 9);
              const spawnPos = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
              const mob = new MobEntity(id, spawn.type as MobType, spawnPos, this.renderer.scene);
              this.mobManager.addMob(mob);
            }
            chunk.pendingMobSpawns = []; // Clear to prevent double spawning
          }
        }
      }

      // Check block raycast targets
      this.updateRaycasting();

      // Process mining ticks if left click is held
      this.updateMining(deltaSec);

      // Refresh dirty chunk meshes (limit to 1 per frame to stay butter-smooth)
      let refreshedCount = 0;
      const chunks = this.chunkManager.getActiveChunks();
      for (const chunk of chunks) {
        if (chunk.isDirty) {
          const meshData = GreedyMesher.generateGeometry(chunk, this.chunkManager);
          this.renderer.updateChunkMesh(chunk.x, chunk.z, meshData.solid, meshData.transparent);
          chunk.isDirty = false;
          refreshedCount++;
          if (refreshedCount >= 1) break;
        }
      }

      // Autosave checker (5 mins)
      this.autoSaveTimer += deltaSec;
      if (this.autoSaveTimer >= 300) {
        this.saveWorld();
        this.autoSaveTimer = 0;
      }
    }

    // Sync camera viewport coords to player eyes based on POV camera mode
    const eyeY = this.player.position.y + this.player.eyeHeight;
    const origin = new THREE.Vector3(this.player.position.x, eyeY, this.player.position.z);

    // Apply look yaw and pitch angles
    const dir = new THREE.Vector3(
      Math.sin(this.player.yaw) * Math.cos(this.player.pitch),
      Math.sin(this.player.pitch),
      -Math.cos(this.player.yaw) * Math.cos(this.player.pitch)
    ).normalize();

    if (this.cameraMode === 'first') {
      this.renderer.camera.position.copy(origin);
      this.renderer.camera.lookAt(origin.clone().add(dir));
    } else if (this.cameraMode === 'third_back') {
      // Raycast to prevent clipping through blocks/walls behind player
      const backRay = Raycaster.cast(origin, dir.clone().negate(), 3.0, this.chunkManager);
      const dist = backRay ? Math.max(0.4, backRay.distance - 0.2) : 3.0;
      const camPos = origin.clone().sub(dir.clone().multiplyScalar(dist));
      this.renderer.camera.position.copy(camPos);
      this.renderer.camera.lookAt(origin.clone().add(dir.clone().multiplyScalar(5.0))); // Look slightly ahead of player
    } else if (this.cameraMode === 'third_front') {
      // Raycast to prevent clipping through blocks in front of player
      const frontRay = Raycaster.cast(origin, dir, 3.0, this.chunkManager);
      const dist = frontRay ? Math.max(0.4, frontRay.distance - 0.2) : 3.0;
      const camPos = origin.clone().add(dir.clone().multiplyScalar(dist));
      this.renderer.camera.position.copy(camPos);
      this.renderer.camera.lookAt(origin); // Look directly at player
    }

    // Update player model visual mesh in 3D scene (hidden in 1st person)
    const activeSkin = settingsManager.getValue('skin') || 'steve';
    this.renderer.updatePlayerModel(
      this.player.position,
      this.player.yaw,
      this.player.pitch,
      this.player.velocity,
      activeSkin,
      this.cameraMode,
      this.player.isSneaking,
      now
    );

    // Render frame
    this.renderer.render(
      this.dayNightCycle.getTime(),
      this.player.position,
      now,
      this.chunkManager.currentDimension === 'nether'
    );
  }

  private updateRaycasting(): void {
    const eyeY = this.player.position.y + this.player.eyeHeight;
    const origin = new THREE.Vector3(this.player.position.x, eyeY, this.player.position.z);

    // Camera look direction
    const dir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(dir);

    const hit = Raycaster.cast(origin, dir, 5.0, this.chunkManager);
    this.hitResult = hit;

    if (hit) {
      // Position selection box outline centered on targeted block
      this.selectionBox.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
      this.selectionBox.visible = true;
    } else {
      this.selectionBox.visible = false;
    }
  }

  private handleLeftClick(): void {
    // Check if we hit a mob first
    const eyeY = this.player.position.y + this.player.eyeHeight;
    const origin = new THREE.Vector3(this.player.position.x, eyeY, this.player.position.z);
    const dir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(dir);

    if (this.mobManager && this.mobManager.checkAttack(origin, dir, 4.0, this.player)) {
      this.resetMining();
      return;
    }

    if (!this.hitResult) return;
    
    // Mark target block coordinates
    this.miningTarget = { x: this.hitResult.blockX, y: this.hitResult.blockY, z: this.hitResult.blockZ };
    this.miningProgress = 0.0;
  }

  private updateMining(deltaSec: number): void {
    if (!this.isLeftClickHeld) return;

    // Ensure we are clicking the same block we started mining
    if (!this.hitResult || !this.miningTarget) {
      this.resetMining();
      return;
    }

    if (
      this.hitResult.blockX !== this.miningTarget.x ||
      this.hitResult.blockY !== this.miningTarget.y ||
      this.hitResult.blockZ !== this.miningTarget.z
    ) {
      this.resetMining();
      return;
    }

    const block = getBlock(this.hitResult.blockId);
    if (block.hardness === -1) return; // Unbreakable bedrock

    // Calculate break speed based on active held tool
    const held = this.player.inventory.getSelected();
    let speedMultiplier = 1.0;
    
    if (held) {
      if (held.id.includes('pickaxe') && (block.id === 1 || block.id === 19 || block.id === 12 || block.id === 15)) {
        // Pickaxe vs stone-types
        if (held.id.startsWith('wood_')) speedMultiplier = 3.0;
        else if (held.id.startsWith('stone_')) speedMultiplier = 5.0;
        else if (held.id.startsWith('iron_')) speedMultiplier = 8.0;
        else if (held.id.startsWith('diamond_')) speedMultiplier = 12.0;
      }
    }

    const totalDuration = block.hardness / speedMultiplier;
    this.miningProgress += deltaSec;

    // Trigger crunch audio cues
    if (Math.floor(this.miningProgress * 5) > Math.floor((this.miningProgress - deltaSec) * 5)) {
      AssetLoader.playSound('dig', block.id);
    }

    if (this.miningProgress >= totalDuration) {
      // Mine success! Break block
      const oldBlockId = this.chunkManager.getBlock(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z);
      this.chunkManager.setBlock(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z, 0); // set to Air
      eventBus.emit('block_broken', { x: this.miningTarget.x, y: this.miningTarget.y, z: this.miningTarget.z });
      AssetLoader.playSound('dig', block.id);

      // If we broke Obsidian or a Portal block, clear adjacent portals
      if (oldBlockId === 26 || oldBlockId === 72) {
        this.clearPortal(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z);
      }

      // Loot item drop drop simulation
      const itemToDrop = block.lootItem || block.name.toLowerCase().replace(' ', '_');
      this.player.inventory.addItem(createItemStack(itemToDrop, 1));

      // Award Level XP: Ores give 25 XP, stone/cobble give 5 XP, others give 2 XP
      let xpAmount = 2;
      if (block.id >= 14 && block.id <= 20) {
        xpAmount = 25;
      } else if (block.id === 1 || block.id === 19) {
        xpAmount = 5;
      }
      this.player.addXp(xpAmount);
      
      this.resetMining();
    }
  }

  private resetMining(): void {
    this.miningTarget = null;
    this.miningProgress = 0;
  }

  private handleRightClick(): void {
    if (!this.hitResult) return;

    // Retrieve held item
    const heldStack = this.player.inventory.getSelected();
    if (!heldStack) return;

    // Resolve block ID to place
    const blockIdToPlace = BLOCK_PLACEMENT_MAP[heldStack.id];
    if (blockIdToPlace === undefined) {
      // Not a placeable block item, check if food or flint and steel
      if (heldStack.id === 'apple') {
        this.player.eat(4); // eat apple
        this.player.inventory.consumeSelected();
        AssetLoader.playSound('place'); // eat crunch sound bypass
      } else if (heldStack.id === 'flint_and_steel') {
        const px = this.hitResult.blockX + this.hitResult.faceNormal.x;
        const py = this.hitResult.blockY + this.hitResult.faceNormal.y;
        const pz = this.hitResult.blockZ + this.hitResult.faceNormal.z;
        this.tryCreatePortal(px, py, pz);
      }
      return; 
    }

    // Place position is hit block coords + face normal vector
    const px = this.hitResult.blockX + this.hitResult.faceNormal.x;
    const py = this.hitResult.blockY + this.hitResult.faceNormal.y;
    const pz = this.hitResult.blockZ + this.hitResult.faceNormal.z;

    // Collision check: prevent block placement intersecting the player's bounding box
    const pos = this.player.position;
    const overlapX = (pos.x + this.player.radius > px) && (pos.x - this.player.radius < px + 1);
    const overlapY = (pos.y + this.player.height > py) && (pos.y < py + 1);
    const overlapZ = (pos.z + this.player.radius > pz) && (pos.z - this.player.radius < pz + 1);

    if (overlapX && overlapY && overlapZ) {
      return; // Cannot place block inside player hitbox!
    }

    // Place block
    const oldBlockAtPlace = this.chunkManager.getBlock(px, py, pz);
    this.chunkManager.setBlock(px, py, pz, blockIdToPlace);
    eventBus.emit('block_placed', { x: px, y: py, z: pz, blockId: blockIdToPlace });
    if (oldBlockAtPlace === 72) {
      this.clearPortal(px, py, pz);
    }
    this.player.inventory.consumeSelected();
    AssetLoader.playSound('place', blockIdToPlace);
  }

  public toggleCameraMode(): void {
    if (this.cameraMode === 'first') {
      this.cameraMode = 'third_back';
    } else if (this.cameraMode === 'third_back') {
      this.cameraMode = 'third_front';
    } else {
      this.cameraMode = 'first';
    }
    eventBus.emit('show_toast', `Camera POV: ${this.cameraMode.replace('_', ' ').toUpperCase()}`);
  }

  public togglePause(): void {
    this.isPaused = !this.isPaused;
    
    if (this.isPaused) {
      document.exitPointerLock();
      this.saveWorld(); // auto-save on pause
    } else {
      this.inputManager.requestLock();
    }
    
    eventBus.emit('pause_toggle', this.isPaused);
  }

  public async respawnPlayer(): Promise<void> {
    this.player.respawn();
    // Pre-load spawn area before repositioning
    const worldId = this.activeWorld?.id;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        await this.chunkManager.forceLoadChunk(dx, dz, worldId);
      }
    }
    this.player.initSpawn(this.chunkManager);
    this.isPaused = false;
    this.inputManager.requestLock();
  }

  private downgradeGraphics(): void {
    this.performanceDowngraded = true;
    
    let changed = false;
    let messages: string[] = [];

    if (settingsManager.getValue('shadows')) {
      settingsManager.set('shadows', false);
      this.renderer.setShadowsEnabled(false);
      changed = true;
      messages.push('shadows off');
    }
    
    if (settingsManager.getValue('postProcessing')) {
      settingsManager.set('postProcessing', false);
      changed = true;
      messages.push('effects off');
    }

    const currentDist = settingsManager.getValue('renderDistance');
    if (currentDist > 4) {
      settingsManager.set('renderDistance', 4);
      this.chunkManager.setRenderDistance(4);
      changed = true;
      messages.push('render distance 4');
    } else if (currentDist > 3) {
      settingsManager.set('renderDistance', 3);
      this.chunkManager.setRenderDistance(3);
      changed = true;
      messages.push('render distance 3');
    }

    if (changed) {
      eventBus.emit('show_toast', `Performance Optimized: ${messages.join(', ')}`);
      eventBus.emit('settings_changed');
    }
  }

  public stop(): void {
    this.isRunning = false;
    AssetLoader.stopMusic();
    this.inputManager.destroy();
    this.renderer.clear();
    this.chunkManager.clear();
    if (this.mobManager) this.mobManager.clear();
  }
}
