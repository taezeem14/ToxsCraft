/**
 * Tox'sCraft AchievementManager
 * Tracks progression achievements, unlocks them, plays synth sounds, and persists to localStorage.
 */

import { eventBus } from '../EventBus';
import { ItemStack } from '../inventory/ItemStack';
import { AssetLoader } from './AssetLoader';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

export class AchievementManager {
  private static instance: AchievementManager | null = null;
  
  private achievements: Achievement[] = [
    { id: 'getting_wood', title: 'Getting Wood', description: 'Attack a tree until a log block pops out', unlocked: false, icon: '🪵' },
    { id: 'time_to_mine', title: 'Time to Mine', description: 'Mine some cobblestone with your pickaxe', unlocked: false, icon: '⛏️' },
    { id: 'diamonds', title: 'Diamonds!', description: 'Acquire shiny diamonds from deep underground', unlocked: false, icon: '💎' }
  ];

  private constructor() {
    this.load();
  }

  public static getInstance(): AchievementManager {
    if (!this.instance) {
      this.instance = new AchievementManager();
    }
    return this.instance;
  }

  public getAchievements(): Achievement[] {
    return this.achievements;
  }

  private load(): void {
    try {
      const saved = localStorage.getItem('toxscraft_achievements');
      if (saved) {
        const unlockedIds = JSON.parse(saved) as string[];
        for (const ach of this.achievements) {
          if (unlockedIds.includes(ach.id)) {
            ach.unlocked = true;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load achievements', e);
    }
  }

  private save(): void {
    try {
      const unlockedIds = this.achievements.filter(a => a.unlocked).map(a => a.id);
      localStorage.setItem('toxscraft_achievements', JSON.stringify(unlockedIds));
    } catch (e) {
      console.warn('Failed to save achievements', e);
    }
  }

  public checkAchievements(slots: (ItemStack | null)[]): void {
    for (const slot of slots) {
      if (!slot) continue;

      // 1. Getting Wood
      if ((slot.id === 'oak_log' || slot.id === 'oak_planks') && !this.isUnlocked('getting_wood')) {
        this.unlock('getting_wood');
      }
      // 2. Time to Mine
      if (slot.id === 'cobblestone' && !this.isUnlocked('time_to_mine')) {
        this.unlock('time_to_mine');
      }
      // 3. Diamonds!
      if ((slot.id === 'diamond' || slot.id === 'diamond_ore') && !this.isUnlocked('diamonds')) {
        this.unlock('diamonds');
      }
    }
  }

  public isUnlocked(id: string): boolean {
    return this.achievements.find(a => a.id === id)?.unlocked || false;
  }

  public unlock(id: string): void {
    const ach = this.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      this.save();
      eventBus.emit('show_toast', `🏆 Achievement Unlocked: ${ach.title}!`);
      AssetLoader.playAchievementSound();
    }
  }
}
