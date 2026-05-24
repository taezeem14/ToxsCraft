/**
 * Tox'sCraft Renderer
 * Initializes Three.js WebGL context, camera, lighting, and handles chunk mesh pools.
 */

import * as THREE from 'three';
import { CHUNK_SIZE } from '../constants';
import { AssetLoader } from '../core/AssetLoader';
import { SkySystem } from './SkySystem';
import blockVertShader from './shaders/block.vert.glsl';
import blockFragShader from './shaders/block.frag.glsl';
import waterVertShader from './shaders/water.vert.glsl';
import waterFragShader from './shaders/water.frag.glsl';
import lavaVertShader from './shaders/lava.vert.glsl';
import lavaFragShader from './shaders/lava.frag.glsl';

export class Renderer {
  public canvas: HTMLCanvasElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  
  // Lighting and Environment
  public dirLight!: THREE.DirectionalLight;
  public ambientLight!: THREE.AmbientLight;
  public skySystem!: SkySystem;

  // Materials
  private blockMaterial!: THREE.ShaderMaterial;
  private waterMaterial!: THREE.ShaderMaterial;
  private lavaMaterial!: THREE.ShaderMaterial;
  private atlasTexture: THREE.CanvasTexture;

  // Mesh pools: chunkKey -> Mesh
  private solidMeshes: Map<string, THREE.Mesh> = new Map();
  private transparentMeshes: Map<string, THREE.Mesh> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    
    // Camera Setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      precision: "mediump"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Load textures
    this.atlasTexture = AssetLoader.getTextureAtlas();

    // Scaffolding components
    this.initLights();
    this.initMaterials();
    
    window.addEventListener('resize', this.onWindowResize);
  }

  private initLights(): void {
    // Ambient Light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // Sun Directional Light
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 500;
    
    // Keep shadow volume tight around active player zone
    const d = 120;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    
    this.scene.add(this.dirLight);

    // Celestial Orchestrator
    this.skySystem = new SkySystem(this.scene, this.dirLight, this.ambientLight);
  }

  private initMaterials(): void {
    const commonUniforms = {
      uTextureAtlas: { value: this.atlasTexture },
      uSunlightIntensity: { value: 1.0 },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0.0035 }, // smooth horizon fading
      uTime: { value: 0 }
    };

    // 1. Solid Blocks material
    this.blockMaterial = new THREE.ShaderMaterial({
      vertexShader: blockVertShader,
      fragmentShader: blockFragShader,
      uniforms: commonUniforms,
      vertexColors: true
    });

    // 2. Liquid Water material
    this.waterMaterial = new THREE.ShaderMaterial({
      vertexShader: waterVertShader,
      fragmentShader: waterFragShader,
      uniforms: commonUniforms,
      transparent: true,
      depthWrite: false, // Prevents transparent sorting artifacts
      vertexColors: false
    });

    // 3. Liquid Lava material
    this.lavaMaterial = new THREE.ShaderMaterial({
      vertexShader: lavaVertShader,
      fragmentShader: lavaFragShader,
      uniforms: commonUniforms,
      vertexColors: false
    });
  }

  /**
   * Updates/creates the meshes for a specific chunk
   */
  public updateChunkMesh(cx: number, cz: number, solidData: any, transparentData: any): void {
    const key = `${cx},${cz}`;

    // 1. Update solid mesh
    this.removeChunkMesh(cx, cz); // clear old

    if (solidData.positions.length > 0) {
      const geom = this.buildGeometry(solidData);
      const mesh = new THREE.Mesh(geom, this.blockMaterial);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      
      this.scene.add(mesh);
      this.solidMeshes.set(key, mesh);
    }

    // 2. Update transparent mesh
    if (transparentData.positions.length > 0) {
      const geom = this.buildGeometry(transparentData);
      
      // Determine if it is water or lava/glass based on texture IDs or group
      // For simplicity, transparent mesh in chunk meshes uses waterMaterial
      // (glass faces are culled into solidData but drawn using transparent flag, 
      // or we can draw them with blockMaterial since blockMaterial supports alpha discard)
      const mesh = new THREE.Mesh(geom, this.waterMaterial);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      
      this.scene.add(mesh);
      this.transparentMeshes.set(key, mesh);
    }
  }

  private buildGeometry(data: any): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uvs), 2));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.colors), 3));
    geom.setIndex(data.indices);
    return geom;
  }

  /**
   * Remove and clean chunk meshes from scene & memory
   */
  public removeChunkMesh(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    
    // Dispose solid
    const solidMesh = this.solidMeshes.get(key);
    if (solidMesh) {
      this.scene.remove(solidMesh);
      solidMesh.geometry.dispose();
      this.solidMeshes.delete(key);
    }

    // Dispose transparent
    const transMesh = this.transparentMeshes.get(key);
    if (transMesh) {
      this.scene.remove(transMesh);
      transMesh.geometry.dispose();
      this.transparentMeshes.delete(key);
    }
  }

  private onWindowResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  /**
   * Render loop frame step
   */
  public render(timeOfDay: number, playerPos: THREE.Vector3, gameTime: number): void {
    // 1. Update Sky elements
    this.skySystem.update(timeOfDay, playerPos);

    // 2. Adjust fog color matching sky gradient
    const fogColor = this.skySystem.getFogColor();
    this.scene.fog = new THREE.FogExp2(fogColor, 0.0035);
    this.renderer.setClearColor(fogColor);

    // 3. Update uniforms
    const sunIntensity = this.skySystem.getSunlightIntensity();
    this.blockMaterial.uniforms.uSunlightIntensity.value = sunIntensity;
    this.blockMaterial.uniforms.uFogColor.value.copy(fogColor);
    
    this.waterMaterial.uniforms.uSunlightIntensity.value = sunIntensity;
    this.waterMaterial.uniforms.uFogColor.value.copy(fogColor);
    this.waterMaterial.uniforms.uTime.value = gameTime * 0.001;

    this.lavaMaterial.uniforms.uFogColor.value.copy(fogColor);
    this.lavaMaterial.uniforms.uTime.value = gameTime * 0.001;

    // Center shadow frustum on player to save draw calls
    this.dirLight.shadow.camera.position.copy(playerPos).add(new THREE.Vector3(50, 100, 30));
    this.dirLight.shadow.camera.lookAt(playerPos);

    // 4. Render main scene pass
    this.renderer.render(this.scene, this.camera);
  }

  public clear(): void {
    // Clean all loaded meshes
    for (const key of this.solidMeshes.keys()) {
      const parts = key.split(',');
      this.removeChunkMesh(parseInt(parts[0]), parseInt(parts[1]));
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}
