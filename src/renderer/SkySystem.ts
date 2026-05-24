/**
 * Tox'sCraft SkySystem
 * Creates the celestial sphere, handles star fields, rotates sun/moon, and animates colors.
 */

import * as THREE from 'three';
import skyVertShader from './shaders/sky.vert.glsl';
import skyFragShader from './shaders/sky.frag.glsl';

export class SkySystem {
  private scene: THREE.Scene;
  private skyMesh!: THREE.Mesh;
  private skyMaterial!: THREE.ShaderMaterial;
  private stars!: THREE.Points;
  private starsMaterial!: THREE.PointsMaterial;
  private dirLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  constructor(scene: THREE.Scene, dirLight: THREE.DirectionalLight, ambientLight: THREE.AmbientLight) {
    this.scene = scene;
    this.dirLight = dirLight;
    this.ambientLight = ambientLight;

    this.createSkyDome();
    this.createStarField();
  }

  private createSkyDome(): void {
    // Sky Dome Sphere (render on inside faces)
    const skyGeom = new THREE.SphereGeometry(400, 32, 15);
    
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: skyVertShader,
      fragmentShader: skyFragShader,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3() },
        uSunAltitude: { value: 0.0 },
        uDayColor: { value: new THREE.Color(0.2, 0.55, 0.95) },
        uSunsetColor: { value: new THREE.Color(0.9, 0.35, 0.15) },
        uNightColor: { value: new THREE.Color(0.02, 0.02, 0.08) },
        uHorizonColor: { value: new THREE.Color(0.7, 0.85, 0.95) }
      },
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyMesh = new THREE.Mesh(skyGeom, this.skyMaterial);
    this.scene.add(this.skyMesh);
  }

  private createStarField(): void {
    const starCount = 1200;
    const starGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    // Distribute stars randomly on a dome of radius 380
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      // We only want stars in the upper hemisphere
      const radius = 380;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = Math.abs(radius * Math.cos(phi)); // Keep positive Y
      const z = radius * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      transparent: true,
      opacity: 0.0, // Start invisible during day
      sizeAttenuation: false,
      depthWrite: false
    });

    this.stars = new THREE.Points(starGeom, this.starsMaterial);
    this.scene.add(this.stars);
  }

  /**
   * Updates sky positions, gradients, and light intensity based on time
   * @param time 0 to 1 representing time of day
   * @param playerPos player position to center the sky dome
   */
  public update(time: number, playerPos: THREE.Vector3): void {
    // Center celestial bodies on player
    this.skyMesh.position.copy(playerPos);
    this.stars.position.copy(playerPos);

    // Calculate sun orbit angle (revolve around Z-axis)
    const angle = time * Math.PI * 2 + Math.PI; // offset so 0.0 is morning
    const sunDir = new THREE.Vector3(
      Math.cos(angle),
      Math.sin(angle),
      Math.sin(angle) * 0.2 // slight tilt
    ).normalize();

    const sunAlt = sunDir.y;

    // Update shader uniforms
    this.skyMaterial.uniforms.uSunDirection.value.copy(sunDir);
    this.skyMaterial.uniforms.uSunAltitude.value = sunAlt;

    // Update lights intensity based on altitude
    if (sunAlt > 0.0) {
      // Day
      const intensity = Math.min(1.0, sunAlt * 2.0);
      this.dirLight.intensity = intensity * 1.2;
      this.dirLight.position.copy(sunDir).multiplyScalar(100);
      this.dirLight.visible = true;

      this.ambientLight.color.setRGB(
        0.4 + intensity * 0.2, 
        0.4 + intensity * 0.2, 
        0.5 + intensity * 0.1
      );
      this.ambientLight.intensity = 0.3 + intensity * 0.3;

      // Stars fade out
      this.starsMaterial.opacity = 0.0;
    } else {
      // Night / Twilight
      const intensity = Math.min(1.0, -sunAlt * 4.0);
      this.dirLight.visible = false; // Turn off sun shadows at night
      
      this.ambientLight.color.setRGB(0.08, 0.09, 0.18);
      this.ambientLight.intensity = 0.12;

      // Stars fade in
      this.starsMaterial.opacity = intensity * 0.85;
    }
  }

  /**
   * Returns normalized sunlight intensity (0.1 to 1.0)
   */
  public getSunlightIntensity(): number {
    const sunAlt = this.skyMaterial.uniforms.uSunAltitude.value;
    if (sunAlt > 0.0) {
      return 0.18 + Math.min(0.82, sunAlt * 2.5);
    }
    return 0.18; // soft ambient moon glow
  }

  /**
   * Returns current sky fog color (for blending scene fog)
   */
  public getFogColor(): THREE.Color {
    const sunAlt = this.skyMaterial.uniforms.uSunAltitude.value;
    const dayCol = this.skyMaterial.uniforms.uDayColor.value;
    const setCol = this.skyMaterial.uniforms.uSunsetColor.value;
    const nightCol = this.skyMaterial.uniforms.uNightColor.value;

    const result = new THREE.Color();
    if (sunAlt > 0.1) {
      const t = THREE.MathUtils.smoothstep(sunAlt, 0.1, 0.3);
      result.lerpColors(setCol, dayCol, t);
    } else if (sunAlt > -0.1) {
      const t = (sunAlt - (-0.1)) / 0.2;
      result.lerpColors(nightCol, setCol, t);
    } else {
      result.copy(nightCol);
    }
    return result;
  }
}
