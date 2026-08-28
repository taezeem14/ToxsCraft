/**
 * Tox'sCraft ParticleSystem
 * High-performance 3D particle manager for block breaking, sparks, smoke,
 * explosions, water splashes, and atmospheric weather (rain / snow).
 */

import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  isPrecipitation?: boolean;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private maxParticles = 2000;
  private particles: Particle[] = [];

  // Instanced / Buffer Geometry for rendering
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.PointsMaterial;
  private pointsMesh!: THREE.Points;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  // Weather precipitation parameters
  private weatherMode: 'none' | 'rain' | 'snow' = 'none';
  private precipitationTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.initMesh();
  }

  private initMesh(): void {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Custom Canvas Texture for sharp square/round particle shapes
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    this.material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      map: texture,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    this.pointsMesh.frustumCulled = false;
    this.scene.add(this.pointsMesh);
  }

  /**
   * Spawn particle burst on block break with colors derived from block
   */
  public spawnBlockBreak(pos: THREE.Vector3, baseColorHex: string | number, count = 16): void {
    const baseColor = new THREE.Color(baseColorHex);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const pColor = baseColor.clone();
      // Slight color jitter
      pColor.r = Math.max(0, Math.min(1, pColor.r + (Math.random() - 0.5) * 0.15));
      pColor.g = Math.max(0, Math.min(1, pColor.g + (Math.random() - 0.5) * 0.15));
      pColor.b = Math.max(0, Math.min(1, pColor.b + (Math.random() - 0.5) * 0.15));

      const spread = 0.4;
      const origin = new THREE.Vector3(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + (Math.random() - 0.5) * spread,
        pos.z + (Math.random() - 0.5) * spread
      );

      const speed = 2.0 + Math.random() * 3.5;
      const angle = Math.random() * Math.PI * 2;
      const yVel = 1.5 + Math.random() * 3.0;

      const vel = new THREE.Vector3(
        Math.cos(angle) * (speed * 0.5),
        yVel,
        Math.sin(angle) * (speed * 0.5)
      );

      this.particles.push({
        position: origin,
        velocity: vel,
        color: pColor,
        size: 0.12 + Math.random() * 0.08,
        alpha: 1.0,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
        gravity: 12.0,
        drag: 0.96
      });
    }
  }

  /**
   * Spawn hit sparks & crit stars when attacking mobs
   */
  public spawnHitSparks(pos: THREE.Vector3, isCrit = false, count = 12): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const color = isCrit
        ? new THREE.Color(1.0, 0.85, 0.1) // Gold critical star
        : new THREE.Color(0.9, 0.15, 0.15); // Crimson damage spark

      const speed = isCrit ? 4.0 : 2.5;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + 1.0,
        (Math.random() - 0.5) * speed
      );

      this.particles.push({
        position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)),
        velocity: vel,
        color: color,
        size: isCrit ? 0.22 : 0.14,
        alpha: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        gravity: 8.0,
        drag: 0.94
      });
    }
  }

  /**
   * Spawn explosion cloud & fireball particles
   */
  public spawnExplosion(center: THREE.Vector3, count = 60): void {
    // 1. Fiery core particles
    for (let i = 0; i < count * 0.6; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const color = Math.random() > 0.4
        ? new THREE.Color(1.0, 0.5, 0.05) // Orange fire
        : new THREE.Color(1.0, 0.9, 0.1); // Yellow flash

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 4.0 + Math.random() * 8.0;

      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed + 1.0,
        Math.cos(phi) * speed
      );

      this.particles.push({
        position: center.clone(),
        velocity: vel,
        color: color,
        size: 0.25 + Math.random() * 0.2,
        alpha: 1.0,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.4,
        gravity: 3.0,
        drag: 0.92
      });
    }

    // 2. Heavy smoke billows
    for (let i = 0; i < count * 0.4; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const grey = 0.2 + Math.random() * 0.3;
      const color = new THREE.Color(grey, grey, grey);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 2.0 + Math.random() * 4.0;

      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed + 3.0,
        Math.cos(phi) * speed
      );

      this.particles.push({
        position: center.clone(),
        velocity: vel,
        color: color,
        size: 0.35 + Math.random() * 0.25,
        alpha: 0.9,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.6,
        gravity: -1.0, // Rises
        drag: 0.95
      });
    }
  }

  /**
   * Spawn eating crunch particles
   */
  public spawnEatingParticles(pos: THREE.Vector3, colorHex = '#e74c3c', count = 6): void {
    const baseColor = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 1.2,
        (Math.random() - 0.5) * 1.5
      );

      this.particles.push({
        position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2)),
        velocity: vel,
        color: baseColor.clone(),
        size: 0.08 + Math.random() * 0.05,
        alpha: 1.0,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        gravity: 9.8,
        drag: 0.95
      });
    }
  }

  /**
   * Water splash droplets
   */
  public spawnSplash(pos: THREE.Vector3, count = 15): void {
    const color = new THREE.Color(0.4, 0.7, 0.95);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.5;

      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.5 + Math.random() * 3.0,
        Math.sin(angle) * speed
      );

      this.particles.push({
        position: pos.clone(),
        velocity: vel,
        color: color.clone(),
        size: 0.1 + Math.random() * 0.06,
        alpha: 0.85,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.25,
        gravity: 12.0,
        drag: 0.95
      });
    }
  }

  /**
   * Set atmospheric weather precipitation
   */
  public setWeather(mode: 'none' | 'rain' | 'snow'): void {
    this.weatherMode = mode;
  }

  public getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * Main Particle Tick
   */
  public update(deltaSec: number, playerPos?: THREE.Vector3): void {
    // 1. Generate precipitation particles around player if active
    if (this.weatherMode !== 'none' && playerPos) {
      this.precipitationTimer += deltaSec;
      const spawnRate = this.weatherMode === 'rain' ? 0.015 : 0.03;

      while (this.precipitationTimer >= spawnRate) {
        this.precipitationTimer -= spawnRate;
        if (this.particles.length < this.maxParticles - 100) {
          const range = 24.0;
          const px = playerPos.x + (Math.random() - 0.5) * range;
          const pz = playerPos.z + (Math.random() - 0.5) * range;
          const py = playerPos.y + 12.0 + Math.random() * 8.0;

          if (this.weatherMode === 'rain') {
            this.particles.push({
              position: new THREE.Vector3(px, py, pz),
              velocity: new THREE.Vector3(0.5, -28.0, -0.5),
              color: new THREE.Color(0.65, 0.75, 0.9),
              size: 0.12,
              alpha: 0.7,
              life: 0,
              maxLife: 0.8,
              gravity: 0,
              drag: 1.0,
              isPrecipitation: true
            });
          } else if (this.weatherMode === 'snow') {
            this.particles.push({
              position: new THREE.Vector3(px, py, pz),
              velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                -3.5 - Math.random() * 1.5,
                (Math.random() - 0.5) * 1.5
              ),
              color: new THREE.Color(0.95, 0.97, 1.0),
              size: 0.14,
              alpha: 0.85,
              life: 0,
              maxLife: 3.5,
              gravity: 0,
              drag: 0.98,
              isPrecipitation: true
            });
          }
        }
      }
    }

    // 2. Tick existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaSec;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.velocity.y -= p.gravity * deltaSec;
      p.velocity.x *= p.drag;
      p.velocity.z *= p.drag;

      p.position.x += p.velocity.x * deltaSec;
      p.position.y += p.velocity.y * deltaSec;
      p.position.z += p.velocity.z * deltaSec;

      // Precipitation culling below player feet
      if (p.isPrecipitation && playerPos && p.position.y < playerPos.y - 4.0) {
        this.particles.splice(i, 1);
      }
    }

    // 3. Write data into GPU buffer attributes
    const count = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const i3 = i * 3;

      this.positions[i3] = p.position.x;
      this.positions[i3 + 1] = p.position.y;
      this.positions[i3 + 2] = p.position.z;

      const progress = p.life / p.maxLife;
      const fade = Math.max(0, 1.0 - progress);

      this.colors[i3] = p.color.r * fade;
      this.colors[i3 + 1] = p.color.g * fade;
      this.colors[i3 + 2] = p.color.b * fade;

      this.sizes[i] = p.size;
    }

    // Clear unused buffer elements
    for (let i = count; i < Math.min(count + 50, this.maxParticles); i++) {
      this.sizes[i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.setDrawRange(0, count);
  }

  public clear(): void {
    this.particles = [];
    if (this.pointsMesh) {
      this.scene.remove(this.pointsMesh);
      this.geometry.dispose();
      this.material.dispose();
    }
  }
}
