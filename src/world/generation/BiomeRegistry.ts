/**
 * Tox'sCraft BiomeRegistry
 * Defines the 8+ game biomes and their specific height, block, and foliage params.
 */

export interface BiomeDef {
  id: number;
  name: string;
  temperature: number; // 0 (cold) to 1 (hot)
  humidity: number;    // 0 (dry) to 1 (wet)
  baseHeight: number;  // Base landscape level (0-1)
  variation: number;   // Height scale/roughness
  surfaceBlock: number;
  subSurfaceBlock: number;
  treeChance: number;   // Probability of a tree in a column (0-1)
  treeType: 'oak' | 'birch' | 'spruce' | 'jungle' | 'acacia';
  detailChance: number; // Probability of grass, flowers, mushrooms
  fogColor: [number, number, number]; // RGB normalized
}

export const BIOMES: { [id: number]: BiomeDef } = {
  0: { // Plains
    id: 0,
    name: "Plains",
    temperature: 0.6,
    humidity: 0.4,
    baseHeight: 0.35,
    variation: 0.08,
    surfaceBlock: 3, // Grass
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.01,
    treeType: 'oak',
    detailChance: 0.15,
    fogColor: [0.7, 0.85, 0.95]
  },
  1: { // Forest
    id: 1,
    name: "Forest",
    temperature: 0.5,
    humidity: 0.7,
    baseHeight: 0.38,
    variation: 0.15,
    surfaceBlock: 3, // Grass
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.08,
    treeType: 'oak',
    detailChance: 0.20,
    fogColor: [0.65, 0.88, 0.9]
  },
  2: { // Desert
    id: 2,
    name: "Desert",
    temperature: 1.0,
    humidity: 0.0,
    baseHeight: 0.32,
    variation: 0.05,
    surfaceBlock: 4, // Sand
    subSurfaceBlock: 21, // Sandstone
    treeChance: 0.005, // Cacti instead
    treeType: 'acacia',
    detailChance: 0.02,
    fogColor: [0.95, 0.85, 0.6]
  },
  3: { // Tundra
    id: 3,
    name: "Tundra",
    temperature: 0.0,
    humidity: 0.3,
    baseHeight: 0.35,
    variation: 0.1,
    surfaceBlock: 22, // Snowy Grass
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.02,
    treeType: 'spruce',
    detailChance: 0.05,
    fogColor: [0.85, 0.9, 0.95]
  },
  4: { // Ocean
    id: 4,
    name: "Ocean",
    temperature: 0.4,
    humidity: 0.8,
    baseHeight: 0.15,
    variation: 0.05,
    surfaceBlock: 4, // Sand / Gravel floor
    subSurfaceBlock: 5, // Gravel
    treeChance: 0.0,
    treeType: 'oak',
    detailChance: 0.0,
    fogColor: [0.1, 0.2, 0.4]
  },
  5: { // Jungle
    id: 5,
    name: "Jungle",
    temperature: 0.9,
    humidity: 0.9,
    baseHeight: 0.4,
    variation: 0.2,
    surfaceBlock: 3, // Grass
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.15,
    treeType: 'jungle',
    detailChance: 0.3,
    fogColor: [0.6, 0.85, 0.7]
  },
  6: { // Mountains
    id: 6,
    name: "Mountains",
    temperature: 0.2,
    humidity: 0.3,
    baseHeight: 0.6,
    variation: 0.35,
    surfaceBlock: 3, // Grass Block
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.02,
    treeType: 'spruce',
    detailChance: 0.08,
    fogColor: [0.8, 0.8, 0.85]
  },
  7: { // Swamp
    id: 7,
    name: "Swamp",
    temperature: 0.7,
    humidity: 0.8,
    baseHeight: 0.28,
    variation: 0.03,
    surfaceBlock: 3, // Grass
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.05,
    treeType: 'oak',
    detailChance: 0.25,
    fogColor: [0.45, 0.55, 0.4]
  },
  8: { // Savanna
    id: 8,
    name: "Savanna",
    temperature: 0.8,
    humidity: 0.2,
    baseHeight: 0.36,
    variation: 0.08,
    surfaceBlock: 3, // Grass
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.02,
    treeType: 'acacia',
    detailChance: 0.1,
    fogColor: [0.9, 0.85, 0.75]
  },
  9: { // Badlands
    id: 9,
    name: "Badlands",
    temperature: 0.95,
    humidity: 0.05,
    baseHeight: 0.45,
    variation: 0.25,
    surfaceBlock: 66, // Terracotta
    subSurfaceBlock: 66, // Terracotta
    treeChance: 0.0,
    treeType: 'oak',
    detailChance: 0.01,
    fogColor: [0.95, 0.8, 0.65]
  },
  10: { // Mushroom Island
    id: 10,
    name: "Mushroom Island",
    temperature: 0.6,
    humidity: 0.9,
    baseHeight: 0.35,
    variation: 0.1,
    surfaceBlock: 65, // Mycelium
    subSurfaceBlock: 2, // Dirt
    treeChance: 0.03,
    treeType: 'oak',
    detailChance: 0.2,
    fogColor: [0.8, 0.85, 0.9]
  },
  11: { // Nether
    id: 11,
    name: "Nether",
    temperature: 1.0,
    humidity: 0.0,
    baseHeight: 0.3,
    variation: 0.1,
    surfaceBlock: 53, // Netherrack
    subSurfaceBlock: 53, // Netherrack
    treeChance: 0.0,
    treeType: 'oak',
    detailChance: 0.0,
    fogColor: [0.3, 0.05, 0.05]
  }
};

/**
 * Given a temperature and humidity (0-1), return the closest matching Biome
 */
export function getBiome(temp: number, humid: number, yVal: number): BiomeDef {
  // If height is very low, it's ocean
  if (yVal < 0.26) {
    return BIOMES[4]; // Ocean
  }

  let bestMatch = BIOMES[0];
  let minDistance = Infinity;

  for (const key in BIOMES) {
    const biome = BIOMES[key];
    if (biome.id === 4) continue; // Skip ocean height override

    // Calculate Euclidean distance in Temp/Humidity space
    const dt = temp - biome.temperature;
    const dh = humid - biome.humidity;
    const dist = dt * dt + dh * dh;

    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = biome;
    }
  }

  // Override mountains if height is high
  if (yVal > 0.63) {
    return BIOMES[6]; // Mountains
  }

  return bestMatch;
}
