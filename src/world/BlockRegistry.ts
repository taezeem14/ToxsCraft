/**
 * Tox'sCraft BlockRegistry
 * Defines all 64+ blocks and their physical and visual properties.
 */

export interface BlockDef {
  id: number;
  name: string;
  solid: boolean;
  transparent: boolean;
  emissive: number; // 0-15 light level emitted
  hardness: number; // Time multiplier to mine (0 = instant, -1 = unbreakable)
  climbable?: boolean;
  fluid?: boolean;
  speedMultiplier?: number; // E.g. Soul sand slows down
  damageOnTouch?: number; // HP per tick
  lootItem?: string; // Item ID dropped when mined
  textures: {
    top: number;
    bottom: number;
    side: number;
    front?: number; // optional, e.g. for chests/furnaces
    back?: number;
    left?: number;
    right?: number;
  };
}

export const BLOCKS: { [id: number]: BlockDef } = {
  0: { id: 0, name: "Air", solid: false, transparent: true, emissive: 0, hardness: 0, textures: { top: 0, bottom: 0, side: 0 } },
  1: { id: 1, name: "Stone", solid: true, transparent: false, emissive: 0, hardness: 1.5, lootItem: "cobblestone", textures: { top: 1, bottom: 1, side: 1 } },
  2: { id: 2, name: "Dirt", solid: true, transparent: false, emissive: 0, hardness: 0.5, lootItem: "dirt", textures: { top: 2, bottom: 2, side: 2 } },
  3: { id: 3, name: "Grass Block", solid: true, transparent: false, emissive: 0, hardness: 0.6, lootItem: "dirt", textures: { top: 3, bottom: 2, side: 4 } },
  4: { id: 4, name: "Sand", solid: true, transparent: false, emissive: 0, hardness: 0.5, lootItem: "sand", textures: { top: 5, bottom: 5, side: 5 } },
  5: { id: 5, name: "Gravel", solid: true, transparent: false, emissive: 0, hardness: 0.6, lootItem: "gravel", textures: { top: 6, bottom: 6, side: 6 } },
  6: { id: 6, name: "Oak Log", solid: true, transparent: false, emissive: 0, hardness: 2.0, lootItem: "oak_log", textures: { top: 7, bottom: 7, side: 8 } },
  7: { id: 7, name: "Oak Leaves", solid: true, transparent: true, emissive: 0, hardness: 0.2, lootItem: "oak_sapling", textures: { top: 9, bottom: 9, side: 9 } },
  8: { id: 8, name: "Glass", solid: true, transparent: true, emissive: 0, hardness: 0.3, lootItem: "glass", textures: { top: 10, bottom: 10, side: 10 } },
  9: { id: 9, name: "Water Flowing", solid: false, transparent: true, emissive: 0, hardness: 0, fluid: true, textures: { top: 11, bottom: 11, side: 11 } },
  10: { id: 10, name: "Lava Flowing", solid: false, transparent: false, emissive: 15, hardness: 0, fluid: true, damageOnTouch: 4, textures: { top: 12, bottom: 12, side: 12 } },
  11: { id: 11, name: "Bedrock", solid: true, transparent: false, emissive: 0, hardness: -1, textures: { top: 13, bottom: 13, side: 13 } },
  12: { id: 12, name: "Coal Ore", solid: true, transparent: false, emissive: 0, hardness: 3.0, lootItem: "coal", textures: { top: 14, bottom: 14, side: 14 } },
  13: { id: 13, name: "Iron Ore", solid: true, transparent: false, emissive: 0, hardness: 3.0, lootItem: "raw_iron", textures: { top: 15, bottom: 15, side: 15 } },
  14: { id: 14, name: "Gold Ore", solid: true, transparent: false, emissive: 0, hardness: 3.0, lootItem: "raw_gold", textures: { top: 16, bottom: 16, side: 16 } },
  15: { id: 15, name: "Diamond Ore", solid: true, transparent: false, emissive: 0, hardness: 3.0, lootItem: "diamond", textures: { top: 17, bottom: 17, side: 17 } },
  16: { id: 16, name: "Redstone Ore", solid: true, transparent: false, emissive: 9, hardness: 3.0, lootItem: "redstone_dust", textures: { top: 18, bottom: 18, side: 18 } },
  17: { id: 17, name: "Emerald Ore", solid: true, transparent: false, emissive: 0, hardness: 3.0, lootItem: "emerald", textures: { top: 19, bottom: 19, side: 19 } },
  18: { id: 18, name: "Lapis Ore", solid: true, transparent: false, emissive: 0, hardness: 3.0, lootItem: "lapis_lazuli", textures: { top: 20, bottom: 20, side: 20 } },
  19: { id: 19, name: "Cobblestone", solid: true, transparent: false, emissive: 0, hardness: 2.0, lootItem: "cobblestone", textures: { top: 1, bottom: 1, side: 1 } },
  20: { id: 20, name: "Oak Planks", solid: true, transparent: false, emissive: 0, hardness: 2.0, lootItem: "oak_planks", textures: { top: 21, bottom: 21, side: 21 } },
  21: { id: 21, name: "Sandstone", solid: true, transparent: false, emissive: 0, hardness: 0.8, lootItem: "sandstone", textures: { top: 22, bottom: 22, side: 22 } },
  22: { id: 22, name: "Snowy Grass", solid: true, transparent: false, emissive: 0, hardness: 0.6, lootItem: "dirt", textures: { top: 23, bottom: 2, side: 24 } },
  23: { id: 23, name: "Ice", solid: true, transparent: true, emissive: 0, hardness: 0.5, speedMultiplier: 1.2, lootItem: "ice", textures: { top: 25, bottom: 25, side: 25 } },
  24: { id: 24, name: "Snow Block", solid: true, transparent: false, emissive: 0, hardness: 0.2, lootItem: "snowball", textures: { top: 26, bottom: 26, side: 26 } },
  25: { id: 25, name: "Clay", solid: true, transparent: false, emissive: 0, hardness: 0.6, lootItem: "clay_ball", textures: { top: 27, bottom: 27, side: 27 } },
  26: { id: 26, name: "Obsidian", solid: true, transparent: false, emissive: 0, hardness: 10.0, lootItem: "obsidian", textures: { top: 28, bottom: 28, side: 28 } },
  27: { id: 27, name: "Torch", solid: false, transparent: true, emissive: 14, hardness: 0, lootItem: "torch", textures: { top: 29, bottom: 29, side: 29 } },
  28: { id: 28, name: "Crafting Table", solid: true, transparent: false, emissive: 0, hardness: 2.5, lootItem: "crafting_table", textures: { top: 30, bottom: 21, side: 31 } },
  29: { id: 29, name: "Furnace", solid: true, transparent: false, emissive: 0, hardness: 3.5, lootItem: "furnace", textures: { top: 1, bottom: 1, side: 32, front: 33 } },
  30: { id: 30, name: "Active Furnace", solid: true, transparent: false, emissive: 13, hardness: 3.5, lootItem: "furnace", textures: { top: 1, bottom: 1, side: 32, front: 34 } },
  31: { id: 31, name: "Chest", solid: true, transparent: false, emissive: 0, hardness: 2.5, lootItem: "chest", textures: { top: 35, bottom: 35, side: 35 } },
  32: { id: 32, name: "Glowstone", solid: true, transparent: false, emissive: 15, hardness: 0.3, lootItem: "glowstone_dust", textures: { top: 36, bottom: 36, side: 36 } },
  33: { id: 33, name: "Mossy Cobblestone", solid: true, transparent: false, emissive: 0, hardness: 2.0, lootItem: "mossy_cobblestone", textures: { top: 37, bottom: 37, side: 37 } },
  34: { id: 34, name: "Bricks", solid: true, transparent: false, emissive: 0, hardness: 2.0, lootItem: "bricks", textures: { top: 38, bottom: 38, side: 38 } },
  35: { id: 35, name: "Bookshelf", solid: true, transparent: false, emissive: 0, hardness: 1.5, lootItem: "bookshelf", textures: { top: 21, bottom: 21, side: 39 } },
  36: { id: 36, name: "Sponge", solid: true, transparent: false, emissive: 0, hardness: 0.6, lootItem: "sponge", textures: { top: 40, bottom: 40, side: 40 } },
  37: { id: 37, name: "White Wool", solid: true, transparent: false, emissive: 0, hardness: 0.8, lootItem: "white_wool", textures: { top: 41, bottom: 41, side: 41 } },
  38: { id: 38, name: "Red Wool", solid: true, transparent: false, emissive: 0, hardness: 0.8, lootItem: "red_wool", textures: { top: 42, bottom: 42, side: 42 } },
  39: { id: 39, name: "Green Wool", solid: true, transparent: false, emissive: 0, hardness: 0.8, lootItem: "green_wool", textures: { top: 43, bottom: 43, side: 43 } },
  40: { id: 40, name: "Blue Wool", solid: true, transparent: false, emissive: 0, hardness: 0.8, lootItem: "blue_wool", textures: { top: 44, bottom: 44, side: 44 } },
  41: { id: 41, name: "Tall Grass", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "wheat_seeds", textures: { top: 45, bottom: 45, side: 45 } },
  42: { id: 42, name: "Dandelion", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "dandelion", textures: { top: 46, bottom: 46, side: 46 } },
  43: { id: 43, name: "Poppy", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "poppy", textures: { top: 47, bottom: 47, side: 47 } },
  44: { id: 44, name: "Brown Mushroom", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "brown_mushroom", textures: { top: 48, bottom: 48, side: 48 } },
  45: { id: 45, name: "Red Mushroom", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "red_mushroom", textures: { top: 49, bottom: 49, side: 49 } },
  46: { id: 46, name: "Cactus", solid: true, transparent: true, emissive: 0, hardness: 0.4, damageOnTouch: 1, lootItem: "cactus", textures: { top: 50, bottom: 50, side: 51 } },
  47: { id: 47, name: "Sugar Cane", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "sugar_cane", textures: { top: 52, bottom: 52, side: 52 } },
  48: { id: 48, name: "Dead Bush", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "stick", textures: { top: 53, bottom: 53, side: 53 } },
  49: { id: 49, name: "Lily Pad", solid: false, transparent: true, emissive: 0, hardness: 0, lootItem: "lily_pad", textures: { top: 54, bottom: 54, side: 54 } },
  50: { id: 50, name: "Iron Block", solid: true, transparent: false, emissive: 0, hardness: 5.0, lootItem: "iron_block", textures: { top: 55, bottom: 55, side: 55 } },
  51: { id: 51, name: "Gold Block", solid: true, transparent: false, emissive: 0, hardness: 3.0, lootItem: "gold_block", textures: { top: 56, bottom: 56, side: 56 } },
  52: { id: 52, name: "Diamond Block", solid: true, transparent: false, emissive: 0, hardness: 5.0, lootItem: "diamond_block", textures: { top: 57, bottom: 57, side: 57 } },
  53: { id: 53, name: "Netherrack", solid: true, transparent: false, emissive: 0, hardness: 0.4, lootItem: "netherrack", textures: { top: 58, bottom: 58, side: 58 } },
  54: { id: 54, name: "Soul Sand", solid: true, transparent: false, emissive: 0, hardness: 0.5, speedMultiplier: 0.4, lootItem: "soul_sand", textures: { top: 59, bottom: 59, side: 59 } },
  55: { id: 55, name: "Glow Lichen", solid: false, transparent: true, emissive: 7, hardness: 0.2, lootItem: "glow_lichen", textures: { top: 60, bottom: 60, side: 60 } },
  56: { id: 56, name: "Pumpkin", solid: true, transparent: false, emissive: 0, hardness: 1.0, lootItem: "pumpkin", textures: { top: 61, bottom: 61, side: 62 } },
  57: { id: 57, name: "Jack O' Lantern", solid: true, transparent: false, emissive: 15, hardness: 1.0, lootItem: "jack_o_lantern", textures: { top: 61, bottom: 61, side: 62, front: 63 } },
  58: { id: 58, name: "Melon Block", solid: true, transparent: false, emissive: 0, hardness: 1.0, lootItem: "melon_slice", textures: { top: 64, bottom: 64, side: 65 } },
  59: { id: 59, name: "TNT", solid: true, transparent: false, emissive: 0, hardness: 0, lootItem: "tnt", textures: { top: 66, bottom: 67, side: 68 } },
  60: { id: 60, name: "Glass Pane", solid: true, transparent: true, emissive: 0, hardness: 0.3, lootItem: "glass_pane", textures: { top: 10, bottom: 10, side: 10 } },
  61: { id: 61, name: "Oak Door Block", solid: true, transparent: true, emissive: 0, hardness: 2.0, lootItem: "oak_door", textures: { top: 21, bottom: 21, side: 21 } },
  62: { id: 62, name: "Ladder", solid: false, transparent: true, emissive: 0, hardness: 0.4, climbable: true, lootItem: "ladder", textures: { top: 69, bottom: 69, side: 69 } },
  63: { id: 63, name: "Cobweb", solid: false, transparent: true, emissive: 0, hardness: 4.0, speedMultiplier: 0.15, lootItem: "string", textures: { top: 70, bottom: 70, side: 70 } },
  64: { id: 64, name: "Ice Blue", solid: true, transparent: true, emissive: 0, hardness: 0.5, speedMultiplier: 1.2, lootItem: "ice", textures: { top: 25, bottom: 25, side: 25 } },
  65: { id: 65, name: "Mycelium", solid: true, transparent: false, emissive: 0, hardness: 0.6, lootItem: "dirt", textures: { top: 71, bottom: 2, side: 72 } },
  66: { id: 66, name: "Terracotta", solid: true, transparent: false, emissive: 0, hardness: 1.25, lootItem: "terracotta", textures: { top: 73, bottom: 73, side: 73 } },
  67: { id: 67, name: "Red Mushroom Block", solid: true, transparent: false, emissive: 0, hardness: 0.2, lootItem: "red_mushroom", textures: { top: 74, bottom: 77, side: 74 } },
  68: { id: 68, name: "Brown Mushroom Block", solid: true, transparent: false, emissive: 0, hardness: 0.2, lootItem: "brown_mushroom", textures: { top: 75, bottom: 77, side: 75 } },
  69: { id: 69, name: "Mushroom Stem", solid: true, transparent: false, emissive: 0, hardness: 0.2, lootItem: "mushroom_stem", textures: { top: 76, bottom: 76, side: 76 } },
  70: { id: 70, name: "Acacia Log", solid: true, transparent: false, emissive: 0, hardness: 2.0, lootItem: "acacia_log", textures: { top: 78, bottom: 78, side: 79 } },
  71: { id: 71, name: "Acacia Leaves", solid: true, transparent: true, emissive: 0, hardness: 0.2, lootItem: "acacia_sapling", textures: { top: 80, bottom: 80, side: 80 } }
};

export function getBlock(id: number): BlockDef {
  return BLOCKS[id] || BLOCKS[0];
}
