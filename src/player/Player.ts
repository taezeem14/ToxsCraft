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
  public isSneaking = false;
  public isSwimming = false;

  // Survival stats (out of 20)
  public health = 20.0;
  public maxHealth = 20.0;
  public hunger = 20.0;
  public maxHunger = 20.0;
  public stamina = 20.0;
  public maxStamina = 20.0;
  public isDead = false;

  // Level progression stats
  public level = 1;
  public xp = 0;

  // Inventory
  public inventory = new Inventory();

  private regenTimer = 0;

  private hungerTimer = 0;

  constructor() {
    // Listen for custom teleport/reset events if needed
    eventBus.on('respawn', () => this.respawn());
  }

  public respawn(): void {
    this.health = 20.0;
    this.hunger = 20.0;
    this.stamina = 20.0;
    this.isDead = false;
    this.velocity.set(0, 0, 0);
    eventBus.emit('player_status_change');
  }

  /**
   * Resets player position and stats to default spawn.
   * Scans a small spiral area around (0,0) to find a solid surface with
   * 2 clear blocks above it. Falls back to Y=80 if no ground is found.
   */
  public initSpawn(chunkManager: any): void {
    // Find ground level by scanning a small area around (0,0)
    let spawnY = 80; // Safe fallback
    let found = false;

    // Try center first, then spiral out
    const checkPositions = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]];

    for (const [cx, cz] of checkPositions) {
      for (let y = 120; y > 2; y--) {
        const blockId = chunkManager.getBlock(cx, y, cz);
        if (blockId !== 0 && blockId !== 9) { // solid non-water block
          const above1 = chunkManager.getBlock(cx, y + 1, cz);
          const above2 = chunkManager.getBlock(cx, y + 2, cz);
          if (above1 === 0 && above2 === 0) { // 2 clear blocks above
            spawnY = y + 1.5;
            found = true;
            break;
          }
        } else if (blockId === 9) { // Water
          spawnY = 64.5; // spawn floating on water surface
          found = true;
          break;
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
   * Processes player stats (regeneration, hunger drain) per frame tick
   */
  public update(deltaSec: number): void {
    if (this.isDead) return;

    // Handle Health Regeneration (if full or nearly full hunger)
    if (this.hunger >= 18.0 && this.health < this.maxHealth) {
      this.regenTimer += deltaSec;
      if (this.regenTimer >= 4.0) { // Regens 1 HP every 4 seconds
        this.heal(1.0);
        this.regenTimer = 0;
      }
    } else {
      this.regenTimer = 0;
    }

    // Passive hunger drain over time
    this.hungerTimer += deltaSec;
    const drainRate = this.velocity.length() > 5.0 ? 0.05 : 0.01; // faster drain when running
    if (this.hungerTimer >= 3.0) {
      this.drainHunger(drainRate);
      this.hungerTimer = 0;
    }
  }

  public takeDamage(amount: number): void {
    if (this.isDead || this.isFlying) return; // Godmode in flying creative

    this.health = Math.max(0, this.health - amount);
    eventBus.emit('player_hurt', amount);
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

  private drainHunger(amount: number): void {
    this.hunger = Math.max(0, this.hunger - amount);
    eventBus.emit('player_status_change');

    // Starvation damage
    if (this.hunger <= 0 && this.health > 1.0) {
      this.takeDamage(0.5); // starves down to half-heart on normal difficulty
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

  public getXpNeeded(): number {
    return this.level * 100;
  }
}

