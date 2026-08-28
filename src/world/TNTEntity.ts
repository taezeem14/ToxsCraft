/**
 * Tox'sCraft TNTEntity
 * Interactive primed TNT block physics entity that flashes white, swells,
 * hisses, and detonates in a spherical crater with particle shockwaves and knockback.
 */

import * as THREE from 'three';
import { ChunkManager } from './ChunkManager';
import { ParticleSystem } from '../renderer/ParticleSystem';
import { AssetLoader } from '../core/AssetLoader';
import { Player } from '../player/Player';
import { MobManager } from '../mobs/MobManager';
import { TextureAtlas } from '../renderer/TextureAtlas';

export class TNTEntity {
  public id: string;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public fuseTimer = 3.0; // 3 second fuse
  public isDead = false;

  private mesh: THREE.Mesh;
  private flashMat: THREE.MeshBasicMaterial;
  private standardMat: THREE.MeshLambertMaterial;
  private flashTimer = 0;

  constructor(id: string, startPos: THREE.Vector3, scene: THREE.Scene) {
    this.id = id;
    this.position = startPos.clone();
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2.0,
      4.0, // Initial pop upwards
      (Math.random() - 0.5) * 2.0
    );

    // Build 1x1x1 TNT Mesh with TextureAtlas
    const geom = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const uvsTop = TextureAtlas.getUVs(66);
    const uvsBottom = TextureAtlas.getUVs(67);
    const uvsSide = TextureAtlas.getUVs(68);

    const uvAttr = geom.attributes.uv;
    const setFaceUVs = (faceIdx: number, uvs: [number, number, number, number]) => {
      const [u0, v0, u1, v1] = uvs;
      uvAttr.setXY(faceIdx * 4 + 0, u0, v1);
      uvAttr.setXY(faceIdx * 4 + 1, u1, v1);
      uvAttr.setXY(faceIdx * 4 + 2, u0, v0);
      uvAttr.setXY(faceIdx * 4 + 3, u1, v0);
    };

    setFaceUVs(0, uvsSide);
    setFaceUVs(1, uvsSide);
    setFaceUVs(2, uvsTop);
    setFaceUVs(3, uvsBottom);
    setFaceUVs(4, uvsSide);
    setFaceUVs(5, uvsSide);
    uvAttr.needsUpdate = true;

    this.standardMat = new THREE.MeshLambertMaterial({
      map: AssetLoader.getTextureAtlas()
    });
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.mesh = new THREE.Mesh(geom, this.standardMat);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    AssetLoader.playSound('hiss');
  }

  public update(
    deltaSec: number,
    chunkManager: ChunkManager,
    particleSystem: ParticleSystem,
    player: Player,
    mobManager: MobManager,
    scene: THREE.Scene,
    onExplodeCallback?: (pos: THREE.Vector3) => void
  ): void {
    if (this.isDead) return;

    // 1. Gravity and kinematics
    this.velocity.y -= 18.0 * deltaSec;
    this.position.x += this.velocity.x * deltaSec;
    this.position.y += this.velocity.y * deltaSec;
    this.position.z += this.velocity.z * deltaSec;

    // Simple block ground collision
    const bx = Math.floor(this.position.x);
    const by = Math.floor(this.position.y);
    const bz = Math.floor(this.position.z);

    const blockBelow = chunkManager.getBlock(bx, by, bz);
    if (blockBelow !== 0 && blockBelow !== 9 && blockBelow !== 10) {
      this.position.y = by + 1.0;
      this.velocity.y = 0;
      this.velocity.x *= 0.7;
      this.velocity.z *= 0.7;
    }

    // 2. Fuse timing and swelling/flashing
    this.fuseTimer -= deltaSec;
    this.flashTimer += deltaSec * (4.0 + (3.0 - this.fuseTimer) * 4.0); // Flashes faster near detonation

    const swell = 1.0 + (3.0 - this.fuseTimer) * 0.12;
    this.mesh.scale.set(swell, swell, swell);

    if (Math.sin(this.flashTimer * 10) > 0) {
      this.mesh.material = this.flashMat;
    } else {
      this.mesh.material = this.standardMat;
    }

    this.mesh.position.copy(this.position);

    // 3. Detonation
    if (this.fuseTimer <= 0) {
      this.detonate(chunkManager, particleSystem, player, mobManager, scene, onExplodeCallback);
    }
  }

  private detonate(
    chunkManager: ChunkManager,
    particleSystem: ParticleSystem,
    player: Player,
    mobManager: MobManager,
    scene: THREE.Scene,
    onExplodeCallback?: (pos: THREE.Vector3) => void
  ): void {
    this.isDead = true;
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (this.flashMat) this.flashMat.dispose();
    if (this.standardMat) this.standardMat.dispose();

    const blastRadius = 4;
    const center = this.position.clone();

    // 1. Sound and VFX
    AssetLoader.playSound('explode');
    particleSystem.spawnExplosion(center, 70);

    // 2. Destroy surrounding blocks in a spherical radius
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);

    for (let x = -blastRadius; x <= blastRadius; x++) {
      for (let y = -blastRadius; y <= blastRadius; y++) {
        for (let z = -blastRadius; z <= blastRadius; z++) {
          const distSq = x * x + y * y + z * z;
          if (distSq <= blastRadius * blastRadius) {
            const bx = cx + x;
            const by = cy + y;
            const bz = cz + z;

            const block = chunkManager.getBlock(bx, by, bz);
            // Don't break bedrock (11) or obsidian (26)
            if (block !== 0 && block !== 11 && block !== 26) {
              chunkManager.setBlock(bx, by, bz, 0);
            }
          }
        }
      }
    }

    // 3. Damage and knockback player
    const distToPlayer = center.distanceTo(player.position);
    if (distToPlayer < 8.0) {
      const damage = Math.max(2, Math.floor((1.0 - distToPlayer / 8.0) * 16));
      player.takeDamage(damage);

      // Knockback vector
      const knockDir = player.position.clone().sub(center).normalize();
      knockDir.y += 0.5;
      player.velocity.add(knockDir.multiplyScalar(12.0 * (1.0 - distToPlayer / 8.0)));
    }

    // 4. Damage and knockback surrounding mobs
    if (mobManager && (mobManager as any).mobs) {
      const activeMobs = (mobManager as any).mobs;
      for (const mob of activeMobs) {
        const d = center.distanceTo(mob.position);
        if (d < 8.0) {
          const mobDmg = Math.max(4, Math.floor((1.0 - d / 8.0) * 24));
          mob.takeDamage(mobDmg, mobManager, scene, center, player, particleSystem);
        }
      }
    }

    if (onExplodeCallback) {
      onExplodeCallback(center);
    }
  }

  public destroy(scene: THREE.Scene): void {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    if (this.flashMat) this.flashMat.dispose();
    if (this.standardMat) this.standardMat.dispose();
  }
}
