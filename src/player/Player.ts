/**
 * Tox'sCraft Player
 * Manages player states: positions, velocity, health, hunger, active inventory, and damage.
 */

import * as THREE from 'three';
import { Inventory } from '../inventory/Inventory';
import { eventBus } from '../EventBus';

export class Player {
  public position = new THREE.Vector3(0, 100, 0); // Default spawn (we will adjust to floor)
  public velocity = new THREE.Vector3();
  public yaw = 0; // Horizontal rotation
  public pitch = 0; // Vertical rotation

  // Physical stats
  public radius = 0.3; // Half width
  public height = 1.8;
  public eyeHeight = 1.6;
  public onGround = false;
  public isFlying = false;
  public isCreative = false;
  public isSneaking = false;
  public isSwimming = false;

  // Survival stats (out of 20)
  public health = 20.0;
  public maxHealth = 20.0;
  public hunger = 20.0;
  public maxHunger = 20.0;
  public stamina = 20.0;
  public maxStamina = 20.0;
  public oxygen = 20.0;
  public maxOxygen = 20.0;
  public isUnderwater = false;
  public isDead = false;

  // Level progression stats
  public level = 1;
  public xp = 0;

  // Combat & weapons
  public bowCharge = 0;
  public isChargingBow = false;

  // Inventory
  public inventory = new Inventory();

  private regenTimer = 0;
  private hungerTimer = 0;
  private drownTimer = 0;

  constructor() {
    // Listen for custom teleport/reset events if needed
    eventBus.on('respawn', () => this.respawn());
  }

  public respawn(): void {
    this.health = 20.0;
    this.hunger = 20.0;
    this.stamina = 20.0;
    this.oxygen = 20.0;
    this.isUnderwater = false;
    this.isDead = false;
    this.velocity.set(0, 0, 0);
    eventBus.emit('player_status_change');
  }

  /**
   * Resets player position and stats to default spawn.
   * Scans downward from Y=250 to find the topmost solid surface with
   * 2 clear blocks above it. Only treats spawn as ocean if the topmost
   * exposed block is water — underground lakes are NOT treated as ocean.
   */
  public initSpawn(chunkManager: any): void {
    let spawnY = 80; // Safe fallback
    let found = false;

    // Try center first, then spiral out to 8 surrounding positions
    const checkPositions = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]];

    for (const [cx, cz] of checkPositions) {
      // --- Step 1: Find the topmost non-air block scanning from Y=250 ---
      let topmostY = -1;
      let topmostId = 0;
      for (let y = 250; y > 0; y--) {
        const bid = chunkManager.getBlock(cx, y, cz);
        if (bid !== 0) {
          topmostY = y;
          topmostId = bid;
          break;
        }
      }

      if (topmostY < 0) continue; // column not loaded yet

      // --- Step 2: If the very top exposed block is water → ocean spawn ---
      if (topmostId === 9) {
        // Find the actual water surface (top of the water column)
        spawnY = topmostY + 1.2;
        found = true;
        break;
      }

      // --- Step 3: Otherwise scan downward for first solid + 2 air above ---
      for (let y = topmostY; y > 0; y--) {
        const blockId = chunkManager.getBlock(cx, y, cz);
        if (blockId !== 0 && blockId !== 9) { // any solid non-water block
          const above1 = chunkManager.getBlock(cx, y + 1, cz);
          const above2 = chunkManager.getBlock(cx, y + 2, cz);
          // Only spawn here if both blocks above are air (not cave ceiling)
          if (above1 === 0 && above2 === 0) {
            spawnY = y + 1.5;
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }

    this.position.set(0.5, spawnY, 0.5);
    this.velocity.set(0, 0, 0);
    this.health = 20.0;
    this.hunger = 20.0;
    this.stamina = 20.0;
    this.isDead = false;
    eventBus.emit('player_status_change');
  }

  /**
   * Calculates total armor defense value from slots 45-48
   */
  public getArmorPoints(): number {
    let points = 0;
    const slots = this.inventory.getSlots();

    // 45: Helmet, 46: Chestplate, 47: Leggings, 48: Boots
    const armorValues: { [key: string]: number } = {
      'leather_helmet': 1, 'leather_chestplate': 3, 'leather_leggings': 2, 'leather_boots': 1,
      'iron_helmet': 2, 'iron_chestplate': 6, 'iron_leggings': 5, 'iron_boots': 2,
      'diamond_helmet': 3, 'diamond_chestplate': 8, 'diamond_leggings': 6, 'diamond_boots': 3
    };

    for (let i = 45; i <= 48; i++) {
      const item = slots[i];
      if (item && armorValues[item.id]) {
        points += armorValues[item.id];
      }
    }
    return Math.min(20, points);
  }

  /**
   * Processes player stats (regeneration, hunger drain, oxygen) per frame tick
   */
  public update(deltaSec: number): void {
    if (this.isDead) return;

    // Handle Oxygen / Drowning
    if (this.isUnderwater && !this.isCreative) {
      this.oxygen = Math.max(0, this.oxygen - deltaSec * 3.0); // 20 units lasts ~6.5 seconds
      eventBus.emit('player_status_change');

      if (this.oxygen <= 0) {
        this.drownTimer += deltaSec;
        if (this.drownTimer >= 1.0) { // 2 damage per second when suffocating
          this.takeDamage(2.0, true);
          this.drownTimer = 0;
        }
      }
    } else {
      if (this.oxygen < this.maxOxygen) {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + deltaSec * 10.0); // fast recovery
        eventBus.emit('player_status_change');
      }
      this.drownTimer = 0;
    }

    // Handle Health Regeneration (if full or nearly full hunger)
    if (this.hunger >= 18.0 && this.health < this.maxHealth) {
      this.regenTimer += deltaSec;
      if (this.regenTimer >= 3.5) { // Regens 1 HP every 3.5 seconds
        this.heal(1.0);
        this.regenTimer = 0;
      }
    } else {
      this.regenTimer = 0;
    }

    // Passive hunger drain over time
    this.hungerTimer += deltaSec;
    const drainRate = this.velocity.length() > 5.0 ? 0.06 : 0.012; // faster drain when running
    if (this.hungerTimer >= 3.0) {
      this.drainHunger(drainRate);
      this.hungerTimer = 0;
    }
  }

  public takeDamage(amount: number, ignoreArmor = false): void {
    if (this.isDead || this.isCreative) return; // Godmode in creative mode

    let effectiveDamage = amount;
    if (!ignoreArmor) {
      const armor = this.getArmorPoints();
      // Minecraft formula: reduction = min(20, max(armor / 5, armor - damage / (2 + toughness / 4))) / 25
      const reduction = (armor * 0.04); // 4% reduction per armor point up to 80%
      effectiveDamage = Math.max(0.5, amount * (1.0 - reduction));
    }

    this.health = Math.max(0, this.health - effectiveDamage);
    eventBus.emit('player_hurt', effectiveDamage);
    eventBus.emit('player_status_change');

    if (this.health <= 0) {
      this.die();
    }
  }

  public heal(amount: number): void {
    if (this.isDead) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    eventBus.emit('player_status_change');
  }

  public eat(amount: number): void {
    if (this.isDead) return;
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    eventBus.emit('player_status_change');
  }

  public tryEatHeldFood(): boolean {
    const held = this.inventory.getSelected();
    if (!held) return false;

    const foodValues: { [key: string]: { hunger: number; heal?: number } } = {
      'apple': { hunger: 4, heal: 1 },
      'bread': { hunger: 5 },
      'cooked_beef': { hunger: 8, heal: 2 },
      'cooked_porkchop': { hunger: 8, heal: 2 },
      'melon_slice': { hunger: 2 },
      'golden_apple': { hunger: 6, heal: 8 }
    };

    const food = foodValues[held.id];
    if (food && (this.hunger < this.maxHunger || (food.heal && this.health < this.maxHealth))) {
      this.eat(food.hunger);
      if (food.heal) this.heal(food.heal);
      this.inventory.consumeSelected();
      return true;
    }
    return false;
  }

  private drainHunger(amount: number): void {
    if (this.isCreative) return; // No hunger decay in creative mode
    this.hunger = Math.max(0, this.hunger - amount);
    eventBus.emit('player_status_change');

    // Starvation damage
    if (this.hunger <= 0 && this.health > 1.0) {
      this.takeDamage(0.5, true); // starves down to half-heart on normal difficulty
    }
  }

  private die(): void {
    this.isDead = true;
    this.velocity.set(0, 0, 0);
    eventBus.emit('player_die');
  }

  public addXp(amount: number): void {
    if (this.isDead) return;
    this.xp += amount;
    let leveledUp = false;
    while (this.xp >= this.getXpNeeded()) {
      this.xp -= this.getXpNeeded();
      this.level++;
      leveledUp = true;
    }
    eventBus.emit('player_xp_change');
    if (leveledUp) {
      eventBus.emit('player_level_up', this.level);
      eventBus.emit('player_status_change'); // refresh health/hunger/level values
    }
  }

  /**
   * Teleports the player to the surface at their current X, Z coordinates.
   * Useful for loading into safe heights or recovering from physics/clipping bugs.
   */
  public async teleportToSurface(chunkManager: any): Promise<void> {
    const px = Math.floor(this.position.x);
    const pz = Math.floor(this.position.z);
    
    // Force load the chunk immediately (must await since it is async)
    const { cx, cz } = chunkManager.getChunkCoords(px, pz);
    await chunkManager.forceLoadChunk(cx, cz);
    
    let spawnY = 80; // Safe fallback

    // Scan downward from Y=250 to find the topmost solid surface
    let topmostY = -1;
    let topmostId = 0;
    for (let y = 250; y > 0; y--) {
      const bid = chunkManager.getBlock(px, y, pz);
      if (bid !== 0) {
        topmostY = y;
        topmostId = bid;
        break;
      }
    }

    if (topmostY >= 0) {
      if (topmostId === 9) { // Water surface
        spawnY = topmostY + 1.2;
      } else {
        // Look for topmost solid block with 2 air blocks above
        for (let y = topmostY; y > 0; y--) {
          const blockId = chunkManager.getBlock(px, y, pz);
          if (blockId !== 0 && blockId !== 9) {
            const above1 = chunkManager.getBlock(px, y + 1, pz);
            const above2 = chunkManager.getBlock(px, y + 2, pz);
            if (above1 === 0 && above2 === 0) {
              spawnY = y + 1.5;
              break;
            }
          }
        }
      }
    }

    this.position.set(this.position.x, spawnY, this.position.z);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    eventBus.emit('show_toast', 'Teleported to surface!');
  }

  public getXpNeeded(): number {
    return this.level * 100;
  }
}

