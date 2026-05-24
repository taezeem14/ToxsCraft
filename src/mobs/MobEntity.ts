/**
 * Tox'sCraft MobEntity
 * Represents a passive or hostile entity in the voxel world with health, positions, and AI state.
 */

import * as THREE from 'three';
import { Physics, PhysicsEntity } from '../physics/Physics';
import { ChunkManager } from '../world/ChunkManager';
import { Player } from '../player/Player';
import { AssetLoader } from '../core/AssetLoader';

export type MobType = 'cow' | 'pig' | 'zombie' | 'creeper' | 'skeleton' | 'spider' | 'slime' | 'chicken';
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

  // Slime specific properties
  public size = 1;
  private slimeJumpTimer = 0;

  // Creeper specific properties
  private creeperExploding = false;
  private creeperFuseTimer = 0;

  // Skeleton specific properties
  private skeletonShootCooldown = 0;

  private stateTimer = 0;
  private wanderDirection = new THREE.Vector3();
  private mesh: THREE.Group;

  // Animation references
  private leftLegMesh?: THREE.Mesh;
  private rightLegMesh?: THREE.Mesh;
  private leftArmMesh?: THREE.Mesh;
  private rightArmMesh?: THREE.Mesh;
  private legs: THREE.Mesh[] = [];
  private wings: THREE.Mesh[] = [];

  // Static Caches for Textures and Materials to save memory and drawcalls
  private static textureCache: Map<string, THREE.CanvasTexture> = new Map();
  private static materialCache: Map<string, THREE.Material | THREE.Material[]> = new Map();

  constructor(id: string, type: MobType, spawnPos: THREE.Vector3, scene: THREE.Scene, slimeSize?: number) {
    this.id = id;
    this.type = type;
    this.position.copy(spawnPos);

    // Hostile designations
    this.isHostile = (type === 'zombie' || type === 'creeper' || type === 'skeleton' || type === 'spider' || type === 'slime');

    // Customize physical attributes based on type
    if (this.type === 'chicken') {
      this.radius = 0.22;
      this.height = 0.7;
      this.health = 4.0;
      this.maxHealth = 4.0;
    } else if (this.type === 'spider') {
      this.radius = 0.55;
      this.height = 0.65;
      this.health = 16.0;
      this.maxHealth = 16.0;
    } else if (this.type === 'slime') {
      this.size = slimeSize !== undefined ? slimeSize : (Math.random() < 0.2 ? 3 : (Math.random() < 0.5 ? 2 : 1));
      this.radius = 0.2 * this.size;
      this.height = 0.4 * this.size;
      this.health = this.size * this.size * 4.0;
      this.maxHealth = this.health;
    } else if (this.type === 'skeleton') {
      this.radius = 0.3;
      this.height = 1.95;
      this.health = 20.0;
      this.maxHealth = 20.0;
    } else if (this.type === 'zombie') {
      this.radius = 0.35;
      this.height = 1.95;
      this.health = 20.0;
      this.maxHealth = 20.0;
    } else if (this.type === 'creeper') {
      this.radius = 0.35;
      this.height = 1.7;
      this.health = 20.0;
      this.maxHealth = 20.0;
    } else if (this.type === 'cow') {
      this.radius = 0.45;
      this.height = 1.35;
      this.health = 10.0;
      this.maxHealth = 10.0;
    } else if (this.type === 'pig') {
      this.radius = 0.4;
      this.height = 0.85;
      this.health = 10.0;
      this.maxHealth = 10.0;
    }

    this.mesh = this.buildMesh();
    scene.add(this.mesh);
  }

  // -------------------------------------------------------------
  // TEXTURE GENERATOR & COMPILATION
  // -------------------------------------------------------------
  
  private static createPixelTexture(name: string, drawFn: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    if (this.textureCache.has(name)) {
      return this.textureCache.get(name)!;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    drawFn(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.textureCache.set(name, texture);
    return texture;
  }

  private static applyNoise(ctx: CanvasRenderingContext2D, baseColor: string, range: number) {
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const offset = (Math.random() - 0.5) * range;
        const nr = Math.max(0, Math.min(255, r + offset));
        const ng = Math.max(0, Math.min(255, g + offset));
        const nb = Math.max(0, Math.min(255, b + offset));
        ctx.fillStyle = `rgb(${Math.floor(nr)},${Math.floor(ng)},${Math.floor(nb)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private static drawMobFace(type: MobType, ctx: CanvasRenderingContext2D) {
    if (type === 'zombie') {
      this.applyNoise(ctx, '#4c8f35', 15);
      ctx.fillStyle = '#000000';
      ctx.fillRect(2, 7, 4, 2);
      ctx.fillRect(10, 7, 4, 2);
      ctx.fillStyle = '#1e3814';
      ctx.fillRect(7, 9, 2, 2);
      ctx.fillStyle = '#1a320f';
      ctx.fillRect(4, 11, 8, 2);
    } else if (type === 'creeper') {
      this.applyNoise(ctx, '#4caf50', 25);
      ctx.fillStyle = '#111111';
      ctx.fillRect(2, 4, 4, 4);
      ctx.fillRect(10, 4, 4, 4);
      ctx.fillRect(6, 8, 4, 6);
      ctx.fillRect(4, 10, 2, 6);
      ctx.fillRect(10, 10, 2, 6);
    } else if (type === 'skeleton') {
      this.applyNoise(ctx, '#d6d6d6', 15);
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(2, 6, 4, 3);
      ctx.fillRect(10, 6, 4, 3);
      ctx.fillRect(7, 9, 2, 2);
      ctx.fillStyle = '#8e8e8e';
      ctx.fillRect(3, 12, 10, 2);
    } else if (type === 'cow') {
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(0, 0, 16, 16);
      this.applyNoise(ctx, '#5c4033', 10);
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(1, 2, 4, 3);
      ctx.fillRect(11, 1, 4, 4);
      ctx.fillRect(3, 8, 3, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, 6, 2, 2);
      ctx.fillRect(13, 6, 2, 2);
      ctx.fillStyle = '#000000';
      ctx.fillRect(2, 6, 1, 2);
      ctx.fillRect(13, 6, 1, 2);
      ctx.fillStyle = '#c48b71';
      ctx.fillRect(4, 9, 8, 5);
      ctx.fillStyle = '#4a3328';
      ctx.fillRect(5, 11, 2, 2);
      ctx.fillRect(9, 11, 2, 2);
    } else if (type === 'pig') {
      this.applyNoise(ctx, '#f48fb1', 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, 7, 2, 1);
      ctx.fillRect(13, 7, 2, 1);
      ctx.fillStyle = '#000000';
      ctx.fillRect(2, 7, 1, 1);
      ctx.fillRect(13, 7, 1, 1);
      ctx.fillStyle = '#e91e63';
      ctx.fillRect(4, 9, 8, 4);
      ctx.fillStyle = '#ad1457';
      ctx.fillRect(5, 10, 2, 2);
      ctx.fillRect(9, 10, 2, 2);
    } else if (type === 'spider') {
      this.applyNoise(ctx, '#212121', 10);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(3, 7, 2, 2);
      ctx.fillRect(11, 7, 2, 2);
      ctx.fillStyle = '#ff8a80';
      ctx.fillRect(1, 9, 1, 1);
      ctx.fillRect(5, 9, 1, 1);
      ctx.fillRect(10, 9, 1, 1);
      ctx.fillRect(14, 9, 1, 1);
    } else if (type === 'chicken') {
      this.applyNoise(ctx, '#ffffff', 8);
      ctx.fillStyle = '#000000';
      ctx.fillRect(2, 6, 2, 2);
      ctx.fillRect(12, 6, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, 6, 1, 2);
      ctx.fillRect(12, 6, 1, 2);
    }
  }

  private static drawMobBodyLimb(type: MobType, part: string, ctx: CanvasRenderingContext2D) {
    if (type === 'zombie') {
      if (part === 'body') {
        this.applyNoise(ctx, '#2e8eb0', 12);
      } else if (part === 'head') {
        this.applyNoise(ctx, '#4c8f35', 15);
      } else { // arms / legs
        // Top sleeve blue, bottom skin green
        ctx.fillStyle = '#2e8eb0';
        ctx.fillRect(0, 0, 16, 5);
        ctx.fillStyle = '#4c8f35';
        ctx.fillRect(0, 5, 16, 11);
        this.applyNoise(ctx, '#4c8f35', 10);
      }
    } else if (type === 'creeper') {
      this.applyNoise(ctx, '#4caf50', 25);
    } else if (type === 'skeleton') {
      if (part === 'body') {
        this.applyNoise(ctx, '#d6d6d6', 15);
        ctx.fillStyle = '#8c8c8c';
        ctx.fillRect(2, 3, 12, 1);
        ctx.fillRect(2, 6, 12, 1);
        ctx.fillRect(2, 9, 12, 1);
        ctx.fillRect(2, 12, 12, 1);
      } else {
        this.applyNoise(ctx, '#d6d6d6', 10);
      }
    } else if (type === 'cow') {
      if (part === 'limb') {
        this.applyNoise(ctx, '#5c4033', 10);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 14, 16, 2); // hooves
      } else {
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(0, 0, 16, 16);
        this.applyNoise(ctx, '#5c4033', 10);
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(1, 2, 6, 5);
        ctx.fillRect(9, 3, 5, 6);
        ctx.fillRect(4, 11, 8, 4);
      }
    } else if (type === 'pig') {
      this.applyNoise(ctx, '#f48fb1', 12);
      if (part === 'limb') {
        ctx.fillStyle = '#444444';
        ctx.fillRect(0, 14, 16, 2); // hooves
      }
    } else if (type === 'spider') {
      this.applyNoise(ctx, '#212121', 10);
    } else if (type === 'chicken') {
      if (part === 'limb') {
        this.applyNoise(ctx, '#ff9800', 10);
      } else {
        this.applyNoise(ctx, '#ffffff', 8);
      }
    }
  }

  public static getMobMaterial(
    type: MobType,
    part: 'head' | 'body' | 'limb' | 'wing' | 'beak' | 'wattle' | 'horn' | 'outer_slime' | 'inner_slime',
    size: number = 1
  ): THREE.Material | THREE.Material[] {
    const key = `${type}_${part}_${size}`;
    if (this.materialCache.has(key)) {
      return this.materialCache.get(key)!;
    }

    let mat: THREE.Material | THREE.Material[];

    if (type === 'slime') {
      if (part === 'outer_slime') {
        mat = new THREE.MeshLambertMaterial({
          color: 0x55d66d,
          transparent: true,
          opacity: 0.55
        });
      } else { // inner_slime
        const frontTex = this.createPixelTexture(`${type}_inner_front`, (ctx) => {
          ctx.fillStyle = '#2e9b43';
          ctx.fillRect(0, 0, 16, 16);
          this.applyNoise(ctx, '#2e9b43', 10);
          ctx.fillStyle = '#111111';
          ctx.fillRect(2, 4, 3, 3);
          ctx.fillRect(11, 4, 3, 3);
          ctx.fillRect(6, 9, 4, 2);
        });

        const sideTex = this.createPixelTexture(`${type}_inner_side`, (ctx) => {
          ctx.fillStyle = '#2e9b43';
          ctx.fillRect(0, 0, 16, 16);
          this.applyNoise(ctx, '#2e9b43', 10);
        });

        const mats = [];
        for (let i = 0; i < 6; i++) {
          mats.push(new THREE.MeshLambertMaterial({ map: i === 4 ? frontTex : sideTex }));
        }
        mat = mats;
      }
    } else if (part === 'beak') {
      const tex = this.createPixelTexture(`chicken_beak`, (ctx) => {
        ctx.fillStyle = '#ff9800';
        ctx.fillRect(0, 0, 16, 16);
        this.applyNoise(ctx, '#ff9800', 8);
      });
      mat = new THREE.MeshLambertMaterial({ map: tex });
    } else if (part === 'wattle') {
      const tex = this.createPixelTexture(`chicken_wattle`, (ctx) => {
        ctx.fillStyle = '#f44336';
        ctx.fillRect(0, 0, 16, 16);
        this.applyNoise(ctx, '#f44336', 8);
      });
      mat = new THREE.MeshLambertMaterial({ map: tex });
    } else if (part === 'horn') {
      const tex = this.createPixelTexture(`cow_horn`, (ctx) => {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 16, 16);
        this.applyNoise(ctx, '#f5f5f5', 5);
      });
      mat = new THREE.MeshLambertMaterial({ map: tex });
    } else {
      if (part === 'head') {
        const frontTex = this.createPixelTexture(`${type}_head_front`, (ctx) => {
          this.drawMobFace(type, ctx);
        });
        const sideTex = this.createPixelTexture(`${type}_head_side`, (ctx) => {
          this.drawMobBodyLimb(type, 'head', ctx);
        });

        const mats = [];
        for (let i = 0; i < 6; i++) {
          // Index 4 is +Z (Front)
          mats.push(new THREE.MeshLambertMaterial({ map: i === 4 ? frontTex : sideTex }));
        }
        mat = mats;
      } else {
        const tex = this.createPixelTexture(`${type}_${part}`, (ctx) => {
          this.drawMobBodyLimb(type, part, ctx);
        });
        mat = new THREE.MeshLambertMaterial({ map: tex });
      }
    }

    this.materialCache.set(key, mat);
    return mat;
  }

  // -------------------------------------------------------------
  // MODEL COMPOSITION
  // -------------------------------------------------------------

  private buildMesh(): THREE.Group {
    const group = new THREE.Group();
    this.legs = [];
    this.wings = [];

    const type = this.type;

    if (type === 'zombie' || type === 'skeleton') {
      // Humanoids (Zombie, Skeleton)
      const isSkel = type === 'skeleton';
      
      // Head
      const headGeom = isSkel ? new THREE.BoxGeometry(0.35, 0.35, 0.35) : new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const headMat = MobEntity.getMobMaterial(type, 'head');
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.y = 1.4;
      group.add(head);

      // Body
      const bodyGeom = isSkel ? new THREE.BoxGeometry(0.35, 0.6, 0.15) : new THREE.BoxGeometry(0.4, 0.6, 0.2);
      const bodyMat = MobEntity.getMobMaterial(type, 'body');
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.9;
      group.add(body);

      // Left Arm
      const armGeom = isSkel ? new THREE.BoxGeometry(0.08, 0.55, 0.08) : new THREE.BoxGeometry(0.12, 0.55, 0.12);
      const armMat = MobEntity.getMobMaterial(type, 'limb');
      
      this.leftArmMesh = new THREE.Mesh(armGeom, armMat);
      this.leftArmMesh.position.set(isSkel ? -0.21 : -0.26, 0.9, 0.2);
      this.leftArmMesh.rotation.x = -Math.PI / 2; // arms point forward
      group.add(this.leftArmMesh);

      // Right Arm
      this.rightArmMesh = new THREE.Mesh(armGeom, armMat);
      this.rightArmMesh.position.set(isSkel ? 0.21 : 0.26, 0.9, 0.2);
      this.rightArmMesh.rotation.x = -Math.PI / 2; // arms point forward
      group.add(this.rightArmMesh);

      // Left Leg
      const legGeom = isSkel ? new THREE.BoxGeometry(0.08, 0.6, 0.08) : new THREE.BoxGeometry(0.14, 0.6, 0.14);
      this.leftLegMesh = new THREE.Mesh(legGeom, armMat);
      this.leftLegMesh.position.set(isSkel ? -0.09 : -0.11, 0.3, 0.0);
      group.add(this.leftLegMesh);

      // Right Leg
      this.rightLegMesh = new THREE.Mesh(legGeom, armMat);
      this.rightLegMesh.position.set(isSkel ? 0.09 : 0.11, 0.3, 0.0);
      group.add(this.rightLegMesh);

    } else if (type === 'creeper') {
      // Head
      const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const headMat = MobEntity.getMobMaterial(type, 'head');
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.y = 1.3;
      group.add(head);

      // Body
      const bodyGeom = new THREE.BoxGeometry(0.3, 0.6, 0.25);
      const bodyMat = MobEntity.getMobMaterial(type, 'body');
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.8;
      group.add(body);

      // 4 Short Legs
      const legGeom = new THREE.BoxGeometry(0.13, 0.3, 0.16);
      const legMat = MobEntity.getMobMaterial(type, 'limb');

      const positions = [
        [-0.11, 0.15, 0.12], // FL
        [0.11, 0.15, 0.12],  // FR
        [-0.11, 0.15, -0.12], // BL
        [0.11, 0.15, -0.12]   // BR
      ];

      for (const pos of positions) {
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        group.add(leg);
        this.legs.push(leg);
      }

    } else if (type === 'cow') {
      // Head
      const headGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const headMat = MobEntity.getMobMaterial(type, 'head');
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.set(0.0, 0.9, 0.4);
      group.add(head);

      // Horns
      const hornGeom = new THREE.BoxGeometry(0.06, 0.12, 0.06);
      const hornMat = MobEntity.getMobMaterial(type, 'horn');
      
      const hornL = new THREE.Mesh(hornGeom, hornMat);
      hornL.position.set(-0.18, 1.1, 0.35);
      group.add(hornL);

      const hornR = new THREE.Mesh(hornGeom, hornMat);
      hornR.position.set(0.18, 1.1, 0.35);
      group.add(hornR);

      // Body
      const bodyGeom = new THREE.BoxGeometry(0.7, 0.6, 1.0);
      const bodyMat = MobEntity.getMobMaterial(type, 'body');
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.set(0.0, 0.65, -0.1);
      group.add(body);

      // Legs
      const legGeom = new THREE.BoxGeometry(0.16, 0.4, 0.16);
      const legMat = MobEntity.getMobMaterial(type, 'limb');
      const legOffsets = [
        [-0.28, 0.2, 0.3],  // FL
        [0.28, 0.2, 0.3],   // FR
        [-0.28, 0.2, -0.3], // BL
        [0.28, 0.2, -0.3]   // BR
      ];
      for (const pos of legOffsets) {
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        group.add(leg);
        this.legs.push(leg);
      }

    } else if (type === 'pig') {
      // Head
      const headGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const headMat = MobEntity.getMobMaterial(type, 'head');
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.set(0.0, 0.6, 0.3);
      group.add(head);

      // Body
      const bodyGeom = new THREE.BoxGeometry(0.65, 0.5, 0.9);
      const bodyMat = MobEntity.getMobMaterial(type, 'body');
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.set(0.0, 0.45, -0.05);
      group.add(body);

      // Legs
      const legGeom = new THREE.BoxGeometry(0.16, 0.3, 0.16);
      const legMat = MobEntity.getMobMaterial(type, 'limb');
      const legOffsets = [
        [-0.22, 0.15, 0.25],  // FL
        [0.22, 0.15, 0.25],   // FR
        [-0.22, 0.15, -0.25], // BL
        [0.22, 0.15, -0.25]   // BR
      ];
      for (const pos of legOffsets) {
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        group.add(leg);
        this.legs.push(leg);
      }

    } else if (type === 'spider') {
      // Spider: Head, Thorax, Abdomen, 8 legs
      // Head
      const headGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const headMat = MobEntity.getMobMaterial(type, 'head');
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.set(0.0, 0.25, 0.35);
      group.add(head);

      // Thorax
      const thoraxGeom = new THREE.BoxGeometry(0.35, 0.3, 0.3);
      const thoraxMat = MobEntity.getMobMaterial(type, 'body');
      const thorax = new THREE.Mesh(thoraxGeom, thoraxMat);
      thorax.position.set(0.0, 0.25, 0.1);
      group.add(thorax);

      // Abdomen
      const abdGeom = new THREE.BoxGeometry(0.5, 0.4, 0.55);
      const abdMat = MobEntity.getMobMaterial(type, 'body');
      const abd = new THREE.Mesh(abdGeom, abdMat);
      abd.position.set(0.0, 0.3, -0.25);
      group.add(abd);

      // 8 Legs (4 on each side)
      const legGeom = new THREE.BoxGeometry(0.4, 0.05, 0.05);
      const legMat = MobEntity.getMobMaterial(type, 'limb');

      const zCoords = [0.2, 0.05, -0.1, -0.25];
      for (let i = 0; i < 4; i++) {
        // Left Leg
        const legL = new THREE.Mesh(legGeom, legMat);
        legL.position.set(-0.35, 0.2, zCoords[i]);
        legL.rotation.z = Math.PI / 10;
        group.add(legL);
        this.legs.push(legL);

        // Right Leg
        const legR = new THREE.Mesh(legGeom, legMat);
        legR.position.set(0.35, 0.2, zCoords[i]);
        legR.rotation.z = -Math.PI / 10;
        group.add(legR);
        this.legs.push(legR);
      }

    } else if (type === 'slime') {
      // Double nested cubes
      // Outer translucent cube
      const outerGeom = new THREE.BoxGeometry(0.4 * this.size, 0.4 * this.size, 0.4 * this.size);
      const outerMat = MobEntity.getMobMaterial(type, 'outer_slime', this.size);
      const outer = new THREE.Mesh(outerGeom, outerMat);
      outer.position.y = 0.2 * this.size;
      group.add(outer);

      // Inner solid cube
      const innerGeom = new THREE.BoxGeometry(0.24 * this.size, 0.24 * this.size, 0.24 * this.size);
      const innerMat = MobEntity.getMobMaterial(type, 'inner_slime', this.size);
      const inner = new THREE.Mesh(innerGeom, innerMat);
      inner.position.y = 0.2 * this.size;
      group.add(inner);

    } else if (type === 'chicken') {
      // Head
      const headGeom = new THREE.BoxGeometry(0.2, 0.25, 0.2);
      const headMat = MobEntity.getMobMaterial(type, 'head');
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.set(0.0, 0.55, 0.15);
      group.add(head);

      // Beak
      const beakGeom = new THREE.BoxGeometry(0.12, 0.08, 0.1);
      const beakMat = MobEntity.getMobMaterial(type, 'beak');
      const beak = new THREE.Mesh(beakGeom, beakMat);
      beak.position.set(0.0, 0.54, 0.28);
      group.add(beak);

      // Wattle (red under beak)
      const wattleGeom = new THREE.BoxGeometry(0.08, 0.1, 0.08);
      const wattleMat = MobEntity.getMobMaterial(type, 'wattle');
      const wattle = new THREE.Mesh(wattleGeom, wattleMat);
      wattle.position.set(0.0, 0.46, 0.22);
      group.add(wattle);

      // Body
      const bodyGeom = new THREE.BoxGeometry(0.3, 0.25, 0.35);
      const bodyMat = MobEntity.getMobMaterial(type, 'body');
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.set(0.0, 0.325, 0.0);
      group.add(body);

      // Wings (Left/Right)
      const wingGeom = new THREE.BoxGeometry(0.05, 0.18, 0.25);
      const wingMat = MobEntity.getMobMaterial(type, 'body');
      
      const wingL = new THREE.Mesh(wingGeom, wingMat);
      wingL.position.set(-0.175, 0.325, 0.05);
      group.add(wingL);
      this.wings.push(wingL);

      const wingR = new THREE.Mesh(wingGeom, wingMat);
      wingR.position.set(0.175, 0.325, 0.05);
      group.add(wingR);
      this.wings.push(wingR);

      // Legs
      const legGeom = new THREE.BoxGeometry(0.05, 0.2, 0.05);
      const legMat = MobEntity.getMobMaterial(type, 'limb');
      
      const legL = new THREE.Mesh(legGeom, legMat);
      legL.position.set(-0.07, 0.1, 0.02);
      group.add(legL);

      const legR = new THREE.Mesh(legGeom, legMat);
      legR.position.set(0.07, 0.1, 0.02);
      group.add(legR);
    }

    group.position.copy(this.position);
    return group;
  }

  // -------------------------------------------------------------
  // UPDATE TICK AND AI
  // -------------------------------------------------------------

  public update(deltaSec: number, player: Player, chunkManager: ChunkManager, mobManager: any): void {
    this.stateTimer += deltaSec;

    // AI state updates
    const distToPlayer = this.position.distanceTo(player.position);
    
    // Slimes split, spiders climb, creepers explode, skeletons shoot
    if (this.isHostile && distToPlayer < 12.0 && !player.isDead && !player.isFlying) {
      this.state = 'chase';
    } else {
      if (this.state === 'chase' || this.stateTimer > 4.0) {
        this.state = 'wander';
        this.stateTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        this.wanderDirection.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
      }
    }

    // Steering velocity calculations
    let speed = this.state === 'chase' ? 2.5 : 1.0;
    if (this.type === 'spider') {
      speed *= 1.6; // Spiders run 60% faster!
    }

    if (this.type === 'slime') {
      // Slime movement is jump-driven (hops along the ground)
      if (this.onGround) {
        this.velocity.x = 0;
        this.velocity.z = 0;
        
        this.slimeJumpTimer += deltaSec;
        const jumpInterval = this.state === 'chase' ? 1.0 : 2.5;
        if (this.slimeJumpTimer >= jumpInterval) {
          this.slimeJumpTimer = 0;
          const jumpDir = new THREE.Vector3();
          if (this.state === 'chase') {
            jumpDir.subVectors(player.position, this.position).setY(0).normalize();
          } else {
            const angle = Math.random() * Math.PI * 2;
            jumpDir.set(Math.cos(angle), 0, Math.sin(angle));
          }
          
          const jumpForce = 2.0 + this.size * 0.5;
          this.velocity.x = jumpDir.x * jumpForce;
          this.velocity.z = jumpDir.z * jumpForce;
          this.velocity.y = 4.0 + this.size * 0.5;
          this.onGround = false;
          
          AssetLoader.playSound('jump');
        }
      }
    } else if (this.creeperExploding) {
      // Creeper freezes during explosion fuse
      this.velocity.x = 0;
      this.velocity.z = 0;
    } else {
      // Normal steer logic
      if (this.state === 'chase') {
        const dir = new THREE.Vector3().subVectors(player.position, this.position);
        dir.y = 0; // lock horizontal steering
        dir.normalize();
        this.velocity.x = dir.x * speed;
        this.velocity.z = dir.z * speed;

        // Contact attack damage
        if (this.type !== 'creeper' && this.type !== 'skeleton' && distToPlayer < 1.3) {
          player.takeDamage(1.5 * deltaSec); // deal contact damage
        }
      } else {
        // Wander
        this.velocity.x = this.wanderDirection.x * speed;
        this.velocity.z = this.wanderDirection.z * speed;
      }
    }

    // Apply gravity
    this.velocity.y += -22.0 * deltaSec;

    // Spider wall climbing
    if (this.type === 'spider') {
      const lookAhead = this.velocity.clone().normalize().multiplyScalar(0.7);
      if (lookAhead.lengthSq() > 0.05) {
        const checkX = Math.floor(this.position.x + lookAhead.x);
        const checkY = Math.floor(this.position.y);
        const checkZ = Math.floor(this.position.z + lookAhead.z);
        const blockInFront = chunkManager.getBlock(checkX, checkY, checkZ);
        const blockInFrontHigh = chunkManager.getBlock(checkX, checkY + 1, checkZ);

        if ((blockInFront !== 0 && blockInFront !== 9) || (blockInFrontHigh !== 0 && blockInFrontHigh !== 9)) {
          this.velocity.y = 4.0; // Spider climbs walls vertically!
          this.onGround = false;
        }
      }
    }

    // Jump if block is directly in front (normal wall climbing for other mobs)
    if (this.type !== 'spider' && this.type !== 'slime' && this.onGround && this.velocity.lengthSq() > 0.1) {
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

    // Creeper Explosion fuse logic
    if (this.type === 'creeper') {
      if (this.state === 'chase' && distToPlayer < 3.0 && !player.isDead && !player.isFlying) {
        if (!this.creeperExploding) {
          this.creeperExploding = true;
          this.creeperFuseTimer = 0;
          AssetLoader.playSound('hiss');
        }
      }

      if (this.creeperExploding) {
        this.creeperFuseTimer += deltaSec;

        // Flashing animation (red/white/default)
        const flashFreq = 0.12;
        const step = Math.floor(this.creeperFuseTimer / flashFreq) % 3;

        this.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
              if (m && 'color' in m) {
                if (step === 1) {
                  m.color.setHex(0xff0000); // Tint red
                } else if (step === 2) {
                  m.color.setHex(0xaaaaaa); // Tint white/gray
                } else {
                  m.color.setHex(0xffffff); // Default
                }
              }
            });
          }
        });

        // Swelling / Scaling animation
        const scale = 1.0 + (this.creeperFuseTimer / 1.5) * 0.25;
        this.mesh.scale.set(scale, scale, scale);

        // Cancel fuse if player escapes
        if (distToPlayer > 5.5) {
          this.creeperExploding = false;
          this.creeperFuseTimer = 0;
          this.mesh.scale.set(1, 1, 1);
          this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(m => {
                if (m && 'color' in m) m.color.setHex(0xffffff);
              });
            }
          });
        }

        // Boom!
        if (this.creeperFuseTimer >= 1.5) {
          this.explode(player, chunkManager, mobManager);
          return;
        }
      }
    }

    // Skeleton shooting arrow logic
    if (this.type === 'skeleton') {
      if (this.state === 'chase' && distToPlayer < 16.0 && !player.isDead && !player.isFlying) {
        this.skeletonShootCooldown = (this.skeletonShootCooldown || 0) - deltaSec;
        if (this.skeletonShootCooldown <= 0) {
          this.skeletonShootCooldown = 2.0; // Shoot every 2 seconds
          this.shootArrow(player, mobManager);
        }
      }
    }

    // AABB collisions updates
    Physics.moveEntity(this, deltaSec, chunkManager);

    // Sync mesh position
    this.mesh.position.copy(this.position);
    if (this.velocity.x !== 0 || this.velocity.z !== 0) {
      this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
    }

    // Limb swing animations based on movement speed
    this.animateLimbs();
  }

  private animateLimbs(): void {
    const speedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
    if (speedSq > 0.05 && this.onGround) {
      const swing = Math.sin(performance.now() * 0.01 * (this.type === 'spider' ? 1.6 : 1.0));

      if (this.leftLegMesh && this.rightLegMesh) {
        this.leftLegMesh.rotation.x = swing * 0.5;
        this.rightLegMesh.rotation.x = -swing * 0.5;
      }
      if (this.leftArmMesh && this.rightArmMesh && this.type !== 'zombie') {
        this.leftArmMesh.rotation.x = -swing * 0.5;
        this.rightArmMesh.rotation.x = swing * 0.5;
      }

      if (this.legs.length >= 4) {
        // Alternating leg swings for 4-legged mobs (cow, pig, creeper, spider)
        this.legs[0].rotation.x = swing * 0.4;
        if (this.legs[1]) this.legs[1].rotation.x = -swing * 0.4;
        if (this.legs[2]) this.legs[2].rotation.x = -swing * 0.4;
        if (this.legs[3]) this.legs[3].rotation.x = swing * 0.4;
      }

      if (this.wings.length === 2) {
        // Flapping wings
        this.wings[0].rotation.z = Math.abs(swing) * 0.45;
        this.wings[1].rotation.z = -Math.abs(swing) * 0.45;
      }
    } else {
      // Reset rotations when stationary
      if (this.leftLegMesh && this.rightLegMesh) {
        this.leftLegMesh.rotation.x = 0;
        this.rightLegMesh.rotation.x = 0;
      }
      if (this.leftArmMesh && this.rightArmMesh && this.type !== 'zombie') {
        this.leftArmMesh.rotation.x = 0;
        this.rightArmMesh.rotation.x = 0;
      }
      this.legs.forEach(l => l.rotation.x = 0);
      this.wings.forEach(w => w.rotation.z = 0);
    }
  }

  // -------------------------------------------------------------
  // ABILITIES & COMBAT
  // -------------------------------------------------------------

  private explode(player: Player, chunkManager: ChunkManager, mobManager: any): void {
    AssetLoader.playSound('explode');

    const radius = 3;
    const cx = Math.floor(this.position.x);
    const cy = Math.floor(this.position.y);
    const cz = Math.floor(this.position.z);

    // Destruct voxels
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq <= radius * radius) {
            const bx = cx + dx;
            const by = cy + dy;
            const bz = cz + dz;
            const blockId = chunkManager.getBlock(bx, by, bz);
            if (blockId !== 0 && blockId !== 13) { // Destroy everything except Bedrock
              chunkManager.setBlock(bx, by, bz, 0); // set to Air
            }
          }
        }
      }
    }

    // Damage player
    const playerDist = this.position.distanceTo(player.position);
    if (playerDist < 6.0 && !player.isDead && !player.isFlying) {
      const damage = Math.max(0, (6.0 - playerDist) * 4.0); // up to 24 damage
      player.takeDamage(damage);
    }

    // Remove creeper
    mobManager.removeMob(this.id);
  }

  private shootArrow(player: Player, mobManager: any): void {
    // Spawn arrow from upper body
    const spawnPos = this.position.clone().add(new THREE.Vector3(0, this.height * 0.75, 0));
    
    // Target player chest Y
    const targetPos = player.position.clone().add(new THREE.Vector3(0, player.height * 0.5, 0));
    
    const dir = new THREE.Vector3().subVectors(targetPos, spawnPos);
    const dist = dir.length();
    dir.normalize();

    // Arrow speed
    const arrowSpeed = 14.0;
    dir.multiplyScalar(arrowSpeed);
    
    // Arc compensation for gravity
    dir.y += dist * 0.08; 

    const arrowId = Math.random().toString(36).substring(2, 9);
    mobManager.spawnArrow(arrowId, spawnPos, dir);
  }

  public takeDamage(amount: number, mobManager: any, scene: THREE.Scene): void {
    this.health = Math.max(0, this.health - amount);
    
    // Play hurt sound
    AssetLoader.playSound('hurt');

    // Visual red damage flash
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => {
          if (m && 'color' in m) {
            m.color.setHex(0xff8888); // tint red
            setTimeout(() => {
              if (m && 'color' in m) m.color.setHex(0xffffff); // restore
            }, 180);
          }
        });
      }
    });

    if (this.health <= 0) {
      // Split slime if size > 1
      if (this.type === 'slime' && this.size > 1) {
        const newSize = this.size - 1;
        const count = 2 + Math.floor(Math.random() * 2); // Split into 2 or 3 smaller ones
        for (let i = 0; i < count; i++) {
          const childId = Math.random().toString(36).substring(2, 9);
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5 * this.size,
            0.1,
            (Math.random() - 0.5) * 0.5 * this.size
          );
          const spawnPos = this.position.clone().add(offset);
          const childSlime = new MobEntity(childId, 'slime', spawnPos, scene, newSize);
          mobManager.addMob(childSlime);
        }
      }

      mobManager.removeMob(this.id);
    }
  }

  // -------------------------------------------------------------
  // TEARDOWN
  // -------------------------------------------------------------

  public destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
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
