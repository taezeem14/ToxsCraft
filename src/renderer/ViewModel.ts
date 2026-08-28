/**
 * Tox'sCraft ViewModel
 * 1st-person 3D viewmodel (arm, hand, held 3D block/tool) attached to camera.
 * Features realistic Minecraft swing arcs, block placement punch, and walking bobbing.
 */

import * as THREE from 'three';
import { ItemStack } from '../inventory/ItemStack';
import { BLOCKS } from '../world/BlockRegistry';
import { TextureAtlas } from './TextureAtlas';
import { AssetLoader } from '../core/AssetLoader';

export class ViewModel {
  public group: THREE.Group;
  private armMesh: THREE.Mesh;
  private heldItemContainer: THREE.Group;
  private currentHeldId: string | null = null;
  private currentSkin: string = 'steve';

  // Animation states
  private swingProgress = 0; // 0 to 1
  private isSwinging = false;
  private swingSpeed = 5.0; // full swing in ~200ms

  private eatProgress = 0;
  private isEating = false;

  private isChargingBow = false;

  private placeProgress = 0;
  private isPlacing = false;

  // Viewmodel resting transforms
  private basePosition = new THREE.Vector3(0.35, -0.32, -0.55);
  private baseRotation = new THREE.Euler(0.1, -0.25, 0.05);

  private textureAtlas: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.heldItemContainer = new THREE.Group();
    this.textureAtlas = AssetLoader.getTextureAtlas();

    // 1. Create 1st person right arm
    const armGeom = new THREE.BoxGeometry(0.14, 0.5, 0.14);
    armGeom.translate(0, -0.2, 0); // Pivot at top
    
    // Skin material for arm
    const armMat = this.createArmMaterial('steve');
    this.armMesh = new THREE.Mesh(armGeom, armMat);
    this.armMesh.position.set(0, 0, 0);
    this.armMesh.rotation.set(Math.PI / 4, -Math.PI / 8, 0.2);

    this.group.add(this.armMesh);
    this.group.add(this.heldItemContainer);
    this.heldItemContainer.position.set(0.02, -0.15, -0.15);

    this.group.position.copy(this.basePosition);
    this.group.rotation.copy(this.baseRotation);

    scene.add(this.group);
  }

  private createArmMaterial(skinName: string): THREE.Material {
    let sleeveColor = '#00a0a0'; // Steve cyan
    let handColor = '#e0a980'; // Skin

    if (skinName === 'alex') {
      sleeveColor = '#508030';
      handColor = '#f5c09e';
    } else if (skinName === 'herobrine') {
      sleeveColor = '#00a0a0';
      handColor = '#e0a980';
    } else if (skinName === 'muhammad') {
      sleeveColor = '#6c3483';
      handColor = '#e0a980';
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Sleeve
    ctx.fillStyle = sleeveColor;
    ctx.fillRect(0, 0, 64, 40);
    // Hand
    ctx.fillStyle = handColor;
    ctx.fillRect(0, 40, 64, 24);

    if (skinName === 'muhammad') {
      ctx.fillStyle = '#f1c40f'; // Gold cuff
      ctx.fillRect(0, 36, 64, 6);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    return new THREE.MeshLambertMaterial({ map: texture });
  }

  public setSkin(skinName: string): void {
    if (this.currentSkin !== skinName) {
      this.currentSkin = skinName;
      if (this.armMesh.material) {
        if (Array.isArray(this.armMesh.material)) {
          this.armMesh.material.forEach(m => m.dispose());
        } else {
          (this.armMesh.material as THREE.Material).dispose();
        }
      }
      this.armMesh.material = this.createArmMaterial(skinName);
    }
  }

  /**
   * Updates held item model when player changes hotbar slot
   */
  public setHeldItem(stack: ItemStack | null): void {
    const id = stack ? stack.id : null;
    if (this.currentHeldId === id) return;
    this.currentHeldId = id;

    // Clear old held mesh and recursively dispose geometries & materials
    while (this.heldItemContainer.children.length > 0) {
      const child = this.heldItemContainer.children[0];
      child.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
      this.heldItemContainer.remove(child);
    }

    if (!stack) {
      // Empty hand: show prominent arm
      this.armMesh.visible = true;
      this.armMesh.position.set(0, 0, 0);
      this.armMesh.rotation.set(Math.PI / 4, -Math.PI / 8, 0.2);
      return;
    }

    const itemId = stack.id;

    // Check if it's a placeable block
    const blockEntry = Object.values(BLOCKS).find(b => b.lootItem === itemId || b.name.toLowerCase().replace(/ /g, '_') === itemId);
    
    if (blockEntry && blockEntry.id > 0 && !itemId.includes('_pickaxe') && !itemId.includes('_sword') && !itemId.includes('_axe') && !itemId.includes('_shovel')) {
      // 3D Miniature Block Model
      this.armMesh.visible = true;
      this.armMesh.position.set(0.12, -0.05, 0.05);

      const blockGeom = new THREE.BoxGeometry(0.24, 0.24, 0.24);
      
      // Compute UVs for the block
      const texIndices = blockEntry.textures;
      const uvsTop = TextureAtlas.getUVs(texIndices.top);
      const uvsBottom = TextureAtlas.getUVs(texIndices.bottom);
      const uvsSide = TextureAtlas.getUVs(texIndices.side);
      const uvsFront = TextureAtlas.getUVs(texIndices.front || texIndices.side);

      // Construct UV mapping for 6 faces: +X, -X, +Y, -Y, +Z, -Z
      const uvAttr = blockGeom.attributes.uv;
      const setFaceUVs = (faceIdx: number, uvs: [number, number, number, number]) => {
        const [u0, v0, u1, v1] = uvs;
        uvAttr.setXY(faceIdx * 4 + 0, u0, v1);
        uvAttr.setXY(faceIdx * 4 + 1, u1, v1);
        uvAttr.setXY(faceIdx * 4 + 2, u0, v0);
        uvAttr.setXY(faceIdx * 4 + 3, u1, v0);
      };

      setFaceUVs(0, uvsSide); // right (+X)
      setFaceUVs(1, uvsSide); // left (-X)
      setFaceUVs(2, uvsTop);  // top (+Y)
      setFaceUVs(3, uvsBottom); // bottom (-Y)
      setFaceUVs(4, uvsFront); // front (+Z)
      setFaceUVs(5, uvsSide); // back (-Z)
      uvAttr.needsUpdate = true;

      const blockMat = new THREE.MeshLambertMaterial({
        map: this.textureAtlas,
        transparent: blockEntry.transparent,
        alphaTest: 0.1
      });

      const blockMesh = new THREE.Mesh(blockGeom, blockMat);
      blockMesh.position.set(-0.02, 0.02, -0.1);
      blockMesh.rotation.set(0.3, -0.6, 0.15);
      this.heldItemContainer.add(blockMesh);
    } else {
      // 3D Tool / Sword / Item flat sprite/extrusion
      this.armMesh.visible = true;
      this.armMesh.position.set(0.1, -0.05, 0.05);

      const toolGeom = new THREE.BoxGeometry(0.04, 0.35, 0.04);
      let toolColor = 0x85633e; // Wood default

      if (itemId.includes('stone_')) toolColor = 0x888888;
      else if (itemId.includes('iron_')) toolColor = 0xdddddd;
      else if (itemId.includes('gold_')) toolColor = 0xf1c40f;
      else if (itemId.includes('diamond_')) toolColor = 0x33ffff;
      else if (itemId === 'bow') toolColor = 0x8e5831;
      else if (itemId === 'apple') toolColor = 0xe74c3c;
      else if (itemId === 'bread') toolColor = 0xd4a359;

      const handleMat = new THREE.MeshLambertMaterial({ color: toolColor });
      const toolMesh = new THREE.Mesh(toolGeom, handleMat);

      // If sword or pickaxe, add cross head
      if (itemId.includes('sword')) {
        const bladeGeom = new THREE.BoxGeometry(0.06, 0.45, 0.02);
        const bladeMesh = new THREE.Mesh(bladeGeom, handleMat);
        bladeMesh.position.set(0, 0.25, 0);
        toolMesh.add(bladeMesh);

        const guardGeom = new THREE.BoxGeometry(0.18, 0.03, 0.04);
        const guardMesh = new THREE.Mesh(guardGeom, new THREE.MeshLambertMaterial({ color: 0x444444 }));
        guardMesh.position.set(0, 0.05, 0);
        toolMesh.add(guardMesh);
      } else if (itemId.includes('pickaxe')) {
        const headGeom = new THREE.BoxGeometry(0.32, 0.05, 0.05);
        const headMesh = new THREE.Mesh(headGeom, handleMat);
        headMesh.position.set(0, 0.2, 0);
        toolMesh.add(headMesh);
      } else if (itemId.includes('axe')) {
        const headGeom = new THREE.BoxGeometry(0.18, 0.15, 0.05);
        const headMesh = new THREE.Mesh(headGeom, handleMat);
        headMesh.position.set(0.06, 0.16, 0);
        toolMesh.add(headMesh);
      }

      toolMesh.position.set(-0.02, 0.04, -0.15);
      toolMesh.rotation.set(-0.6, 0.2, -0.8);
      this.heldItemContainer.add(toolMesh);
    }
  }

  /**
   * Trigger primary attack/mining swing
   */
  public triggerSwing(): void {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  /**
   * Trigger block place punch
   */
  public triggerPlace(): void {
    this.isPlacing = true;
    this.placeProgress = 0;
  }

  public setEating(eating: boolean): void {
    this.isEating = eating;
  }

  public setChargingBow(charging: boolean): void {
    this.isChargingBow = charging;
  }

  /**
   * Tick viewmodel animations & attach to camera position
   */
  public update(
    deltaSec: number,
    camera: THREE.PerspectiveCamera,
    velocity: THREE.Vector3,
    onGround: boolean,
    cameraMode: 'first' | 'third_back' | 'third_front',
    time: number
  ): void {
    if (cameraMode !== 'first') {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // 1. Base position relative to camera
    const camPos = camera.position;
    this.group.position.copy(camPos);
    this.group.rotation.copy(camera.rotation);

    // 2. Walking Bobbing
    const horizSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    let bobX = 0;
    let bobY = 0;

    if (onGround && horizSpeed > 0.1) {
      const bobFreq = horizSpeed > 6.0 ? 14.0 : 9.0;
      bobX = Math.sin(time * 0.001 * bobFreq) * 0.015;
      bobY = Math.abs(Math.cos(time * 0.001 * bobFreq)) * 0.02;
    }

    // 3. Swing Animation Calculation
    let swingRotX = 0;
    let swingRotY = 0;
    let swingRotZ = 0;
    let swingPosZ = 0;

    if (this.isSwinging) {
      this.swingProgress += deltaSec * this.swingSpeed;
      if (this.swingProgress >= 1.0) {
        this.swingProgress = 0;
        this.isSwinging = false;
      } else {
        const sinProgress = Math.sin(this.swingProgress * Math.PI);
        swingRotX = -sinProgress * 0.8;
        swingRotY = sinProgress * 0.4;
        swingRotZ = -sinProgress * 0.6;
        swingPosZ = -sinProgress * 0.15;
      }
    }

    // 4. Place Punch Animation
    if (this.isPlacing) {
      this.placeProgress += deltaSec * 8.0;
      if (this.placeProgress >= 1.0) {
        this.placeProgress = 0;
        this.isPlacing = false;
      } else {
        const sinP = Math.sin(this.placeProgress * Math.PI);
        swingPosZ -= sinP * 0.08;
        swingRotX -= sinP * 0.2;
      }
    }

    // 5. Eating Wiggle Animation
    let eatY = 0;
    let eatRotZ = 0;
    if (this.isEating) {
      this.eatProgress += deltaSec * 15.0;
      eatY = Math.sin(this.eatProgress) * 0.03;
      eatRotZ = Math.cos(this.eatProgress) * 0.1;
    }

    // 6. Bow Aiming Pull Animation
    let bowPullX = 0;
    let bowPullY = 0;
    let bowPullZ = 0;
    if (this.isChargingBow) {
      bowPullX = -0.12;
      bowPullY = 0.06;
      bowPullZ = 0.08;
    }

    // Transform local offset vector into camera world space
    const offset = new THREE.Vector3(
      this.basePosition.x + bobX + bowPullX,
      this.basePosition.y - bobY + eatY + bowPullY,
      this.basePosition.z + swingPosZ + bowPullZ
    );

    offset.applyEuler(camera.rotation);
    this.group.position.add(offset);

    // Apply combined rotations
    this.group.rotation.x += this.baseRotation.x + swingRotX;
    this.group.rotation.y += this.baseRotation.y + swingRotY;
    this.group.rotation.z += this.baseRotation.z + swingRotZ + eatRotZ;
  }

  public clear(): void {
    if (this.group) {
      this.group.clear();
    }
  }
}
