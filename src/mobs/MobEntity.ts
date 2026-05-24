/**
 * Tox'sCraft MobEntity
 * Represents a passive or hostile entity in the voxel world with health, positions, and AI state.
 */

import * as THREE from 'three';
import { Physics, PhysicsEntity } from '../physics/Physics';
import { ChunkManager } from '../world/ChunkManager';
import { Player } from '../player/Player';

export type MobType = 'cow' | 'pig' | 'zombie' | 'creeper';
export type MobState = 'idle' | 'wander' | 'chase' | 'flee';

export class MobEntity implements PhysicsEntity {
  public id: string;
  public type: MobType;
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public radius = 0.35;
  public height = 1.3;
  public onGround = false;
  
  public health = 10.0;
  public maxHealth = 10.0;
  public state: MobState = 'wander';
  public isHostile = false;

  private stateTimer = 0;
  private wanderDirection = new THREE.Vector3();
  private mesh: THREE.Group;

  constructor(id: string, type: MobType, spawnPos: THREE.Vector3, scene: THREE.Scene) {
    this.id = id;
    this.type = type;
    this.position.copy(spawnPos);
    this.isHostile = (type === 'zombie' || type === 'creeper');
    this.mesh = this.buildMesh();
    scene.add(this.mesh);
  }

  private buildMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Choose colors based on type
    let bodyColor = 0x8b5a2b; // cow brown
    if (this.type === 'zombie') bodyColor = 0x2ecc71; // zombie green
    else if (this.type === 'creeper') bodyColor = 0x27ae60; // dark green
    else if (this.type === 'pig') bodyColor = 0xffa0af; // pig pink

    // Simple composite box mesh
    const bodyGeom = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.55;
    group.add(body);

    const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.0;
    head.position.z = 0.25;
    group.add(head);

    group.position.copy(this.position);
    return group;
  }

  public update(deltaSec: number, player: Player, chunkManager: ChunkManager): void {
    this.stateTimer += deltaSec;

    // AI state updates
    const distToPlayer = this.position.distanceTo(player.position);
    
    if (this.isHostile && distToPlayer < 12.0 && !player.isDead && !player.isFlying) {
      this.state = 'chase';
    } else {
      if (this.state === 'chase' || this.stateTimer > 4.0) {
        this.state = 'wander';
        this.stateTimer = 0;
        // Choose random angle
        const angle = Math.random() * Math.PI * 2;
        this.wanderDirection.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
      }
    }

    // Steering velocity calculations
    const speed = this.state === 'chase' ? 2.5 : 1.0;

    if (this.state === 'chase') {
      const dir = new THREE.Vector3().subVectors(player.position, this.position);
      dir.y = 0; // lock horizontal steering
      dir.normalize();
      this.velocity.x = dir.x * speed;
      this.velocity.z = dir.z * speed;

      // Zombie attack player
      if (distToPlayer < 1.3) {
        player.takeDamage(1.5 * deltaSec); // deal continuous contact damage
      }
    } else {
      // Wander around
      this.velocity.x = this.wanderDirection.x * speed;
      this.velocity.z = this.wanderDirection.z * speed;
    }

    // Apply gravity
    this.velocity.y += -22.0 * deltaSec;

    // Jump if block is directly in front (climb walls)
    if (this.onGround && this.velocity.lengthSq() > 0.1) {
      const lookAhead = this.velocity.clone().normalize().multiplyScalar(0.65);
      const checkX = Math.floor(this.position.x + lookAhead.x);
      const checkY = Math.floor(this.position.y);
      const checkZ = Math.floor(this.position.z + lookAhead.z);
      
      const obstacleBlock = chunkManager.getBlock(checkX, checkY, checkZ);
      const headBlock = chunkManager.getBlock(checkX, checkY + 1, checkZ);
      if (obstacleBlock !== 0 && obstacleBlock !== 9 && headBlock === 0) {
        this.velocity.y = 6.0; // jump up
        this.onGround = false;
      }
    }

    // AABB collisions updates
    Physics.moveEntity(this, deltaSec, chunkManager);

    // Sync mesh position
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
  }

  public destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    // Dispose geometry
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof Array) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
