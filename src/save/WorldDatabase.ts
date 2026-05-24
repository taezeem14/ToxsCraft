/**
 * Tox'sCraft WorldDatabase
 * Provides asynchronous persistence of world metadata, player profiles, and chunk block data using IndexedDB.
 */

import { openDB, IDBPDatabase } from 'idb';

export interface WorldMetadata {
  id: string; // unique GUID
  name: string;
  seed: string;
  gameMode: 'survival' | 'creative';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  playtime: number; // in seconds
  lastPlayed: number; // unix timestamp
}

export interface SavedPlayer {
  health: number;
  hunger: number;
  position: { x: number; y: number; z: number };
  inventory: any[]; // Serialized slots
  daysElapsed: number;
  timeOfDay: number;
  level?: number;
  xp?: number;
}


export class WorldDatabase {
  private static DB_NAME = 'toxscraft_db';
  private static DB_VERSION = 1;
  private static db: IDBPDatabase | null = null;

  /**
   * Initializes connection to IndexedDB
   */
  public static async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Store for list of worlds
        if (!db.objectStoreNames.contains('worlds')) {
          db.createObjectStore('worlds', { keyPath: 'id' });
        }
        // Store for chunks (Key is: worldId_cx_cz)
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks');
        }
        // Store for player state (Key is: worldId)
        if (!db.objectStoreNames.contains('player')) {
          db.createObjectStore('player');
        }
      }
    });
  }

  /**
   * Retrieve list of all saved worlds
   */
  public static async getWorlds(): Promise<WorldMetadata[]> {
    await this.init();
    if (!this.db) return [];
    return this.db.getAll('worlds');
  }

  /**
   * Add a new world metadata entry
   */
  public static async saveWorldMetadata(metadata: WorldMetadata): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.put('worlds', metadata);
  }

  /**
   * Delete world metadata, its chunks, and player profiles
   */
  public static async deleteWorld(worldId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    // 1. Delete world record
    await this.db.delete('worlds', worldId);
    
    // 2. Delete player record
    await this.db.delete('player', worldId);

    // 3. Delete matching chunks (IndexedDB cursor scan)
    const tx = this.db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    let cursor = await store.openCursor();
    
    while (cursor) {
      const key = cursor.key as string;
      if (key.startsWith(worldId)) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  /**
   * Saves a chunk's block binary mapping
   */
  public static async saveChunk(worldId: string, cx: number, cz: number, data: Uint8Array): Promise<void> {
    await this.init();
    if (!this.db) return;
    const key = `${worldId}_${cx}_${cz}`;
    await this.db.put('chunks', data, key);
  }

  /**
   * Loads a chunk's block binary mapping, returns null if not cached
   */
  public static async loadChunk(worldId: string, cx: number, cz: number): Promise<Uint8Array | null> {
    await this.init();
    if (!this.db) return null;
    const key = `${worldId}_${cx}_${cz}`;
    const result = await this.db.get('chunks', key);
    return result || null;
  }

  /**
   * Saves player status and hotbars
   */
  public static async savePlayer(worldId: string, player: SavedPlayer): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.put('player', player, worldId);
  }

  /**
   * Loads player profile, returns null if first load
   */
  public static async loadPlayer(worldId: string): Promise<SavedPlayer | null> {
    await this.init();
    if (!this.db) return null;
    const result = await this.db.get('player', worldId);
    return result || null;
  }
}
