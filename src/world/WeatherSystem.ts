/**
 * Tox'sCraft WeatherSystem
 * Dynamic weather engine supporting Clear, Rain, Thunderstorm, and Snow.
 * Manages lightning flashes, sky darkening, and atmospheric ambient audio triggers.
 */

import * as THREE from 'three';
import { ParticleSystem } from '../renderer/ParticleSystem';
import { AssetLoader } from '../core/AssetLoader';
import { BiomeDef } from './generation/BiomeRegistry';

export type WeatherType = 'clear' | 'rain' | 'thunder' | 'snow';

export class WeatherSystem {
  private currentWeather: WeatherType = 'clear';
  private weatherTimer = 0;
  private weatherDuration = 180; // 3 minutes per weather cycle

  // Lightning system
  private lightningTimer = 0;
  private isLightningActive = false;
  private lightningIntensity = 0;

  // Sky darkening
  private skyDarkness = 0; // 0 (clear) to 0.4 (dark storm)

  constructor() {
    this.weatherDuration = 120 + Math.random() * 120;
  }

  public getWeather(): WeatherType {
    return this.currentWeather;
  }

  public setWeather(type: WeatherType): void {
    this.currentWeather = type;
    this.weatherTimer = 0;
  }

  public getSkyDarkness(): number {
    return this.skyDarkness;
  }

  public getLightningIntensity(): number {
    return this.lightningIntensity;
  }

  /**
   * Main weather tick
   */
  public update(deltaSec: number, _playerPos: THREE.Vector3, currentBiome: BiomeDef, particleSystem: ParticleSystem): void {
    this.weatherTimer += deltaSec;

    // Automatic weather transition
    if (this.weatherTimer >= this.weatherDuration) {
      this.weatherTimer = 0;
      this.weatherDuration = 120 + Math.random() * 180;

      // Random chance for weather change
      const rand = Math.random();
      if (rand < 0.6) {
        this.currentWeather = 'clear';
      } else if (rand < 0.85) {
        this.currentWeather = (currentBiome.id === 3 || currentBiome.id === 7) ? 'snow' : 'rain'; // Tundra / Snowy
      } else {
        this.currentWeather = 'thunder';
      }
    }

    // Determine target precipitation based on current biome
    let activePrecipitation: 'none' | 'rain' | 'snow' = 'none';
    if (this.currentWeather === 'rain' || this.currentWeather === 'thunder') {
      if (currentBiome.id === 3 || currentBiome.id === 7) {
        activePrecipitation = 'snow';
      } else if (currentBiome.id !== 2 && currentBiome.id !== 9) { // No rain in Desert or Badlands
        activePrecipitation = 'rain';
      }
    } else if (this.currentWeather === 'snow') {
      activePrecipitation = 'snow';
    }

    particleSystem.setWeather(activePrecipitation);

    // Smooth sky darkening
    const targetDarkness = (this.currentWeather === 'thunder') ? 0.45 : (this.currentWeather === 'rain' || this.currentWeather === 'snow') ? 0.25 : 0.0;
    this.skyDarkness += (targetDarkness - this.skyDarkness) * deltaSec * 0.5;

    // Lightning Flash Logic during thunderstorms
    if (this.currentWeather === 'thunder') {
      this.lightningTimer += deltaSec;
      if (this.lightningTimer >= 8.0 + Math.random() * 15.0) {
        this.lightningTimer = 0;
        this.triggerLightning();
      }
    }

    if (this.isLightningActive) {
      this.lightningIntensity -= deltaSec * 4.0;
      if (this.lightningIntensity <= 0) {
        this.lightningIntensity = 0;
        this.isLightningActive = false;
      }
    }
  }

  private triggerLightning(): void {
    this.isLightningActive = true;
    this.lightningIntensity = 2.5; // Flash bright white
    AssetLoader.playSound('thunder' as any);
  }
}
