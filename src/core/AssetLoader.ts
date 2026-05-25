/**
 * Tox'sCraft AssetLoader
 * Generates all 16x16 pixel-art block textures and handles Web Audio sound synthesis.
 */

import * as THREE from 'three';

export class AssetLoader {
  private static textureAtlas: THREE.CanvasTexture | null = null;
  private static audioCtx: AudioContext | null = null;

  /**
   * Generates the entire 16x16 texture atlas on the fly
   */
  public static getTextureAtlas(): THREE.CanvasTexture {
    if (this.textureAtlas) return this.textureAtlas;

    const tileSize = 16;
    const cols = 16;
    const rows = 16;
    const canvas = document.createElement('canvas');
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext('2d')!;

    // Fill with debug magenta first
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Generate each texture slot
    for (let index = 0; index < 256; index++) {
      const tx = (index % cols) * tileSize;
      const ty = Math.floor(index / cols) * tileSize;
      this.drawTexture(index, ctx, tx, ty);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.textureAtlas = texture;
    return texture;
  }

  /**
   * Draw a specific 16x16 block texture based on index
   */
  private static drawTexture(index: number, ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Helper to draw a pixel
    const pixel = (px: number, py: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + px, y + py, 1, 1);
    };

    // Helper to fill a tile
    const fillTile = (color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 16, 16);
    };



    // Helper to add 2D grid noise
    const gridNoise = (r: number, g: number, b: number, variance = 15) => {
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const v = (Math.random() - 0.5) * variance;
          ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r + v))}, ${Math.max(0, Math.min(255, g + v))}, ${Math.max(0, Math.min(255, b + v))})`;
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    };

    switch (index) {
      case 0: // Air / transparent
        ctx.clearRect(x, y, 16, 16);
        break;

      case 1: // Stone
        gridNoise(120, 120, 120, 18);
        // Add some random darker gray cracks
        for (let i = 0; i < 5; i++) {
          pixel(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), '#555555');
        }
        break;

      case 2: // Dirt
        gridNoise(110, 75, 45, 12);
        // Add small brown gravel bits
        for (let i = 0; i < 8; i++) {
          pixel(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), '#53361a');
        }
        break;

      case 3: // Grass top
        gridNoise(85, 145, 45, 16);
        // Add dark green blades
        for (let i = 0; i < 6; i++) {
          const px = Math.floor(Math.random() * 14) + 1;
          const py = Math.floor(Math.random() * 14) + 1;
          pixel(px, py, '#396d1b');
          pixel(px, py - 1, '#4e8d2b');
        }
        break;

      case 4: // Grass side
        // Bottom dirt
        ctx.fillStyle = '#6e4b2e';
        ctx.fillRect(x, y + 4, 16, 12);
        // Add dirt noise
        for (let py = 4; py < 16; py++) {
          for (let px = 0; px < 16; px++) {
            if (Math.random() > 0.7) {
              ctx.fillStyle = Math.random() > 0.5 ? '#5c3e26' : '#7f5938';
              ctx.fillRect(x + px, y + py, 1, 1);
            }
          }
        }
        // Top grass overlay
        ctx.fillStyle = '#55912d';
        ctx.fillRect(x, y, 16, 4);
        // Grass blades hanging down
        for (let px = 0; px < 16; px++) {
          const depth = Math.floor(Math.random() * 4) + 2;
          ctx.fillStyle = '#55912d';
          ctx.fillRect(x + px, y, 1, depth);
          // Dark grass accent
          pixel(px, depth - 1, '#3c691f');
        }
        break;

      case 5: // Sand
        gridNoise(225, 210, 150, 10);
        // Sand ripples
        ctx.fillStyle = '#dfcd8d';
        ctx.fillRect(x, y + 4, 16, 1);
        ctx.fillRect(x, y + 10, 16, 1);
        break;

      case 6: // Gravel
        gridNoise(100, 95, 95, 20);
        // Small pebbles
        for (let i = 0; i < 12; i++) {
          const color = Math.random() > 0.5 ? '#555555' : '#cccccc';
          pixel(Math.floor(Math.random() * 15), Math.floor(Math.random() * 15), color);
        }
        break;

      case 7: // Wood top (rings)
        gridNoise(200, 160, 110, 8);
        ctx.strokeStyle = '#85633e';
        ctx.lineWidth = 1;
        // Draw wood rings
        ctx.strokeRect(x + 2.5, y + 2.5, 11, 11);
        ctx.strokeRect(x + 5.5, y + 5.5, 5, 5);
        pixel(7, 7, '#5b432a');
        break;

      case 8: // Wood side (bark)
        gridNoise(90, 65, 45, 10);
        // Vertical lines
        ctx.fillStyle = '#44301d';
        for (let px = 1; px < 16; px += 4) {
          ctx.fillRect(x + px + Math.floor(Math.random() * 2), y, 1, 16);
        }
        break;

      case 9: // Leaves
        gridNoise(45, 110, 35, 25);
        // Punch some transparent holes
        for (let i = 0; i < 20; i++) {
          const px = Math.floor(Math.random() * 16);
          const py = Math.floor(Math.random() * 16);
          // Keep leaf borders closed to avoid gaping seams
          if (px > 0 && px < 15 && py > 0 && py < 15) {
            pixel(px, py, 'rgba(0,0,0,0)');
          }
        }
        break;

      case 10: // Glass
        fillTile('rgba(255, 255, 255, 0.08)');
        // White border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        // White reflection streaks
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        pixel(3, 3, 'rgba(255, 255, 255, 0.5)');
        pixel(4, 4, 'rgba(255, 255, 255, 0.5)');
        pixel(11, 11, 'rgba(255, 255, 255, 0.5)');
        pixel(12, 12, 'rgba(255, 255, 255, 0.5)');
        break;

      case 11: // Water
        fillTile('#3355ff');
        // Gentle wave highlights
        for (let py = 0; py < 16; py += 4) {
          ctx.fillStyle = '#4f7cff';
          ctx.fillRect(x, y + py, 16, 1);
        }
        break;

      case 12: // Lava
        fillTile('#ff3c00');
        // Orange/yellow heat spots
        for (let py = 0; py < 16; py += 3) {
          ctx.fillStyle = '#ff8c00';
          ctx.fillRect(x + (py % 2) * 2, y + py, 8, 1);
          ctx.fillStyle = '#ffcc00';
          pixel(x + (py % 2) * 2 + 3, y + py, '#ffcc00');
        }
        break;

      case 13: // Bedrock
        gridNoise(40, 40, 40, 30);
        break;

      // Ores
      case 14: // Coal Ore
        gridNoise(120, 120, 120, 10);
        this.drawOreSpots(ctx, x, y, '#222222');
        break;
      case 15: // Iron Ore
        gridNoise(120, 120, 120, 10);
        this.drawOreSpots(ctx, x, y, '#dfae8b');
        break;
      case 16: // Gold Ore
        gridNoise(120, 120, 120, 10);
        this.drawOreSpots(ctx, x, y, '#ffcc00');
        break;
      case 17: // Diamond Ore
        gridNoise(120, 120, 120, 10);
        this.drawOreSpots(ctx, x, y, '#33ffff');
        break;
      case 18: // Redstone Ore
        gridNoise(120, 120, 120, 10);
        this.drawOreSpots(ctx, x, y, '#ff0000');
        break;
      case 19: // Emerald Ore
        gridNoise(120, 120, 120, 10);
        this.drawOreSpots(ctx, x, y, '#17ff3f');
        break;
      case 20: // Lapis Ore
        gridNoise(120, 120, 120, 10);
        this.drawOreSpots(ctx, x, y, '#1f48d3');
        break;

      case 21: // Planks
        gridNoise(180, 135, 80, 10);
        // Draw horizontal planks grooves
        ctx.fillStyle = '#9e7343';
        ctx.fillRect(x, y + 4, 16, 1);
        ctx.fillRect(x, y + 9, 16, 1);
        ctx.fillRect(x, y + 14, 16, 1);
        // Planks vertical joints
        ctx.fillRect(x + 5, y, 1, 4);
        ctx.fillRect(x + 11, y + 5, 1, 4);
        ctx.fillRect(x + 3, y + 10, 1, 4);
        break;

      case 22: // Sandstone
        gridNoise(220, 200, 140, 6);
        ctx.fillStyle = '#ad965b';
        ctx.fillRect(x, y + 7, 16, 2);
        ctx.fillRect(x, y + 15, 16, 1);
        break;

      case 23: // Snowy grass top
        gridNoise(245, 248, 255, 6);
        break;

      case 24: // Snowy grass side
        ctx.fillStyle = '#6e4b2e'; // Dirt
        ctx.fillRect(x, y + 5, 16, 11);
        ctx.fillStyle = '#ffffff'; // Snow top
        ctx.fillRect(x, y, 16, 5);
        // Snowy icicles hanging down
        for (let px = 0; px < 16; px++) {
          const depth = Math.floor(Math.random() * 4) + 3;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + px, y, 1, depth);
        }
        break;

      case 25: // Ice
        fillTile('#aaddff');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(x + 2, y + 2, 4, 1);
        ctx.fillRect(x + 2, y + 3, 1, 3);
        ctx.fillRect(x + 10, y + 8, 3, 1);
        break;

      case 26: // Snow block
        gridNoise(240, 245, 255, 4);
        break;

      case 27: // Clay
        gridNoise(155, 160, 175, 5);
        break;

      case 28: // Obsidian
        gridNoise(25, 15, 35, 10);
        // Purple crystal spots
        for (let i = 0; i < 8; i++) {
          pixel(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), '#562f7e');
        }
        break;

      case 29: // Torch
        ctx.clearRect(x, y, 16, 16);
        // Stick
        ctx.fillStyle = '#85633e';
        ctx.fillRect(x + 7, y + 6, 2, 10);
        // Flame
        ctx.fillStyle = '#ff7b00';
        ctx.fillRect(x + 6, y + 2, 4, 4);
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(x + 7, y + 3, 2, 2);
        break;

      case 30: // Crafting Table Top
        gridNoise(180, 135, 80, 5);
        // Border
        ctx.strokeStyle = '#5b432a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        // Tools sketch
        ctx.fillStyle = '#9e7343';
        ctx.fillRect(x + 3, y + 3, 3, 3);
        ctx.fillRect(x + 10, y + 8, 3, 3);
        break;

      case 31: // Crafting Table Side
        gridNoise(180, 135, 80, 5);
        // Draw side planks
        ctx.fillStyle = '#5b432a';
        ctx.fillRect(x, y, 16, 2);
        ctx.fillRect(x, y + 14, 16, 2);
        // Hanging saws/hammers details
        ctx.fillStyle = '#aaaaaa';
        ctx.fillRect(x + 4, y + 4, 2, 6);
        ctx.fillStyle = '#9e7343';
        ctx.fillRect(x + 10, y + 4, 3, 3);
        break;

      case 32: // Furnace Side
        gridNoise(100, 100, 100, 10);
        // Cobble outline border
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        break;

      case 33: // Furnace Front
        gridNoise(100, 100, 100, 10);
        // Opening
        ctx.fillStyle = '#222222';
        ctx.fillRect(x + 3, y + 6, 10, 7);
        // Opening border
        ctx.fillStyle = '#555555';
        ctx.fillRect(x + 2, y + 5, 12, 1);
        break;

      case 34: // Furnace Front Active
        gridNoise(100, 100, 100, 10);
        // Fire opening
        ctx.fillStyle = '#ff6c00';
        ctx.fillRect(x + 3, y + 6, 10, 7);
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(x + 5, y + 8, 6, 5);
        break;

      case 35: // Chest Side
        gridNoise(120, 80, 45, 6);
        // Dark corners
        ctx.strokeStyle = '#392211';
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        // Lock
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(x + 7, y + 5, 2, 3);
        ctx.fillStyle = '#999999';
        ctx.fillRect(x + 7, y + 8, 2, 1);
        break;

      case 36: // Glowstone
        gridNoise(235, 185, 90, 20);
        // Bright spots
        for (let i = 0; i < 8; i++) {
          pixel(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), '#ffffff');
        }
        break;

      case 37: // Mossy Cobble
        gridNoise(105, 105, 105, 10);
        // Green moss spots
        for (let i = 0; i < 15; i++) {
          pixel(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), '#327027');
        }
        break;

      case 38: // Bricks
        gridNoise(165, 80, 60, 10);
        // Mortar lines
        ctx.fillStyle = '#dcdcdc';
        ctx.fillRect(x, y + 3, 16, 1);
        ctx.fillRect(x, y + 7, 16, 1);
        ctx.fillRect(x, y + 11, 16, 1);
        ctx.fillRect(x, y + 15, 16, 1);
        // Vertical lines
        ctx.fillRect(x + 4, y, 1, 3);
        ctx.fillRect(x + 12, y, 1, 3);
        ctx.fillRect(x + 8, y + 4, 1, 3);
        ctx.fillRect(x + 4, y + 8, 1, 3);
        ctx.fillRect(x + 12, y + 8, 1, 3);
        ctx.fillRect(x + 8, y + 12, 1, 3);
        break;

      case 39: // Bookshelf
        gridNoise(180, 135, 80, 5); // Planks background
        // Book shelves
        ctx.fillStyle = '#6b4c2b';
        ctx.fillRect(x, y + 4, 16, 2);
        ctx.fillRect(x, y + 11, 16, 2);
        // Draw colorful books
        const colors = ['#aa3838', '#3858aa', '#38aa58', '#dcdcdc', '#cca025'];
        for (let px = 1; px < 15; px += 2) {
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillRect(x + px, y + 1, 1.5, 3);
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillRect(x + px, y + 7, 1.5, 4);
        }
        break;

      case 40: // Sponge
        gridNoise(220, 210, 80, 15);
        // Sponge holes
        ctx.fillStyle = '#9c8c1e';
        for (let i = 0; i < 15; i++) {
          pixel(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), '#9c8c1e');
        }
        break;

      case 41: // Wool White
        gridNoise(235, 235, 235, 5);
        break;
      case 42: // Wool Red
        gridNoise(180, 40, 40, 10);
        break;
      case 43: // Wool Green
        gridNoise(40, 140, 40, 10);
        break;
      case 44: // Wool Blue
        gridNoise(40, 50, 180, 10);
        break;

      case 45: // Tall Grass
        ctx.clearRect(x, y, 16, 16);
        ctx.fillStyle = '#5c9932';
        // Draw some grass stems
        ctx.fillRect(x + 4, y + 8, 1, 8);
        ctx.fillRect(x + 8, y + 3, 1, 13);
        ctx.fillRect(x + 12, y + 7, 1, 9);
        pixel(3, 9, '#5c9932');
        pixel(7, 4, '#5c9932');
        pixel(13, 8, '#5c9932');
        break;

      case 46: // Dandelion
        ctx.clearRect(x, y, 16, 16);
        // Stem
        ctx.fillStyle = '#5c9932';
        ctx.fillRect(x + 7, y + 6, 2, 10);
        // Yellow flower head
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(x + 6, y + 3, 4, 3);
        pixel(7, 2, '#ffea00');
        pixel(8, 2, '#ffea00');
        break;

      case 47: // Poppy
        ctx.clearRect(x, y, 16, 16);
        // Stem
        ctx.fillStyle = '#5c9932';
        ctx.fillRect(x + 7, y + 6, 2, 10);
        // Red Poppy head
        ctx.fillStyle = '#e82525';
        ctx.fillRect(x + 5, y + 3, 5, 3);
        pixel(7, 4, '#222222'); // black center
        break;

      case 50: // Cactus Top
        gridNoise(35, 115, 30, 8);
        // Star pattern ridges
        ctx.fillStyle = '#1e5e1a';
        ctx.fillRect(x + 7, y, 2, 16);
        ctx.fillRect(x, y + 7, 16, 2);
        break;

      case 51: // Cactus Side
        gridNoise(35, 115, 30, 8);
        // Vertical ridges
        ctx.fillStyle = '#1e5e1a';
        ctx.fillRect(x + 3, y, 2, 16);
        ctx.fillRect(x + 11, y, 2, 16);
        // White spikes
        ctx.fillStyle = '#ffffff';
        pixel(3, 4, '#ffffff');
        pixel(11, 7, '#ffffff');
        pixel(5, 11, '#ffffff');
        break;

      case 55: // Iron Block
        gridNoise(220, 220, 220, 5);
        // Smooth rivet joints
        ctx.strokeStyle = '#999999';
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        break;

      case 56: // Gold Block
        gridNoise(250, 215, 55, 6);
        ctx.strokeStyle = '#cf9d17';
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        break;

      case 57: // Diamond Block
        gridNoise(100, 240, 255, 8);
        ctx.strokeStyle = '#3eb7c9';
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
        break;

      case 58: // Netherrack
        gridNoise(90, 20, 20, 15);
        break;

      case 59: // Soul Sand
        gridNoise(65, 45, 30, 8);
        // Distorted screaming faces
        ctx.fillStyle = '#3e2c1e';
        pixel(4, 5, '#3e2c1e');
        pixel(10, 5, '#3e2c1e');
        ctx.fillRect(x + 6, y + 8, 3, 2);
        break;

      case 61: // Pumpkin Top
        gridNoise(225, 120, 20, 10);
        // Center stem
        ctx.fillStyle = '#4c6e3b';
        ctx.fillRect(x + 7, y + 7, 2, 2);
        break;

      case 62: // Pumpkin Side
        gridNoise(225, 120, 20, 10);
        // Vertical grooves
        ctx.fillStyle = '#a6560b';
        ctx.fillRect(x + 4, y, 1, 16);
        ctx.fillRect(x + 8, y, 1, 16);
        ctx.fillRect(x + 12, y, 1, 16);
        break;

      case 63: // Jack O Lantern Front
        gridNoise(225, 120, 20, 10);
        // Glowing face
        ctx.fillStyle = '#ffea00';
        // Eyes
        ctx.fillRect(x + 3, y + 3, 2, 2);
        ctx.fillRect(x + 11, y + 3, 2, 2);
        // Nose
        ctx.fillRect(x + 7, y + 6, 2, 2);
        // Mouth
        ctx.fillRect(x + 4, y + 9, 8, 2);
        pixel(4, 8, '#ffea00');
        pixel(11, 8, '#ffea00');
        break;

      case 66: // TNT Top
        gridNoise(180, 40, 40, 10);
        // Fuse lines
        ctx.strokeStyle = '#222222';
        ctx.strokeRect(x + 3, y + 3, 10, 10);
        break;

      case 67: // TNT Bottom
        gridNoise(180, 40, 40, 10);
        break;

      case 68: // TNT Side
        // Red tubes
        fillTile('#cc2c2c');
        ctx.fillStyle = '#8f1c1c';
        for (let px = 1; px < 16; px += 2) {
          ctx.fillRect(x + px, y, 1, 16);
        }
        // White label
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y + 6, 16, 4);
        ctx.fillStyle = '#000000';
        // Letters "TNT" (approx)
        pixel(2, 7, '#000000'); pixel(3, 7, '#000000'); pixel(4, 7, '#000000');
        pixel(3, 8, '#000000'); pixel(3, 9, '#000000'); // T
        pixel(7, 7, '#000000'); pixel(7, 9, '#000000');
        pixel(8, 8, '#000000'); pixel(9, 7, '#000000'); pixel(9, 9, '#000000'); // N
        pixel(12, 7, '#000000'); pixel(13, 7, '#000000'); pixel(14, 7, '#000000');
        pixel(13, 8, '#000000'); pixel(13, 9, '#000000'); // T
        break;

      case 69: // Ladder
        ctx.clearRect(x, y, 16, 16);
        ctx.fillStyle = '#85633e';
        // Sides
        ctx.fillRect(x + 2, y, 2, 16);
        ctx.fillRect(x + 12, y, 2, 16);
        // Rungs
        ctx.fillRect(x + 4, y + 3, 8, 1);
        ctx.fillRect(x + 4, y + 7, 8, 1);
        ctx.fillRect(x + 4, y + 11, 8, 1);
        ctx.fillRect(x + 4, y + 15, 8, 1);
        break;

      case 70: // Cobweb
        ctx.clearRect(x, y, 16, 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        // Web diagonals
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 16);
        ctx.moveTo(x + 16, y); ctx.lineTo(x, y + 16);
        ctx.moveTo(x + 8, y); ctx.lineTo(x + 8, y + 16);
        ctx.moveTo(x, y + 8); ctx.lineTo(x + 16, y + 8);
        ctx.stroke();
        break;

      case 71: // Mycelium Top
        gridNoise(122, 98, 122, 12); // purple-gray mycelium color
        // Add purple/spore spots
        for (let i = 0; i < 6; i++) {
          const px = Math.floor(Math.random() * 14) + 1;
          const py = Math.floor(Math.random() * 14) + 1;
          pixel(px, py, '#9a7ca5');
          pixel(px, py - 1, '#b096bb');
        }
        break;

      case 72: // Mycelium Side
        // Bottom dirt
        ctx.fillStyle = '#6e4b2e';
        ctx.fillRect(x, y + 4, 16, 12);
        // Add dirt noise
        for (let py = 4; py < 16; py++) {
          for (let px = 0; px < 16; px++) {
            if (Math.random() > 0.7) {
              ctx.fillStyle = Math.random() > 0.5 ? '#5c3e26' : '#7f5938';
              ctx.fillRect(x + px, y + py, 1, 1);
            }
          }
        }
        // Top purple overlay
        ctx.fillStyle = '#8a6c8a';
        ctx.fillRect(x, y, 16, 4);
        // Spores hanging down
        for (let px = 0; px < 16; px++) {
          const depth = Math.floor(Math.random() * 4) + 2;
          ctx.fillStyle = '#8a6c8a';
          ctx.fillRect(x + px, y, 1, depth);
          pixel(px, depth - 1, '#664d66');
        }
        break;

      case 73: // Terracotta
        gridNoise(178, 108, 79, 10); // Reddish-orange terracotta clay
        // Add some horizontal color bands
        ctx.fillStyle = '#9e5a37';
        ctx.fillRect(x, y + 3, 16, 2);
        ctx.fillRect(x, y + 10, 16, 3);
        ctx.fillStyle = '#c57d56';
        ctx.fillRect(x, y + 7, 16, 1);
        break;

      case 74: // Red Mushroom Block
        fillTile('#b71c1c'); // Deep red
        // Add white spots
        pixel(2, 2, '#ffffff');
        pixel(3, 2, '#ffffff');
        pixel(2, 3, '#ffffff');
        pixel(11, 4, '#ffffff');
        pixel(12, 4, '#ffffff');
        pixel(11, 5, '#ffffff');
        pixel(6, 9, '#ffffff');
        pixel(7, 9, '#ffffff');
        pixel(6, 10, '#ffffff');
        pixel(13, 12, '#ffffff');
        pixel(2, 13, '#ffffff');
        break;

      case 75: // Brown Mushroom Block
        fillTile('#5d4037'); // Medium brown
        // Add lighter brown/tan spots
        pixel(3, 3, '#8d6e63');
        pixel(4, 3, '#8d6e63');
        pixel(10, 2, '#8d6e63');
        pixel(12, 7, '#8d6e63');
        pixel(6, 11, '#8d6e63');
        pixel(7, 11, '#8d6e63');
        pixel(13, 12, '#8d6e63');
        pixel(2, 12, '#8d6e63');
        break;

      case 76: // Mushroom Stem
        gridNoise(225, 220, 210, 5); // Off-white/cream stem
        // Light grey vertical texture lines
        ctx.fillStyle = '#b0aaa0';
        ctx.fillRect(x + 4, y, 1, 16);
        ctx.fillRect(x + 11, y, 1, 16);
        break;

      case 77: // Mushroom Inside
        gridNoise(235, 230, 220, 4); // Light beige/cream inside pores
        break;

      case 78: // Acacia Log Top
        gridNoise(216, 115, 60, 8); // Orange center
        ctx.strokeStyle = '#5c544d'; // grey ring
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2.5, y + 2.5, 11, 11);
        ctx.strokeRect(x + 5.5, y + 5.5, 5, 5);
        pixel(7, 7, '#e67e22');
        break;

      case 79: // Acacia Log Side
        gridNoise(100, 95, 90, 8); // Grey outer bark
        // Vertical lines with orange cracks/accents
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(x + 3, y, 1, 16);
        ctx.fillRect(x + 11, y, 1, 16);
        ctx.fillStyle = '#5c544d';
        ctx.fillRect(x + 2, y, 1, 16);
        ctx.fillRect(x + 10, y, 1, 16);
        break;

      case 80: // Acacia Leaves
        gridNoise(45, 120, 40, 20); // slightly different green
        // Punch some transparent holes
        for (let i = 0; i < 20; i++) {
          const px = Math.floor(Math.random() * 16);
          const py = Math.floor(Math.random() * 16);
          if (px > 0 && px < 15 && py > 0 && py < 15) {
            pixel(px, py, 'rgba(0,0,0,0)');
          }
        }
        break;

      case 81: // Nether Portal
        // Purple/magenta swirl texture
        gridNoise(100, 30, 150, 35);
        ctx.fillStyle = 'rgba(255, 0, 255, 0.4)';
        for (let i = 0; i < 15; i++) {
          const px = Math.floor(Math.random() * 14) + 1;
          const py = Math.floor(Math.random() * 14) + 1;
          ctx.fillRect(x + px, y + py, 2, 2);
        }
        break;

      default: // Cobblestone / generic default
        gridNoise(100, 100, 100, 15);
        // Draw stones dividers
        ctx.fillStyle = '#555555';
        ctx.fillRect(x, y + 4, 16, 1);
        ctx.fillRect(x, y + 9, 16, 1);
        ctx.fillRect(x + 6, y, 1, 4);
        ctx.fillRect(x + 11, y + 5, 1, 4);
        ctx.fillRect(x + 4, y + 10, 1, 6);
        break;
    }
  }

  /**
   * Helper to draw mineral spots for ores
   */
  private static drawOreSpots(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    const spots = [
      [3, 3, 2, 2],
      [10, 2, 3, 1],
      [7, 6, 2, 2],
      [2, 9, 3, 2],
      [11, 10, 2, 2],
      [6, 12, 3, 1]
    ];
    ctx.fillStyle = color;
    for (const s of spots) {
      ctx.fillRect(x + s[0], y + s[1], s[2], s[3]);
    }
  }

  /**
   * Safe initialization of the Web Audio context
   */
  private static initAudio(): void {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Synth sound: plays standard sound effect
   */
  public static playSound(type: 'dig' | 'place' | 'walk' | 'hurt' | 'jump' | 'hiss' | 'explode' | 'shoot' | 'hit', blockId = 0): void {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'dig' || type === 'walk') {
        // Low-pass filtered noise/pop
        osc.type = 'triangle';
        const startFreq = blockId === 1 || blockId === 19 ? 80 : 150; // lower pitches for stone/cobble
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'place') {
        // High click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'jump') {
        // Subtle upward sweep
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'hurt') {
        // Descending synth oof
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.25);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'hiss') {
        // White noise bandpass sweep for creeper fuse
        const bufferSize = this.audioCtx.sampleRate * 1.5;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);

        noise.connect(filter);
        filter.connect(gain);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        noise.start(now);
        noise.stop(now + 1.5);
      } else if (type === 'explode') {
        // Low-pitch noise + rumble
        const bufferSize = this.audioCtx.sampleRate * 0.8;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(10, now + 0.8);

        noise.connect(filter);
        filter.connect(gain);

        // Combine with a low frequency sine wave for punch
        const subOsc = this.audioCtx.createOscillator();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(90, now);
        subOsc.frequency.linearRampToValueAtTime(5, now + 0.65);
        
        const subGain = this.audioCtx.createGain();
        subGain.gain.setValueAtTime(0.35, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        subOsc.connect(subGain);
        subGain.connect(this.audioCtx.destination);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        
        noise.start(now);
        noise.stop(now + 0.8);
        subOsc.start(now);
        subOsc.stop(now + 0.8);
      } else if (type === 'shoot') {
        // High frequency sweep
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'hit') {
        // Arrow thump
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch (e) {
      console.warn('Audio context playback failed (needs user gesture interaction).', e);
    }
  }

  /**
   * Synth sound: plays level up arpeggio chime
   */
  public static playLevelUpSound(): void {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      // Arpeggio notes: C5, E5, G5, C6
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const time = now + idx * 0.12;
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.15, time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

        osc.start(time);
        osc.stop(time + 0.4);
      });
    } catch (e) {
      console.warn('Level up sound failed', e);
    }
  }

  /**
   * Synth sound: plays achievement unlocked chime
   */
  public static playAchievementSound(): void {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      // High-pitched double chime: E6 then G6
      const freqs = [659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const time = now + idx * 0.1;
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

        osc.start(time);
        osc.stop(time + 0.3);
      });
    } catch (e) {
      console.warn('Achievement sound failed', e);
    }
  }


  /**
   * Synthesize arpeggiated ambient music
   */
  private static musicTimer: any = null;

  public static playProceduralMusic(): void {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.musicTimer) return; // Already running

      const notes = [261.63, 293.66, 329.63, 392.00, 440.00]; // Pentatonic scale (C, D, E, G, A)

      const scheduleNextNote = () => {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        const note = notes[Math.floor(Math.random() * notes.length)];
        osc.frequency.setValueAtTime(note, now);

        gain.connect(this.audioCtx.destination);
        osc.connect(gain);

        // Gentle volume curve
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.5); // very soft ambient background
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

        osc.start(now);
        osc.stop(now + 3.0);

        // Next note in 4-6 seconds
        this.musicTimer = setTimeout(scheduleNextNote, 4000 + Math.random() * 2000);
      };

      scheduleNextNote();
    } catch (e) {
      console.warn('Procedural music play failed.', e);
    }
  }

  public static stopMusic(): void {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
