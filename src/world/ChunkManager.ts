/**
 * Tox'sCraft ChunkManager
 * Coordinates chunk life-cycles (generate, load, unload) around the player's position.
 * Handles cross-chunk boundaries getBlock/setBlock queries.
 */

import { CHUNK_SIZE } from '../constants';
import { Chunk } from './Chunk';
import { WorldGenerator } from './generation/WorldGenerator';
import { BiomeDef } from './generation/BiomeRegistry';

export class ChunkManager {
  private chunks: Map<string, Chunk> = new Map();
  private generator: WorldGenerator;
  private renderDistance = 8;
  public activeWorldId: string | undefined;
  public currentDimension: 'overworld' | 'nether' = 'overworld';

  constructor(seed: string, renderDistance = 8, worldId?: string) {
    this.renderDistance = renderDistance;
    this.activeWorldId = worldId;
    this.generator = new WorldGenerator(seed);
  }

  private getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  /**
   * Translates absolute block coordinates to chunk coordinates
   */
  public getChunkCoords(wx: number, wz: number): { cx: number; cz: number; lx: number; lz: number } {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  /**
   * Get loaded chunk by coordinates
   */
  public getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  /**
   * Get all loaded chunks
   */
  public getActiveChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get block ID at world absolute coordinates
   */
  public getBlock(wx: number, wy: number, wz: number): number {
    const { cx, cz, lx, lz } = this.getChunkCoords(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 0; // Air for unloaded
    return chunk.getBlock(lx, wy, lz);
  }

  /**
   * Set block ID at world absolute coordinates, dirtying chunk + neighbors
   */
  public setBlock(wx: number, wy: number, wz: number, id: number): void {
    const { cx, cz, lx, lz } = this.getChunkCoords(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;

    chunk.setBlock(lx, wy, lz, id);

    // If block is at chunk edge, flag neighboring chunks as dirty to refresh borders
    if (lx === 0) this.dirtyChunk(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.dirtyChunk(cx + 1, cz);
    if (lz === 0) this.dirtyChunk(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.dirtyChunk(cx, cz + 1);
  }

  private dirtyChunk(cx: number, cz: number): void {
    const neighbor = this.getChunk(cx, cz);
    if (neighbor) neighbor.isDirty = true;
  }

  /**
   * Update loaded chunks based on player coordinates
   */
  public update(playerX: number, playerZ: number): { loaded: Chunk[]; unloaded: string[] } {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);
    
    const loaded: Chunk[] = [];
    const unloaded: string[] = [];
    const keepKeys = new Set<string>();

    const missingChunks: {cx: number, cz: number, distSq: number}[] = [];

    // Load chunks inside render distance circle
    for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        const distSq = dx * dx + dz * dz;
        // Distance check (circle loading rather than square)
        if (distSq > this.renderDistance * this.renderDistance) continue;

        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = this.getChunkKey(cx, cz);
        keepKeys.add(key);

        if (!this.chunks.has(key)) {
          missingChunks.push({ cx, cz, distSq });
        }
      }
    }

    // Sort missing chunks by distance to player so closest ones load first!
    missingChunks.sort((a, b) => a.distSq - b.distSq);

    for (const mc of missingChunks) {
      const key = this.getChunkKey(mc.cx, mc.cz);
      const chunk = new Chunk(mc.cx, mc.cz);
      
      // Look for locally cached or generated chunk first
      this.generator.generateChunk(chunk, this.currentDimension);
      this.chunks.set(key, chunk);
      loaded.push(chunk);
      
      // Trigger an async load from database if activeWorldId is set
      if (this.activeWorldId) {
        import('../save/WorldDatabase').then(({ WorldDatabase }) => {
          WorldDatabase.loadChunk(this.activeWorldId!, mc.cx, mc.cz, this.currentDimension).then(data => {
            if (data) {
              chunk.deserialize(data);
              // Trigger a dirty flag for the chunk mesh to update
              chunk.isDirty = true;
            }
          });
        }).catch(err => {
          console.warn('Failed to dynamically import WorldDatabase for chunk load:', err);
        });
      }

      // Limit chunk generation to 1 per frame to prevent freezing the main thread and OOM crashes on mobile
      if (loaded.length >= 1) {
        break;
      }
    }

    // Unload far chunks
    for (const key of this.chunks.keys()) {
      if (!keepKeys.has(key)) {
        unloaded.push(key);
        this.chunks.delete(key);
      }
    }

    return { loaded, unloaded };
  }

  /**
   * Force-generates a chunk immediately (bypasses the 1-per-frame limit).
   * Attempts to load saved chunk data from WorldDatabase before generating procedural terrain.
   * Call this before initSpawn to guarantee the spawn column is available.
   */
  public async forceLoadChunk(cx: number, cz: number, worldId?: string): Promise<void> {
    const key = this.getChunkKey(cx, cz);
    if (!this.chunks.has(key)) {
      const chunk = new Chunk(cx, cz);
      
      let loaded = false;
      if (worldId) {
        try {
          const { WorldDatabase } = await import('../save/WorldDatabase');
          const data = await WorldDatabase.loadChunk(worldId, cx, cz, this.currentDimension);
          if (data) {
            chunk.deserialize(data);
            loaded = true;
          }
        } catch (e) {
          console.warn('Failed to load saved chunk from IndexedDB, generating procedurally...', e);
        }
      }
      
      if (!loaded) {
        this.generator.generateChunk(chunk, this.currentDimension);
      }
      
      this.chunks.set(key, chunk);
    }
  }

  /**
   * Checks if coordinates are loaded
   */
  public isChunkLoaded(cx: number, cz: number): boolean {
    return this.chunks.has(this.getChunkKey(cx, cz));
  }

  /**
   * Set new render distance
   */
  public setRenderDistance(distance: number): void {
    this.renderDistance = distance;
  }

  public clear(): void {
    this.chunks.clear();
  }

  /**
   * Delegates biome evaluation to the world generator
   */
  public getBiomeAt(wx: number, wz: number): BiomeDef {
    return this.generator.getBiomeAt(wx, wz);
  }
}
