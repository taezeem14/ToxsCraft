/**
 * Tox'sCraft Inventory
 * Manages slots for storing, stacking, and removing ItemStacks.
 */

import { ItemStack, createItemStack } from './ItemStack';
import { eventBus } from '../EventBus';

export class Inventory {
  private slots: (ItemStack | null)[] = [];
  private selectedSlotIndex = 0; // 0 to 8 (hotbar)

  constructor() {
    // 50 slots: 0-8 are Hotbar, 9-44 are Main Inventory, 45-48 are Armor, 49 is Off-hand
    for (let i = 0; i < 50; i++) {
      this.slots.push(null);
    }

    // Scaffold some initial items for test play!
    this.slots[0] = createItemStack('wood_pickaxe', 1);
    this.slots[1] = createItemStack('grass_block', 64);
    this.slots[2] = createItemStack('stone', 32);
    this.slots[3] = createItemStack('torch', 16);
    this.slots[4] = createItemStack('oak_log', 10);
    this.slots[5] = createItemStack('apple', 5);
  }

  public getSlots(): (ItemStack | null)[] {
    return this.slots;
  }

  public getHotbarSlotIndex(): number {
    return this.selectedSlotIndex;
  }

  public setHotbarSlotIndex(index: number): void {
    if (index >= 0 && index < 9) {
      this.selectedSlotIndex = index;
      eventBus.emit('hotbar_change', index);
    }
  }

  /**
   * Returns held item in selected hotbar slot
   */
  public getSelected(): ItemStack | null {
    return this.slots[this.selectedSlotIndex];
  }

  /**
   * Get stack at slot index
   */
  public getItem(index: number): ItemStack | null {
    if (index < 0 || index >= 50) return null;
    return this.slots[index];
  }

  /**
   * Set stack at slot index
   */
  public setItem(index: number, stack: ItemStack | null): void {
    if (index >= 0 && index < 50) {
      this.slots[index] = stack;
      eventBus.emit('inventory_update');
    }
  }

  /**
   * Adds an item, merging with existing stacks or placing in first empty slot.
   * Returns true if the entire stack was successfully added.
   */
  public addItem(item: ItemStack): boolean {
    let remaining = item.count;
    const max = item.maxStack || 64;

    // 1. Try to merge into existing stacks of same item (exclude armor and off-hand slots 45-49)
    for (let i = 0; i < 45; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === item.id && slot.count < max) {
        const addAmount = Math.min(remaining, max - slot.count);
        slot.count += addAmount;
        remaining -= addAmount;
        if (remaining <= 0) {
          eventBus.emit('inventory_update');
          return true;
        }
      }
    }

    // 2. Insert into first available empty slots (exclude armor and off-hand slots 45-49)
    for (let i = 0; i < 45; i++) {
      if (this.slots[i] === null) {
        const addAmount = Math.min(remaining, max);
        this.slots[i] = createItemStack(item.id, addAmount, item.durability);
        remaining -= addAmount;
        if (remaining <= 0) {
          eventBus.emit('inventory_update');
          return true;
        }
      }
    }

    eventBus.emit('inventory_update');
    return remaining === 0;
  }

  /**
   * Consumes 1 count from selected held stack
   */
  public consumeSelected(): void {
    const slot = this.getSelected();
    if (slot) {
      slot.count--;
      if (slot.count <= 0) {
        this.slots[this.selectedSlotIndex] = null;
      }
      eventBus.emit('inventory_update');
    }
  }

  public clear(): void {
    for (let i = 0; i < 50; i++) {
      this.slots[i] = null;
    }
    eventBus.emit('inventory_update');
  }
}
