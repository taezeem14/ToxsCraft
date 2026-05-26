/**
 * Tox'sCraft Chunk
 * Represents a 16x16x256 vertical column of blocks in the voxel grid.
 * Manages blocks and lighting (sky light, block light).
 */

import { CHUNK_SIZE, CHUNK_HEIGHT } from '../constants';

export class Chunk {
  public x: number;
  public z: number;
  public blocks: Uint8Array;
  public skyLight: Uint8Array;
  public blockLight: Uint8Array;
  public isDirty = false; // Set to true if chunk needs remeshing
  public pendingMobSpawns: { type: string; x: number; y: number; z: number }[] = [];

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    
    const size = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT; // 65,536
    this.blocks = new Uint8Array(size);
    this.skyLight = new Uint8Array(size);
    this.blockLight = new Uint8Array(size);
  }

  /**
   * Translates 3D coordinates into a 1D flat array index
   */
  public getIndex(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  /**
   * Get block ID at local coordinates
   */
  public getBlock(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    return this.blocks[this.getIndex(x, y, z)];
  }

  /**
   * Set block ID at local coordinates
   */
  public setBlock(x: number, y: number, z: number, id: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const idx = this.getIndex(x, y, z);
    if (this.blocks[idx] !== id) {
      this.blocks[idx] = id;
      this.isDirty = true;
    }
  }

  /**
   * Get sky light level (0-15)
   */
  public getSkyLight(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 15; // default full sunlight outside bounds
    }
    return this.skyLight[this.getIndex(x, y, z)];
  }

  /**
   * Set sky light level (0-15)
   */
  public setSkyLight(x: number, y: number, z: number, val: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const idx = this.getIndex(x, y, z);
    if (this.skyLight[idx] !== val) {
      this.skyLight[idx] = val;
      this.isDirty = true;
    }
  }

  /**
   * Get block light level (0-15)
   */
  public getBlockLight(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    return this.blockLight[this.getIndex(x, y, z)];
  }

  /**
   * Set block light level (0-15)
   */
  public setBlockLight(x: number, y: number, z: number, val: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const idx = this.getIndex(x, y, z);
    if (this.blockLight[idx] !== val) {
      this.blockLight[idx] = val;
      this.isDirty = true;
    }
  }

  /**
   * Compresses block and lighting data to a binary format for storage
   */
  public serialize(): Uint8Array {
    // Basic flat copy
    const size = this.blocks.length;
    const data = new Uint8Array(size * 3); // blocks, skyLight, blockLight
    data.set(this.blocks, 0);
    data.set(this.skyLight, size);
    data.set(this.blockLight, size * 2);
    return data;
  }

  /**
   * Restores chunk contents from binary data
   */
  public deserialize(data: Uint8Array): void {
    const size = this.blocks.length;
    if (data.length >= size * 3) {
      this.blocks.set(data.subarray(0, size));
      this.skyLight.set(data.subarray(size, size * 2));
      this.blockLight.set(data.subarray(size * 2, size * 3));
      this.isDirty = true;
    }
  }
}
