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

> **The voxel game that's absolutely bussin. No cap, no downloads, no BS — just vibes and blocks in your browser.**

[![Three.js](https://img.shields.io/badge/Three.js-r160+-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Blazing_Fast-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy_Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![WebGL](https://img.shields.io/badge/WebGL-Powered-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](./LICENSE)

</div>

---

## ✨ What Even Is This? (No Cap Edition)

Tox'sCraft is a **Minecraft-inspired 3D voxel sandbox survival game** that runs *entirely in your browser* — zero installs, zero launchers, zero waiting. It's giving **main character energy** with a full-blown procedurally generated open world, hostile mobs, crafting, achievements, and an XP system that goes *stupid* hard.

Built from the ground up with **TypeScript + Three.js + custom GLSL shaders**, this isn't some janky hobbyist project — it's a **production-grade W game** that you can flex in your portfolio, self-host for free on Vercel, and run on hardware so old your grandma probably donated it. We're talking **Compaq Presario era** compatible, bestie. 🖥️

Minecraft who? We don't know her. 💅

---

## 🔥 Features (Sheesh, We Really Cooked)

### 🌍 Procedural World Generation — *It's giving infinite possibilities*
Over **10+ unique biomes** procedurally generated with seeded simplex noise. Every world is different, every run hits different. Biomes blend with smooth HSL fog transitions so the vibe is always immaculate.

### ⛏️ Mining & Crafting — *The classic W gameplay loop*
Break blocks, collect resources, craft tools. A **2×2 crafting grid** with recipe resolution means you go from punching trees to building empires in no time. Logs → Planks → Sticks → Torches. We love to see it.

### 🧟 8 Mob Types — *The streets are NOT safe after dark*
Survive the night against a full roster of hostile and passive creatures:
- 🧟 **Zombies** — slow but they're coming for you, respectfully
- 💥 **Creepers** — they're right behind you. Don't look.
- 💀 **Skeletons** — ranged attackers that lowkey have drip
- 🕷️ **Spiders** — climbing walls and not paying rent
- 🟩 **Slimes** — bouncy lil fellas with big energy
- 🐔 **Chickens** — passive, vibing, no thoughts
- 🐄 **Cows** — mooving differently
- 🐷 **Pigs** — the OG homies of the pasture

### 🏆 Achievement System — *Slay your goals*
Get clout for your in-game accomplishments. The achievement system tracks your milestones and serves them up with that dopamine hit you came here for. W game behavior.

### 📈 XP & Level Progression — *Glow up arc incoming*
Every block mined, every mob slain, every craft completed — it's all feeding your XP bar. Level up, get stronger, become the main character. The grind never stops. 💪

### 🌅 Dynamic Day/Night Cycle — *Different vibes, different times*
A fully animated celestial dome with Sun and Moon orbits, Rayleigh sky gradients, and star clouds that fade at sunrise. Daytime? Bussin, collect resources. Nighttime? It's giving horror movie energy. 😰

### 💾 IndexedDB Save System — *Your builds are safe, bestie*
Full world persistence via IndexedDB. Your builds, your progress, your legacy — autosaved locally so you never have to relive the trauma of losing a world. We been through enough.

### 📱 Old Hardware Compatible — *Runs on your grandpa's PC*
Optimized with **greedy meshing** that culls ~90% of unnecessary triangles, and custom AABB physics that keeps frame times smooth. If your machine can run a browser, it can run Tox'sCraft. Compaq Presario era? Step up. 🖥️

### 🎮 WebGL Powered — *No install? No problem*
Zero downloads. Zero launchers. Just open a URL and you're IN. WebGL rendering directly in your browser tab. The accessibility is unmatched and the vibes are immaculate.

---

## 🕹️ How To Play — *Controls that slap*

| Key / Input | Action |
|---|---|
| `W` `A` `S` `D` | Move like the main character you are |
| `Mouse Move` | Look around (Pointer Lock activated bestie) |
| `Space` | Jump / Swim Up / Fly Up ✈️ |
| `Shift` | Sneak / Fly Down |
| `Double-tap Space` | Toggle Flying mode (Creative mode activated fr fr) |
| `Left Click` | Mine / Break targeted block (hold to crunch) ⛏️ |
| `Right Click` | Place block / Interact with the world |
| `E` | Toggle Inventory & Crafting Screen 🎒 |
| `1`–`9` / Scroll Wheel | Select hotbar slot |
| `Escape` | Pause / Settings Menu |

> [!TIP]
> Double-tap `Space` to activate fly mode and get that aerial main character POV. The world gen looks *insane* from up high. 🌄

---

## 🗺️ Biomes — *The map is actually popping*

Tox'sCraft generates **11 distinct biomes**, each with unique terrain height, block palette, and mob spawn rates. Your world tour:

| Biome | Vibe Check | What to Expect |
|---|---|---|
| 🟩 **Plains** | Starter territory, chill | Flat land, easy resources, the tutorial zone |
| 🌲 **Forest** | Cozy and green | Trees on trees on trees. Wood? Stacked. |
| 🏜️ **Desert** | Hot girl summer (literally) | Sand, cacti, no water. Touch grass elsewhere. |
| ❄️ **Tundra** | It's giving Frozen | Snow-covered hills, limited resources, cold vibes |
| 🌊 **Ocean** | Aquatic arc unlocked | Endless water, hidden ocean floors, swim check |
| 🌿 **Jungle** | Main character tropical trip | Dense foliage, tall trees, peak aesthetic |
| ⛰️ **Mountains** | High altitude, high stakes | Steep terrain, exposed ores, breathtaking views |
| 🌾 **Swamp** | Dark academia energy | Murky, atmospheric, mob heavy after dark |
| 🦁 **Savanna** | Safari szn | Warm tones, flat acacia terrain, open skies |
| 🔴 **Badlands** | Chaos terrain, W aesthetic | Red mesa cliffs, rare gold, absolutely unhinged terrain |
| 🍄 **Mushroom Island** | Rare drop, legendary biome | Giant mushrooms, mycelium, zero hostile mobs. Paradise. |

---

## 🛠️ Tech Stack — *Lowkey Stacked, No Cap*

| Layer | Tech | The W Reason |
|---|---|---|
| 🖼️ **Core Renderer** | [Three.js](https://threejs.org/) r160+ | WebGL wrapper that genuinely carries the whole rendering pipeline |
| 🔷 **Language** | [TypeScript](https://www.typescriptlang.org/) (strict mode) | Type-safe, autocomplete-blessed, no runtime mystery errors |
| ⚡ **Bundler** | [Vite](https://vitejs.dev/) | Instant HMR, lightning builds, and it just *works* |
| 🏔️ **Terrain Noise** | [simplex-noise](https://github.com/jwagner/simplex-noise) | Seeded heightmaps + caves + biome blending that goes hard |
| 💾 **Persistence** | IndexedDB (`idb`) | Chunked world autosaves stored locally. Your builds = eternal. |
| 🔊 **Audio** | Web Audio API | Pentatonic soundscapes + block SFX synthesized in real-time |
| 🎨 **Shaders** | Custom GLSL (Vert/Frag) | Ambient occlusion, waving water, glowing lava — pure drip |
| 🧱 **Physics** | Custom Sweep AABB | Zero clipping, buttery smooth collision resolution |
| 🌐 **Deploy** | [Vercel](https://vercel.com/) | One-click deploy, globally CDN'd, always slapping |

---

## 💻 Self-Host / Development — *Run It Locally, Bestie*

> [!IMPORTANT]
> You'll need **Node.js v20+** and **pnpm** installed before you proceed. Don't skip prerequisites or you'll be in your feelings.

### Prerequisites

```bash
# Check your Node version (needs v20+)
node --version

# Install pnpm if you don't have it (it's the superior package manager fr)
npm install -g pnpm
```

### Clone & Install

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/ToxsCraft.git
cd ToxsCraft

# 2. Install dependencies (pnpm goes brrr 🚀)
pnpm install

# 3. Fire up the dev server
pnpm dev
```

Then open `http://localhost:3000` in Chrome or Firefox and **let's cook** 🍳

### Extra Scripts

```bash
# Type-check everything (no sneaky TS errors allowed)
npx tsc --noEmit

# Build for production (optimized, minified, ready to ship)
pnpm build

# Preview the production build locally
pnpm preview
```

> [!NOTE]
> Chrome is the GOAT browser for WebGL performance here. Firefox works too. Safari is... trying its best. 🙏

---

## 🚀 Deploy to Vercel — *One Click, Whole Vibe*

Tox'sCraft is fully optimized for **Vercel** deployment. It's literally a static Vite build — zero backend, zero server, zero drama.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/ToxsCraft)

**Manual deploy:**

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy (follow the prompts, it's giving wizard energy)
vercel

# Or deploy straight to production
vercel --prod
```

Your game will be live on a `*.vercel.app` URL in under 60 seconds. No cap. 🌐✨

---

## 📋 Survival Mechanics — *The Grind Is Real*

Because Tox'sCraft doesn't play around with the survival loop:

- ❤️ **Health** — Take damage from mobs, lava, falling, and drowning. Regen when fed.
- 🍗 **Hunger** — Stay fed or your health regen stops. The streets demand respect.
- 🏃 **Stamina** — Sprint depletes it. Sneak when you're running low.
- 💀 **Fall Damage** — Touch grass carefully. Gravity is real and it doesn't care about you.
- 🌊 **Drowning** — You have an air bar. Use it wisely.
- 🔥 **Lava Burning** — It will end you. Immediately. No discussion.
- 💎 **Ore Mining** — Coal, Iron, Gold, Redstone, Lapis, Diamond, Emerald. Go deep, get rich.

---

## 📜 License & Credits — *Respect the homies*

**MIT License** — take it, fork it, build on it, just don't be weird about it. ✌️

---

<div align="center">

### 🤖 Made with [Antigravity IDE](https://antigravity.dev/) powered by Google DeepMind

*Crafted with ❤️, chaos, and an unhealthy amount of voxel math.*

**Tox'sCraft** — *W game. Certified bussin. No cap forever.* 🔥🪨🌲

</div>
