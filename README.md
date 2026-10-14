# ECHOFRONT: RELAY NINE — Cinematic Environment Update

An original first-person sci-fi arena that runs directly in your browser. This update adds an entirely original cinematic industrial art pass: layered procedural PBR-like materials, atmospheric sky, dense facility detailing, animated lighting, environmental dust, reflective ground accents, redesigned first-person weapons, more intricate autonomous sentries, energy impact effects, richer procedural audio, and an upgraded tactical HUD. **The bundled game is offline practice** against five autonomous sentry drones; no account or backend is necessary.


## Visual update (v0.2)

- Atmospheric procedural sky with a warm industrial sunset, graded haze, and distance fog.
- Textured concrete, alloy and asphalt generated locally via Canvas, no remotely hosted images or copyrighted assets.
- Modular industrial structures: maintenance shutters, vents, pipes, roof antennae, area signage, gantry lighting, road paint, drainage, puddles, and tiny instanced fixtures.
- Redesigned procedural carbine/sidearm viewmodels, animated recoil/weapon sway, muzzle flashes, and reconstructed sentry robotics.
- Transient energy-spark impacts and layered original synthesized weapon audio.
- Low disables extra structural embellishments, Medium enables environment detailing, and High adds micro-details/particles and postprocessed bloom. Change this in Settings.
- The gameplay coordinates, solid mesh hit testing, physics obstacles, player spawns and scoring rules remain unchanged. This update does not claim to add or test a multiplayer server.

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
| 1 / 2 / Mouse wheel | Swap between ARC-7 and NIX-3 |
| Tab (hold) | Live scoreboard |
| Esc | Pause / release cursor |

The game begins when you click **DEPLOY**. The browser will capture your pointer during play and release it on pause or match completion. Reach 25 drone eliminations or finish a five-minute session. Offline personal bests and total trial XP are stored only in your browser via `localStorage`.

## GitHub Pages

1. Push this project's source files (including `.github/workflows/deploy.yml`) to a GitHub repository's `main` branch.
2. In repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. GitHub Actions runs the Node build and publishes `dist/` automatically on pushes to `main`.
4. Open the URL shown in the `Deploy ECHOFRONT to GitHub Pages` workflow result.

Vite's `base: './'` uses relative output asset paths so the bundle works at both a user-root and a `/repository-name/` Pages URL. Avoid trying to open source `index.html` as a local `file:` URL: it must first be built or run through Vite.

## What's implemented

- One original industrial arena, Spillway 09, made from procedural meshes and generated materials (no third-party visual assets)
- Pointer lock, WASD, sprint, crouch, sliding, jumping, low-cover vault, basic AABB collision
- Fictional ARC-7 and NIX-3 weapons with ADS, recoil, ammo, switching, damage and reload times
- Five independently moving drone opponents with pathfinding, line of sight, damage, eliminations and respawns
- Match score, timer, elimination feed, minimap, hit marker, health, ammo, result screen, local progression
- Runtime synthesized effects, adjustable graphics quality, audio, look sensitivity, FOV and motion reduction
- Rules unit tests and GitHub Pages deployment workflow

## Known limitations and future work

This is a **Phase 1 playable foundation**, not a finished AAA game. No real online multiplayer or Cloudflare backend exists in this phase. Multiplayer menu is accurately disabled. Character rigs, animations, collision, AI and lighting are lightweight. Bots use a grid planner and simple reaction logic rather than sophisticated cover selection. The health/damage model is intentionally non-graphic. Controller support, multiple maps, challenge modes and customization are planned for future phases. Graphics and actual frame rates vary by hardware; the 60-FPS target is not a guarantee.

**Phase 2 plan:** Share strict client/server message types, create a Cloudflare Worker + Durable Object room authority, validate movement and combat server-side, implement room creation/joining and snapshots, interpolation/reconciliation, match results, disconnect handling and browser-to-browser tests. `VITE_MULTIPLAYER_WS_URL` is currently an unused example variable; multiplayer must not be represented as functional before that work is done.

## Originality and privacy

All map layout, branding, 3D shapes, HUD and synthesized sound are authored for ECHOFRONT. No copyrighted commercial shooter content is reused. Offline progress remains in the player's browser and is not verified online.
