/**
 * Tox'sCraft MobManager
 * Handles spawning, ticking, rendering updates, and despawning of active mobs and projectiles.
 */

import * as THREE from 'three';
import { MobEntity, MobType } from './MobEntity';
import { ArrowEntity } from './ArrowEntity';
import { Player } from '../player/Player';
import { ChunkManager } from '../world/ChunkManager';
import { settingsManager } from '../core/SettingsManager';

export class MobManager {
  private scene: THREE.Scene;
  private mobs: MobEntity[] = [];
  private arrows: ArrowEntity[] = [];
  private spawnCooldown = 5.0; // spawn check every 5 seconds
  private spawnTimer = 0;
  private maxMobs = 18; // Support slightly more mobs for splitting slimes

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Main manager tick, runs AI updates, projectile kinematics, and checks spawns
   */
  public update(deltaSec: number, player: Player, chunkManager: ChunkManager): void {
    // 1. Update active arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.update(deltaSec, player, chunkManager);
      if (arrow.isDead) {
        this.arrows.splice(i, 1);
      }
    }

    // 2. Update active mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      mob.update(deltaSec, player, chunkManager, this);

      // Despawn mobs that fall out of bounds or go too far (> 110 blocks)
      const dist = mob.position.distanceTo(player.position);
      if (mob.position.y < -20 || dist > 110.0) {
        mob.destroy(this.scene);
        this.mobs.splice(i, 1);
      }
    }

    // 3. Spawn ticker check
    this.spawnTimer += deltaSec;
    if (this.spawnTimer >= this.spawnCooldown) {
      this.spawnTimer = 0;
      if (this.mobs.length < this.maxMobs) {
        this.attemptSpawn(player, chunkManager);
      }
    }
  }

  private attemptSpawn(player: Player, chunkManager: ChunkManager): void {
    // Pick spawn distance within loaded render boundaries
    const renderDist = settingsManager.getValue('renderDistance') || 4;
    const maxDist = Math.max(20.0, Math.min(50.0, renderDist * 16 - 8));
    const minDist = 12.0;
    const dist = minDist + Math.random() * (maxDist - minDist);

    const angle = Math.random() * Math.PI * 2;
    const sx = Math.floor(player.position.x + Math.cos(angle) * dist);
    const sz = Math.floor(player.position.z + Math.sin(angle) * dist);

    const { cx, cz } = chunkManager.getChunkCoords(sx, sz);
    if (!chunkManager.isChunkLoaded(cx, cz)) return;

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
      const biome = chunkManager.getBiomeAt(sx, sz);
      const types: MobType[] = ['cow', 'pig', 'zombie', 'creeper', 'skeleton', 'spider', 'slime', 'chicken'];
      
      if (biome.id === 0 || biome.id === 8) { // Plains / Savanna
        types.push('villager');
      } else if (biome.id === 1 || biome.id === 6) { // Forest / Mountains
        types.push('pillager');
      }
      
      const chosenType = types[Math.floor(Math.random() * types.length)];
      
      const spawnPos = new THREE.Vector3(sx, sy, sz);
      const mob = new MobEntity(id, chosenType, spawnPos, this.scene);
      this.mobs.push(mob);
    }
  }

  // -------------------------------------------------------------
  // MOB AND PROJECTILE MANAGEMENT API
  // -------------------------------------------------------------

  public addMob(mob: MobEntity): void {
    this.mobs.push(mob);
  }

  public removeMob(id: string): void {
    const idx = this.mobs.findIndex(m => m.id === id);
    if (idx !== -1) {
      const mob = this.mobs[idx];
      mob.destroy(this.scene);
      this.mobs.splice(idx, 1);
    }
  }

  public spawnArrow(id: string, position: THREE.Vector3, velocity: THREE.Vector3): void {
    const arrow = new ArrowEntity(id, position, velocity, this.scene);
    this.arrows.push(arrow);
  }

  /**
   * Raycast attack check against active mob bounding boxes.
   * Resolves first hit within maxRange, dealing damage and playing effects.
   */
  public checkAttack(origin: THREE.Vector3, dir: THREE.Vector3, maxRange: number, player: Player): boolean {
    let closestMob: MobEntity | null = null;
    let closestDist = maxRange;

    const ray = new THREE.Ray(origin, dir);
    const box = new THREE.Box3();

    for (const mob of this.mobs) {
      // Calculate AABB centered on mob
      box.setFromCenterAndSize(
        new THREE.Vector3(mob.position.x, mob.position.y + mob.height / 2, mob.position.z),
        new THREE.Vector3(mob.radius * 2, mob.height, mob.radius * 2)
      );

      const target = new THREE.Vector3();
      if (ray.intersectBox(box, target)) {
        const dist = origin.distanceTo(target);
        if (dist < closestDist) {
          closestDist = dist;
          closestMob = mob;
        }
      }
    }

    if (closestMob) {
      // Resolve melee damage based on active held tool
      const held = player.inventory.getSelected();
      let damage = 2.0; // default fist damage
      
      if (held) {
        if (held.id.includes('sword')) {
          if (held.id.startsWith('wood_')) damage = 4.0;
          else if (held.id.startsWith('stone_')) damage = 5.0;
          else if (held.id.startsWith('iron_')) damage = 7.0;
          else if (held.id.startsWith('diamond_')) damage = 9.0;
        } else if (held.id.includes('pickaxe')) {
          damage = 3.5;
        }
      }

      closestMob.takeDamage(damage, this, this.scene);
      return true;
    }

    return false;
  }

  public clear(): void {
    for (const mob of this.mobs) {
      mob.destroy(this.scene);
    }
    this.mobs = [];

    for (const arrow of this.arrows) {
      arrow.destroy();
    }
    this.arrows = [];
  }
}
