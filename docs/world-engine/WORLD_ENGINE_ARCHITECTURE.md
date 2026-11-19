# World Engine Architecture

The world engine adds real-geography Yaoundé neighbourhoods to Yaoundé Life
without replacing the existing game simulation. It is a data-driven layer under
the game systems, not a second game.

## Goals

- Load real Nlongkak, Mvog-Mbi, Mokolo, Bastos, Ngoa-Ekelle, Boulevard du 20 Mai,
  Lac Municipal, Mvan and Mont Febe slices from versioned local data.
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
public/world/registry.json ──► district → versioned pack selector
        │
        ▼
public/world/v1/              Nlongkak manifest + chunks + catalog
public/world/mvog-mbi/v1/     Mvog-Mbi manifest + chunks + catalog
public/world/mokolo/v1/       Mokolo manifest + chunks + catalog
public/world/bastos/v1/       Bastos manifest + chunks + catalog
public/world/ngoa-ekelle/v1/  Ngoa-Ekelle manifest + chunks + catalog
public/world/boulevard/v1/    Boulevard du 20 Mai manifest + chunks + catalog
public/world/lac-municipal/v1/ Lac Municipal manifest + chunks + catalog
public/world/mvan/v1/         Mvan manifest + chunks + catalog
public/world/mont-febe/v1/    Mont Febe manifest + chunks + catalog
        │
        ├── fetch/cache ──► src/world/loader.ts ──► decoded chunks
        │                                           │
        │                                           ▼
        │                              src/render/geo/GeoScene.tsx
        │                                   terrain / roads / buildings / props / water
        │                                           │
        │                                           ▼
        │                              src/render/geo/adapter.ts (WorldApi)
        │                                           │
        │                                           ▼
        │                              existing player, collision, NPC, UI systems
        │
        └── src/pwa/worldCache.ts ──► Cache Storage (offline pack per version)
```

The renderer owns visuals and chunk lifetimes. The adapter exposes collision,
ground height, place lookup and interaction data to the existing game. The
simulation remains authoritative for player state, saves and time.

## Runtime flow

1. `GameCanvas` loads `world/registry.json` once, validates the registry, and
   selects the versioned pack registered for the current gameplay district. A
   missing, incompatible or unmapped pack keeps the legacy procedural fallback;
   all nine checked-in pack entries are also mirrored as a built-in
   compatibility fallback when the registry request fails.
2. `GeoScene` receives that pack entry, fetches its manifest, and enforces the
   registered `worldVersion`, manifest format and `area.id` before loading data.
3. `ChunkLru` plans loads and evictions. The visible radius is 1×1 (low),
   3×3 (mid) or 5×5 (high), capped by the pack grid: Nlongkak has 16 chunks in a
   4×4 grid; Mvog-Mbi, Bastos, Ngoa-Ekelle, Lac Municipal, Mvan and Mont Febe
   have 9 chunks in 3×3 grids; Mokolo has 6 chunks in a 3×2 grid; Boulevard du
   20 Mai has 4 chunks in a 2×2 grid.
4. Each chunk loads terrain, roads, building metadata, buildings and POIs.
5. Chunk groups are built once and cached in memory. Quality changes rebuild
   geometry; distance decides near/far building LOD.
6. The adapter supplies ground height, building collision, road queries and
   places to the player and crowd. Its anchor, place filter and district mapping
   come from the pack manifest and `WorldDistrictAnchor`, not a hard-coded
   district constant.
7. If loading or validation fails, `GeoScene` reports the failure and the app
   falls back to the legacy procedural neighbourhood.

## Directory map

| Path | Role |
| --- | --- |
| `scripts/world-acquire.sh` | Config-driven download, extraction, DEM decode and build |
| `scripts/world-build.mjs` | Reproducible OSM + DEM → one world pack, registry upsert |
| `scripts/world-validate.mjs` | Manifest, chunk, catalog and byte validation for one pack |
| `scripts/world-validate-all.mjs` | Validate every registered pack by default |
| `data/geodata/config/` | Per-area bboxes, versions, sources and output paths |
| `src/world/` | Manifest, registry, transform, chunk, terrain, road, building and loader logic |
| `src/world/registry.ts` | District → pack selection, compatibility and base-path validation |
| `src/world/offline.ts` | Pure offline catalog/status logic and multi-pack cache cleanup |
| `src/pwa/worldCache.ts` | Browser Cache Storage download and cleanup |
| `src/render/geo/` | Real-world Three.js scene, geometry builders, streaming, metrics |
| `public/world/registry.json` | Committed district → versioned pack registry |
| `public/world/v1/` | Generated, committed Nlongkak world data |
| `public/world/mvog-mbi/v1/` | Generated, committed Mvog-Mbi world data |
| `public/world/mokolo/v1/` | Generated, committed Mokolo world data |
| `public/world/bastos/v1/` | Generated, committed Bastos world data |
| `public/world/ngoa-ekelle/v1/` | Generated, committed Ngoa-Ekelle world data |
| `public/world/boulevard/v1/` | Generated, committed Boulevard du 20 Mai world data |
| `public/world/lac-municipal/v1/` | Generated, committed Lac Municipal world data |
| `public/world/mvan/v1/` | Generated, committed Mvan world data |
| `public/world/mont-febe/v1/` | Generated, committed Mont Febe world data |
| `public/sw.js` | Versioned app-shell and world caches |
| `docs/world-engine/` | This documentation suite |

## Design decisions

- **Local-first data.** The game does not call OSM, Nominatim or Copernicus at
  runtime. Data is acquired once, processed and committed.
- **Deterministic generation.** Building heights, colours and props are seeded
  from stable IDs so rebuilds do not shuffle the neighbourhood.
- **Separate caches.** App-shell updates do not invalidate a downloaded world
  pack; world updates are explicit and versioned. Cache names stay keyed by
  `worldVersion`, and cleanup preserves every version still registered.
- **One pack at a time.** The registry can describe multiple districts, but the
  renderer loads only the selected district's pack and keeps the legacy world
  for unregistered districts.
- **No simulation fork.** The adapter implements the existing `WorldApi`; the
  procedural world remains the fallback.
- **Documented compromises.** Data gaps and unverified claims are recorded in
  `IMPLEMENTATION_PROGRESS.md` and `GEOGRAPHIC_DATA_SOURCES.md`.
