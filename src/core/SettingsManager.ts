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

function detectSoftwareRenderer(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toString().toLowerCase();
      const vendor = (gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '').toString().toLowerCase();
      return (
        renderer.includes('software') ||
        renderer.includes('swiftshader') ||
        renderer.includes('llvmpipe') ||
        renderer.includes('basic render') ||
        vendor.includes('swiftshader')
      );
    }
  } catch (e) {
    // Fallback if context creation fails
  }
  return false;
}

const isSoftware = detectSoftwareRenderer();
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

const DEFAULT_SETTINGS: GameSettings = {
  fov: 75,
  renderDistance: isSoftware ? 2 : (isMobileDevice ? 3 : 4),
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
        
        // Auto-optimize render distance for low-end / software devices on load
        if (isSoftware && this.settings.renderDistance > 3) {
          this.settings.renderDistance = 2;
        } else if (isMobileDevice && this.settings.renderDistance > 4) {
          this.settings.renderDistance = 3;
        }
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
