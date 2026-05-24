/**
 * Tox'sCraft Physics Engine
 * Implements axis-aligned bounding box (AABB) sweep-and-slide collision resolution
 * against the solid voxel grid.
 */

import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { getBlock } from '../world/BlockRegistry';

export interface PhysicsEntity {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  height: number;
  onGround: boolean;
}

export class Physics {
  /**
   * Checks if an AABB at a given position intersects with any solid block
   */
  public static checkCollision(
    pos: THREE.Vector3,
    radius: number,
    height: number,
    chunkManager: ChunkManager
  ): boolean {
    const minX = Math.floor(pos.x - radius);
    const maxX = Math.floor(pos.x + radius);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + height);
    const minZ = Math.floor(pos.z - radius);
    const maxZ = Math.floor(pos.z + radius);

    // Scan all overlapping block cells
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const blockId = chunkManager.getBlock(x, y, z);
          const block = getBlock(blockId);
          
          if (block.solid) {
            // AABB intersection check
            const overlapX = (pos.x + radius > x) && (pos.x - radius < x + 1);
            const overlapY = (pos.y + height > y) && (pos.y < y + 1);
            const overlapZ = (pos.z + radius > z) && (pos.z - radius < z + 1);

            if (overlapX && overlapY && overlapZ) {
              return true; // Intersecting a solid block
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Resolves collision axis-by-axis, sliding the entity along solid boundaries.
   * Modifies entity position and velocity vectors directly.
   */
  public static moveEntity(
    entity: PhysicsEntity,
    deltaSec: number,
    chunkManager: ChunkManager
  ): void {
    const pos = entity.position;
    const vel = entity.velocity;

    // 1. Move along Y-axis first to resolve vertical footing
    const dy = vel.y * deltaSec;
    if (dy !== 0) {
      pos.y += dy;
      if (this.checkCollision(pos, entity.radius, entity.height, chunkManager)) {
        if (dy < 0) {
          // Landed on floor
          pos.y = Math.ceil(pos.y); // Snap to block top
          entity.onGround = true;
        } else {
          // Hit ceiling
          pos.y = Math.floor(pos.y + entity.height) - entity.height - 0.001; // Snap below ceiling
        }
        vel.y = 0; // stop vertical velocity
      } else {
        if (vel.y !== 0) {
          entity.onGround = false;
        }
      }
    }

    // 2. Move along X-axis
    const dx = vel.x * deltaSec;
    if (dx !== 0) {
      pos.x += dx;
      if (this.checkCollision(pos, entity.radius, entity.height, chunkManager)) {
        if (dx > 0) {
          // Collided going east, snap west
          pos.x = Math.floor(pos.x + entity.radius) - entity.radius - 0.001;
        } else {
          // Collided going west, snap east
          pos.x = Math.ceil(pos.x - entity.radius) + entity.radius + 0.001;
        }
        vel.x = 0; // stop x velocity
      }
    }

    // 3. Move along Z-axis
    const dz = vel.z * deltaSec;
    if (dz !== 0) {
      pos.z += dz;
      if (this.checkCollision(pos, entity.radius, entity.height, chunkManager)) {
        if (dz > 0) {
          // Collided going south, snap north
          pos.z = Math.floor(pos.z + entity.radius) - entity.radius - 0.001;
        } else {
          // Collided going north, snap south
          pos.z = Math.ceil(pos.z - entity.radius) + entity.radius + 0.001;
        }
        vel.z = 0; // stop z velocity
      }
    }
  }
}
