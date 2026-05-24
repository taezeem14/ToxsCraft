/**
 * Tox'sCraft TextureAtlas
 * Computes UV coordinates for faces within the texture atlas.
 */

export class TextureAtlas {
  private static readonly COLS = 16;
  private static readonly TILE_SIZE = 1 / 16; // 0.0625

  /**
   * Returns the UV coordinates [uMin, vMin, uMax, vMax] for a given texture index.
   * To prevent texture bleeding, we add a half-pixel padding inside the UV bounds.
   */
  public static getUVs(index: number): [number, number, number, number] {
    const col = index % this.COLS;
    const row = Math.floor(index / this.COLS);

    // Coordinate ranges
    const uMin = col * this.TILE_SIZE;
    const uMax = uMin + this.TILE_SIZE;
    
    // In WebGL, V=0 is the bottom and V=1 is the top.
    const vMax = 1 - row * this.TILE_SIZE;
    const vMin = vMax - this.TILE_SIZE;

    // Small pixel buffer padding (1/32th of a pixel inside) to avoid texture bleeding/seams
    const padding = 0.0001; 
    
    return [
      uMin + padding,
      vMin + padding,
      uMax - padding,
      vMax - padding
    ];
  }
}
