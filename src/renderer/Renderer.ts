/**
 * Tox'sCraft Renderer
 * Initializes Three.js WebGL context, camera, lighting, and handles chunk mesh pools.
 */

import * as THREE from 'three';
import { CHUNK_SIZE } from '../constants';
import { AssetLoader } from '../core/AssetLoader';
import { SkySystem } from './SkySystem';
import { settingsManager } from '../core/SettingsManager';
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
  private activeFades: Map<string, { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; progress: number }> = new Map();

  // Player Model Group and Limb Meshes
  public playerGroup: THREE.Group | null = null;
  private playerHead: THREE.Mesh | null = null;
  private playerTorso: THREE.Mesh | null = null;
  private playerLeftArm: THREE.Mesh | null = null;
  private playerRightArm: THREE.Mesh | null = null;
  private playerLeftLeg: THREE.Mesh | null = null;
  private playerRightLeg: THREE.Mesh | null = null;
  private skinMaterialsCache: Map<string, { head: THREE.Material; torso: THREE.Material; arm: THREE.Material; leg: THREE.Material }> = new Map();
  private currentSkinName: string = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    
    // Camera Setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // Disable antialias for better laptop/mobile compatibility
      powerPreference: "high-performance",
      precision: "mediump"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Use device pixel ratio clamped to max 1.5 to fix cooked aspect ratios while maintaining performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const shadows = settingsManager.getValue('shadows');
    this.renderer.shadowMap.enabled = shadows;
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
    const shadows = settingsManager.getValue('shadows');
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.dirLight.castShadow = shadows;
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
      uTime: { value: 0 },
      uOpacity: { value: 1.0 }
    };

    // 1. Solid Blocks material (opaque + alpha-solid like leaves/glass/ice)
    // depthWrite:true and transparent:false (both Three.js defaults for ShaderMaterial)
    // ensure correct depth buffer writes. The fragment shader discards pixels with
    // alpha < 0.1, providing alphaTest-style rendering for leaves, glass, ice, etc.
    this.blockMaterial = new THREE.ShaderMaterial({
      vertexShader: blockVertShader,
      fragmentShader: blockFragShader,
      uniforms: commonUniforms,
      vertexColors: true,
      depthWrite: true,
      transparent: false,
      side: THREE.DoubleSide
    });

    // 2. Liquid Water material
    this.waterMaterial = new THREE.ShaderMaterial({
      vertexShader: waterVertShader,
      fragmentShader: waterFragShader,
      uniforms: commonUniforms,
      transparent: true,
      depthWrite: false, // Prevents transparent sorting artifacts
      vertexColors: false,
      side: THREE.DoubleSide
    });

    // 3. Liquid Lava material
    this.lavaMaterial = new THREE.ShaderMaterial({
      vertexShader: lavaVertShader,
      fragmentShader: lavaFragShader,
      uniforms: commonUniforms,
      vertexColors: false,
      side: THREE.DoubleSide
    });
  }

  /**
   * Updates/creates the meshes for a specific chunk
   */
  public updateChunkMesh(cx: number, cz: number, solidData: any, transparentData: any): void {
    const key = `${cx},${cz}`;
    const isNewSolid = !this.solidMeshes.has(key);
    const isNewTransparent = !this.transparentMeshes.has(key);

    // 1. Update solid mesh
    this.removeChunkMesh(cx, cz); // clear old

    if (solidData.positions.length > 0) {
      const geom = this.buildGeometry(solidData);
      let mat: THREE.Material = this.blockMaterial;
      
      if (isNewSolid) {
        const clonedMat = this.blockMaterial.clone();
        clonedMat.transparent = true;
        clonedMat.uniforms = THREE.UniformsUtils.clone(this.blockMaterial.uniforms);
        clonedMat.uniforms.uOpacity = { value: 0.0 };
        mat = clonedMat;
      }
      
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      
      this.scene.add(mesh);
      this.solidMeshes.set(key, mesh);

      if (isNewSolid && mat !== this.blockMaterial) {
        this.activeFades.set(key + '_solid', {
          mesh,
          mat: mat as THREE.ShaderMaterial,
          progress: 0
        });
      }
    }

    // 2. Update transparent mesh (water / lava only — fluid blocks)
    if (transparentData.positions.length > 0) {
      const geom = this.buildGeometry(transparentData);
      let mat: THREE.Material = this.waterMaterial;
      
      if (isNewTransparent) {
        const clonedMat = this.waterMaterial.clone();
        clonedMat.transparent = true;
        clonedMat.uniforms = THREE.UniformsUtils.clone(this.waterMaterial.uniforms);
        clonedMat.uniforms.uOpacity = { value: 0.0 };
        mat = clonedMat;
      }
      
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      
      this.scene.add(mesh);
      this.transparentMeshes.set(key, mesh);

      if (isNewTransparent && mat !== this.waterMaterial) {
        this.activeFades.set(key + '_trans', {
          mesh,
          mat: mat as THREE.ShaderMaterial,
          progress: 0
        });
      }
    }
  }

  private buildGeometry(data: any): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uvs), 2));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.colors), 3));
    
    // Explicitly use Uint32Array for indices if the number of vertices exceeds 65535,
    // otherwise fallback to Uint16Array for better compatibility on older/software GPUs.
    const vertexCount = data.positions.length / 3;
    if (vertexCount > 65535) {
      geom.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1));
    } else {
      geom.setIndex(new THREE.BufferAttribute(new Uint16Array(data.indices), 1));
    }
    
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
      if (solidMesh.material !== this.blockMaterial) {
        (solidMesh.material as THREE.Material).dispose();
      }
      this.solidMeshes.delete(key);
    }

    // Dispose transparent
    const transMesh = this.transparentMeshes.get(key);
    if (transMesh) {
      this.scene.remove(transMesh);
      transMesh.geometry.dispose();
      if (transMesh.material !== this.waterMaterial) {
        (transMesh.material as THREE.Material).dispose();
      }
      this.transparentMeshes.delete(key);
    }
    
    this.activeFades.delete(key + '_solid');
    this.activeFades.delete(key + '_trans');
  }

  private onWindowResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private tickFadeAnimations(deltaSec: number): void {
    const fadeDuration = 0.3; // 300ms fade
    for (const [fadeKey, fade] of this.activeFades.entries()) {
      fade.progress += deltaSec;
      const opacity = Math.min(1.0, fade.progress / fadeDuration);
      fade.mat.uniforms.uOpacity.value = opacity;
      
      // Update sun intensity and fog uniforms on the cloned materials
      fade.mat.uniforms.uSunlightIntensity.value = this.blockMaterial.uniforms.uSunlightIntensity.value;
      fade.mat.uniforms.uFogColor.value.copy(this.blockMaterial.uniforms.uFogColor.value);
      fade.mat.uniforms.uFogDensity.value = this.blockMaterial.uniforms.uFogDensity.value;
      fade.mat.uniforms.uTime.value = this.waterMaterial.uniforms.uTime.value;

      if (fade.progress >= fadeDuration) {
        fade.mesh.material = fadeKey.endsWith('_solid') ? this.blockMaterial : this.waterMaterial;
        fade.mat.dispose();
        this.activeFades.delete(fadeKey);
      }
    }
  }

  public render(timeOfDay: number, playerPos: THREE.Vector3, gameTime: number, isNether = false, deltaSec = 0.016): void {
    let fogColor: THREE.Color;
    let sunIntensity: number;

    if (isNether) {
      this.skySystem.setDimension('nether');
      fogColor = new THREE.Color(0.12, 0.03, 0.03); // Dark red Nether fog
      this.scene.fog = new THREE.FogExp2(fogColor, 0.015); // High density cavern fog
      sunIntensity = 0.45; // Constant base light level
    } else {
      this.skySystem.setDimension('overworld');
      // 1. Update Sky elements
      this.skySystem.update(timeOfDay, playerPos);
      fogColor = this.skySystem.getFogColor();
      this.scene.fog = new THREE.FogExp2(fogColor, 0.0035);
      sunIntensity = this.skySystem.getSunlightIntensity();
    }

    this.renderer.setClearColor(fogColor);

    // Update uniforms
    this.blockMaterial.uniforms.uSunlightIntensity.value = sunIntensity;
    this.blockMaterial.uniforms.uFogColor.value.copy(fogColor);
    
    this.waterMaterial.uniforms.uSunlightIntensity.value = sunIntensity;
    this.waterMaterial.uniforms.uFogColor.value.copy(fogColor);
    this.waterMaterial.uniforms.uTime.value = gameTime * 0.001;

    this.lavaMaterial.uniforms.uFogColor.value.copy(fogColor);
    this.lavaMaterial.uniforms.uTime.value = gameTime * 0.001;

    // Tick chunk fade opacity levels
    this.tickFadeAnimations(deltaSec);

    if (!isNether) {
      // Center shadow frustum on player to save draw calls
      this.dirLight.shadow.camera.position.copy(playerPos).add(new THREE.Vector3(50, 100, 30));
      this.dirLight.shadow.camera.lookAt(playerPos);
    }

    // Render main scene pass
    this.renderer.render(this.scene, this.camera);
  }

  public setShadowsEnabled(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled;
    this.dirLight.castShadow = enabled;
    
    // Update existing chunk meshes
    for (const mesh of this.solidMeshes.values()) {
      mesh.castShadow = enabled;
      mesh.receiveShadow = enabled;
      mesh.customDepthMaterial = undefined;
    }
  }

  public clearAllMeshes(): void {
    const keys = Array.from(this.solidMeshes.keys());
    for (const key of keys) {
      const parts = key.split(',');
      this.removeChunkMesh(parseInt(parts[0]), parseInt(parts[1]));
    }
  }

  /* Player Model Helpers & Procedural Skin Generators */
  private createPlayerSkinMaterials(skinName: string) {
    let headColor = '#e0a980'; // skin
    let hairColor = '#604020'; // brown
    let eyeColor = '#305080'; // blue
    let torsoColor = '#00a0a0'; // cyan
    let armColor = '#00a0a0'; // cyan sleeve, skin hand
    let legColor = '#3040a0'; // blue pants, grey shoes

    if (skinName === 'alex') {
      headColor = '#f5c09e';
      hairColor = '#d06010'; // orange
      eyeColor = '#307040'; // green
      torsoColor = '#508030'; // green
      armColor = '#508030';
      legColor = '#705030'; // brown
    } else if (skinName === 'herobrine') {
      headColor = '#e0a980';
      hairColor = '#604020';
      eyeColor = '#ffffff'; // glowing white eyes
      torsoColor = '#00a0a0';
      armColor = '#00a0a0';
      legColor = '#3040a0';
    } else if (skinName === 'muhammad') {
      headColor = '#e0a980';
      hairColor = '#4a2c11';
      eyeColor = '#4b88b0';
      torsoColor = '#6c3483'; // royal purple robe
      armColor = '#6c3483';
      legColor = '#6c3483'; // purple pants
    }

    const makeTexture = (drawFn: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      drawFn(ctx);
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      return texture;
    };

    // Draw Head
    const headTex = makeTexture((ctx) => {
      ctx.fillStyle = headColor;
      ctx.fillRect(0, 0, 64, 64);
      // Hair
      ctx.fillStyle = hairColor;
      ctx.fillRect(0, 0, 64, 20); // Top hair
      ctx.fillRect(0, 20, 16, 20); // Side hair
      ctx.fillRect(48, 20, 16, 20);
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(14, 28, 8, 6);
      ctx.fillRect(42, 28, 8, 6);
      ctx.fillStyle = eyeColor;
      if (skinName !== 'herobrine') {
        ctx.fillRect(18, 28, 4, 6);
        ctx.fillRect(42, 28, 4, 6);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(14, 28, 8, 6);
        ctx.fillRect(42, 28, 8, 6);
      }
      // Mouth
      if (skinName !== 'herobrine') {
        ctx.fillStyle = '#a05040';
        ctx.fillRect(24, 44, 16, 4);
      }
      // Crown for Muhammad
      if (skinName === 'muhammad') {
        ctx.fillStyle = '#f1c40f'; // Gold crown
        ctx.fillRect(6, 0, 52, 10);
        ctx.fillRect(10, 10, 6, 6);
        ctx.fillRect(29, 10, 6, 6);
        ctx.fillRect(48, 10, 6, 6);
      }
    });

    // Draw Torso
    const torsoTex = makeTexture((ctx) => {
      ctx.fillStyle = torsoColor;
      ctx.fillRect(0, 0, 64, 64);
      if (skinName === 'muhammad') {
        // Gold trim for royal robes
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(0, 0, 64, 6);
        ctx.fillRect(28, 6, 8, 58); // vertical sash
      }
    });

    // Draw Arm
    const armTex = makeTexture((ctx) => {
      ctx.fillStyle = armColor;
      ctx.fillRect(0, 0, 64, 44); // sleeve
      ctx.fillStyle = headColor;
      ctx.fillRect(0, 44, 64, 20); // hand
      if (skinName === 'muhammad') {
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(0, 40, 64, 4); // gold cuff
      }
    });

    // Draw Leg
    const legTex = makeTexture((ctx) => {
      ctx.fillStyle = legColor;
      ctx.fillRect(0, 0, 64, 52); // pants
      ctx.fillStyle = '#444444';
      ctx.fillRect(0, 52, 64, 12); // shoes
      if (skinName === 'muhammad') {
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(0, 0, 64, 4); // gold stripe
      }
    });

    return {
      head: new THREE.MeshLambertMaterial({ map: headTex }),
      torso: new THREE.MeshLambertMaterial({ map: torsoTex }),
      arm: new THREE.MeshLambertMaterial({ map: armTex }),
      leg: new THREE.MeshLambertMaterial({ map: legTex })
    };
  }

  public initPlayerModel(): void {
    this.playerGroup = new THREE.Group();
    
    // Create geometries with offset pivots for natural limb swinging
    const headGeom = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    const torsoGeom = new THREE.BoxGeometry(0.38, 0.6, 0.2);
    
    const armGeom = new THREE.BoxGeometry(0.16, 0.6, 0.16);
    armGeom.translate(0, -0.3, 0); // pivot at shoulder
    
    const legGeom = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    legGeom.translate(0, -0.375, 0); // pivot at hip

    this.playerHead = new THREE.Mesh(headGeom);
    this.playerTorso = new THREE.Mesh(torsoGeom);
    this.playerLeftArm = new THREE.Mesh(armGeom);
    this.playerRightArm = new THREE.Mesh(armGeom.clone());
    this.playerLeftLeg = new THREE.Mesh(legGeom);
    this.playerRightLeg = new THREE.Mesh(legGeom.clone());

    // Assemble player model hierarchy
    this.playerGroup.add(this.playerHead);
    this.playerGroup.add(this.playerTorso);
    this.playerGroup.add(this.playerLeftArm);
    this.playerGroup.add(this.playerRightArm);
    this.playerGroup.add(this.playerLeftLeg);
    this.playerGroup.add(this.playerRightLeg);

    // Initial positions relative to group center
    this.playerHead.position.set(0, 1.54, 0);
    this.playerTorso.position.set(0, 1.05, 0);
    this.playerLeftArm.position.set(-0.28, 1.35, 0);
    this.playerRightArm.position.set(0.28, 1.35, 0);
    this.playerLeftLeg.position.set(-0.1, 0.75, 0);
    this.playerRightLeg.position.set(0.1, 0.75, 0);

    // Enable shadows
    this.playerHead.castShadow = true;
    this.playerHead.receiveShadow = true;
    this.playerTorso.castShadow = true;
    this.playerTorso.receiveShadow = true;
    this.playerLeftArm.castShadow = true;
    this.playerLeftArm.receiveShadow = true;
    this.playerRightArm.castShadow = true;
    this.playerRightArm.receiveShadow = true;
    this.playerLeftLeg.castShadow = true;
    this.playerLeftLeg.receiveShadow = true;
    this.playerRightLeg.castShadow = true;
    this.playerRightLeg.receiveShadow = true;

    this.scene.add(this.playerGroup);
  }

  private applyPlayerSkin(skinName: string): void {
    let mats = this.skinMaterialsCache.get(skinName);
    if (!mats) {
      mats = this.createPlayerSkinMaterials(skinName);
      this.skinMaterialsCache.set(skinName, mats);
    }

    this.playerHead!.material = mats.head;
    this.playerTorso!.material = mats.torso;
    this.playerLeftArm!.material = mats.arm;
    this.playerRightArm!.material = mats.arm;
    this.playerLeftLeg!.material = mats.leg;
    this.playerRightLeg!.material = mats.leg;

    this.currentSkinName = skinName;
  }

  public updatePlayerModel(
    pos: THREE.Vector3,
    yaw: number,
    pitch: number,
    velocity: THREE.Vector3,
    skinName: string,
    cameraMode: string,
    isSneaking: boolean,
    time: number
  ): void {
    if (!this.playerGroup) {
      this.initPlayerModel();
    }

    if (cameraMode === 'first') {
      this.playerGroup!.visible = false;
      return;
    }
    this.playerGroup!.visible = true;

    if (this.currentSkinName !== skinName) {
      this.applyPlayerSkin(skinName);
    }

    // Set model position
    this.playerGroup!.position.copy(pos);
    
    // Rotate player model horizontally (offset Math.PI for direct camera alignment)
    this.playerGroup!.rotation.y = yaw + Math.PI;

    // Head tilts vertically
    this.playerHead!.rotation.x = -pitch;

    // Sneaking height adjustments and torso leaning
    if (isSneaking) {
      this.playerTorso!.position.y = 0.95;
      this.playerHead!.position.y = 1.4;
      this.playerLeftArm!.position.y = 1.25;
      this.playerRightArm!.position.y = 1.25;
      this.playerTorso!.rotation.x = 0.25; // lean torso
      this.playerHead!.position.z = 0.08;
    } else {
      this.playerTorso!.position.y = 1.05;
      this.playerHead!.position.y = 1.54;
      this.playerLeftArm!.position.y = 1.35;
      this.playerRightArm!.position.y = 1.35;
      this.playerTorso!.rotation.x = 0.0;
      this.playerHead!.position.z = 0.0;
    }

    // Leg and arm swinging animation
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    if (speed > 0.1) {
      const swingSpeed = 12.0;
      const swingAngle = 0.6 * Math.sin(time * 0.0015 * swingSpeed);

      this.playerLeftLeg!.rotation.x = swingAngle;
      this.playerRightLeg!.rotation.x = -swingAngle;
      this.playerLeftArm!.rotation.x = -swingAngle;
      this.playerRightArm!.rotation.x = swingAngle;
    } else {
      this.playerLeftLeg!.rotation.x = 0;
      this.playerRightLeg!.rotation.x = 0;
      this.playerLeftArm!.rotation.x = 0;
      this.playerRightArm!.rotation.x = 0;
    }
  }

  public createRemotePlayerMesh(skinName: string, name: string): THREE.Group {
    const group = new THREE.Group();
    
    // Geometries
    const headGeom = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    const torsoGeom = new THREE.BoxGeometry(0.38, 0.6, 0.2);
    
    const armGeom = new THREE.BoxGeometry(0.16, 0.6, 0.16);
    armGeom.translate(0, -0.3, 0); // pivot at shoulder
    
    const legGeom = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    legGeom.translate(0, -0.375, 0); // pivot at hip

    const mats = this.createPlayerSkinMaterials(skinName);

    const head = new THREE.Mesh(headGeom, mats.head);
    head.position.set(0, 1.54, 0);
    head.name = 'head';
    group.add(head);

    const torso = new THREE.Mesh(torsoGeom, mats.torso);
    torso.position.set(0, 1.05, 0);
    torso.name = 'torso';
    group.add(torso);

    const leftArm = new THREE.Mesh(armGeom, mats.arm);
    leftArm.position.set(-0.28, 1.35, 0);
    leftArm.name = 'leftArm';
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeom.clone(), mats.arm);
    rightArm.position.set(0.28, 1.35, 0);
    rightArm.name = 'rightArm';
    group.add(rightArm);

    const leftLeg = new THREE.Mesh(legGeom, mats.leg);
    leftLeg.position.set(-0.1, 0.75, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeom.clone(), mats.leg);
    rightLeg.position.set(0.1, 0.75, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // Shadows
    head.castShadow = head.receiveShadow = true;
    torso.castShadow = torso.receiveShadow = true;
    leftArm.castShadow = leftArm.receiveShadow = true;
    rightArm.castShadow = rightArm.receiveShadow = true;
    leftLeg.castShadow = leftLeg.receiveShadow = true;
    rightLeg.castShadow = rightLeg.receiveShadow = true;

    // Create username tag (floating canvas billboard text sprite above head)
    const nameTag = this.createUsernameTag(name);
    nameTag.position.set(0, 1.95, 0);
    nameTag.name = 'nameTag';
    group.add(nameTag);

    this.scene.add(group);
    return group;
  }

  private createUsernameTag(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Draw rounded background semi-transparent black rectangle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    
    // Simple rounded rect check
    if (ctx.roundRect) {
      ctx.roundRect(10, 10, 236, 44, 8);
    } else {
      ctx.rect(10, 10, 236, 44);
    }
    ctx.fill();

    // Draw text
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.2, 0.3, 1.2);
    return sprite;
  }

  public clear(): void {
    // Clean all loaded meshes
    this.clearAllMeshes();
    if (this.playerGroup) {
      this.scene.remove(this.playerGroup);
      this.playerGroup = null;
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}
