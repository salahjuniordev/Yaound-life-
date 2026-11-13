# World Engine Architecture

The world engine adds a real-geography Yaoundé neighbourhood to Yaoundé Life without
replacing the existing game simulation. It is a data-driven layer under the game
systems, not a second game.

## Goals

- Load a real 2 km × 2 km Nlongkak slice from versioned local data.
- Keep the first playable load small and stream the rest on demand.
- Work offline after the app shell and initial world pack are cached.
- Preserve gameplay, saves and the procedural fallback.
- Keep source provenance and licensing visible in the repository.

## Layers

```
data pipeline (scripts/world-build.mjs)
  OSM / Copernicus inputs
        │
        ▼
public/world/v1/            manifest + chunks + catalog
        │
        ├── fetch/cache ──► src/world/loader.ts ──► decoded chunks
        │                                           │
        │                                           ▼
        │                              src/render/geo/GeoScene.tsx
        │                                   terrain / roads / buildings / props / water
        │                                           │
        │                                           ▼
        │                              src/world/adapter.ts (WorldApi)
        │                                           │
        │                                           ▼
        │                              existing player, collision, NPC, UI systems
        │
        └── src/pwa/worldCache.ts ──► Cache Storage (offline pack)
```

The renderer owns visuals and chunk lifetimes. The adapter exposes collision,
ground height, place lookup and interaction data to the existing game. The
simulation remains authoritative for player state, saves and time.

## Runtime flow

1. `GameCanvas` decides whether the real world is available for the current
   district (`nlongkak`) and passes a `WorldApi` adapter to `GeoScene`.
2. `GeoScene` fetches `manifest.json`, validates format/version, then ensures
   chunks around the player.
3. `ChunkLru` plans loads and evictions. The visible radius is 1×1 (low),
   3×3 (mid) or 5×5 (high); the pack has 16 chunks in a 4×4 grid.
4. Each chunk loads terrain, roads, building metadata, buildings and POIs.
5. Chunk groups are built once and cached in memory. Quality changes rebuild
   geometry; distance decides near/far building LOD.
6. The adapter supplies ground height, building collision, road queries and
   places to the player and crowd.
7. If loading or validation fails, `GeoScene` reports the failure and the app
   falls back to the legacy procedural neighbourhood.

## Directory map

| Path | Role |
| --- | --- |
| `scripts/world-build.mjs` | Reproducible OSM + DEM → world pack pipeline |
| `scripts/world-validate.mjs` | Manifest, chunk, catalog and byte validation |
| `src/world/` | Manifest, transform, chunk, terrain, road, building and loader logic |
| `src/world/offline.ts` | Pure offline catalog/status logic |
| `src/pwa/worldCache.ts` | Browser Cache Storage download and cleanup |
| `src/render/geo/` | Real-world Three.js scene, geometry builders, streaming, metrics |
| `public/world/v1/` | Generated, committed world data |
| `public/sw.js` | Versioned app-shell and world caches |
| `docs/world-engine/` | This documentation suite |

## Design decisions

- **Local-first data.** The game does not call OSM, Nominatim or Copernicus at
  runtime. Data is acquired once, processed and committed.
- **Deterministic generation.** Building heights, colours and props are seeded
  from stable IDs so rebuilds do not shuffle the neighbourhood.
- **Separate caches.** App-shell updates do not invalidate a downloaded world
  pack; world updates are explicit and versioned.
- **No simulation fork.** The adapter implements the existing `WorldApi`; the
  procedural world remains the fallback.
- **Documented compromises.** Data gaps and unverified claims are recorded in
  `IMPLEMENTATION_PROGRESS.md` and `GEOGRAPHIC_DATA_SOURCES.md`.
