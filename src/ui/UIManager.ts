/**
 * Tox'sCraft UIManager
 * Controls all DOM overlays, HUD metrics, menu states, click-to-move inventory, and 2x2 crafting.
 */

import { Game, BLOCK_PLACEMENT_MAP } from '../Game';
import { eventBus } from '../EventBus';
import { settingsManager } from '../core/SettingsManager';
import { WorldDatabase, WorldMetadata } from '../save/WorldDatabase';
import { ItemStack, createItemStack } from '../inventory/ItemStack';
import { AssetLoader } from '../core/AssetLoader';
import { AchievementManager } from '../core/AchievementManager';
import { auth, database, signInWithGoogle, signOutUser, onAuthStateChanged, ref, onValue } from '../core/FirebaseManager';
import { BLOCKS } from '../world/BlockRegistry';

export class UIManager {
  private game: Game;

  // DOM Elements
  private activeScreen: HTMLElement | null = null;
  private hudOverlay = document.getElementById('hud-overlay')!;
  private debugPanel = document.getElementById('debug-info')!;

  // Screen Containers
  private screens: { [key: string]: HTMLElement } = {
    landingPage: document.getElementById('landing-page')!,
    mainMenu: document.getElementById('main-menu')!,
    worldSelect: document.getElementById('world-select')!,
    worldCreate: document.getElementById('world-create')!,
    pauseScreen: document.getElementById('pause-screen')!,
    settingsScreen: document.getElementById('settings-screen')!,
    loadingScreen: document.getElementById('loading-screen')!,
    inventoryScreen: document.getElementById('inventory-screen')!,
    craftingTableScreen: document.getElementById('crafting-table-screen')!,
    furnaceScreen: document.getElementById('furnace-screen')!,
    deathScreen: document.getElementById('death-screen')!,
    creditsScreen: document.getElementById('credits-screen')!,
    achievementsScreen: document.getElementById('achievements-screen')!,
    skinsScreen: document.getElementById('skins-screen')!
  };

  // Damage vignette element
  private damageVignette = document.getElementById('damage-vignette');

  // Held item state
  private heldItem: ItemStack | null = null;
  private cursorElement = document.getElementById('cursor-item')!;

  // 2x2 Crafting inputs (indices 0-3) and output slot
  private craftInput: (ItemStack | null)[] = [null, null, null, null];
  private craftOutput: ItemStack | null = null;

  // 3x3 Crafting inputs (indices 0-8) and output slot
  private craftInput3x3: (ItemStack | null)[] = new Array(9).fill(null);
  private craftOutput3x3: ItemStack | null = null;

  // Furnace Smelting State
  private furnaceInput: ItemStack | null = null;
  private furnaceFuel: ItemStack | null = null;
  private furnaceOutput: ItemStack | null = null;
  private furnaceCookProgress = 0;
  private furnaceBurnTimer = 0;

  private itemTextureCache: Map<string, string> = new Map();

  constructor(game: Game) {
    this.game = game;
    this.activeScreen = this.screens.landingPage;

    this.bindButtons();
    this.bindSettings();
    this.initHUD();
    this.initInventoryUI();
    this.init3x3CraftingUI();
    this.initFurnaceUI();

    // Pre-populate multiplayer inputs
    const urlEl = document.getElementById('input-mp-server') as HTMLInputElement;
    const userEl = document.getElementById('input-mp-username') as HTMLInputElement;
    if (urlEl) {
      urlEl.value = localStorage.getItem("mp_server_url") || "wss://toxs-craft-multiplayer.taezeem14.workers.dev/ws";
    }
    if (userEl) {
      userEl.value = localStorage.getItem("mp_username") || "Steve";
    }

    // Google Auth State observer
    onAuthStateChanged(auth, (user) => {
      this.handleAuthStateChange(user);
    });

    // Ping default lobby status
    this.pingDefaultLobby();

    // Mouse tracking for cursor held item
    document.addEventListener('mousemove', (e) => {
      if (this.heldItem) {
        this.cursorElement.style.left = `${e.clientX + 10}px`;
        this.cursorElement.style.top = `${e.clientY + 10}px`;
      }
    });

    // Orientation check for mobile landscape lock
    this.checkOrientation();
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => this.checkOrientation());

    // Listen to Fullscreen change to update buttons
    const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    fsEvents.forEach(evt => {
      document.addEventListener(evt, () => this.updateFullscreenButtons());
    });
  }

  private showScreen(screenKey: string): void {
    if (this.activeScreen) {
      this.activeScreen.classList.add('hidden');
    }
    
    const target = this.screens[screenKey];
    if (target) {
      target.classList.remove('hidden');
      this.activeScreen = target;
    }
  }

  private hideAllScreens(): void {
    if (this.activeScreen) {
      this.activeScreen.classList.add('hidden');
      this.activeScreen = null;
    }
  }

  private handleAuthStateChange(user: any): void {
    const loggedOutEl = document.getElementById('auth-logged-out');
    const loggedInEl = document.getElementById('auth-logged-in');
    const avatarEl = document.getElementById('user-avatar') as HTMLImageElement;
    const nameEl = document.getElementById('user-display-name');

    if (user) {
      if (loggedOutEl) loggedOutEl.classList.add('hidden');
      if (loggedInEl) loggedInEl.classList.remove('hidden');
      if (avatarEl) avatarEl.src = user.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
      if (nameEl) nameEl.textContent = user.displayName || 'Player';
      
      localStorage.setItem('mp_username', user.displayName || 'Player');
      const mpUserEl = document.getElementById('input-mp-username') as HTMLInputElement;
      if (mpUserEl) {
        mpUserEl.value = user.displayName || 'Player';
      }
    } else {
      if (loggedOutEl) loggedOutEl.classList.remove('hidden');
      if (loggedInEl) loggedInEl.classList.add('hidden');
      
      localStorage.setItem('mp_username', 'Steve');
      const mpUserEl = document.getElementById('input-mp-username') as HTMLInputElement;
      if (mpUserEl) {
        mpUserEl.value = 'Steve';
      }
    }
  }

  private checkOrientation(): void {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (window.innerWidth <= 1024 && 'ontouchstart' in window);
    
    const overlay = document.getElementById('orientation-overlay');
    if (!overlay) return;

    if (isMobile && window.innerHeight > window.innerWidth) {
      overlay.classList.remove('hidden');
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } else {
      overlay.classList.add('hidden');
    }
  }

  private toggleFullscreen(): void {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen = docEl.requestFullscreen || (docEl as any).mozRequestFullScreen || (docEl as any).webkitRequestFullScreen || (docEl as any).msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || (doc as any).mozCancelFullScreen || (doc as any).webkitExitFullscreen || (doc as any).msExitFullscreen;

    const isFs = !!(doc.fullscreenElement || (doc as any).mozFullScreenElement || (doc as any).webkitFullscreenElement || (doc as any).msFullscreenElement);

    if (!isFs) {
      if (requestFullScreen) {
        requestFullScreen.call(docEl).catch((err: any) => {
          console.warn(`Error enabling full-screen mode: ${err.message}`);
        });
      }
    } else {
      if (cancelFullScreen) {
        cancelFullScreen.call(doc);
      }
    }
  }

  private updateFullscreenButtons(): void {
    const doc = window.document;
    const isFs = !!(doc.fullscreenElement || (doc as any).mozFullScreenElement || (doc as any).webkitFullScreenElement || (doc as any).msFullscreenElement);
    
    const btnHudFs = document.getElementById('btn-hud-fullscreen');
    if (btnHudFs) {
      btnHudFs.title = isFs ? 'Exit Fullscreen' : 'Enter Fullscreen';
    }
    const btnPauseFs = document.getElementById('btn-pause-fullscreen');
    if (btnPauseFs) {
      btnPauseFs.textContent = isFs ? 'Exit Fullscreen' : 'Toggle Fullscreen';
    }
  }

  private pingDefaultLobby(): void {
    const statusEl = document.getElementById('landing-lobby-status');
    if (!statusEl) return;

    try {
      const connectedRef = ref(database, '.info/connected');
      onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          statusEl.textContent = "Online";
          statusEl.className = "lobby-badge status-online";
        } else {
          statusEl.textContent = "Offline";
          statusEl.className = "lobby-badge status-offline";
        }
      });
    } catch (err) {
      statusEl.textContent = "Offline";
      statusEl.className = "lobby-badge status-offline";
    }
  }

  private bindButtons(): void {
    // 1. Main Menu
    document.getElementById('btn-play')!.addEventListener('click', () => {
      this.renderWorldsList();
      this.showScreen('worldSelect');
    });
    
    document.getElementById('btn-settings')!.addEventListener('click', () => {
      this.showScreen('settingsScreen');
    });

    document.getElementById('btn-credits')!.addEventListener('click', () => {
      this.showScreen('creditsScreen');
    });
    
    document.getElementById('btn-credits-back')!.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    // 2. World Select
    document.getElementById('btn-select-back')!.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    document.getElementById('btn-new-world')!.addEventListener('click', () => {
      this.showScreen('worldCreate');
    });

    // 3. World Create
    document.getElementById('btn-create-back')!.addEventListener('click', () => {
      this.showScreen('worldSelect');
    });

    document.getElementById('btn-create-submit')!.addEventListener('click', async () => {
      const name = (document.getElementById('input-world-name') as HTMLInputElement).value || 'New World';
      const seedInput = (document.getElementById('input-world-seed') as HTMLInputElement).value;
      const seed = seedInput || Math.random().toString(36).substring(2, 9);
      const mode = (document.getElementById('select-game-mode') as HTMLSelectElement).value as 'survival' | 'creative';

      const metadata: WorldMetadata = {
        id: Math.random().toString(36).substring(2, 15),
        name,
        seed,
        gameMode: mode,
        difficulty: 'normal',
        playtime: 0,
        lastPlayed: Date.now()
      };

      await WorldDatabase.saveWorldMetadata(metadata);
      this.showScreen('loadingScreen');
      await this.game.loadWorld(metadata);
    });

    document.getElementById('btn-resume')!.addEventListener('click', () => {
      this.game.togglePause();
    });

    document.getElementById('btn-unstuck')!.addEventListener('click', async () => {
      await this.game.player.teleportToSurface(this.game.chunkManager);
      this.game.togglePause();
    });

    document.getElementById('btn-settings-pause')!.addEventListener('click', () => {
      this.showScreen('settingsScreen');
    });

    document.getElementById('btn-achievements')!.addEventListener('click', () => {
      this.renderAchievementsList();
      this.showScreen('achievementsScreen');
    });

    document.getElementById('btn-achievements-close')!.addEventListener('click', () => {
      this.showScreen('pauseScreen');
    });

    document.getElementById('btn-quit')!.addEventListener('click', async () => {
      this.showScreen('loadingScreen');
      document.getElementById('loading-status')!.textContent = 'Saving chunks...';
      await this.game.saveWorld();
      this.game.stop();
      this.hudOverlay.classList.add('hidden');
      this.showScreen('mainMenu');
    });

    // 5. Death Screen
    document.getElementById('btn-respawn')!.addEventListener('click', () => {
      this.hideAllScreens();
      this.hudOverlay.classList.remove('hidden');
      this.game.respawnPlayer();
    });

    document.getElementById('btn-death-quit')!.addEventListener('click', () => {
      this.game.stop();
      this.hudOverlay.classList.add('hidden');
      this.showScreen('mainMenu');
    });

    // 6. HUD top center utility buttons
    const btnChat = document.getElementById('btn-hud-chat');
    if (btnChat) {
      btnChat.addEventListener('click', () => {
        if (this.game.multiplayerManager.getConnected()) {
          const msg = prompt("Enter chat message:");
          if (msg) {
            this.game.multiplayerManager.sendChatMessage(msg);
          }
        } else {
          this.showToast("Chat: Connect to a multiplayer server first.");
        }
      });
    }

    const btnPause = document.getElementById('btn-hud-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.game.togglePause();
      });
    }

    const btnHudFs = document.getElementById('btn-hud-fullscreen');
    if (btnHudFs) {
      btnHudFs.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    const btnPauseFs = document.getElementById('btn-pause-fullscreen');
    if (btnPauseFs) {
      btnPauseFs.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // Pause screen Skins & POV bindings
    const btnPauseSkins = document.getElementById('btn-pause-skins');
    if (btnPauseSkins) {
      btnPauseSkins.addEventListener('click', () => {
        document.exitPointerLock();
        this.showScreen('skinsScreen');
        this.initSkinsSelectionUI();
      });
    }

    const btnPausePov = document.getElementById('btn-pause-pov');
    if (btnPausePov) {
      btnPausePov.addEventListener('click', () => {
        this.game.toggleCameraMode();
      });
    }

    // Multiplayer connect button inside pause menu
    const btnMpConnect = document.getElementById('btn-mp-connect');
    if (btnMpConnect) {
      btnMpConnect.addEventListener('click', () => {
        if (this.game.multiplayerManager.getConnected()) {
          this.game.multiplayerManager.disconnect();
        } else {
          const urlEl = document.getElementById('input-mp-server') as HTMLInputElement;
          const userEl = document.getElementById('input-mp-username') as HTMLInputElement;
          const url = urlEl.value || "wss://toxs-craft-multiplayer.taezeem14.workers.dev/ws";
          const username = userEl.value || "Steve";
          
          localStorage.setItem("mp_server_url", url);
          localStorage.setItem("mp_username", username);

          this.game.multiplayerManager.connect(url, username);
        }
      });
    }

    // Google Auth & Landing Page Actions
    const btnGoogleLogin = document.getElementById('btn-google-login');
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener('click', async () => {
        try {
          await signInWithGoogle();
          this.showToast("Signed in with Google!");
        } catch (err: any) {
          console.error(err);
          this.showToast("Google Auth error: " + err.message);
        }
      });
    }

    const btnGoogleLogout = document.getElementById('btn-google-logout');
    if (btnGoogleLogout) {
      btnGoogleLogout.addEventListener('click', async () => {
        try {
          await signOutUser();
          this.showToast("Signed out.");
        } catch (err: any) {
          console.error(err);
        }
      });
    }

    const btnEnterGame = document.getElementById('btn-enter-game');
    if (btnEnterGame) {
      btnEnterGame.addEventListener('click', () => {
        this.showScreen('mainMenu');
      });
    }

    // 7. Skins Selection screen buttons
    document.getElementById('btn-skins-close')!.addEventListener('click', () => {
      this.hideAllScreens();
      this.game.inputManager.requestLock();
    });

    const skinOptions = document.querySelectorAll('.skin-option');
    skinOptions.forEach((option) => {
      option.addEventListener('click', () => {
        skinOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        const skinName = option.getAttribute('data-skin') || 'steve';
        settingsManager.set('skin', skinName);
        eventBus.emit('show_toast', `Selected Skin: ${skinName.toUpperCase()}`);
      });
    });

    // 8. 3x3 Crafting Table & Furnace screen close buttons and events
    const btnCloseCraft3x3 = document.getElementById('btn-close-crafting-table');
    if (btnCloseCraft3x3) {
      btnCloseCraft3x3.addEventListener('click', () => {
        this.hideAllScreens();
        this.hudOverlay.classList.remove('hidden');
        this.game.inputManager.requestLock();
      });
    }

    const btnCloseFurnace = document.getElementById('btn-close-furnace');
    if (btnCloseFurnace) {
      btnCloseFurnace.addEventListener('click', () => {
        this.hideAllScreens();
        this.hudOverlay.classList.remove('hidden');
        this.game.inputManager.requestLock();
      });
    }

    eventBus.on('open_crafting_table_3x3', () => {
      document.exitPointerLock();
      this.showScreen('craftingTableScreen');
      this.drawCraftingTableSlots();
    });

    eventBus.on('open_furnace', () => {
      document.exitPointerLock();
      this.showScreen('furnaceScreen');
      this.drawFurnaceSlots();
    });

    eventBus.on('player_hurt', () => {
      if (this.damageVignette) {
        this.damageVignette.classList.add('active');
        setTimeout(() => this.damageVignette?.classList.remove('active'), 250);
      }
    });
  }

  private bindSettings(): void {
    const fovSlider = document.getElementById('slide-fov') as HTMLInputElement;
    const sensSlider = document.getElementById('slide-sens') as HTMLInputElement;
    const volSlider = document.getElementById('slide-vol') as HTMLInputElement;
    const postCheck = document.getElementById('check-post') as HTMLInputElement;
    const shadowsCheck = document.getElementById('check-shadows') as HTMLInputElement;
    const renderSlider = document.getElementById('slide-render') as HTMLInputElement;
    const coordsCheck = document.getElementById('check-coords') as HTMLInputElement;

    // Events
    fovSlider.addEventListener('input', () => {
      const val = parseInt(fovSlider.value);
      document.getElementById('val-fov')!.textContent = val.toString();
      settingsManager.set('fov', val);
      if (this.game.renderer && this.game.renderer.camera) {
        this.game.renderer.camera.fov = val;
        this.game.renderer.camera.updateProjectionMatrix();
      }
    });

    sensSlider.addEventListener('input', () => {
      const val = parseInt(sensSlider.value);
      document.getElementById('val-sens')!.textContent = val.toString();
      settingsManager.set('mouseSensitivity', val / 25000);
    });

    volSlider.addEventListener('input', () => {
      const val = parseInt(volSlider.value);
      document.getElementById('val-vol')!.textContent = `${val}%`;
      settingsManager.set('volumeMaster', val / 100);
    });

    postCheck.addEventListener('change', () => {
      settingsManager.set('postProcessing', postCheck.checked);
    });

    shadowsCheck.addEventListener('change', () => {
      settingsManager.set('shadows', shadowsCheck.checked);
      if (this.game.renderer) {
        this.game.renderer.setShadowsEnabled(shadowsCheck.checked);
      }
    });

    renderSlider.addEventListener('input', () => {
      const val = parseInt(renderSlider.value);
      document.getElementById('val-render')!.textContent = val.toString();
      settingsManager.set('renderDistance', val);
      if (this.game.chunkManager) {
        this.game.chunkManager.setRenderDistance(val);
      }
    });

    coordsCheck.addEventListener('change', () => {
      settingsManager.set('showCoordinates', coordsCheck.checked);
      if (coordsCheck.checked) {
        this.debugPanel.classList.remove('hidden');
      } else {
        this.debugPanel.classList.add('hidden');
      }
    });

    document.getElementById('btn-settings-save')!.addEventListener('click', () => {
      if (this.game.activeWorld) {
        this.showScreen('pauseScreen');
      } else {
        this.showScreen('mainMenu');
      }
    });

    // Run initial sync
    this.syncSettingsUI();
  }

  public syncSettingsUI(): void {
    const fovSlider = document.getElementById('slide-fov') as HTMLInputElement;
    const sensSlider = document.getElementById('slide-sens') as HTMLInputElement;
    const volSlider = document.getElementById('slide-vol') as HTMLInputElement;
    const postCheck = document.getElementById('check-post') as HTMLInputElement;
    const shadowsCheck = document.getElementById('check-shadows') as HTMLInputElement;
    const renderSlider = document.getElementById('slide-render') as HTMLInputElement;
    const coordsCheck = document.getElementById('check-coords') as HTMLInputElement;

    const settings = settingsManager.get();
    if (fovSlider) {
      fovSlider.value = settings.fov.toString();
      const valFov = document.getElementById('val-fov');
      if (valFov) valFov.textContent = settings.fov.toString();
    }
    if (sensSlider) {
      sensSlider.value = (settings.mouseSensitivity * 25000).toString();
      const valSens = document.getElementById('val-sens');
      if (valSens) valSens.textContent = Math.round(settings.mouseSensitivity * 25000).toString();
    }
    if (volSlider) {
      volSlider.value = (settings.volumeMaster * 100).toString();
      const valVol = document.getElementById('val-vol');
      if (valVol) valVol.textContent = `${Math.round(settings.volumeMaster * 100)}%`;
    }
    if (postCheck) postCheck.checked = settings.postProcessing;
    if (shadowsCheck) shadowsCheck.checked = settings.shadows;
    if (renderSlider) {
      renderSlider.value = settings.renderDistance.toString();
      const valRender = document.getElementById('val-render');
      if (valRender) valRender.textContent = settings.renderDistance.toString();
    }
    if (coordsCheck) {
      coordsCheck.checked = settings.showCoordinates;
      if (settings.showCoordinates) {
        this.debugPanel.classList.remove('hidden');
      } else {
        this.debugPanel.classList.add('hidden');
      }
    }
  }

  public showToast(message: string): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    
    container.appendChild(el);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s ease';
      setTimeout(() => el.remove(), 500);
    }, 3000);
  }

  public showAchievementToast(message: string): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'toast toast-gold';
    el.textContent = message;

    container.appendChild(el);

    // Auto-remove after 4 seconds (slightly longer for achievements)
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s ease';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  }

  private initHUD(): void {
    // Setup listeners for updates
    eventBus.on('player_status_change', () => this.drawHUDVitals());
    eventBus.on('hotbar_change', () => this.drawHotbarSelection());
    eventBus.on('inventory_update', () => {
      this.drawHUDVitals();
      this.drawHotbarSelection();
    });
    eventBus.on('player_xp_change', () => this.drawHUDVitals());
    eventBus.on('player_level_up', (level: number) => {
      this.showToast(`✨ LEVEL UP! You reached Level ${level} ✨`);
      AssetLoader.playLevelUpSound();
    });
    eventBus.on('show_toast', (msg: string) => {
      // Achievement toasts (prefixed with 🏆) get gold styling
      if (msg.startsWith('🏆')) {
        this.showAchievementToast(msg);
      } else {
        this.showToast(msg);
      }
    });
    eventBus.on('settings_changed', () => {
      this.syncSettingsUI();
    });

    // F3 debug key bindings toggle
    eventBus.on('keydown', (code: string) => {
      if (code === 'KeyF') { // Cheat flying / debug toggle
        // Toggle F3 display
        const show = settingsManager.getValue('showCoordinates');
        settingsManager.set('showCoordinates', !show);
        const checkEl = document.getElementById('check-coords') as HTMLInputElement;
        if (checkEl) checkEl.checked = !show;
        if (!show) this.debugPanel.classList.remove('hidden');
        else this.debugPanel.classList.add('hidden');
      }
    });

    // Load progress
    eventBus.on('loading_progress', (status: string, val: number) => {
      document.getElementById('loading-status')!.textContent = status;
      document.getElementById('progress-fill')!.style.width = `${val}%`;
    });

    eventBus.on('loading_complete', () => {
      this.hideAllScreens();
      this.hudOverlay.classList.remove('hidden');
    });

    eventBus.on('pause_toggle', (paused: boolean) => {
      if (paused) {
        this.showScreen('pauseScreen');
      } else {
        this.hideAllScreens();
      }
    });

    eventBus.on('player_die', () => {
      document.exitPointerLock();
      this.showScreen('deathScreen');
      this.hudOverlay.classList.add('hidden');
    });

    // Tick FPS / Coordinates display
    eventBus.on('time_change', () => {}); // placeholder

    setInterval(() => {
      if (!this.game.activeWorld || this.game.player.isDead) return;

      // Coordinate updates
      const p = this.game.player.position;
      document.getElementById('coords-val')!.textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
      
      const cx = Math.floor(p.x / 16);
      const cz = Math.floor(p.z / 16);
      document.getElementById('chunk-val')!.textContent = `${cx}, ${cz}`;

      // Biome look
      const biome = this.game.chunkManager.getBiomeAt(p.x, p.z);
      document.getElementById('biome-val')!.textContent = biome.name;

      // Weather look
      const weatherEl = document.getElementById('weather-val');
      if (weatherEl) {
        weatherEl.textContent = this.game.weatherSystem.getWeather().toUpperCase();
      }

      // Time string
      document.getElementById('time-val')!.textContent = this.game.dayNightCycle.getTimeString();

      // Tick active furnace
      this.tickFurnace(0.1);
    }, 100);

    // Bind click/touch events to HUD hotbar slots
    const hudSlots = document.querySelectorAll('#hotbar .hotbar-slot');
    hudSlots.forEach((slot, idx) => {
      const selectFn = (e: Event) => {
        e.stopPropagation();
        if (this.game.player) {
          this.game.player.inventory.setHotbarSlotIndex(idx);
        }
      };
      slot.addEventListener('click', selectFn);
      slot.addEventListener('touchstart', selectFn);
    });
  }

  private drawHUDVitals(): void {
    const healthRow = document.getElementById('health-bar')!;
    const hungerRow = document.getElementById('hunger-bar')!;
    const armorRow = document.getElementById('armor-bar');
    const oxygenRow = document.getElementById('oxygen-bar');
    const statusContainer = document.querySelector('.hud-status-bars-wrapper') as HTMLElement;
    const xpContainer = document.querySelector('.xp-container') as HTMLElement;

    if (this.game.player && this.game.player.isCreative) {
      if (statusContainer) statusContainer.style.display = 'none';
      if (xpContainer) xpContainer.style.display = 'none';
      return;
    } else {
      if (statusContainer) statusContainer.style.display = 'flex';
      if (xpContainer) xpContainer.style.display = 'flex';
    }

    // 1. Armor Bar (10 Shields = 20 Armor Points)
    if (armorRow && this.game.player) {
      const armorPoints = this.game.player.getArmorPoints();
      if (armorPoints > 0) {
        armorRow.style.display = 'flex';
        let armorStr = '';
        const fullShields = Math.floor(armorPoints / 2);
        const halfShield = (armorPoints % 2 >= 1);
        for (let i = 0; i < 10; i++) {
          if (i < fullShields) armorStr += '<span style="color: #bdc3c7">🛡️</span>';
          else if (i === fullShields && halfShield) armorStr += '<span style="color: #bdc3c7; opacity: 0.65">🛡️</span>';
          else armorStr += '<span style="opacity: 0">🛡️</span>';
        }
        armorRow.innerHTML = armorStr;
      } else {
        armorRow.innerHTML = '';
      }
    }

    // 2. Oxygen Bar (10 Bubbles)
    if (oxygenRow && this.game.player) {
      const player = this.game.player;
      if (player.isUnderwater || player.oxygen < player.maxOxygen) {
        oxygenRow.classList.remove('hidden');
        oxygenRow.style.display = 'flex';
        let o2Str = '';
        const bubbles = Math.ceil((player.oxygen / player.maxOxygen) * 10);
        for (let i = 0; i < 10; i++) {
          if (i < bubbles) o2Str += '<span style="color: #00d2d3">🫧</span>';
          else o2Str += '<span style="color: #444; opacity: 0.3">🫧</span>';
        }
        oxygenRow.innerHTML = o2Str;
        oxygenRow.style.display = 'flex';
      } else {
        oxygenRow.classList.add('hidden');
        oxygenRow.style.display = 'none';
      }
    }

    // 3. 10 hearts maximum (20 HP)
    let hpStr = '';
    const fullHearts = Math.floor(this.game.player.health / 2);
    const halfHeart = this.game.player.health % 2 >= 1;
    
    for (let i = 0; i < 10; i++) {
      if (i < fullHearts) hpStr += '<span style="color: var(--color-danger)">❤</span>';
      else if (i === fullHearts && halfHeart) hpStr += '<span style="color: var(--color-danger); opacity:0.65">❤</span>';
      else hpStr += '<span style="color: #444">❤</span>';
    }
    healthRow.innerHTML = hpStr;

    // 4. 10 hunger drumsticks (20 points)
    let foodStr = '';
    const fullFood = Math.floor(this.game.player.hunger / 2);
    const halfFood = this.game.player.hunger % 2 >= 1;
    for (let i = 0; i < 10; i++) {
      if (i < fullFood) foodStr += '<span style="color: #c9803b">🍖</span>';
      else if (i === fullFood && halfFood) foodStr += '<span style="color: #c9803b; opacity:0.65">🍖</span>';
      else foodStr += '<span style="color: #444">🍖</span>';
    }
    hungerRow.innerHTML = foodStr;

    // 5. XP and Level rendering
    const xpLevelEl = document.getElementById('xp-level');
    const xpFillEl = document.getElementById('xp-fill');
    if (xpLevelEl && xpFillEl && this.game.player) {
      const player = this.game.player;
      xpLevelEl.textContent = `LVL ${player.level}`;
      const xpNeeded = player.getXpNeeded();
      const pct = Math.min(100, Math.max(0, (player.xp / xpNeeded) * 100));
      xpFillEl.style.width = `${pct}%`;
    }
  }

  private drawHotbarSelection(): void {
    const active = this.game.player.inventory.getHotbarSlotIndex();
    const slots = document.querySelectorAll('#hotbar .hotbar-slot');
    
    slots.forEach((s, idx) => {
      if (idx === active) s.classList.add('selected');
      else s.classList.remove('selected');

      const stack = this.game.player.inventory.getItem(idx);
      this.renderSlotItem(s as HTMLElement, stack);
    });
  }

  private renderSlotItem(slotEl: HTMLElement, stack: ItemStack | null): void {
    const slotNumberEl = slotEl.querySelector('.slot-number');
    slotEl.innerHTML = '';
    if (slotNumberEl) slotEl.appendChild(slotNumberEl);
    if (!stack) return;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-slot';

    const icon = document.createElement('div');
    icon.className = 'item-texture';
    icon.style.backgroundImage = `url(${this.getItemTexture(stack.id)})`;
    icon.style.backgroundSize = '100% 100%';
    icon.style.imageRendering = 'pixelated';
    icon.style.border = '2px solid rgba(0,0,0,0.2)';
    icon.style.borderRadius = '4px';

    itemDiv.appendChild(icon);

    if (stack.count > 1) {
      const countLabel = document.createElement('div');
      countLabel.className = 'item-count';
      countLabel.textContent = stack.count.toString();
      itemDiv.appendChild(countLabel);
    }

    // Durability Meter
    if (stack.durability !== undefined && stack.maxDurability) {
      const barContainer = document.createElement('div');
      barContainer.className = 'durability-bar-container';

      const durPct = Math.max(0, Math.min(100, (stack.durability / stack.maxDurability) * 100));
      const fill = document.createElement('div');
      fill.className = 'durability-bar-fill';
      fill.style.width = `${durPct}%`;
      
      if (durPct > 60) fill.style.backgroundColor = '#2ecc71';
      else if (durPct > 25) fill.style.backgroundColor = '#f1c40f';
      else fill.style.backgroundColor = '#e74c3c';

      barContainer.appendChild(fill);
      itemDiv.appendChild(barContainer);
    }

    slotEl.appendChild(itemDiv);
  }

  private getItemColor(itemId: string): string {
    if (itemId.includes('pickaxe')) return '#5f9ea0';
    if (itemId.includes('sword')) return '#48c9b0';
    if (itemId.includes('axe')) return '#a569bd';
    if (itemId.includes('shovel')) return '#f5b041';
    if (itemId === 'flint_and_steel') return '#7f8c8d';
    if (itemId.includes('stone') || itemId === 'cobblestone') return '#7f8c8d';
    if (itemId === 'dirt') return '#8b5a2b';
    if (itemId === 'grass_block') return '#2ecc71';
    if (itemId === 'sand') return '#f1c40f';
    if (itemId === 'apple') return '#e74c3c';
    if (itemId === 'bread') return '#f5cbf7';
    if (itemId === 'cooked_beef') return '#a04000';
    if (itemId === 'cooked_porkchop') return '#f5b041';
    if (itemId === 'torch') return '#e67e22';
    if (itemId === 'oak_log') return '#8e44ad';
    if (itemId === 'mycelium') return '#8a6c8a';
    if (itemId === 'terracotta') return '#d17d4f';
    if (itemId === 'red_mushroom_block') return '#e74c3c';
    if (itemId === 'brown_mushroom_block') return '#795548';
    if (itemId === 'mushroom_stem') return '#f5f5dc';
    if (itemId === 'acacia_log') return '#e67e22';
    if (itemId === 'acacia_leaves') return '#27ae60';
    if (itemId === 'obsidian') return '#3a1f5d';
    if (itemId === 'netherrack') return '#7f0000';
    if (itemId === 'soul_sand') return '#4d3926';
    if (itemId === 'nether_portal') return '#9b59b6';
    if (itemId === 'glowstone') return '#f39c12';
    if (itemId === 'diamond') return '#33ffff';
    if (itemId === 'coal') return '#2c3e50';
    if (itemId === 'raw_iron') return '#d98880';
    if (itemId === 'raw_gold') return '#f1c40f';
    if (itemId === 'redstone_dust') return '#c0392b';
    if (itemId === 'emerald') return '#2ecc71';
    if (itemId === 'lapis_lazuli') return '#2980b9';
    return '#bdc3c7'; // default light gray
  }

  private getItemTexture(itemId: string): string {
    if (this.itemTextureCache.has(itemId)) {
      return this.itemTextureCache.get(itemId)!;
    }

    const tileSize = 16;
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    (ctx as any).mozImageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    (ctx as any).msImageSmoothingEnabled = false;

    // Helper to draw pixel
    const p = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    };

    // Helper to fill rectangle
    const r = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };

    // Check if it's a block
    const blockId = BLOCK_PLACEMENT_MAP[itemId];
    if (blockId !== undefined) {
      // It's a block, extract from texture atlas!
      try {
        const atlas = AssetLoader.getTextureAtlas().image as HTMLCanvasElement;
        const bDef = BLOCKS[blockId];
        // Use top texture for grass block or chest/furnace top, otherwise side/top
        let texIdx = bDef.textures.side;
        if (itemId === 'grass_block' || itemId === 'crafting_table' || itemId === 'furnace' || itemId === 'chest') {
          texIdx = bDef.textures.top;
        }
        
        const col = texIdx % 16;
        const row = Math.floor(texIdx / 16);
        ctx.drawImage(atlas, col * tileSize, row * tileSize, tileSize, tileSize, 0, 0, tileSize, tileSize);
        
        const dataUrl = canvas.toDataURL();
        this.itemTextureCache.set(itemId, dataUrl);
        return dataUrl;
      } catch (err) {
        console.warn("Failed to extract block texture:", err);
      }
    }

    // It's a non-block item or tool
    // Clear canvas transparent
    ctx.clearRect(0, 0, 16, 16);

    // Resolve color base for tools
    let toolColor = '#fff';
    let handleColor = '#85633e'; // Wood stick
    if (itemId.startsWith('wood_')) toolColor = '#9c7c5d';
    else if (itemId.startsWith('stone_')) toolColor = '#808080';
    else if (itemId.startsWith('iron_')) toolColor = '#dcdde1';
    else if (itemId.startsWith('gold_')) toolColor = '#fbc531';
    else if (itemId.startsWith('diamond_')) toolColor = '#00a8ff';

    if (itemId.includes('pickaxe')) {
      // Diagonal handle
      for (let i = 2; i <= 12; i++) {
        p(i, 14 - i, handleColor);
      }
      // Pickaxe head
      r(9, 2, 4, 2, toolColor);
      r(11, 4, 2, 2, toolColor);
      r(13, 6, 2, 2, toolColor);
      r(7, 0, 4, 2, toolColor);
      r(5, 2, 2, 2, toolColor);
      r(3, 4, 2, 2, toolColor);
      // Dark tips / highlights
      p(2, 5, '#2f3640');
      p(14, 7, '#2f3640');
    } 
    else if (itemId.includes('sword')) {
      // Diagonal handle
      p(1, 14, '#2f3640');
      p(2, 13, handleColor);
      p(3, 12, handleColor);
      // Guard
      p(2, 11, '#718093');
      p(3, 11, '#718093');
      p(4, 11, '#718093');
      p(4, 12, '#718093');
      p(4, 13, '#718093');
      // Blade
      for (let i = 4; i <= 12; i++) {
        p(i, 15 - i, toolColor);
        p(i + 1, 14 - i, toolColor);
      }
      p(13, 2, '#fff'); // tip shine
    } 
    else if (itemId.includes('axe') && !itemId.includes('pickaxe')) {
      // Diagonal handle
      for (let i = 2; i <= 13; i++) {
        p(i, 15 - i, handleColor);
      }
      // Axe head
      r(10, 1, 4, 4, toolColor);
      r(9, 2, 2, 4, toolColor);
      r(8, 3, 2, 2, toolColor);
    } 
    else if (itemId.includes('shovel')) {
      // Diagonal handle
      for (let i = 2; i <= 12; i++) {
        p(i, 15 - i, handleColor);
      }
      // Shovel head
      r(11, 2, 3, 3, toolColor);
      p(10, 4, toolColor);
      p(12, 1, toolColor);
    } 
    else if (itemId === 'apple') {
      // Apple shape
      r(5, 4, 6, 8, '#e74c3c');
      r(4, 5, 8, 6, '#e74c3c');
      p(6, 3, '#27ae60'); // leaf
      p(7, 3, '#85633e'); // stem
      p(5, 5, '#ff8080'); // shine
    } 
    else if (itemId === 'bread') {
      r(3, 5, 10, 6, '#f3a663');
      r(4, 4, 8, 8, '#d35400');
      // Lines
      p(5, 5, '#e67e22');
      p(8, 5, '#e67e22');
      p(11, 5, '#e67e22');
    } 
    else if (itemId === 'cooked_beef') {
      r(4, 4, 8, 7, '#a04000');
      r(3, 5, 10, 5, '#78281f');
      p(6, 6, '#e74c3c');
      p(8, 7, '#e74c3c');
    } 
    else if (itemId === 'cooked_porkchop') {
      r(3, 5, 8, 6, '#e59866');
      r(4, 4, 6, 8, '#ba4a00');
      p(11, 10, '#fdfefe'); // bone
      p(12, 11, '#fdfefe');
    } 
    else if (itemId === 'diamond') {
      r(6, 4, 4, 8, '#33ffff');
      r(4, 6, 8, 4, '#33ffff');
      p(5, 5, '#ffffff'); // shine
      p(10, 10, '#2980b9');
    } 
    else if (itemId === 'coal') {
      r(5, 5, 6, 6, '#2c3e50');
      p(4, 6, '#1a252f');
      p(11, 9, '#1a252f');
    } 
    else if (itemId === 'raw_iron') {
      r(5, 5, 6, 6, '#d98880');
      p(4, 7, '#f5b041');
    } 
    else if (itemId === 'raw_gold') {
      r(5, 5, 6, 6, '#f1c40f');
      p(4, 7, '#f39c12');
    } 
    else if (itemId === 'redstone_dust') {
      p(5, 6, '#c0392b');
      p(8, 5, '#e74c3c');
      p(6, 9, '#c0392b');
      p(9, 8, '#e74c3c');
    } 
    else if (itemId === 'emerald') {
      r(6, 4, 4, 8, '#2ecc71');
      r(4, 6, 8, 4, '#27ae60');
      p(6, 6, '#fff');
    } 
    else if (itemId === 'lapis_lazuli') {
      r(5, 5, 6, 6, '#2980b9');
      p(4, 6, '#1f3a52');
    } 
    else if (itemId === 'iron_ingot') {
      r(4, 5, 8, 5, '#ecf0f1');
      r(5, 6, 6, 3, '#bdc3c7');
      p(4, 5, '#fff');
    }
    else if (itemId === 'gold_ingot') {
      r(4, 5, 8, 5, '#f1c40f');
      r(5, 6, 6, 3, '#f39c12');
      p(4, 5, '#fef9e7');
    }
    else if (itemId === 'bow') {
      p(3, 3, '#85633e'); p(4, 2, '#85633e'); p(5, 2, '#85633e'); p(6, 3, '#85633e');
      p(2, 4, '#85633e'); p(2, 5, '#85633e'); p(2, 6, '#85633e'); p(3, 7, '#85633e');
      p(4, 8, '#85633e'); p(5, 8, '#85633e'); p(6, 7, '#85633e');
      // String
      for (let y = 3; y <= 7; y++) p(7, y, '#ecf0f1');
    }
    else if (itemId === 'arrow') {
      for (let i = 3; i <= 11; i++) p(i, 14 - i, '#85633e');
      // Flint head
      p(11, 2, '#7f8c8d'); p(12, 3, '#7f8c8d'); p(12, 2, '#bdc3c7');
      // Feathers
      p(3, 12, '#ecf0f1'); p(2, 11, '#ecf0f1');
    }
    else if (itemId.includes('helmet')) {
      const col = itemId.startsWith('diamond') ? '#00d2d3' : (itemId.startsWith('iron') ? '#dcdde1' : '#85633e');
      r(3, 3, 10, 5, col);
      r(3, 8, 3, 4, col);
      r(10, 8, 3, 4, col);
      p(4, 4, '#fff'); // shine
    }
    else if (itemId.includes('chestplate')) {
      const col = itemId.startsWith('diamond') ? '#00d2d3' : (itemId.startsWith('iron') ? '#dcdde1' : '#85633e');
      r(3, 3, 10, 9, col);
      r(6, 3, 4, 3, 'rgba(0,0,0,0)'); // neck cutout
      r(1, 3, 2, 6, col); // left shoulder
      r(13, 3, 2, 6, col); // right shoulder
      p(4, 5, '#fff'); // shine
    }
    else if (itemId.includes('leggings')) {
      const col = itemId.startsWith('diamond') ? '#00d2d3' : (itemId.startsWith('iron') ? '#dcdde1' : '#85633e');
      r(4, 2, 8, 4, col);
      r(4, 6, 3, 7, col);
      r(9, 6, 3, 7, col);
      p(5, 3, '#fff');
    }
    else if (itemId.includes('boots')) {
      const col = itemId.startsWith('diamond') ? '#00d2d3' : (itemId.startsWith('iron') ? '#dcdde1' : '#85633e');
      r(3, 5, 4, 7, col);
      r(9, 5, 4, 7, col);
      p(3, 11, col); p(9, 11, col);
      p(4, 6, '#fff');
    }
    else if (itemId === 'gunpowder') {
      r(5, 6, 6, 5, '#7f8c8d');
      p(4, 7, '#95a5a6'); p(11, 8, '#95a5a6');
    }
    else if (itemId === 'string') {
      p(4, 4, '#ecf0f1'); p(5, 5, '#ecf0f1'); p(6, 6, '#ecf0f1'); p(7, 8, '#ecf0f1'); p(8, 9, '#ecf0f1'); p(10, 11, '#ecf0f1');
    }
    else if (itemId === 'feather') {
      for (let i = 3; i <= 11; i++) p(i, 14 - i, '#bdc3c7');
      r(5, 4, 4, 4, '#ecf0f1');
      r(8, 2, 3, 3, '#fff');
    }
    else if (itemId === 'bone') {
      for (let i = 4; i <= 11; i++) p(i, 15 - i, '#ecf0f1');
      p(3, 12, '#bdc3c7'); p(3, 11, '#bdc3c7');
      p(11, 3, '#fff'); p(12, 3, '#fff');
    }
    else if (itemId === 'rotten_flesh') {
      r(4, 5, 8, 6, '#962d22');
      p(6, 7, '#27ae60'); p(9, 6, '#1e824c');
    }
    else if (itemId === 'slime_ball') {
      r(4, 5, 8, 6, '#2ecc71');
      r(5, 4, 6, 8, '#2ecc71');
      p(6, 6, '#a8e6cf');
    }
    else if (itemId === 'golden_apple') {
      r(5, 4, 6, 8, '#f1c40f');
      r(4, 5, 8, 6, '#f1c40f');
      p(6, 3, '#27ae60');
      p(7, 3, '#85633e');
      p(5, 5, '#fff');
    }
    else if (itemId === 'stick') {
      for (let i = 2; i <= 13; i++) {
        p(i, 15 - i, '#85633e');
      }
    } 
    else if (itemId === 'flint_and_steel') {
      // Steel
      r(4, 6, 3, 5, '#bdc3c7');
      p(3, 8, '#7f8c8d');
      // Flint
      r(8, 8, 4, 3, '#34495e');
    } 
    else {
      // Fallback: Fill slot with solid color
      ctx.fillStyle = this.getItemColor(itemId);
      ctx.fillRect(2, 2, 12, 12);
    }

    const dataUrl = canvas.toDataURL();
    this.itemTextureCache.set(itemId, dataUrl);
    return dataUrl;
  }

  private updateCursorElement(): void {
    if (this.heldItem) {
      this.cursorElement.classList.remove('hidden');
      this.cursorElement.style.backgroundImage = `url(${this.getItemTexture(this.heldItem.id)})`;
      this.cursorElement.style.backgroundSize = '100% 100%';
      this.cursorElement.style.imageRendering = 'pixelated';
      this.cursorElement.style.border = '2px solid #fff';
      this.cursorElement.style.width = '32px';
      this.cursorElement.style.height = '32px';
      this.cursorElement.style.pointerEvents = 'none';
      
      this.cursorElement.innerHTML = '';
      if (this.heldItem.count > 1) {
        const countLabel = document.createElement('div');
        countLabel.className = 'item-count';
        countLabel.style.position = 'absolute';
        countLabel.style.bottom = '2px';
        countLabel.style.right = '2px';
        countLabel.style.fontSize = '12px';
        countLabel.style.color = '#fff';
        countLabel.style.textShadow = '1px 1px 2px #000';
        countLabel.style.fontFamily = 'monospace';
        countLabel.textContent = this.heldItem.count.toString();
        this.cursorElement.appendChild(countLabel);
      }
    } else {
      this.cursorElement.classList.add('hidden');
      this.cursorElement.innerHTML = '';
    }
  }

  /**
   * Builds active list of IndexedDB saves
   */
  private async renderWorldsList(): Promise<void> {
    const container = document.getElementById('worlds-list')!;
    container.innerHTML = '';

    const list = await WorldDatabase.getWorlds();
    if (list.length === 0) {
      container.innerHTML = '<div class="text-center" style="padding:20px; color:#666">No worlds found. Create one!</div>';
      return;
    }

    for (const world of list) {
      const el = document.createElement('div');
      el.className = 'world-item';
      
      const dt = new Date(world.lastPlayed).toLocaleDateString();
      el.innerHTML = `
        <div>
          <div class="world-name">${world.name}</div>
          <div class="world-details">Seed: ${world.seed} | Mode: ${world.gameMode}</div>
        </div>
        <div class="text-right">
          <div class="world-details">${dt}</div>
          <button class="btn btn-delete-world" style="padding:4px 8px; font-size:0.75rem; width:auto; margin:0;" data-id="${world.id}">Delete</button>
        </div>
      `;

      // Select world callback
      el.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('btn-delete-world')) {
          e.stopPropagation();
          const id = target.getAttribute('data-id')!;
          await WorldDatabase.deleteWorld(id);
          this.renderWorldsList();
          return;
        }

        this.showScreen('loadingScreen');
        await this.game.loadWorld(world);
      });

      container.appendChild(el);
    }
  }

  /**
   * Setup click bindings for the inventory card overlay
   */
  private initInventoryUI(): void {
    // Trigger toggle inventory key
    eventBus.on('keydown', (code: string) => {
      if (code === 'KeyE' && this.game.activeWorld && !this.game.isPaused && !this.game.player.isDead) {
        if (this.activeScreen) {
          this.hideAllScreens();
          this.hudOverlay.classList.remove('hidden');
          this.game.inputManager.requestLock();
        } else {
          document.exitPointerLock();
          this.showScreen('inventoryScreen');
          this.drawInventorySlots();
        }
      }
    });

    document.getElementById('btn-close-inventory')!.addEventListener('click', () => {
      this.closeInventory();
    });
  }

  private closeInventory(): void {
    this.screens.inventoryScreen.classList.add('hidden');
    this.activeScreen = null;
    this.game.inputManager.requestLock();

    // Drop held item back into inventory if active
    if (this.heldItem) {
      this.game.player.inventory.addItem(this.heldItem);
      this.heldItem = null;
      this.updateCursorElement();
    }
  }

  private drawCreativeCatalog(): void {
    const grid = document.getElementById('creative-items-grid')!;
    if (!grid) return;
    grid.innerHTML = '';
    
    const CREATIVE_ITEMS = [
      "stone", "cobblestone", "mossy_cobblestone", "bricks", "dirt", "grass_block", "mycelium",
      "sand", "sandstone", "terracotta", "gravel", "oak_log", "acacia_log", "oak_leaves", "acacia_leaves",
      "glass", "glass_pane", "white_wool", "red_wool", "green_wool", "blue_wool",
      "pumpkin", "jack_o_lantern", "melon_block", "cactus", "sugar_cane", "lily_pad", "ladder", "cobweb", "torch", "glowstone",
      "crafting_table", "furnace", "chest", "obsidian", "nether_portal", "netherrack", "soul_sand", "tnt",
      "wood_pickaxe", "stone_pickaxe", "iron_pickaxe", "diamond_pickaxe",
      "wood_sword", "stone_sword", "iron_sword", "diamond_sword",
      "wood_axe", "stone_axe", "iron_axe", "diamond_axe",
      "wood_shovel", "stone_shovel", "iron_shovel", "diamond_shovel",
      "flint_and_steel", "coal", "raw_iron", "raw_gold", "diamond", "redstone_dust", "emerald", "lapis_lazuli",
      "apple", "bread", "cooked_beef", "cooked_porkchop", "stick", "wheat_seeds",
      "dandelion", "poppy", "brown_mushroom", "red_mushroom", "melon_slice", "string",
      "snowball", "clay_ball", "glowstone_dust"
    ];

    for (const itemId of CREATIVE_ITEMS) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.title = itemId.replace(/_/g, ' ');
      this.renderSlotItem(slot, createItemStack(itemId, 1));
      slot.addEventListener('click', () => {
        this.heldItem = createItemStack(itemId, 64);
        this.cursorElement.classList.remove('hidden');
        this.cursorElement.style.backgroundColor = this.getItemColor(this.heldItem.id);
        this.cursorElement.style.border = '2px solid #fff';
      });
      grid.appendChild(slot);
    }
  }

  private drawInventorySlots(): void {
    const grid = document.getElementById('inventory-slots-grid')!;
    const hotbarGrid = document.getElementById('inventory-hotbar-grid')!;
    
    grid.innerHTML = '';
    hotbarGrid.innerHTML = '';

    // Handle Creative mode layout visibility overrides
    const creativeSection = document.getElementById('creative-catalog-section');
    const equipmentSection = document.querySelector('.inventory-equipment-section') as HTMLElement;
    const craftingSection = document.querySelector('.inventory-crafting-section') as HTMLElement;

    if (this.game.player && this.game.player.isCreative) {
      if (creativeSection) {
        creativeSection.classList.remove('hidden');
        this.drawCreativeCatalog();
      }
      if (equipmentSection) equipmentSection.style.display = 'none';
      if (craftingSection) craftingSection.style.display = 'none';
    } else {
      if (creativeSection) creativeSection.classList.add('hidden');
      if (equipmentSection) equipmentSection.style.display = 'block';
      if (craftingSection) craftingSection.style.display = 'block';
    }

    // Draw main storage (slots 9 to 44) - 36 slots total
    for (let i = 9; i < 45; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.setAttribute('data-idx', i.toString());
      this.renderSlotItem(slot, this.game.player.inventory.getItem(i));
      slot.addEventListener('click', () => this.handleSlotClick(i));
      grid.appendChild(slot);
    }

    // Draw armor and off-hand slots (slots 45 to 49)
    const equipmentSlots = document.querySelectorAll('.inventory-equipment-section .hotbar-slot');
    equipmentSlots.forEach((slotEl) => {
      const idxAttr = slotEl.getAttribute('data-idx');
      if (idxAttr) {
        const i = parseInt(idxAttr);
        this.renderSlotItem(slotEl as HTMLElement, this.game.player.inventory.getItem(i));
        // Remove old listener
        const newSlot = slotEl.cloneNode(true);
        slotEl.parentNode!.replaceChild(newSlot, slotEl);
        newSlot.addEventListener('click', () => this.handleSlotClick(i));
      }
    });

    // Draw hotbar row (slots 0 to 8)
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.setAttribute('data-idx', i.toString());
      this.renderSlotItem(slot, this.game.player.inventory.getItem(i));
      slot.addEventListener('click', () => this.handleSlotClick(i));
      hotbarGrid.appendChild(slot);
    }

    // Draw 2x2 crafting slots
    const craftSlots = document.querySelectorAll('#crafting-grid .craft-slot');
    craftSlots.forEach((slot, cIdx) => {
      this.renderSlotItem(slot as HTMLElement, this.craftInput[cIdx]);
      // Remove old listener
      const newSlot = slot.cloneNode(true);
      slot.parentNode!.replaceChild(newSlot, slot);
      newSlot.addEventListener('click', () => this.handleCraftSlotClick(cIdx));
    });

    // Draw output slot
    this.renderSlotItem(document.getElementById('crafting-output')!, this.craftOutput);
    const newOutput = document.getElementById('crafting-output')!.cloneNode(true);
    document.getElementById('crafting-output')!.parentNode!.replaceChild(newOutput, document.getElementById('crafting-output')!);
    newOutput.addEventListener('click', () => this.handleCraftOutputClick());
  }

  /**
   * Exact Minecraft click-to-pick-place slot logic
   */
  private handleSlotClick(idx: number): void {
    const inv = this.game.player.inventory;
    const current = inv.getItem(idx);

    if (!this.heldItem) {
      // Pick up item
      if (current) {
        this.heldItem = current;
        inv.setItem(idx, null);
      }
    } else {
      // Place / swap held item
      if (!current) {
        inv.setItem(idx, this.heldItem);
        this.heldItem = null;
      } else if (current.id === this.heldItem.id) {
        // Merge stacks
        const max = current.maxStack || 64;
        const addAmount = Math.min(this.heldItem.count, max - current.count);
        current.count += addAmount;
        this.heldItem.count -= addAmount;
        if (this.heldItem.count <= 0) {
          this.heldItem = null;
        }
        inv.setItem(idx, current);
      } else {
        // Swap items
        const temp = current;
        inv.setItem(idx, this.heldItem);
        this.heldItem = temp;
      }
    }
    this.updateCursorElement();
    this.drawInventorySlots();
  }

  private handleCraftSlotClick(cIdx: number): void {
    const current = this.craftInput[cIdx];

    if (!this.heldItem) {
      if (current) {
        this.heldItem = current;
        this.craftInput[cIdx] = null;
      }
    } else {
      if (!current) {
        this.craftInput[cIdx] = this.heldItem;
        this.heldItem = null;
      } else if (current.id === this.heldItem.id) {
        const space = 64 - current.count;
        const toAdd = Math.min(space, this.heldItem.count);
        current.count += toAdd;
        this.heldItem.count -= toAdd;
        if (this.heldItem.count <= 0) this.heldItem = null;
      } else {
        const temp = current;
        this.craftInput[cIdx] = this.heldItem;
        this.heldItem = temp;
      }
    }
    this.updateCursorElement();
    this.resolveCrafting();
    this.drawInventorySlots();
  }

  private handleCraftOutputClick(): void {
    if (this.craftOutput && !this.heldItem) {
      // Pick up craft result
      this.heldItem = this.craftOutput;
      this.craftOutput = null;

      // Consume inputs
      for (let i = 0; i < 4; i++) {
        if (this.craftInput[i]) {
          this.craftInput[i]!.count--;
          if (this.craftInput[i]!.count <= 0) {
            this.craftInput[i] = null;
          }
        }
      }

      this.updateCursorElement();
      this.resolveCrafting();
      this.drawInventorySlots();
    }
  }

  /**
   * Basic 2x2 crafting recipe book resolver
   */
  private resolveCrafting(): void {
    // 1. Single Oak Log -> 4 Oak Planks
    if (this.countCraftMatches('oak_log', 1) && this.countInputs() === 1) {
      this.craftOutput = createItemStack('oak_planks', 4);
      return;
    }

    // 2. Vertical 2 planks -> 4 sticks
    if (this.craftInput[0]?.id === 'oak_planks' && this.craftInput[2]?.id === 'oak_planks' && this.countInputs() === 2) {
      this.craftOutput = createItemStack('stick', 4);
      return;
    }

    // 3. 4 Planks -> 1 Crafting table
    if (
      this.craftInput[0]?.id === 'oak_planks' &&
      this.craftInput[1]?.id === 'oak_planks' &&
      this.craftInput[2]?.id === 'oak_planks' &&
      this.craftInput[3]?.id === 'oak_planks'
    ) {
      this.craftOutput = createItemStack('crafting_table', 1);
      return;
    }

    // 4. Torch: 1 Coal (top) + 1 Stick (bottom)
    if (this.craftInput[0]?.id === 'coal' && this.craftInput[2]?.id === 'stick' && this.countInputs() === 2) {
      this.craftOutput = createItemStack('torch', 4);
      return;
    }

    this.craftOutput = null;
  }

  private countInputs(): number {
    return this.craftInput.filter(i => i !== null).length;
  }

  private countCraftMatches(id: string, count: number): boolean {
    for (const stack of this.craftInput) {
      if (stack && stack.id === id && stack.count >= count) return true;
    }
    return false;
  }

  private renderAchievementsList(): void {
    const listEl = document.getElementById('achievements-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const achievements = AchievementManager.getInstance().getAchievements();
    achievements.forEach((ach) => {
      const row = document.createElement('div');
      row.className = `achievement-row ${ach.unlocked ? 'unlocked' : 'locked'}`;

      row.innerHTML = `
        <div class="achievement-icon">${ach.unlocked ? ach.icon : '❓'}</div>
        <div class="achievement-info">
          <div class="achievement-title">${ach.title}</div>
          <div class="achievement-desc">${ach.unlocked ? ach.description : 'Locked achievement'}</div>
        </div>
        <div class="achievement-status ${ach.unlocked ? 'unlocked-badge' : 'locked-badge'}">
          ${ach.unlocked ? 'Unlocked' : 'Locked'}
        </div>
      `;
      listEl.appendChild(row);
    });
  }

  private initSkinsSelectionUI(): void {
    const activeSkin = settingsManager.getValue('skin') || 'steve';
    const skinOptions = document.querySelectorAll('.skin-option');
    skinOptions.forEach((option) => {
      const name = option.getAttribute('data-skin');
      if (name === activeSkin) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
  }

  // =========================================================================
  // 3x3 CRAFTING TABLE SYSTEM
  // =========================================================================

  private init3x3CraftingUI(): void {
    // Initial bindings for 3x3 crafting table
  }

  public drawCraftingTableSlots(): void {
    const storageGrid = document.getElementById('crafting-table-slots-grid');
    const hotbarGrid = document.getElementById('crafting-table-hotbar-grid');
    if (!storageGrid || !hotbarGrid || !this.game.player) return;

    storageGrid.innerHTML = '';
    hotbarGrid.innerHTML = '';

    // Draw main storage (slots 9 to 44)
    for (let i = 9; i < 45; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      this.renderSlotItem(slot, this.game.player.inventory.getItem(i));
      slot.addEventListener('click', () => {
        this.handleSlotClick(i);
        this.drawCraftingTableSlots();
      });
      storageGrid.appendChild(slot);
    }

    // Draw hotbar (slots 0 to 8)
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      this.renderSlotItem(slot, this.game.player.inventory.getItem(i));
      slot.addEventListener('click', () => {
        this.handleSlotClick(i);
        this.drawCraftingTableSlots();
      });
      hotbarGrid.appendChild(slot);
    }

    // Draw 3x3 crafting grid slots
    const c3Slots = document.querySelectorAll('#crafting-grid-3x3 .craft-slot');
    c3Slots.forEach((slot, cIdx) => {
      this.renderSlotItem(slot as HTMLElement, this.craftInput3x3[cIdx]);
      const newSlot = slot.cloneNode(true);
      slot.parentNode!.replaceChild(newSlot, slot);
      newSlot.addEventListener('click', () => this.handleCraftSlot3x3Click(cIdx));
    });

    // Draw 3x3 output slot
    const outputEl = document.getElementById('crafting-table-output')!;
    this.renderSlotItem(outputEl, this.craftOutput3x3);
    const newOutput = outputEl.cloneNode(true);
    outputEl.parentNode!.replaceChild(newOutput, outputEl);
    newOutput.addEventListener('click', () => this.handleCraftOutput3x3Click());
  }

  private handleCraftSlot3x3Click(cIdx: number): void {
    const current = this.craftInput3x3[cIdx];

    if (!this.heldItem) {
      if (current) {
        this.heldItem = current;
        this.craftInput3x3[cIdx] = null;
      }
    } else {
      if (!current) {
        this.craftInput3x3[cIdx] = this.heldItem;
        this.heldItem = null;
      } else if (current.id === this.heldItem.id) {
        const space = 64 - current.count;
        const toAdd = Math.min(space, this.heldItem.count);
        current.count += toAdd;
        this.heldItem.count -= toAdd;
        if (this.heldItem.count <= 0) this.heldItem = null;
      } else {
        const temp = current;
        this.craftInput3x3[cIdx] = this.heldItem;
        this.heldItem = temp;
      }
    }
    this.updateCursorElement();
    this.resolveCrafting3x3();
    this.drawCraftingTableSlots();
  }

  private handleCraftOutput3x3Click(): void {
    if (this.craftOutput3x3 && !this.heldItem) {
      this.heldItem = this.craftOutput3x3;
      this.craftOutput3x3 = null;

      for (let i = 0; i < 9; i++) {
        if (this.craftInput3x3[i]) {
          this.craftInput3x3[i]!.count--;
          if (this.craftInput3x3[i]!.count <= 0) {
            this.craftInput3x3[i] = null;
          }
        }
      }

      this.updateCursorElement();
      this.resolveCrafting3x3();
      this.drawCraftingTableSlots();
    }
  }

  private resolveCrafting3x3(): void {
    const grid = this.craftInput3x3.map(item => item ? item.id : null);
    const count = grid.filter(Boolean).length;

    // 1. Single Item recipes
    if (count === 1) {
      const item = this.craftInput3x3.find(Boolean);
      if (item?.id === 'oak_log') { this.craftOutput3x3 = createItemStack('oak_planks', 4); return; }
      if (item?.id === 'acacia_log') { this.craftOutput3x3 = createItemStack('oak_planks', 4); return; }
    }

    // 2. Pickaxes (3 materials top row + sticks at slot 4 & 7)
    if (grid[0] === 'oak_planks' && grid[1] === 'oak_planks' && grid[2] === 'oak_planks' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) {
      this.craftOutput3x3 = createItemStack('wood_pickaxe', 1); return;
    }
    if (grid[0] === 'cobblestone' && grid[1] === 'cobblestone' && grid[2] === 'cobblestone' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) {
      this.craftOutput3x3 = createItemStack('stone_pickaxe', 1); return;
    }
    if (grid[0] === 'iron_ingot' && grid[1] === 'iron_ingot' && grid[2] === 'iron_ingot' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) {
      this.craftOutput3x3 = createItemStack('iron_pickaxe', 1); return;
    }
    if (grid[0] === 'diamond' && grid[1] === 'diamond' && grid[2] === 'diamond' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) {
      this.craftOutput3x3 = createItemStack('diamond_pickaxe', 1); return;
    }

    // 3. Swords (2 materials vertically + stick at bottom)
    const checkSword = (mat: string) => {
      return (
        (grid[0] === mat && grid[3] === mat && grid[6] === 'stick' && count === 3) ||
        (grid[1] === mat && grid[4] === mat && grid[7] === 'stick' && count === 3) ||
        (grid[2] === mat && grid[5] === mat && grid[8] === 'stick' && count === 3)
      );
    };
    if (checkSword('oak_planks')) { this.craftOutput3x3 = createItemStack('wood_sword', 1); return; }
    if (checkSword('cobblestone')) { this.craftOutput3x3 = createItemStack('stone_sword', 1); return; }
    if (checkSword('iron_ingot')) { this.craftOutput3x3 = createItemStack('iron_sword', 1); return; }
    if (checkSword('diamond')) { this.craftOutput3x3 = createItemStack('diamond_sword', 1); return; }

    // 4. Axes
    if ((grid[0] === 'oak_planks' && grid[1] === 'oak_planks' && grid[3] === 'oak_planks' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) ||
        (grid[1] === 'oak_planks' && grid[2] === 'oak_planks' && grid[5] === 'oak_planks' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5)) {
      this.craftOutput3x3 = createItemStack('wood_axe', 1); return;
    }
    if ((grid[0] === 'cobblestone' && grid[1] === 'cobblestone' && grid[3] === 'cobblestone' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) ||
        (grid[1] === 'cobblestone' && grid[2] === 'cobblestone' && grid[5] === 'cobblestone' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5)) {
      this.craftOutput3x3 = createItemStack('stone_axe', 1); return;
    }
    if ((grid[0] === 'iron_ingot' && grid[1] === 'iron_ingot' && grid[3] === 'iron_ingot' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) ||
        (grid[1] === 'iron_ingot' && grid[2] === 'iron_ingot' && grid[5] === 'iron_ingot' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5)) {
      this.craftOutput3x3 = createItemStack('iron_axe', 1); return;
    }
    if ((grid[0] === 'diamond' && grid[1] === 'diamond' && grid[3] === 'diamond' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5) ||
        (grid[1] === 'diamond' && grid[2] === 'diamond' && grid[5] === 'diamond' && grid[4] === 'stick' && grid[7] === 'stick' && count === 5)) {
      this.craftOutput3x3 = createItemStack('diamond_axe', 1); return;
    }

    // 5. Armor (Iron & Diamond)
    // Helmet: 3 top row, 2 middle row sides
    if (grid[0] === 'iron_ingot' && grid[1] === 'iron_ingot' && grid[2] === 'iron_ingot' && grid[3] === 'iron_ingot' && grid[5] === 'iron_ingot' && count === 5) {
      this.craftOutput3x3 = createItemStack('iron_helmet', 1); return;
    }
    if (grid[0] === 'diamond' && grid[1] === 'diamond' && grid[2] === 'diamond' && grid[3] === 'diamond' && grid[5] === 'diamond' && count === 5) {
      this.craftOutput3x3 = createItemStack('diamond_helmet', 1); return;
    }
    // Chestplate: all except top middle
    if (grid[0] === 'iron_ingot' && grid[2] === 'iron_ingot' && grid[3] === 'iron_ingot' && grid[4] === 'iron_ingot' && grid[5] === 'iron_ingot' && grid[6] === 'iron_ingot' && grid[7] === 'iron_ingot' && grid[8] === 'iron_ingot' && count === 8) {
      this.craftOutput3x3 = createItemStack('iron_chestplate', 1); return;
    }
    if (grid[0] === 'diamond' && grid[2] === 'diamond' && grid[3] === 'diamond' && grid[4] === 'diamond' && grid[5] === 'diamond' && grid[6] === 'diamond' && grid[7] === 'diamond' && grid[8] === 'diamond' && count === 8) {
      this.craftOutput3x3 = createItemStack('diamond_chestplate', 1); return;
    }
    // Leggings: 3 top, 2 left column, 2 right column
    if (grid[0] === 'iron_ingot' && grid[1] === 'iron_ingot' && grid[2] === 'iron_ingot' && grid[3] === 'iron_ingot' && grid[5] === 'iron_ingot' && grid[6] === 'iron_ingot' && grid[8] === 'iron_ingot' && count === 7) {
      this.craftOutput3x3 = createItemStack('iron_leggings', 1); return;
    }
    if (grid[0] === 'diamond' && grid[1] === 'diamond' && grid[2] === 'diamond' && grid[3] === 'diamond' && grid[5] === 'diamond' && grid[6] === 'diamond' && grid[8] === 'diamond' && count === 7) {
      this.craftOutput3x3 = createItemStack('diamond_leggings', 1); return;
    }
    // Boots: 2 left, 2 right
    if (grid[0] === 'iron_ingot' && grid[2] === 'iron_ingot' && grid[3] === 'iron_ingot' && grid[5] === 'iron_ingot' && count === 4) {
      this.craftOutput3x3 = createItemStack('iron_boots', 1); return;
    }
    if (grid[0] === 'diamond' && grid[2] === 'diamond' && grid[3] === 'diamond' && grid[5] === 'diamond' && count === 4) {
      this.craftOutput3x3 = createItemStack('diamond_boots', 1); return;
    }

    // 6. Bow & Arrow
    if (grid[1] === 'stick' && grid[3] === 'stick' && grid[7] === 'stick' && grid[2] === 'string' && grid[5] === 'string' && grid[8] === 'string' && count === 6) {
      this.craftOutput3x3 = createItemStack('bow', 1); return;
    }
    if ((grid[1] === 'stone' || grid[1] === 'flint') && grid[4] === 'stick' && grid[7] === 'feather' && count === 3) {
      this.craftOutput3x3 = createItemStack('arrow', 4); return;
    }

    // 7. TNT: 5 gunpowder + 4 sand
    if (grid[0] === 'gunpowder' && grid[1] === 'sand' && grid[2] === 'gunpowder' && grid[3] === 'sand' && grid[4] === 'gunpowder' && grid[5] === 'sand' && grid[6] === 'gunpowder' && grid[7] === 'sand' && grid[8] === 'gunpowder' && count === 9) {
      this.craftOutput3x3 = createItemStack('tnt', 1); return;
    }

    // 8. Golden Apple: 1 apple in center + 8 gold ingots around
    if (grid[4] === 'apple' && grid[0] === 'gold_ingot' && grid[1] === 'gold_ingot' && grid[2] === 'gold_ingot' && grid[3] === 'gold_ingot' && grid[5] === 'gold_ingot' && grid[6] === 'gold_ingot' && grid[7] === 'gold_ingot' && grid[8] === 'gold_ingot' && count === 9) {
      this.craftOutput3x3 = createItemStack('golden_apple', 1); return;
    }

    // 9. Furnace (8 Cobblestone ring)
    if (grid[0] === 'cobblestone' && grid[1] === 'cobblestone' && grid[2] === 'cobblestone' && grid[3] === 'cobblestone' && grid[5] === 'cobblestone' && grid[6] === 'cobblestone' && grid[7] === 'cobblestone' && grid[8] === 'cobblestone' && count === 8) {
      this.craftOutput3x3 = createItemStack('furnace', 1); return;
    }

    // 10. Chest (8 Planks ring)
    if (grid[0] === 'oak_planks' && grid[1] === 'oak_planks' && grid[2] === 'oak_planks' && grid[3] === 'oak_planks' && grid[5] === 'oak_planks' && grid[6] === 'oak_planks' && grid[7] === 'oak_planks' && grid[8] === 'oak_planks' && count === 8) {
      this.craftOutput3x3 = createItemStack('chest', 1); return;
    }

    // 11. Sticks
    if (grid[4] === 'oak_planks' && grid[7] === 'oak_planks' && count === 2) {
      this.craftOutput3x3 = createItemStack('stick', 4); return;
    }

    // 12. Torches
    if (grid[4] === 'coal' && grid[7] === 'stick' && count === 2) {
      this.craftOutput3x3 = createItemStack('torch', 4); return;
    }

    this.craftOutput3x3 = null;
  }

  // =========================================================================
  // FURNACE SMELTING SYSTEM
  // =========================================================================

  private initFurnaceUI(): void {
    // Initial bindings for furnace
  }

  public drawFurnaceSlots(): void {
    const storageGrid = document.getElementById('furnace-slots-grid');
    const hotbarGrid = document.getElementById('furnace-hotbar-grid');
    if (!storageGrid || !hotbarGrid || !this.game.player) return;

    storageGrid.innerHTML = '';
    hotbarGrid.innerHTML = '';

    for (let i = 9; i < 45; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      this.renderSlotItem(slot, this.game.player.inventory.getItem(i));
      slot.addEventListener('click', () => {
        this.handleSlotClick(i);
        this.drawFurnaceSlots();
      });
      storageGrid.appendChild(slot);
    }

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      this.renderSlotItem(slot, this.game.player.inventory.getItem(i));
      slot.addEventListener('click', () => {
        this.handleSlotClick(i);
        this.drawFurnaceSlots();
      });
      hotbarGrid.appendChild(slot);
    }

    // Input Slot
    const inputSlot = document.getElementById('furnace-input-slot')!;
    this.renderSlotItem(inputSlot, this.furnaceInput);
    const newInput = inputSlot.cloneNode(true);
    inputSlot.parentNode!.replaceChild(newInput, inputSlot);
    newInput.addEventListener('click', () => {
      this.handleFurnaceSlotClick('input');
      this.drawFurnaceSlots();
    });

    // Fuel Slot
    const fuelSlot = document.getElementById('furnace-fuel-slot')!;
    this.renderSlotItem(fuelSlot, this.furnaceFuel);
    const newFuel = fuelSlot.cloneNode(true);
    fuelSlot.parentNode!.replaceChild(newFuel, fuelSlot);
    newFuel.addEventListener('click', () => {
      this.handleFurnaceSlotClick('fuel');
      this.drawFurnaceSlots();
    });

    // Output Slot
    const outputSlot = document.getElementById('furnace-output-slot')!;
    this.renderSlotItem(outputSlot, this.furnaceOutput);
    const newOutput = outputSlot.cloneNode(true);
    outputSlot.parentNode!.replaceChild(newOutput, outputSlot);
    newOutput.addEventListener('click', () => {
      this.handleFurnaceSlotClick('output');
      this.drawFurnaceSlots();
    });
  }

  private handleFurnaceSlotClick(type: 'input' | 'fuel' | 'output'): void {
    if (type === 'input') {
      if (!this.heldItem) {
        this.heldItem = this.furnaceInput;
        this.furnaceInput = null;
      } else {
        if (!this.furnaceInput) {
          this.furnaceInput = this.heldItem;
          this.heldItem = null;
        } else if (this.furnaceInput.id === this.heldItem.id) {
          const space = 64 - this.furnaceInput.count;
          const toAdd = Math.min(space, this.heldItem.count);
          this.furnaceInput.count += toAdd;
          this.heldItem.count -= toAdd;
          if (this.heldItem.count <= 0) this.heldItem = null;
        } else {
          const temp = this.furnaceInput;
          this.furnaceInput = this.heldItem;
          this.heldItem = temp;
        }
      }
    } else if (type === 'fuel') {
      if (!this.heldItem) {
        this.heldItem = this.furnaceFuel;
        this.furnaceFuel = null;
      } else {
        if (!this.furnaceFuel) {
          this.furnaceFuel = this.heldItem;
          this.heldItem = null;
        } else if (this.furnaceFuel.id === this.heldItem.id) {
          const space = 64 - this.furnaceFuel.count;
          const toAdd = Math.min(space, this.heldItem.count);
          this.furnaceFuel.count += toAdd;
          this.heldItem.count -= toAdd;
          if (this.heldItem.count <= 0) this.heldItem = null;
        } else {
          const temp = this.furnaceFuel;
          this.furnaceFuel = this.heldItem;
          this.heldItem = temp;
        }
      }
    } else if (type === 'output') {
      if (this.furnaceOutput && !this.heldItem) {
        this.heldItem = this.furnaceOutput;
        this.furnaceOutput = null;
      }
    }
    this.updateCursorElement();
  }

  private tickFurnace(deltaSec: number): void {
    const SMELT_RECIPES: { [key: string]: string } = {
      'raw_iron': 'iron_ingot',
      'raw_gold': 'gold_ingot',
      'cobblestone': 'stone',
      'sand': 'glass',
      'clay': 'terracotta',
      'beef': 'cooked_beef',
      'porkchop': 'cooked_porkchop'
    };

    if (!this.furnaceInput || !SMELT_RECIPES[this.furnaceInput.id]) {
      this.furnaceCookProgress = 0;
      return;
    }

    const outputResultId = SMELT_RECIPES[this.furnaceInput.id];

    // Check if output slot can receive result
    if (this.furnaceOutput && (this.furnaceOutput.id !== outputResultId || this.furnaceOutput.count >= 64)) {
      return;
    }

    // Burn Fuel
    if (this.furnaceBurnTimer <= 0) {
      if (this.furnaceFuel && this.furnaceFuel.count > 0) {
        let burnGain = 4.0;
        if (this.furnaceFuel.id === 'coal') burnGain = 16.0;
        else if (this.furnaceFuel.id === 'oak_log' || this.furnaceFuel.id === 'acacia_log') burnGain = 8.0;
        else if (this.furnaceFuel.id === 'oak_planks') burnGain = 6.0;

        this.furnaceBurnTimer = burnGain;
        this.furnaceFuel.count--;
        if (this.furnaceFuel.count <= 0) this.furnaceFuel = null;
      } else {
        return; // No fuel to smelt
      }
    }

    this.furnaceBurnTimer -= deltaSec;
    this.furnaceCookProgress += deltaSec;

    // Complete Smelt (4 seconds per item)
    if (this.furnaceCookProgress >= 4.0) {
      this.furnaceCookProgress = 0;
      this.furnaceInput.count--;
      if (this.furnaceInput.count <= 0) this.furnaceInput = null;

      if (!this.furnaceOutput) {
        this.furnaceOutput = createItemStack(outputResultId, 1);
      } else {
        this.furnaceOutput.count++;
      }

      if (this.activeScreen === this.screens.furnaceScreen) {
        this.drawFurnaceSlots();
      }
    }
  }
}
