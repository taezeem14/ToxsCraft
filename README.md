```
 ████████╗ ██████╗ ██╗  ██╗███████╗     ██████╗██████╗  █████╗ ███████╗████████╗
    ██╔══╝██╔═══██╗╚██╗██╔╝██╔════╝    ██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝
    ██║   ██║   ██║ ╚███╔╝ ███████╗    ██║     ██████╔╝███████║█████╗     ██║
    ██║   ██║   ██║ ██╔██╗ ╚════██║    ██║     ██╔══██╗██╔══██║██╔══╝     ██║
    ██║   ╚██████╔╝██╔╝ ██╗███████║    ╚██████╗██║  ██║██║  ██║██║        ██║
    ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝     ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝
```

<div align="center">

# 🪨 Tox'sCraft 🌲
### *The Ultimate WebGL Voxel Sandbox Survival Game*

> **No downloads. No launchers. Pure vibes, 3D animated viewmodels, procedural weather, explosive TNT, and survival crafting directly in your browser.**

[![Three.js](https://img.shields.io/badge/Three.js-r160+-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Blazing_Fast-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![WebGL](https://img.shields.io/badge/WebGL-Optimized_128MB_iGPU-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy_Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](./LICENSE)

</div>

---

## ✨ What Is Tox'sCraft?

Tox'sCraft is a **full-featured, high-performance 3D voxel sandbox survival game** built from scratch with **TypeScript, Three.js, and WebGL**. It runs seamlessly on any modern web browser — from high-end gaming rigs down to **128MB integrated GPUs (Intel HD / UHD / Iris / Mobile)**.

Featuring procedural infinite world generation across 11+ biomes, first-person 3D animated viewmodels, GPU particle physics, dynamic weather cycles, interactive TNT explosions, 3x3 crafting tables, furnace smelting, ranged archery, and an extensive Web Audio synthesizer.

---

## 🔥 Key Features & Systems

### 🦾 1st-Person 3D Animated ViewModel
- **Custom Player Arm & Skin Mapping**: Renders Steve, Alex, Tox, Cyber, Knight, Mage, Zombie, and Skeleton skin textures directly in first-person view.
- **3D Item & Block Miniatures**: Handheld blocks render as textured 3D voxel cubes with atlas UVs; tools display miniature 3D geometries.
- **Procedural Animations**: Realistic mining swing arcs, block placement punches, eating food wiggles, bow drawing tension, and walking/sprinting sinusoidal bobbing.

### 💥 GPU Particle Physics Engine
- **Single-Draw-Call Instanced Rendering**: Ultra-low overhead particle simulation.
- **Voxel Debris**: 16 fragments with gravity and momentum on block break.
- **Combat VFX**: Golden sparkle bursts on critical jump hits, hit sparks, and death poofs.
- **Explosion Shockwaves**: Expanding smoke clouds, fire shards, and dynamic blast radius particles.
- **Atmospheric Precipitation**: Real-time localized rain streaks and drifting snow particles.

### ⛈️ Dynamic Weather & Atmosphere
- **Weather State Machine**: Transitions between **Clear**, **Rain**, **Thunderstorm**, and **Snow**.
- **Biome Temperature Sensitivity**: Precipitates snow in Tundra/Snowy biomes, rain in Forests/Plains, and suppresses precipitation in Deserts and Badlands.
- **Sky Darkening & Lightning**: Smooth sunlight attenuation during storms with bright lightning flashes and synthesized thunder.

### 💣 Interactive Primed TNT & Explosions
- **Physics Ignition**: Right-click placed TNT blocks or use Flint & Steel to ignite.
- **Swell & White Flash Fuse**: 3-second fuse with white-swelling animation and hissing audio.
- **Spherical Voxel Craters**: Destroys surrounding soft blocks within a 4-block spherical radius (preserves Bedrock and Obsidian).
- **Shockwave Physics**: Applies velocity knockback, damage, and camera screen shake to players and mobs.

### 🪓 3×3 Crafting Table & 2×2 Inventory Crafting
- **Interactive 3×3 Modal GUI**: Right-click placed Crafting Tables to open the full crafting screen.
- **Comprehensive Recipe Book**:
  - **Tools & Weapons**: Pickaxes, Swords, Axes, Shovels (Wood, Stone, Iron, Diamond).
  - **Armor Sets**: Helmets, Chestplates, Leggings, Boots.
  - **Ranged & Survival**: Bows, Arrows, TNT, Torches, Furnaces, Chests, Golden Apples, Bread.

### 🔥 Furnace Smelting Engine
- **Smelting GUI**: Input slot, fuel slot, animated flame gauge, and output collector.
- **Smelting Recipes**: Raw Iron/Gold into Ingots, Sand into Glass, Cobblestone into Stone, Clay into Terracotta, Raw Meats into Cooked Steaks/Porkchops.
- **Fuel Economy**: Coal (16s), Logs (8s), Planks (6s), and Sticks (4s).

### 🏹 Bow & Arrow Ranged Combat
- **Ballistic Physics**: Fires aerodynamic arrows with gravity trajectories and velocity momentum.
- **Mob Piercing**: Registers hit damage, knockback, and critical damage on mobs.

### 🛡️ Survival HUD & Audio Synthesizer
- **Armor Bar**: 10 dynamic shields displaying equipped defense points.
- **Oxygen Bubble Bar**: Submersion detector with 10 bubbles and drowning damage.
- **Tool Durability Meters**: In-slot health bars (Green $\rightarrow$ Yellow $\rightarrow$ Red).
- **Damage Screen Vignette**: Red pulse effect on player hurt.
- **25+ Procedural Web Audio Synthesizers**: Real-time sound synthesis for footsteps, digging, tool breaks, weapon sweeps, crits, eating, explosions, thunder, and mob noises (Cow, Pig, Zombie, Skeleton, Creeper, Spider, Chicken, Slime).

### ⚡ 128MB iGPU & Low-End Optimization
- **Zero-GC Render Loops**: Pooled static scratch vectors and colors to eliminate garbage collection frame stalls.
- **Front-Side Culling**: Halved triangle rasterization load for opaque blocks.
- **$O(1)$ Swap-and-Pop Particles**: Eliminates $O(n^2)$ array shifts during large explosions.
- **Dirty Chunk Saving**: Prevents massive IndexedDB disk freezes by saving only modified chunks.
- **Hardware Auto-Detection**: Automatically detects Intel HD/UHD/Iris/Mali/Adreno and adjusts render distance for smooth 60 FPS.

---

## 🕹️ Controls & Keybindings

| Key / Input | Action |
|---|---|
| `W` `A` `S` `D` | Move (Walk / Sprint) |
| `Mouse Move` | Look around (Pointer Lock) |
| `Space` | Jump / Swim Up / Fly Up ✈️ |
| `Shift` | Sneak / Fly Down |
| `Double-tap Space` | Toggle Creative Flying Mode |
| `Left Click` | Mine Block / Attack Mob / Swing Tool ⛏️ |
| `Right Click` | Place Block / Interact (Crafting Table, Furnace) / Shoot Bow / Eat Food |
| `E` | Open Inventory / Close Open Modals 🎒 |
| `1`–`9` / Scroll Wheel | Select Hotbar Slot |
| `Escape` | Pause Menu / Settings |

---

## 🗺️ Biomes (11 Unique Biomes)

| Biome | Description | Block Palette |
|---|---|---|
| 🟩 **Plains** | Open rolling grasslands | Grass, Dirt, Flowers |
| 🌲 **Forest** | Dense tree canopies | Oak Logs, Leaves, Grass |
| 🏜️ **Desert** | Arid dunes with cacti | Sand, Sandstone, Cacti |
| ❄️ **Tundra** | Freezing snowfields | Snow, Ice, Dirt |
| 🌊 **Ocean** | Deep bodies of water | Water, Sand, Gravel |
| 🌿 **Jungle** | Massive tropical rainforests | Jungle Wood, Vines, Leaves |
| ⛰️ **Mountains** | Towering stone peaks | Stone, Snow, Exposed Ores |
| 🌾 **Swamp** | Murky wetlands | Mud, Oak, Water Lilies |
| 🦁 **Savanna** | Flat acacia plains | Acacia Wood, Dry Grass |
| 🔴 **Badlands** | Terracotta canyons | Terracotta, Red Sand, Gold |
| 🍄 **Mushroom Island** | Rare peaceful sanctuary | Mycelium, Huge Mushrooms |

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
|---|---|---|
| 🖼️ **3D Renderer** | [Three.js](https://threejs.org/) (WebGL) | Custom greedy meshing, viewmodel rigging, instanced particles |
| 🔷 **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict mode, zero `any` types, fully typed ECS architecture |
| ⚡ **Bundler** | [Vite](https://vitejs.dev/) | Instant HMR and optimized production bundling |
| 🏔️ **Terrain Gen** | [simplex-noise](https://github.com/jwagner/simplex-noise) | Seeded 3D simplex noise with 3D cave tunnels |
| 💾 **Persistence** | IndexedDB (`idb`) | Incremental dirty chunk autosaving |
| 🔊 **Audio** | Web Audio API | 100% procedural sound synthesis (no external audio files) |
| 🚀 **Hosting** | [Vercel](https://vercel.com/) | 100% free static frontend deployment with global CDN |

---

## 💻 Local Development & Setup

### Prerequisites
- **Node.js** v20+
- **npm** or **pnpm**

```bash
# 1. Clone the repository
git clone https://github.com/taezeem14/ToxsCraft.git
cd ToxsCraft

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open `http://localhost:3000` in your browser and start playing!

### Build for Production
```bash
# Verify TypeScript types and generate production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🚀 Deploy to Vercel

1. Push your changes to the `main` branch of your GitHub repository.
2. Import the project into [Vercel](https://vercel.com).
3. Set the build command to `npm run build` and output directory to `dist`.
4. Deploy! Your game will be live with full HTTPS and CDN caching.

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.
