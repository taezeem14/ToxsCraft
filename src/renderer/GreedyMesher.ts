/**
 * Tox'sCraft GreedyMesher
 * Reduces block face rendering counts by merging contiguous identical faces.
 * Computes per-vertex Ambient Occlusion (AO) shadow mapping.
 */

import { CHUNK_SIZE, CHUNK_HEIGHT } from '../constants';
import { Chunk } from '../world/Chunk';
import { getBlock } from '../world/BlockRegistry';
import { TextureAtlas } from './TextureAtlas';

export class GreedyMesher {
  /**
   * Generates solid and transparent geometry data for a chunk
   */
  public static generateGeometry(chunk: Chunk, chunkManager: any) {
    const solidData = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], colors: [] as number[], indices: [] as number[] };
    const transData = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], colors: [] as number[], indices: [] as number[] };

    let solidIndexCount = 0;
    let transIndexCount = 0;

    // Helper to get block ID safely across chunk borders
    const getBlockId = (lx: number, ly: number, lz: number): number => {
      if (ly < 0 || ly >= CHUNK_HEIGHT) return 0;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
        return chunk.getBlock(lx, ly, lz);
      }
      // Fetch from chunkManager if out of local bounds
      const wx = chunk.x * CHUNK_SIZE + lx;
      const wz = chunk.z * CHUNK_SIZE + lz;
      return chunkManager.getBlock(wx, ly, wz);
    };

    // Helper to get ambient occlusion value for a corner vertex on a face
    // side1, side2 are neighbor block checks, corner is diagonal neighbor block check
    const calculateAO = (s1: boolean, s2: boolean, c: boolean): number => {
      if (s1 && s2) return 0; // Fully occluded corner
      return 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0)); // 0 (darkest) to 3 (brightest)
    };

    // We mesh along 6 face directions: 0 = X-, 1 = X+, 2 = Y-, 3 = Y+, 4 = Z-, 5 = Z+
    for (let f = 0; f < 6; f++) {
      const isBack = f % 2 === 0;
      const axis = Math.floor(f / 2); // 0 = X, 1 = Y, 2 = Z

      // Setup sweeping bounds
      const dimD = axis === 0 ? CHUNK_SIZE : (axis === 1 ? CHUNK_HEIGHT : CHUNK_SIZE);
      const dimU = axis === 1 ? CHUNK_SIZE : CHUNK_SIZE; // sweep along remaining
      const dimV = axis === 1 ? CHUNK_SIZE : (axis === 0 ? CHUNK_HEIGHT : CHUNK_HEIGHT);

      // Sweep along the perpendicular axis 'd'
      for (let d = 0; d < dimD; d++) {
        // Create visited / face mask
        const mask = new Int32Array(dimU * dimV); // holds blockId (positive) or 0 (no face)

        // Fill mask
        for (let v = 0; v < dimV; v++) {
          for (let u = 0; u < dimU; u++) {
            // Get 3D coords of current voxel and its neighbor in direction 'f'
            let x = 0, y = 0, z = 0;
            let nx = 0, ny = 0, nz = 0;

            if (axis === 0) { // X
              x = d; y = v; z = u;
              nx = isBack ? d - 1 : d + 1; ny = v; nz = u;
            } else if (axis === 1) { // Y
              x = u; y = d; z = v;
              nx = u; ny = isBack ? d - 1 : d + 1; nz = v;
            } else { // Z
              x = u; y = v; z = d;
              nx = u; ny = v; nz = isBack ? d - 1 : d + 1;
            }

            const current = getBlockId(x, y, z);
            const neighbor = getBlockId(nx, ny, nz);

            const b1 = getBlock(current);
            const b2 = getBlock(neighbor);

            // Classify blocks into render categories:
            //   fluid      = water / lava (fluid: true)  -> transparent pass (depthWrite:false)
            //   alphaSolid = transparent:true but NOT fluid (leaves, glass, ice) -> solid pass (alphaTest discard)
            //   opaque     = everything else solid
            if (current !== 0) {
              const currentFluid = !!b1.fluid;
              const currentAlphaSolid = b1.transparent && !b1.fluid; // leaves, glass, ice …
              const currentOpaque = !b1.transparent && !b1.fluid;

              const neighborFluid = !!b2.fluid;
              const neighborAlphaSolid = b2.transparent && !b2.fluid;

              // Face draw rules:
              //  opaque      -> show face if neighbor is air / fluid / alphaSolid
              //  alphaSolid  -> show face if neighbor is air or fluid; DON'T show vs. another opaque
              //                 (the opaque side already draws a face toward us)
              //                 DO show if neighbor is a DIFFERENT alphaSolid block type
              //  fluid       -> show face if neighbor is air or opaque/alphaSolid (different block)
              let drawFace = false;
              if (currentOpaque) {
                drawFace = neighbor === 0 || neighborFluid || neighborAlphaSolid;
              } else if (currentAlphaSolid) {
                if (neighbor === 0) drawFace = true;
                else if (neighborFluid) drawFace = true;
                else if (neighborAlphaSolid && current !== neighbor) drawFace = true;
                // Do NOT draw against opaque blocks – the opaque already covers us
              } else if (currentFluid) {
                if (neighbor === 0) drawFace = true;
                else if (!neighborFluid) drawFace = true; // fluid face against any non-fluid
                else if (current !== neighbor) drawFace = true; // e.g. water next to lava
              }

              if (drawFace) {
                mask[u + v * dimU] = current;
              }
            }
          }
        }

        // Perform greedy meshing on the mask slice
        for (let v = 0; v < dimV; v++) {
          for (let u = 0; u < dimU; u++) {
            const blockId = mask[u + v * dimU];
            if (blockId === 0) continue;

            // Find width 'w' - To stop stretched textures on an atlas, we force 1x1 faces
            let w = 1;

            // Find height 'h'
            let h = 1;

            // Generate quad vertices and texture details
            // Block Definition face override check
            const bDef = getBlock(blockId);
            let texIndex = bDef.textures.side;
            if (axis === 1) { // Y- or Y+
              texIndex = isBack ? bDef.textures.bottom : bDef.textures.top;
            } else if (axis === 0 && !isBack && bDef.textures.front && f === 1) { // X+ Front
              texIndex = bDef.textures.front;
            } else if (axis === 2 && !isBack && bDef.textures.front && f === 5) { // Z+ Front
              texIndex = bDef.textures.front;
            }

            const uv = TextureAtlas.getUVs(texIndex);

            // Compute AO for all 4 corners of the merged quad
            const aoColors: number[] = [];
            for (let corner = 0; corner < 4; corner++) {
              // Get corner coordinate
              let cu = u + (corner === 1 || corner === 2 ? w : 0);
              let cv = v + (corner === 2 || corner === 3 ? h : 0);

              // Map cu, cv back to 3D grid coords to fetch neighbors
              let qx = 0, qy = 0, qz = 0;
              if (axis === 0) {
                qx = d; qy = cv; qz = cu;
              } else if (axis === 1) {
                qx = cu; qy = d; qz = cv;
              } else {
                qx = cu; qy = cv; qz = d;
              }

              // Compute side offsets perpendicular to the face normal
              let s1x = 0, s1y = 0, s1z = 0;
              let s2x = 0, s2y = 0, s2z = 0;
              let diagx = 0, diagy = 0, diagz = 0;

              const uDir = (corner === 1 || corner === 2) ? 1 : -1;
              const vDir = (corner === 2 || corner === 3) ? 1 : -1;

              // Setup offsets along axis sweeps
              if (axis === 0) { // norm is X. Sides are Y and Z.
                s1y = vDir; s2z = uDir;
              } else if (axis === 1) { // norm is Y. Sides are X and Z.
                s1x = uDir; s2z = vDir;
              } else { // norm is Z. Sides are X and Y.
                s1x = uDir; s2y = vDir;
              }

              diagx = s1x + s2x; diagy = s1y + s2y; diagz = s1z + s2z;

              // Step outside to check obstruction
              const nShift = isBack ? -1 : 1;
              let ox = qx + (axis === 0 ? nShift : 0);
              let oy = qy + (axis === 1 ? nShift : 0);
              let oz = qz + (axis === 2 ? nShift : 0);

              const block1 = getBlock(getBlockId(ox + s1x, oy + s1y, oz + s1z)).solid;
              const block2 = getBlock(getBlockId(ox + s2x, oy + s2y, oz + s2z)).solid;
              const blockC = getBlock(getBlockId(ox + diagx, oy + diagy, oz + diagz)).solid;

              const aoVal = calculateAO(block1, block2, blockC);
              // Translate 0-3 to shading float: 0 -> 0.45, 1 -> 0.65, 2 -> 0.8, 3 -> 1.0
              const shadow = aoVal === 0 ? 0.45 : (aoVal === 1 ? 0.65 : (aoVal === 2 ? 0.82 : 1.0));
              aoColors.push(shadow);
            }

            // Append vertices and index offsets
            // Only true fluid blocks (water / lava) go into the transparent (depthWrite:false) pass.
            // Alpha-solid blocks (leaves, glass, ice) stay in the solid pass and rely on
            // the shader's `discard` for transparent pixels (alphaTest behaviour).
            const isFluidBlock = !!bDef.fluid;
            const dest = isFluidBlock ? transData : solidData;
            let ind = isFluidBlock ? transIndexCount : solidIndexCount;

            const n = isBack ? -1 : 1;
            const norm = [axis === 0 ? n : 0, axis === 1 ? n : 0, axis === 2 ? n : 0];

            // Corner vertex positions mapping
            // Corner orders: 0: BL, 1: BR, 2: TR, 3: TL
            const pos = [
              [0, 0], [w, 0], [w, h], [0, h]
            ];

            for (let i = 0; i < 4; i++) {
              const cu = u + pos[i][0];
              const cv = v + pos[i][1];

              let vx = 0, vy = 0, vz = 0;
              if (axis === 0) {
                vx = d + (isBack ? 0 : 1); vy = cv; vz = cu;
              } else if (axis === 1) {
                vx = cu; vy = d + (isBack ? 0 : 1); vz = cv;
              } else {
                vx = cu; vy = cv; vz = d + (isBack ? 0 : 1);
              }

              dest.positions.push(vx, vy, vz);
              dest.normals.push(norm[0], norm[1], norm[2]);

              // UV mapping for corners
              const uVal = i === 1 || i === 2 ? uv[2] : uv[0];
              const vVal = i === 2 || i === 3 ? uv[3] : uv[1];
              dest.uvs.push(uVal, vVal);

              // Set AO baked color (RGB same multiplier)
              const shade = aoColors[i];
              dest.colors.push(shade, shade, shade);
            }

            // Write index patterns (two triangles per quad)
            // Determine winding order to ensure all face polygons are counter-clockwise (CCW)
            // when viewed from the outside (preventing them from being culled by the GPU).
            // - Z axis: isBack (Z-) is CW in standard layout, Z+ is CCW. So invert for Z-.
            // - X and Y axes: the mapping of plane coords to 3D axes inverts the default orientation.
            //   So X+ and Y+ are CW, while X- and Y- are CCW. We must invert winding for X+ and Y+ (i.e. !isBack).
            const invertWinding = (axis === 2) ? isBack : !isBack;
            if (invertWinding) {
              dest.indices.push(
                ind, ind + 2, ind + 1,
                ind, ind + 3, ind + 2
              );
            } else {
              dest.indices.push(
                ind, ind + 1, ind + 2,
                ind, ind + 2, ind + 3
              );
            }

            if (isFluidBlock) {
              transIndexCount += 4;
            } else {
              solidIndexCount += 4;
            }

            // Mark these slots in mask as visited
            for (let dy = 0; dy < h; dy++) {
              for (let dx = 0; dx < w; dx++) {
                mask[(u + dx) + (v + dy) * dimU] = 0;
              }
            }
          }
        }
      }
    }

    return { solid: solidData, transparent: transData };
  }
}
