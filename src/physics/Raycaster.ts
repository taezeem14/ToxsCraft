/**
 * Tox'sCraft Raycaster
 * Implements Amanatides & Woo's fast 3D DDA (Digital Differential Analysis) voxel raycast algorithm.
 * Used for block selection, placing targets, and mining outlines.
 */

import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { getBlock } from '../world/BlockRegistry';

export interface RaycastResult {
  blockX: number;
  blockY: number;
  blockZ: number;
  faceNormal: THREE.Vector3; // Direction pointing away from hit face
  blockId: number;
  distance: number;
}

export class Raycaster {
  /**
   * Casts a ray from origin in dir up to maxDistance, checking for non-air voxels.
   */
  public static cast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDistance: number,
    chunkManager: ChunkManager
  ): RaycastResult | null {
    // Current voxel coordinate
    let ix = Math.floor(origin.x);
    let iy = Math.floor(origin.y);
    let iz = Math.floor(origin.z);

    // Direction sign steps
    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    // Length of ray to cross one voxel unit along each axis
    const deltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const deltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const deltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);

    // Initial ray distance to next voxel border
    let tMaxX = dir.x === 0 ? Infinity : (stepX > 0 ? (ix + 1 - origin.x) : (origin.x - ix)) * deltaX;
    let tMaxY = dir.y === 0 ? Infinity : (stepY > 0 ? (iy + 1 - origin.y) : (origin.y - iy)) * deltaY;
    let tMaxZ = dir.z === 0 ? Infinity : (stepZ > 0 ? (iz + 1 - origin.z) : (origin.z - iz)) * deltaZ;

    let hitNormal = new THREE.Vector3();
    let distance = 0;

    // Run DDA loop
    while (distance < maxDistance) {
      // Find smallest tMax step
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        ix += stepX;
        distance = tMaxX;
        tMaxX += deltaX;
        hitNormal.set(-stepX, 0, 0);
      } else if (tMaxY < tMaxZ) {
        iy += stepY;
        distance = tMaxY;
        tMaxY += deltaY;
        hitNormal.set(0, -stepY, 0);
      } else {
        iz += stepZ;
        distance = tMaxZ;
        tMaxZ += deltaZ;
        hitNormal.set(0, 0, -stepZ);
      }

      // Check if block at this step is hit
      const blockId = chunkManager.getBlock(ix, iy, iz);
      if (blockId !== 0 && blockId !== 9) { // Solid block (ignore air and water)
        const block = getBlock(blockId);
        
        // Solid or transparent decorative blocks (like glass, chest) count as raycast targets
        if (block.solid || blockId === 27 || blockId === 41 || blockId === 42 || blockId === 43) {
          return {
            blockX: ix,
            blockY: iy,
            blockZ: iz,
            faceNormal: hitNormal.clone(),
            blockId,
            distance
          };
        }
      }
    }

    return null; // Hit nothing within reach
  }
}
