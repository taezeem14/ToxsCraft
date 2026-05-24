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
import { Raycaster, RaycastResult } from './physics/Raycaster';
import { GreedyMesher } from './renderer/GreedyMesher';
import { WorldDatabase, WorldMetadata } from './save/WorldDatabase';
import { eventBus } from './EventBus';
import { getBlock } from './world/BlockRegistry';
import { createItemStack } from './inventory/ItemStack';
import { AssetLoader } from './core/AssetLoader';
import { MobManager } from './mobs/MobManager';
import { settingsManager } from './core/SettingsManager';
import { AchievementManager } from './core/AchievementManager';

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

  // Active Save World State
  public activeWorld: WorldMetadata | null = null;
  private autoSaveTimer = 0;
  private totalPlaytime = 0;

  // Loop & timing
  private lastTime = 0;
  private isRunning = false;
  public isPaused = false;

  // Raycasting Block Interaction
  public hitResult: RaycastResult | null = null;
  private selectionBox!: THREE.LineSegments;
  private miningProgress = 0;
  private miningTarget: { x: number; y: number; z: number } | null = null;

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
    eventBus.on('click_left', () => this.handleLeftClick());
    eventBus.on('click_right', () => this.handleRightClick());
    eventBus.on('release_left', () => this.resetMining());

    eventBus.on('scroll', (dir: number) => {
      const idx = this.player.inventory.getHotbarSlotIndex();
      this.player.inventory.setHotbarSlotIndex(((idx + dir) % 9 + 9) % 9);
    });

    // Pause triggering
    eventBus.on('keydown', (code: string) => {
      if (code === 'Escape' && this.isRunning && !this.player.isDead) {
        this.togglePause();
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

    eventBus.emit('loading_progress', 'Connecting database...', 10);
    await WorldDatabase.init();

    eventBus.emit('loading_progress', 'Initializing chunk indices...', 30);
    this.chunkManager = new ChunkManager(world.seed, settingsManager.getValue('renderDistance'));

    // Try loading player save profile
    const savedPlayer = await WorldDatabase.loadPlayer(world.id);
    if (savedPlayer) {
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

      // A simple loop to find the highest non-air block near 0,0
      let spawnX = 0;
      let spawnZ = 0;
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
      this.giveStarterKit();
    }

    this.movementController = new MovementController(this.player, this.inputManager, this.chunkManager);

    // Pre-load surrounding chunks around player spawn position
    eventBus.emit('loading_progress', 'Building landscape chunks...', 70);
    
    // Warm up the core 3x3 chunks immediately before starting the loop so the player has somewhere to stand safely
    for (let i = 0; i < 9; i++) {
      this.chunkManager.update(this.player.position.x, this.player.position.z);
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
        await WorldDatabase.saveChunk(this.activeWorld.id, chunk.x, chunk.z, data);
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
      xp: this.player.xp
    });

    eventBus.emit('saving_complete');
  }

  private async preloadSpawnChunks(spawnX: number, spawnZ: number): Promise<void> {
    // Generate chunks synchronously around the spawn point
    this.chunkManager.update(spawnX, spawnZ);
    // Wait a brief moment to ensure block arrays are accessible
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private giveStarterKit(): void {
    // Basic setup if wanted, currently we just leave UI empty
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

      // Async Chunk Loading update around player
      const updates = this.chunkManager.update(this.player.position.x, this.player.position.z);
      
      // Load new meshes
      for (const chunk of updates.loaded) {
        const meshData = GreedyMesher.generateGeometry(chunk, this.chunkManager);
        this.renderer.updateChunkMesh(chunk.x, chunk.z, meshData.solid, meshData.transparent);
      }
      // Unload far meshes
      for (const key of updates.unloaded || []) {
        const parts = key.split(',');
        this.renderer.removeChunkMesh(parseInt(parts[0]), parseInt(parts[1]));
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

    // Sync camera viewport coords to player eyes
    const eyeY = this.player.position.y + this.player.eyeHeight;
    this.renderer.camera.position.set(this.player.position.x, eyeY, this.player.position.z);

    // Apply look yaw and pitch angles
    const lookTarget = new THREE.Vector3(
      Math.sin(this.player.yaw) * Math.cos(this.player.pitch),
      Math.sin(this.player.pitch),
      Math.cos(this.player.yaw) * Math.cos(this.player.pitch)
    );
    this.renderer.camera.lookAt(this.player.position.clone().setY(eyeY).add(lookTarget));

    // Render frame
    this.renderer.render(this.dayNightCycle.getTime(), this.player.position, now);
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
    if (!this.inputManager.isKeyDown('KeyQ') && !this.inputManager.getLocked()) return; // check click down

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
      this.chunkManager.setBlock(this.miningTarget.x, this.miningTarget.y, this.miningTarget.z, 0); // set to Air
      AssetLoader.playSound('dig', block.id);

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
      // Not a placeable block item, check if food
      if (heldStack.id === 'apple') {
        this.player.eat(4); // eat apple
        this.player.inventory.consumeSelected();
        AssetLoader.playSound('place'); // eat crunch sound bypass
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
    this.chunkManager.setBlock(px, py, pz, blockIdToPlace);
    this.player.inventory.consumeSelected();
    AssetLoader.playSound('place', blockIdToPlace);
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

  /**
   * Resets player stats and repositions the player on a safe surface.
   * Called by the death screen "Respawn" button via UIManager.
   */
  public respawnPlayer(): void {
    this.player.respawn();
    // Pre-load spawn area before repositioning
    this.chunkManager.update(0, 0);
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
