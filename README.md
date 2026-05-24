# TOX'SCRAFT 🚀

> A 3D voxel sandbox engine that is **built different**. No cap, this goes hard. 

Tox'sCraft is a production-grade Minecraft-inspired survival game built from scratch using TypeScript, Three.js, and raw GLSL shaders. 

It features infinite procedurally-generated biomes, custom AABB sweep-and-slide collision physics, an on-the-fly greedy meshing pipeline, Web Audio sound synthesizers, and IndexedDB world state saves. 

It's giving premium. It's giving 60 FPS.

---

## 🛠️ The Tech Stack (Lowkey Stacked)

| Layer | Tech | Why it's a W |
|---|---|---|
| **Core Viewport** | Three.js (r160+) | WebGL wrapper that carries the rendering |
| **Pipeline Shaders** | Custom GLSL (Vert/Frag) | Vert-color Ambient Occlusion, waving water, glowing lava |
| **Terrain Generation** | Simplex Noise + Octaves | Seeded heightmaps + caves + 8 biomes blending |
| **Performance Mesher**| Greedy Meshing Algorithm | Combines matching block faces. Culls 90% triangles |
| **Physics** | Custom Sweep AABB | Sweep-and-slide AABB resolution. Zero clipping |
| **State Database** | IndexedDB via `idb` | Autosave intervals that write chunk bytes locally |
| **Synth Audio** | Web Audio API | Pentatonic background soundscapes + block breaking cues |
| **Bundling** | Vite + TypeScript | Instant HMR and type-safety check |

---

## 🔥 Features (Sheesh)

- 🏞️ **Infinite Seeded Terrain**: 8 biomes (Plains, Desert, Tundra, Jungle, Ocean, Swamp, Mountains, Forest) that blend smoothly using HSL fog transitions.
- 🕳️ **Cave Worms & Aquifers**: 3D simplex noise carves organic underground passages, ravines, and water pockets.
- 💎 **Biome Ore Tables**: Coal, iron, gold, redstone, lapis, diamond, and emerald cluster veins spawn at specific vertical depth thresholds.
- 🍖 **Survival Loops**: Health, hunger, stamina, drowning, fall damage, and lava burning. Regen health when hunger is full.
- 🧱 **Aesthetic Block Registry**: 64+ block definitions, including interactive crafting tables and furnaces.
- 🎒 **Inventory & Crafting**: Drag-and-drop 36-slot inventory screen with 2x2 crafting grid resolver (log -> planks, planks -> sticks, sticks + coal -> torches).
- 💾 **Local Persistence**: Full world save/load system so your builds never disappear.
- 🌟 **Celestial Dome**: Day/night cycle with rotating Sun/Moon orbits, sky Rayleigh gradients, and star clouds that fade at sunrise.

---

## 🕹️ Controls (How to Play)

- `W` / `A` / `S` / `D` — Movement
- `Mouse Movement` — Camera Look (Pointer Locked)
- `Space` — Jump / Swim Up / Fly Up
- `Shift` — Sneak / Fly Down
- `Double Tap Space` — Toggle Flying (Creative mode)
- `Left Click` — Mine / Break targeted block (Hold to crunch)
- `Right Click` — Place selected held block / Interact
- `E` — Toggle Inventory & Crafting Screen
- `1` - `9` / `Scroll Wheel` — Select hotbar slot
- `Escape` — Pause / Settings Menu

---

## 🚀 Setup & Launch (No Cap)

Ensure you have **Node.js v20+** installed, then execute:

```bash
# 1. Install dependencies
pnpm install

# 2. Start the local Vite server
pnpm dev

# 3. Check type safety compilation
npx tsc --noEmit
```

Open `http://localhost:3000` in Chrome/Firefox and enjoy. Let's cook! 🍳
