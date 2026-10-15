# ECHOFRONT: RELAY NINE — Cinematic Environment Update

An original first-person sci-fi arena that runs directly in your browser. This update adds an entirely original cinematic industrial art pass: layered procedural PBR-like materials, atmospheric sky, dense facility detailing, animated lighting, environmental dust, reflective ground accents, redesigned first-person weapons, more intricate autonomous sentries, energy impact effects, richer procedural audio, and an upgraded tactical HUD. Includes offline practice and an online room mode backed by Cloudflare Durable Objects.


## Arsenal & Gun Game upgrade (v0.4)

- Seven **original, fictional sci-fi loadouts**: ARC-7 carbine, NIX-3 sidearm, VEIL-9 and VEX-5 SMGs, RIFT-12 marksman rail, GHOST-50 sniper, and SHARD-0 energy blade.
- Distinct weapon silhouettes, aiming magnification, synthesized firing tones, effects, damage, cooldowns, and ranges. The long-range GHOST-50 has a custom full-screen optical HUD.
- Offline **GUN GAME / 7-STAGE GAUNTLET**: each drone elimination advances the active loadout, with the energy blade as the final stage. First to seven eliminations wins.
- Online room choices: classic FFA with the full arsenal, or Gun Game with an authoritative seven-stage progression. Mode is part of room join/invite and validated by the Cloudflare room server.
- Mode-sensitive scoreboard, round limit, stage meter, next loadout, and elimination announcements. Match setup and multiplayer rooms retain their existing foundation.

## Visual update (v0.2)

- Atmospheric procedural sky with a warm industrial sunset, graded haze, and distance fog.
- Textured concrete, alloy and asphalt generated locally via Canvas, no remotely hosted images or copyrighted assets.
- Modular industrial structures: maintenance shutters, vents, pipes, roof antennae, area signage, gantry lighting, road paint, drainage, puddles, and tiny instanced fixtures.
- Redesigned procedural carbine/sidearm viewmodels, animated recoil/weapon sway, muzzle flashes, and reconstructed sentry robotics.
- Transient energy-spark impacts and layered original synthesized weapon audio.
- Low disables extra structural embellishments, Medium enables environment detailing, and High adds micro-details/particles and postprocessed bloom. Change this in Settings.
- The arena coordinates remain unchanged; spawn positions now reject structures and score rules are kept consistent between practice and online play.

### Visual assets & performance
All art in this update is generated in code. No external texture CDN or commercial game assets are required to play, and no free assets are embedded with unclear redistribution rights. High uses additional GPU render targets; choose Medium if the game drops below a comfortable frame rate.

## Play locally (developer workflow)

Requires Node.js 22 or later (only for building/development, **not** for players):

```bash
npm install
npm test
npm run dev
```

Open the development URL printed by Vite. For a production bundle:

```bash
npm run build
npm run preview
```

The browser-only files are in `dist/`. Players just open the published page; they never need to install Node.

## Controls

| Input | Action |
|---|---|
| WASD / Mouse | Move / aim |
| Left click / Right click | Fire / aim down sights |
| Shift | Sprint |
| Left Ctrl or C | Crouch; slide while sprinting |
| Space / E | Jump / vault low cover |
| R | Reload |
| 1–7 / Mouse wheel | Choose or cycle all seven loadouts in FFA |
| V | Quickly equip SHARD-0 energy blade in FFA |
| Gun Game | Each elimination automatically changes your loadout |
| Tab (hold) | Live scoreboard |
| Esc | Pause / release cursor |

The game begins when you click **DEPLOY**. The browser will capture your pointer during play and release it on pause or match completion. Reach 25 drone eliminations in FFA, or progress through seven eliminations in Gun Game, before the five-minute timer ends. Offline personal bests and total trial XP are stored only in your browser via `localStorage`.

## GitHub Pages

1. Push this project's source files (including `.github/workflows/deploy.yml`) to a GitHub repository's `main` branch.
2. In repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. GitHub Actions runs the Node build and publishes `dist/` automatically on pushes to `main`.
4. Open the URL shown in the `Deploy ECHOFRONT to GitHub Pages` workflow result.

Vite's `base: './'` uses relative output asset paths so the bundle works at both a user-root and a `/repository-name/` Pages URL. Avoid trying to open source `index.html` as a local `file:` URL: it must first be built or run through Vite.

## What's implemented

- One original industrial arena, Spillway 09, made from procedural meshes and generated materials (no third-party visual assets)
- Pointer lock, WASD, sprint, crouch, sliding, jumping, low-cover vault, basic AABB collision
- Seven original fictional weapons, each with custom ADS, recoil, rate, effects, and ammo; a short-range energy blade
- Five independently moving drone opponents with pathfinding, line of sight, damage, eliminations and respawns
- Match score, timer, elimination feed, minimap, hit marker, health, ammo, result screen, local progression
- Runtime synthesized effects, adjustable graphics quality, audio, look sensitivity, FOV and motion reduction
- Rules unit tests and GitHub Pages deployment workflow

## Known limitations and future work

This is a playable online FPS foundation, not a finished AAA commercial game. Character rigs, animations, collision, AI and lighting remain lightweight. Only one map is implemented; free-for-all and Gun Game are available. Browser-to-browser testing and network load/performance testing remain necessary before calling it production-ready. Graphics and frame rates vary by hardware; 60 FPS is not guaranteed.

**Implemented online foundation:** Shared client/server packets, room creation/joining, Cloudflare Durable Object room authority, server-side movement/combat checks, snapshots, interpolation, elimination feeds, automatic respawns and room-code invite links. Recommended next steps: latency smoothing, spectating, teams, more maps, real browser-to-browser stress testing and optional matchmaking.

## Originality and privacy

All map layout, branding, 3D shapes, HUD and synthesized sound are authored for ECHOFRONT. No copyrighted commercial shooter content is reused. Offline progress remains in the player's browser and is not verified online.

## Cloudflare Workers target and multiplayer preservation

The requested original production hostname is `https://relay-zero-play.relay-zero.workers.dev`. This repository now includes its own independent multiplayer Worker and Durable Object server. Its separately deployed preview Worker is `https://echofront-visual-preview.relay-zero.workers.dev`. Deployments to the preview must not overwrite the existing `relay-zero-play` Worker until its original multiplayer behavior has been compared and the migration is approved.

See [`CLOUDFLARE_DEPLOY.md`](./CLOUDFLARE_DEPLOY.md) for the preview workflow, secrets, worker routes and independent multiplayer server setup.

## Online rooms (v0.3)

The preview Worker hosts the static frontend and `/api/rooms/:code` WebSocket endpoints backed by a Durable Object per room. Two or more operators start a timed free-for-all. Server-side movement bounds, collision checks, weapon cooldowns, wall hits, spawn shielding and match scores are validated. Open **MULTIPLAYER**, choose a room code, and share the invite link. The server and UI are included in this repository. Play-test with two separate browsers in one room and check actual connection, movement, shooting, respawn and round restart behavior before treating it as production-ready.

