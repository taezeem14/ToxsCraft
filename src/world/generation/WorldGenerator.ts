/**
 * Tox'sCraft WorldGenerator
 * Generates chunk block data and initial lighting using seeded noise.
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants';
import { Chunk } from '../Chunk';
import { getBiome, BiomeDef } from './BiomeRegistry';
import { getBlock } from '../BlockRegistry';

// Seeded RNG Helper
function createRNG(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0;
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  };
}

export class WorldGenerator {
  private noiseHeight2D: (x: number, y: number) => number;
  private noiseBiomeTemp2D: (x: number, y: number) => number;
  private noiseBiomeHum2D: (x: number, y: number) => number;
  private noiseCave3D: (x: number, y: number, z: number) => number;
  private rng: () => number;

  constructor(seed: string) {
    this.rng = createRNG(seed);
    
    // Create simplex noise functions driven by our seeded RNG
    this.noiseHeight2D = createNoise2D(this.rng);
    this.noiseBiomeTemp2D = createNoise2D(this.rng);
    this.noiseBiomeHum2D = createNoise2D(this.rng);
    this.noiseCave3D = createNoise3D(this.rng);
  }

  /**
   * Generates blocks and height bounds inside a chunk
   */
  public generateChunk(chunk: Chunk): void {
    const worldXOffset = chunk.x * CHUNK_SIZE;
    const worldZOffset = chunk.z * CHUNK_SIZE;
    const seaLevel = 63;

    // Phase 1: Heightmap and terrain structure filling
    const heights = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomesInChunk: BiomeDef[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = worldXOffset + x;
        const wz = worldZOffset + z;

        // Biome factors
        const temp = (this.noiseBiomeTemp2D(wx * 0.001, wz * 0.001) + 1) * 0.5;
        const humid = (this.noiseBiomeHum2D(wx * 0.001, wz * 0.001) + 1) * 0.5;
        
        // Base continent scale
        const cont = (this.noiseHeight2D(wx * 0.002, wz * 0.002) + 1) * 0.5;
        const biome = getBiome(temp, humid, cont);
        biomesInChunk[x + z * CHUNK_SIZE] = biome;

        // Base height details
        let hNoise = this.noiseHeight2D(wx * 0.015, wz * 0.015) * 0.5;
        hNoise += this.noiseHeight2D(wx * 0.04, wz * 0.04) * 0.25;

        // Scale by biome height parameters
        const landHeight = Math.floor(biome.baseHeight * 120 + hNoise * biome.variation * 80);
        const finalHeight = Math.max(10, Math.min(250, landHeight));
        heights[x + z * CHUNK_SIZE] = finalHeight;

        // Fill blocks vertically
        chunk.setBlock(x, 0, z, 11); // Bedrock at bottom

        for (let y = 1; y < CHUNK_HEIGHT; y++) {
          if (y < finalHeight - 4) {
            // Underground stone
            chunk.setBlock(x, y, z, 1); // Stone
          } else if (y < finalHeight) {
            // Subsurface layer (dirt/sandstone)
            chunk.setBlock(x, y, z, biome.subSurfaceBlock);
          } else if (y === finalHeight) {
            // Surface block (grass/sand)
            // If below sea level, it might need to be sand/gravel
            if (y <= seaLevel + 1 && biome.id !== 2 && biome.id !== 9 && biome.id !== 10) {
              chunk.setBlock(x, y, z, 4); // Sand at water borders
            } else {
              if (biome.id === 6) { // Mountain biome
                if (y > 115) {
                  chunk.setBlock(x, y, z, 24); // Snow block top peaks
                } else if (y > 90) {
                  chunk.setBlock(x, y, z, 1); // Stone peaks
                } else {
                  chunk.setBlock(x, y, z, biome.surfaceBlock); // Grass slopes
                }
              } else {
                chunk.setBlock(x, y, z, biome.surfaceBlock);
              }
            }
          } else if (y <= seaLevel) {
            // Fill water up to sea level
            chunk.setBlock(x, y, z, 9); // Water
          } else {
            // Air
            chunk.setBlock(x, y, z, 0);
          }
        }
      }
    }

    // Phase 2: Cave carving (3D Noise)
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = worldXOffset + x;
        const wz = worldZOffset + z;
        const finalHeight = heights[x + z * CHUNK_SIZE];

        for (let y = 1; y < finalHeight - 5; y++) {
          // Double octave 3D cave noise
          const cv1 = this.noiseCave3D(wx * 0.02, y * 0.03, wz * 0.02);
          const cv2 = this.noiseCave3D(wx * 0.05, y * 0.05, wz * 0.05);
          
          if (cv1 * 0.6 + cv2 * 0.4 > 0.48) {
            const currentBlock = chunk.getBlock(x, y, z);
            if (currentBlock !== 11 && currentBlock !== 9) { // Don't carve bedrock/water
              chunk.setBlock(x, y, z, 0); // Air
            }
          }
        }
      }
    }

    // Phase 3: Ore deposits spawning
    this.generateOres(chunk, heights);

    // Phase 4: Foliage & Trees spawning
    this.generateFoliageAndTrees(chunk, heights, biomesInChunk);

    // Phase 5: Initial Sky Light calculations
    this.calculateSkyLight(chunk);
  }

  /**
   * Generates ore veins at respective depth intervals
   */
  private generateOres(chunk: Chunk, heights: Uint8Array): void {
    // Config: oreId, maxDepth, chance, veinSize
    const ores = [
      { id: 12, maxDepth: 140, chance: 0.12, size: 4 }, // Coal
      { id: 13, maxDepth: 80,  chance: 0.08, size: 3 }, // Iron
      { id: 14, maxDepth: 45,  chance: 0.04, size: 3 }, // Gold
      { id: 18, maxDepth: 40,  chance: 0.03, size: 2 }, // Lapis
      { id: 16, maxDepth: 30,  chance: 0.04, size: 2 }, // Redstone
      { id: 15, maxDepth: 16,  chance: 0.015, size: 2 }, // Diamond
      { id: 17, maxDepth: 35,  chance: 0.01, size: 1 }  // Emerald
    ];

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const height = heights[x + z * CHUNK_SIZE];

        for (const ore of ores) {
          if (height > 10 && Math.random() < ore.chance) {
            // Pick a random depth below maxDepth
            const y = Math.floor(Math.random() * Math.min(height - 6, ore.maxDepth)) + 3;
            
            // Build a small cluster
            for (let o = 0; o < ore.size; o++) {
              const ox = x + (Math.floor(Math.random() * 3) - 1);
              const oy = y + (Math.floor(Math.random() * 3) - 1);
              const oz = z + (Math.floor(Math.random() * 3) - 1);

              if (chunk.getBlock(ox, oy, oz) === 1) { // Only replace stone
                chunk.setBlock(ox, oy, oz, ore.id);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Generates trees and surface decorations
   */
  private generateFoliageAndTrees(chunk: Chunk, heights: Uint8Array, biomes: BiomeDef[]): void {
    const seaLevel = 63;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const height = heights[x + z * CHUNK_SIZE];
        const biome = biomes[x + z * CHUNK_SIZE];

        if (height <= seaLevel + 1) continue; // Skip underwater or shoreline

        const surfaceBlock = chunk.getBlock(x, height, z);
        if (surfaceBlock !== 3 && surfaceBlock !== 22 && surfaceBlock !== 4 && surfaceBlock !== 65) continue; // Must be grass, snowy grass, sand, or mycelium

        // Try spawning a tree
        if (Math.random() < biome.treeChance) {
          if (biome.id === 2) {
            // Desert cactus spawn
            const cHeight = Math.floor(Math.random() * 3) + 2; // 2-4 tall
            for (let cy = 1; cy <= cHeight; cy++) {
              chunk.setBlock(x, height + cy, z, 46); // Cactus
            }
          } else if (biome.id === 10) {
            // Mushroom Island giant mushroom spawn
            this.drawGiantMushroom(chunk, x, height + 1, z);
          } else if (biome.id === 8) {
            // Savanna acacia tree spawn
            this.drawAcaciaTree(chunk, x, height + 1, z);
          } else {
            // Standard wood tree spawn
            this.drawTree(chunk, x, height + 1, z, biome.treeType);
          }
          continue;
        }

        // Try spawning detail decorations (flowers, grass, mushrooms)
        if (Math.random() < biome.detailChance) {
          const detailRand = Math.random();
          let detailBlock = 41; // Default tall grass

          if (biome.id === 2) { // Desert
            detailBlock = 48; // Dead bush
          } else if (biome.id === 3) { // Tundra
            detailBlock = 0; // No foliage on snow
          } else if (biome.id === 7) { // Swamp
            detailBlock = detailRand > 0.5 ? 44 : 45; // Mushrooms
          } else if (biome.id === 10) { // Mushroom Island
            detailBlock = detailRand > 0.5 ? 44 : 45; // Mushrooms
          } else {
            if (detailRand > 0.85) {
              detailBlock = 42; // Dandelion
            } else if (detailRand > 0.75) {
              detailBlock = 43; // Poppy
            } else {
              detailBlock = 41; // Tall grass
            }
          }

          if (detailBlock > 0) {
            chunk.setBlock(x, height + 1, z, detailBlock);
          }
        }
      }
    }
  }

  /**
   * Helper to draw a tree at a specific location
   */
  private drawTree(chunk: Chunk, tx: number, ty: number, tz: number, _treeType: string): void {
    const treeHeight = Math.floor(Math.random() * 3) + 5; // 5 to 7 high log trunk
    const leafRadius = 2;

    // Draw trunk log blocks
    const logBlockId = 6; // Oak Log
    const leavesBlockId = 7; // Oak Leaves

    for (let ly = 0; ly < treeHeight; ly++) {
      chunk.setBlock(tx, ty + ly, tz, logBlockId);
    }

    // Draw foliage canopy around the top of the trunk
    const topY = ty + treeHeight - 1;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy >= 0 ? leafRadius - 1 : leafRadius;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Avoid corners for rounded look
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.5) continue;
          
          const rx = tx + dx;
          const ry = topY + dy;
          const rz = tz + dz;

          // Don't replace logs or bedrock
          const existingBlock = chunk.getBlock(rx, ry, rz);
          if (existingBlock === 0) {
            chunk.setBlock(rx, ry, rz, leavesBlockId);
          }
        }
      }
    }
  }

  /**
   * Draw procedurally shaped acacia tree in Savanna
   */
  private drawAcaciaTree(chunk: Chunk, tx: number, ty: number, tz: number): void {
    const height = Math.floor(Math.random() * 2) + 5; // 5 to 6 tall
    const logId = 70; // Acacia Log
    const leavesId = 71; // Acacia Leaves

    // Base straight trunk
    const straightHeight = 3;
    for (let y = 0; y < straightHeight; y++) {
      chunk.setBlock(tx, ty + y, tz, logId);
    }

    const branchHeight = height - straightHeight;

    // Branch 1 (Main slant)
    let bx1 = tx;
    let bz1 = tz;
    for (let y = 0; y < branchHeight; y++) {
      const cy = ty + straightHeight + y;
      if (y > 0) {
        bx1 += 1;
        bz1 += 1;
      }
      chunk.setBlock(bx1, cy, bz1, logId);
    }
    this.drawFlatCanopy(chunk, bx1, ty + height, bz1, leavesId, 2);

    // Branch 2 (Side branch)
    let bx2 = tx;
    let bz2 = tz;
    for (let y = 0; y < branchHeight - 1; y++) {
      const cy = ty + straightHeight + y;
      if (y > 0) {
        bx2 -= 1;
        bz2 -= 1;
      }
      chunk.setBlock(bx2, cy, bz2, logId);
    }
    if (branchHeight > 1) {
      this.drawFlatCanopy(chunk, bx2, ty + straightHeight + branchHeight - 1, bz2, leavesId, 2);
    }
  }

  private drawFlatCanopy(chunk: Chunk, cx: number, cy: number, cz: number, leavesId: number, radius: number): void {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
        
        const rx = cx + dx;
        const rz = cz + dz;
        
        for (let dy = 0; dy <= 1; dy++) {
          const ry = cy + dy;
          const current = chunk.getBlock(rx, ry, rz);
          if (current === 0) {
            chunk.setBlock(rx, ry, rz, leavesId);
          }
        }
      }
    }
  }

  /**
   * Draw giant mushrooms in Mushroom Island (dome for red, plate for brown)
   */
  private drawGiantMushroom(chunk: Chunk, tx: number, ty: number, tz: number): void {
    const isRed = Math.random() > 0.5;
    const height = Math.floor(Math.random() * 3) + 5; // 5 to 7 tall stem
    const stemId = 69; // Mushroom Stem
    const capId = isRed ? 67 : 68; // Red or Brown Mushroom Block

    // 1. Draw stem
    for (let y = 0; y < height; y++) {
      chunk.setBlock(tx, ty + y, tz, stemId);
    }

    const capY = ty + height;

    if (isRed) {
      // Red Mushroom Cap: Dome shape
      // Layer 0 (top): 3x3 red cap
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          chunk.setBlock(tx + dx, capY + 2, tz + dz, capId);
        }
      }
      // Layer 1 (middle): 5x5 red cap with cut corners
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          chunk.setBlock(tx + dx, capY + 1, tz + dz, capId);
        }
      }
      // Layer 2 (bottom): 5x5 outline/ring with cut corners
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            chunk.setBlock(tx + dx, capY, tz + dz, capId);
          }
        }
      }
    } else {
      // Brown Mushroom Cap: Flat plate
      // 5x5 flat cap, corners cut off
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          chunk.setBlock(tx + dx, capY, tz + dz, capId);
        }
      }
    }
  }

  /**
   * Computes simple downward light projection inside the chunk
   */
  private calculateSkyLight(chunk: Chunk): void {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        let light = 15;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const blockId = chunk.getBlock(x, y, z);
          const block = getBlock(blockId);

          if (block.solid) {
            if (block.transparent) {
              // Dim light through transparent blocks
              light = Math.max(0, light - 2);
            } else {
              light = 0;
            }
          } else if (blockId === 9) { // Water
            light = Math.max(0, light - 3); // dim through water
          }

          chunk.setSkyLight(x, y, z, light);
        }
      }
    }
  }

  /**
   * Evaluates the biome at exact world coordinates
   */
  public getBiomeAt(wx: number, wz: number): BiomeDef {
    const temp = (this.noiseBiomeTemp2D(wx * 0.001, wz * 0.001) + 1) * 0.5;
    const humid = (this.noiseBiomeHum2D(wx * 0.001, wz * 0.001) + 1) * 0.5;
    const cont = (this.noiseHeight2D(wx * 0.002, wz * 0.002) + 1) * 0.5;
    return getBiome(temp, humid, cont);
  }
}
