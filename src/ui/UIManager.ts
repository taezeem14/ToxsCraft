/**
 * Tox'sCraft UIManager
 * Controls all DOM overlays, HUD metrics, menu states, click-to-move inventory, and 2x2 crafting.
 */

import { Game } from '../Game';
import { eventBus } from '../EventBus';
import { settingsManager } from '../core/SettingsManager';
import { WorldDatabase, WorldMetadata } from '../save/WorldDatabase';
import { ItemStack, createItemStack } from '../inventory/ItemStack';
import { getBiome } from '../world/generation/BiomeRegistry';

export class UIManager {
  private game: Game;

  // DOM Elements
  private activeScreen: HTMLElement | null = null;
  private hudOverlay = document.getElementById('hud-overlay')!;
  private debugPanel = document.getElementById('debug-info')!;

  // Screen Containers
  private screens: { [key: string]: HTMLElement } = {
    mainMenu: document.getElementById('main-menu')!,
    worldSelect: document.getElementById('world-select')!,
    worldCreate: document.getElementById('world-create')!,
    pauseScreen: document.getElementById('pause-screen')!,
    settingsScreen: document.getElementById('settings-screen')!,
    loadingScreen: document.getElementById('loading-screen')!,
    inventoryScreen: document.getElementById('inventory-screen')!,
    deathScreen: document.getElementById('death-screen')!,
    creditsScreen: document.getElementById('credits-screen')!
  };

  // Held item state
  private heldItem: ItemStack | null = null;
  private cursorElement = document.getElementById('cursor-item')!;

  // 2x2 Crafting inputs (indices 0-3) and output slot
  private craftInput: (ItemStack | null)[] = [null, null, null, null];
  private craftOutput: ItemStack | null = null;

  constructor(game: Game) {
    this.game = game;
    this.activeScreen = this.screens.mainMenu;

    this.bindButtons();
    this.bindSettings();
    this.initHUD();
    this.initInventoryUI();

    // Mouse tracking for cursor held item
    document.addEventListener('mousemove', (e) => {
      if (this.heldItem) {
        this.cursorElement.style.left = `${e.clientX + 10}px`;
        this.cursorElement.style.top = `${e.clientY + 10}px`;
      }
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

    // 4. Pause Screen
    document.getElementById('btn-resume')!.addEventListener('click', () => {
      this.game.togglePause();
    });

    document.getElementById('btn-settings-pause')!.addEventListener('click', () => {
      this.showScreen('settingsScreen');
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
      eventBus.emit('respawn');
      this.hideAllScreens();
      this.hudOverlay.classList.remove('hidden');
      this.game.inputManager.requestLock();
    });

    document.getElementById('btn-death-quit')!.addEventListener('click', () => {
      this.game.stop();
      this.hudOverlay.classList.add('hidden');
      this.showScreen('mainMenu');
    });
  }

  private bindSettings(): void {
    const fovSlider = document.getElementById('slide-fov') as HTMLInputElement;
    const sensSlider = document.getElementById('slide-sens') as HTMLInputElement;
    const volSlider = document.getElementById('slide-vol') as HTMLInputElement;
    const postCheck = document.getElementById('check-post') as HTMLInputElement;
    const coordsCheck = document.getElementById('check-coords') as HTMLInputElement;

    // Load initial values
    const settings = settingsManager.get();
    fovSlider.value = settings.fov.toString();
    sensSlider.value = (settings.mouseSensitivity * 25000).toString();
    volSlider.value = (settings.volumeMaster * 100).toString();
    postCheck.checked = settings.postProcessing;
    coordsCheck.checked = settings.showCoordinates;

    // Events
    fovSlider.addEventListener('input', () => {
      const val = parseInt(fovSlider.value);
      document.getElementById('val-fov')!.textContent = val.toString();
      settingsManager.set('fov', val);
      this.game.renderer.camera.fov = val;
      this.game.renderer.camera.updateProjectionMatrix();
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
  }

  private initHUD(): void {
    // Setup listeners for updates
    eventBus.on('player_status_change', () => this.drawHUDVitals());
    eventBus.on('hotbar_change', () => this.drawHotbarSelection());
    eventBus.on('inventory_update', () => {
      this.drawHUDVitals();
      this.drawHotbarSelection();
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
      const biome = getBiome(0.5, 0.5, p.y / 256.0); // simple mockup query
      document.getElementById('biome-val')!.textContent = biome.name;

      // Time string
      document.getElementById('time-val')!.textContent = this.game.dayNightCycle.getTimeString();
    }, 100);
  }

  private drawHUDVitals(): void {
    const healthRow = document.getElementById('health-bar')!;
    const hungerRow = document.getElementById('hunger-bar')!;

    // 10 hearts maximum (20 HP)
    let hpStr = '';
    const fullHearts = Math.floor(this.game.player.health / 2);
    const halfHeart = this.game.player.health % 2 >= 1;
    
    for (let i = 0; i < 10; i++) {
      if (i < fullHearts) hpStr += '<span style="color: var(--color-danger)">❤</span>';
      else if (i === fullHearts && halfHeart) hpStr += '<span style="color: var(--color-danger); opacity:0.65">❤</span>';
      else hpStr += '<span style="color: #444">❤</span>';
    }
    healthRow.innerHTML = hpStr;

    // 10 hunger drumsticks (20 points)
    let foodStr = '';
    const fullFood = Math.floor(this.game.player.hunger / 2);
    for (let i = 0; i < 10; i++) {
      if (i < fullFood) foodStr += '<span style="color: #c9803b">🍖</span>';
      else foodStr += '<span style="color: #444">🍖</span>';
    }
    hungerRow.innerHTML = foodStr;
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
    slotEl.innerHTML = '';
    if (!stack) return;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-slot';

    // Procedural color mapping representing item icon
    const icon = document.createElement('div');
    icon.className = 'item-texture';
    icon.style.backgroundColor = this.getItemColor(stack.id);
    icon.style.border = '2px solid rgba(0,0,0,0.2)';
    icon.style.borderRadius = '4px';

    itemDiv.appendChild(icon);

    if (stack.count > 1) {
      const countLabel = document.createElement('div');
      countLabel.className = 'item-count';
      countLabel.textContent = stack.count.toString();
      itemDiv.appendChild(countLabel);
    }

    slotEl.appendChild(itemDiv);
  }

  private getItemColor(itemId: string): string {
    if (itemId.includes('pickaxe')) return '#5f9ea0';
    if (itemId.includes('stone') || itemId === 'cobblestone') return '#7f8c8d';
    if (itemId === 'dirt') return '#8b5a2b';
    if (itemId === 'grass_block') return '#2ecc71';
    if (itemId === 'sand') return '#f1c40f';
    if (itemId === 'apple') return '#e74c3c';
    if (itemId === 'torch') return '#e67e22';
    if (itemId === 'oak_log') return '#8e44ad';
    return '#bdc3c7'; // default light gray
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
        const hidden = this.screens.inventoryScreen.classList.contains('hidden');
        if (hidden) {
          document.exitPointerLock();
          this.screens.inventoryScreen.classList.remove('hidden');
          this.activeScreen = this.screens.inventoryScreen;
          this.drawInventorySlots();
        } else {
          this.closeInventory();
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
      this.cursorElement.classList.add('hidden');
    }
  }

  private drawInventorySlots(): void {
    const grid = document.getElementById('inventory-slots-grid')!;
    const hotbarGrid = document.getElementById('inventory-hotbar-grid')!;
    
    grid.innerHTML = '';
    hotbarGrid.innerHTML = '';

    // Draw main storage (slots 9 to 35)
    for (let i = 9; i < 36; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.setAttribute('data-idx', i.toString());
      this.renderSlotItem(slot, this.game.player.inventory.getItem(i));
      slot.addEventListener('click', () => this.handleSlotClick(i));
      grid.appendChild(slot);
    }

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
        this.cursorElement.classList.remove('hidden');
        this.cursorElement.style.backgroundColor = this.getItemColor(this.heldItem.id);
        this.cursorElement.style.border = '2px solid #fff';
      }
    } else {
      // Place / swap held item
      if (!current) {
        inv.setItem(idx, this.heldItem);
        this.heldItem = null;
        this.cursorElement.classList.add('hidden');
      } else if (current.id === this.heldItem.id) {
        // Merge stacks
        const max = current.maxStack || 64;
        const addAmount = Math.min(this.heldItem.count, max - current.count);
        current.count += addAmount;
        this.heldItem.count -= addAmount;
        if (this.heldItem.count <= 0) {
          this.heldItem = null;
          this.cursorElement.classList.add('hidden');
        }
        inv.setItem(idx, current);
      } else {
        // Swap items
        const temp = current;
        inv.setItem(idx, this.heldItem);
        this.heldItem = temp;
        this.cursorElement.style.backgroundColor = this.getItemColor(this.heldItem.id);
      }
    }
    this.drawInventorySlots();
  }

  private handleCraftSlotClick(cIdx: number): void {
    const current = this.craftInput[cIdx];

    if (!this.heldItem) {
      if (current) {
        this.heldItem = current;
        this.craftInput[cIdx] = null;
        this.cursorElement.classList.remove('hidden');
        this.cursorElement.style.backgroundColor = this.getItemColor(this.heldItem.id);
      }
    } else {
      if (!current) {
        this.craftInput[cIdx] = this.heldItem;
        this.heldItem = null;
        this.cursorElement.classList.add('hidden');
      } else if (current.id === this.heldItem.id) {
        current.count += this.heldItem.count; // simplicity merge
        this.heldItem = null;
        this.cursorElement.classList.add('hidden');
      } else {
        const temp = current;
        this.craftInput[cIdx] = this.heldItem;
        this.heldItem = temp;
        this.cursorElement.style.backgroundColor = this.getItemColor(this.heldItem.id);
      }
    }
    this.resolveCrafting();
    this.drawInventorySlots();
  }

  private handleCraftOutputClick(): void {
    if (this.craftOutput && !this.heldItem) {
      // Pick up craft result
      this.heldItem = this.craftOutput;
      this.craftOutput = null;
      this.cursorElement.classList.remove('hidden');
      this.cursorElement.style.backgroundColor = this.getItemColor(this.heldItem.id);

      // Consume inputs
      for (let i = 0; i < 4; i++) {
        if (this.craftInput[i]) {
          this.craftInput[i]!.count--;
          if (this.craftInput[i]!.count <= 0) {
            this.craftInput[i] = null;
          }
        }
      }

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
}
