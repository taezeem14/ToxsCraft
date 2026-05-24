/**
 * Tox'sCraft ItemStack
 * Represents a quantity of a specific item or block in an inventory slot.
 */

export interface ItemStack {
  id: string; // E.g. "stone", "oak_log", "iron_pickaxe", "apple"
  count: number;
  maxStack?: number;
  durability?: number; // E.g. tools have durability
  maxDurability?: number;
}

export function createItemStack(id: string, count = 1, durability?: number): ItemStack {
  let maxStack = 64;
  let maxDurability: number | undefined = undefined;

  // Set limits based on item types
  if (id.includes('_pickaxe') || id.includes('_axe') || id.includes('_sword') || id.includes('_shovel')) {
    maxStack = 1;
    if (id.startsWith('wood_')) maxDurability = 60;
    else if (id.startsWith('stone_')) maxDurability = 130;
    else if (id.startsWith('iron_')) maxDurability = 250;
    else if (id.startsWith('diamond_')) maxDurability = 1560;
  }

  return {
    id,
    count,
    maxStack,
    durability: durability !== undefined ? durability : maxDurability,
    maxDurability
  };
}
