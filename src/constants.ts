/**
 * Tox'sCraft Voxel Engine Constants
 */

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256; // Render height standard. Let's make it 256.
export const CHUNK_SLICES = CHUNK_SIZE * CHUNK_SIZE;

// Build bounds (vertical height limits)
export const WORLD_MIN_Y = 0;
export const WORLD_MAX_Y = 256;

// Physics settings
export const GRAVITY = -32.0; // Blocks/sec^2
export const TERMINAL_VELOCITY = -60.0;
export const BUOYANCY = 12.0;

// Player metrics
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.3; // Half-width (0.6 blocks total diameter)
export const PLAYER_REACH = 5.0; // Max distance for mining/placing

// Speeds
export const WALK_SPEED = 4.3; // Blocks per second
export const SPRINT_SPEED = 5.6;
export const SNEAK_SPEED = 1.3;
export const FLY_SPEED = 15.0;
export const JUMP_FORCE = 8.5;

// Tick settings
export const TICK_MS = 50; // 20 ticks per second (TPS)
export const SECONDS_PER_DAY = 1200; // 20-minute day cycle
