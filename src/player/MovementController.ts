/**
 * Tox'sCraft MovementController
 * Translates InputManager states into player velocity and camera orientation.
 * Handles gravity, swimming, flying, running, and crouching.
 */

import * as THREE from 'three';
import { Player } from './Player';
import { InputManager } from '../core/InputManager';
import { Physics } from '../physics/Physics';
import { ChunkManager } from '../world/ChunkManager';
import { 
  GRAVITY, 
  TERMINAL_VELOCITY, 
  BUOYANCY,
  WALK_SPEED, 
  SPRINT_SPEED, 
  SNEAK_SPEED, 
  FLY_SPEED, 
  JUMP_FORCE 
} from '../constants';
import { eventBus } from '../EventBus';
import { AssetLoader } from '../core/AssetLoader';

export class MovementController {
  private player: Player;
  private input: InputManager;
  private chunkManager: ChunkManager;

  // Double-tap Space tracking for flying toggle
  private lastSpaceTime = 0;
  private spaceTapCooldown = 280; // ms

  constructor(player: Player, input: InputManager, chunkManager: ChunkManager) {
    this.player = player;
    this.input = input;
    this.chunkManager = chunkManager;

    // Listen for jumps to track double-taps
    eventBus.on('keydown', (code: string) => {
      if (code === 'Space') {
        this.handleSpaceTap();
      }
    });
  }

  private handleSpaceTap(): void {
    const now = performance.now();
    if (now - this.lastSpaceTime < this.spaceTapCooldown) {
      // Double tapped! Toggle flying (Creative mode check bypassed for simplicity)
      this.player.isFlying = !this.player.isFlying;
      this.player.velocity.y = 0;
      eventBus.emit('status_message', this.player.isFlying ? 'Flight Enabled' : 'Flight Disabled');
    }
    this.lastSpaceTime = now;
  }

  /**
   * Translates keyboard inputs and mouse yaw/pitch rotations, updates velocity,
   * runs collision checks, and slides the player.
   */
  public update(deltaSec: number): void {
    if (this.player.isDead) return;

    // 1. Process Mouse Look
    const mouse = this.input.getAndResetMouseDeltas();
    const sensitivity = 0.0015; // sensitivity scale
    
    this.player.yaw -= mouse.x * sensitivity;
    this.player.pitch -= mouse.y * sensitivity;
    
    // Clamp vertical look pitch to prevent flipping upside down (-89 to +89 degrees)
    const limit = Math.PI / 2 - 0.02;
    this.player.pitch = Math.max(-limit, Math.min(limit, this.player.pitch));

    // 2. Check environment (swimming, etc.)
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y + 0.1);
    const pEyeY = Math.floor(this.player.position.y + this.player.eyeHeight);
    const pz = Math.floor(this.player.position.z);

    const footBlock = this.chunkManager.getBlock(px, py, pz);
    const eyeBlock = this.chunkManager.getBlock(px, pEyeY, pz);
    
    this.player.isSwimming = (footBlock === 9 || eyeBlock === 9); // Water block ID is 9

    // 3. Movement speed calculations
    let speed = WALK_SPEED;
    this.player.isSneaking = this.input.isKeyDown('ShiftLeft') && this.player.onGround && !this.player.isFlying;
    
    const isSprinting = this.input.isKeyDown('ControlLeft') || this.input.isKeyDown('KeyR');

    if (this.player.isSneaking) {
      speed = SNEAK_SPEED;
    } else if (isSprinting && this.player.hunger > 6.0) {
      speed = SPRINT_SPEED;
    }

    // 4. Calculate move direction vectors based on yaw look angle
    const forwardVec = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).normalize();
    const rightVec = new THREE.Vector3().crossVectors(forwardVec, new THREE.Vector3(0, 1, 0)).normalize();

    let moveX = 0;
    let moveZ = 0;

    if (this.input.isKeyDown('KeyW')) { moveX += forwardVec.x; moveZ += forwardVec.z; }
    if (this.input.isKeyDown('KeyS')) { moveX -= forwardVec.x; moveZ -= forwardVec.z; }
    if (this.input.isKeyDown('KeyD')) { moveX += rightVec.x; moveZ += rightVec.z; }
    if (this.input.isKeyDown('KeyA')) { moveX -= rightVec.x; moveZ -= rightVec.z; }

    const inputDirection = new THREE.Vector3(moveX, 0, moveZ);
    if (inputDirection.lengthSq() > 0) {
      inputDirection.normalize();
    }

    // 5. Vertical movements & Physics types (Flying / Swimming / Grounded)
    if (this.player.isFlying) {
      // 3D Flying movement
      this.player.velocity.x = inputDirection.x * FLY_SPEED;
      this.player.velocity.z = inputDirection.z * FLY_SPEED;

      let flyY = 0;
      if (this.input.isKeyDown('Space')) flyY += FLY_SPEED;
      if (this.input.isKeyDown('ShiftLeft')) flyY -= FLY_SPEED;
      this.player.velocity.y = flyY;
    } else if (this.player.isSwimming) {
      // Submerged swimming buoyancy & drag
      const swimFriction = 0.85;
      this.player.velocity.x = inputDirection.x * speed * swimFriction;
      this.player.velocity.z = inputDirection.z * speed * swimFriction;

      // Gravity is reduced in water
      this.player.velocity.y += (GRAVITY * 0.15) * deltaSec;

      if (this.input.isKeyDown('Space')) {
        this.player.velocity.y = Math.min(3.0, this.player.velocity.y + BUOYANCY * deltaSec * 3);
      }
      
      // Drag clamp
      this.player.velocity.y = Math.max(-4.0, Math.min(4.0, this.player.velocity.y));
    } else {
      // Standard Walking/Running/Jumping
      // Horizontal speeds slide
      const accel = this.player.onGround ? 15.0 : 4.0; // low control in air

      // Apply friction drag to velocity
      const targetVelX = inputDirection.x * speed;
      const targetVelZ = inputDirection.z * speed;

      this.player.velocity.x += (targetVelX - this.player.velocity.x) * accel * deltaSec;
      this.player.velocity.z += (targetVelZ - this.player.velocity.z) * accel * deltaSec;

      // Apply Gravity
      this.player.velocity.y += GRAVITY * deltaSec;
      if (this.player.velocity.y < TERMINAL_VELOCITY) {
        this.player.velocity.y = TERMINAL_VELOCITY;
      }

      // Jump request
      if (this.input.isKeyDown('Space') && this.player.onGround) {
        this.player.velocity.y = JUMP_FORCE;
        this.player.onGround = false;
        AssetLoader.playSound('jump');
      }
    }

    // 6. Sweep-and-slide collision resolution
    Physics.moveEntity(this.player, deltaSec, this.chunkManager);
  }
}
