import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { Player } from '../player/Player';
import { AssetLoader } from '../core/AssetLoader';

export class ArrowEntity {
  public id: string;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public mesh: THREE.Group;
  public isDead = false;
  
  private scene: THREE.Scene;
  private lifetime = 0;
  private maxLifetime = 15.0; // despawn after 15 seconds
  private hasHitBlock = false;

  constructor(id: string, spawnPos: THREE.Vector3, velocity: THREE.Vector3, scene: THREE.Scene) {
    this.id = id;
    this.position = spawnPos.clone();
    this.velocity = velocity.clone();
    this.scene = scene;

    this.mesh = this.buildMesh();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    // Play shoot sound on spawn
    AssetLoader.playSound('shoot');
  }

  private buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // Arrow Shaft (Brown)
    const shaftGeom = new THREE.BoxGeometry(0.04, 0.04, 0.6);
    const shaftMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const shaft = new THREE.Mesh(shaftGeom, shaftMat);
    group.add(shaft);

    // Arrow Tip (Grey)
    const tipGeom = new THREE.BoxGeometry(0.08, 0.08, 0.12);
    const tipMat = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.position.z = 0.36; // Place at tip end
    group.add(tip);

    // Fletching / Feathers (White)
    const fletchGeom = new THREE.BoxGeometry(0.12, 0.12, 0.08);
    const fletchMat = new THREE.MeshLambertMaterial({ color: 0xecf0f1 });
    const fletch = new THREE.Mesh(fletchGeom, fletchMat);
    fletch.position.z = -0.3; // Place at tail end
    group.add(fletch);

    return group;
  }

  public update(deltaSec: number, player: Player, chunkManager: ChunkManager): void {
    this.lifetime += deltaSec;
    if (this.lifetime >= this.maxLifetime) {
      this.destroy();
      return;
    }

    if (this.hasHitBlock) {
      // If arrow is stuck, just wait to despawn
      return;
    }

    // Apply gravity
    this.velocity.y += -12.0 * deltaSec;

    // Kinematics: Update position
    const nextPos = this.position.clone().add(this.velocity.clone().multiplyScalar(deltaSec));
    
    // Check collision along path with chunks
    const stepCount = 3;
    let hitSomething = false;

    for (let i = 1; i <= stepCount; i++) {
      const t = i / stepCount;
      const testPos = this.position.clone().lerp(nextPos, t);
      
      // Voxel collision
      const bx = Math.floor(testPos.x);
      const by = Math.floor(testPos.y);
      const bz = Math.floor(testPos.z);
      const blockId = chunkManager.getBlock(bx, by, bz);

      if (blockId !== 0 && blockId !== 9) { // Solid obstacle (ignore air, water)
        this.position.copy(testPos);
        this.velocity.set(0, 0, 0);
        this.hasHitBlock = true;
        hitSomething = true;
        AssetLoader.playSound('hit');
        break;
      }

      // Player hit detection (Bounding Box check)
      const pMin = player.position.clone().sub(new THREE.Vector3(player.radius, 0, player.radius));
      const pMax = player.position.clone().add(new THREE.Vector3(player.radius, player.height, player.radius));
      const playerBox = new THREE.Box3(pMin, pMax);

      if (playerBox.containsPoint(testPos) && !player.isDead && !player.isFlying) {
        player.takeDamage(3.0); // deal arrow damage
        this.destroy();
        hitSomething = true;
        AssetLoader.playSound('hit');
        break;
      }
    }

    if (!hitSomething) {
      this.position.copy(nextPos);
    }

    // Sync mesh position and orientation
    this.mesh.position.copy(this.position);
    
    if (this.velocity.lengthSq() > 0.01) {
      const dir = this.velocity.clone().normalize();
      const target = this.position.clone().add(dir);
      this.mesh.lookAt(target);
    }
  }

  public destroy(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.scene.remove(this.mesh);
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
