/**
 * Tox'sCraft SettingsManager
 * Handles persistent game settings (graphics, audio, gameplay) in localStorage.
 */

export interface GameSettings {
  fov: number;
  renderDistance: number;
  mouseSensitivity: number;
  volumeMaster: number;
  volumeMusic: number;
  volumeAmbient: number;
  volumeEffects: number;
  postProcessing: boolean;
  shadows: boolean;
  viewBobbing: boolean;
  autoJump: boolean;
  showCoordinates: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  fov: 75,
  renderDistance: 4,
  mouseSensitivity: 0.002,
  volumeMaster: 0.8,
  volumeMusic: 0.5,
  volumeAmbient: 0.6,
  volumeEffects: 0.8,
  postProcessing: false,
  shadows: false,
  viewBobbing: true,
  autoJump: false,
  showCoordinates: true
};

class SettingsManager {
  private settings: GameSettings = { ...DEFAULT_SETTINGS };

  constructor() {
    this.load();
  }

  /**
   * Get all settings
   */
  get(): GameSettings {
    return this.settings;
  }

  /**
   * Get a single setting value
   */
  getValue<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this.settings[key];
  }

  /**
   * Set a setting and save
   */
  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  /**
   * Load settings from localStorage
   */
  load(): void {
    try {
      const data = localStorage.getItem('toxscraft_settings');
      if (data) {
        const parsed = JSON.parse(data);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    } catch (e) {
      console.warn('Failed to load settings, using defaults.', e);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to localStorage
   */
  save(): void {
    try {
      localStorage.setItem('toxscraft_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings.', e);
    }
  }

  /**
   * Reset to default settings
   */
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }
}

export const settingsManager = new SettingsManager();
