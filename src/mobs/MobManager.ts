/**
 * Tox'sCraft MobManager
 * Handles spawning, ticking, rendering updates, and despawning of active mobs.
 */

import * as THREE from 'three';
import { MobEntity, MobType } from './MobEntity';
import { Player } from '../player/Player';
import { ChunkManager } from '../world/ChunkManager';

export class MobManager {
  private scene: THREE.Scene;
  private mobs: MobEntity[] = [];
  private spawnCooldown = 15.0; // spawn check every 15 seconds
  private spawnTimer = 0;
  private maxMobs = 10;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Main manager tick, runs AI updates and checks spawns
   */
  public update(deltaSec: number, player: Player, chunkManager: ChunkManager): void {
    // 1. Update active mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      mob.update(deltaSec, player, chunkManager);

      // Despawn mobs that fall out of bounds or go too far (> 120 blocks)
      const dist = mob.position.distanceTo(player.position);
      if (mob.position.y < -20 || dist > 120.0) {
        mob.destroy(this.scene);
        this.mobs.splice(i, 1);
      }
    }

    // 2. Spawn ticker check
    this.spawnTimer += deltaSec;
    if (this.spawnTimer >= this.spawnCooldown) {
      this.spawnTimer = 0;
      if (this.mobs.length < this.maxMobs) {
        this.attemptSpawn(player, chunkManager);
      }
    }
  }

  private attemptSpawn(player: Player, chunkManager: ChunkManager): void {
    // Pick random horizontal offset from player (30-60 blocks away)
    const angle = Math.random() * Math.PI * 2;
    const dist = 30.0 + Math.random() * 20.0;
    
    const sx = Math.floor(player.position.x + Math.cos(angle) * dist);
    const sz = Math.floor(player.position.z + Math.sin(angle) * dist);

    // Find surface Y level
    let sy = -1;
    for (let y = 160; y > 0; y--) {
      const blockId = chunkManager.getBlock(sx, y, sz);
      if (blockId !== 0 && blockId !== 9) { // Solid surface
        sy = y + 1.5;
        break;
      }
    }

    if (sy > 0) {
      const id = Math.random().toString(36).substring(2, 9);
      const types: MobType[] = ['cow', 'pig', 'zombie'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      
      const spawnPos = new THREE.Vector3(sx, sy, sz);
      const mob = new MobEntity(id, chosenType, spawnPos, this.scene);
      this.mobs.push(mob);
    }
  }

  public clear(): void {
    for (const mob of this.mobs) {
      mob.destroy(this.scene);
    }
    this.mobs = [];
  }
}
