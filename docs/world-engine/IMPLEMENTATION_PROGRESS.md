# Implementation Progress

Last updated: 2026-11-13

## Milestones

| Milestone | Status | Evidence |
| --- | --- | --- |
| M0 — Baseline and contract | Done | Baseline verified before the slice commit; architecture and decisions documented here and in `WORLD_ENGINE_ARCHITECTURE.md` |
| M1 — Coordinates and data layer | Done | `src/world/`, manifest/transform/chunk/terrain/road/building tests |
| M2 — Real Yaoundé data | Done with documented exclusion | Nlongkak pack from OSM 2026-10-30 + Copernicus GLO-30; Open Buildings excluded with blocker |
| M3 — Real road network | Done | 426 clipped roads, classes/widths/roundabouts, graph, spatial index |
| M4 — Buildings and terrain | Done | 8,085 buildings, 16 heightfield chunks, 2 water polygons, 35 waterway lines, collision metadata |
| M5 — Chunking and rendering | Done | `ChunkLru` stable over-cap planning, streaming, near/far LOD, disposal, grounding, safe spawn, quality tiers |
| M6 — Offline packaging | Done | `files.json`, `precache.json`, versioned world caches, Settings download UI, progress/quota/cancel, service-worker and cache download tests |
| M7 — Gameplay/district alignment | Done | District adapter, safe spawn, NPC placement, POI anchors, travel alignment, save compatibility |
| M8 — Visual/cultural/legal/perf | Partial | Waterway lines, market-stall clustering, painted shop signage, mixed vehicles, drainage/pavement detail, architecture, vegetation, lighting, attribution and budgets exist; real-device performance and local cultural review remain |

## Current pack

- Area: Nlongkak, Yaoundé (`nlongkak`), bbox `11.5126,3.8780,11.5305,3.8960`.
- World version: `nlongkak-2026-10-30-v2`; generator version `1.1.0`.
- Chunks: 16 (4 × 4, 512 m).
- Features: 426 roads, 8,085 buildings, 409 POIs, 2 water polygons, 35 waterway lines (5 rivers, 29 streams, 1 drain; 5,868 m of centrelines), 62,750 terrain samples.
- Offline catalog: 90 files, 5,391,242 bytes; initial precache 53 files (8 global files + 3 × 3 chunks, about 5.1 MB).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 713.3 m.

## Verification

Run from the repository root:

```bash
npm run typecheck
npm test
npm run build
npm run size
npm run world:validate
```

Latest results:

- `typecheck`: pass.
- `npm test`: 205 pass, 0 fail.
- `build`: pass.
- `size`: all budgets pass — JS 570,748 B gzip, CSS 8,622 B, HTML 1,814 B,
  first load 581,184 B, world raw 5,402,073 B, world gzip 853,458 B.
- `world:validate`: pass.

## Latest round: offline cache hardening and automated tests

Completed after the M8 round:

- Added `test/serviceWorker.test.ts`, which runs the real `public/sw.js` in a
  VM with a fake Cache Storage. It covers app-shell precache, initial world
  precache, cached world serving, newest-cache fallback, missing-asset 503,
  runtime caching, non-GET/cross-origin bypass, activation cleanup, unsafe or
  malformed manifest versions and malformed precache lists.
- Added `test/offlineCache.test.ts` covering full and resumed `downloadWorldPack`
  runs, byte progress, quota rejection before fetch, HTTP failure wrapping,
  abort handling, catalog errors, cache version listing/deletion and path
  filtering.
- Added the shared `test/helpers/fakeCaches.ts` in-memory Cache Storage.
- Fixed stale world-version selection in the service worker: the manifest
  lookup is now memoized for 60 seconds instead of forever, activation resets
  it, and the Settings UI posts `{ type: 'world-cache-updated' }` after a
  download or removal so the next world request resolves the new pack
  immediately.
- Typecheck clean, 205/205 tests pass, build and all size budgets pass,
  `world:validate` passes.

## Previous round: M8 street and market detailing

Completed after the waterway round:

- Market-stall clusters now seed from real `marketplace` and `mall` POIs before
  the roadside prop budget, with produce mats and a market board. Clusters try
  several angles and radii when buildings block the first ring.
- Shop, restaurant and market frontages get deterministic painted sign boards
  with contrasting lettering blocks, plus occasional projecting blade signs.
- Vehicles now mix yellow taxis, private cars, minibuses, trucks and motos by
  road class, with wheels, glazing, rider and roof details. Vehicle bodies were
  also re-oriented so their length follows the road.
- Vehicle roads get an open concrete drainage gutter, curb, wider shoulder and
  pavement on major roads, with periodic gutter crossing slabs.
- Added geometry tests for market clustering, signage, drainage/pavements and
  vehicle selection.

## Previous round: waterway lines and stable streaming

Completed after the offline/streaming round:

- Extracted all 35 OSM waterway centrelines in the slice (`river`, `stream`,
  `drain`) with real IDs, names, widths and provenance.
- Added per-point inferred surface heights from the fine DEM so streams follow
  terrain instead of a single global water plane.
- Added `WaterwayFeature` types, loader support (older packs without the file
  still load), validation, build output (`water/waterways.json`), manifest
  counts, catalog/precache entries and renderer ribbons.
- Fixed an over-cap `ChunkLru` flaw that could swap and reload chunk sets every
  plan when the desired radius exceeded the memory cap. The plan now selects a
  stable nearest-first subset and only keeps keep-ring buffers in spare slots.
- Added tests for waterway validation, waterway geometry and over-cap streaming
  stability.

## Commit state

Commit `555ad39` (2026-11-13) contains the offline/streaming, waterway, M8
street-detailing, v2 pack and documentation work, and is pushed to `origin/main`.

Uncommitted since that commit:

- `public/sw.js` — 60-second world-manifest memoization, activation reset and
  `world-cache-updated` message invalidation.
- `src/ui/WorldOffline.tsx` — posts the cache-updated message after download and
  removal.
- `test/serviceWorker.test.ts`, `test/offlineCache.test.ts`,
  `test/helpers/fakeCaches.ts` — 21 new offline/cache tests.
- `docs/world-engine/OFFLINE_WORLD_PACKAGING.md`,
  `docs/world-engine/PERFORMANCE_BUDGETS.md`, `docs/WORLD.md`,
  `docs/world-engine/IMPLEMENTATION_PROGRESS.md` and
  `IMPLEMENTATION_CHECKLIST.md` — this round's documentation and measurements.

## Known defects and gaps

1. **Open Buildings not ingested.** The dataset requires a Google export that is
   not in the repository. Exact blocker is in `GEOGRAPHIC_DATA_SOURCES.md`.
2. **Waterway hydrology is visual only.** Surface heights are inferred from the
   DEM; there is no flow simulation, flooding, bridges over streams, or channel
   carving beyond the rendered ribbon.
3. **Real-device performance is unmeasured.** The overlay and budgets exist, but
   no low-end Android numbers are recorded.
4. **Only Nlongkak is geographic.** The other eight districts remain procedural.
5. **M8 visual variety still needs human review.** Market stalls, signage,
   vehicles and street drainage are now present, but their placement and
   cultural fit have not been reviewed in a browser or by local reviewers.
6. **Offline browser behavior is only unit-tested.** The service worker and
   Cache Storage paths now have automated tests, but real installation timing,
   persistent-storage prompts, quota accounting and an offline reload still need
   a manual browser pass.
7. **No automated visual regression test.** Geometry is tested numerically, not
   screenshot-tested.

## Save compatibility

Saves store player state, not world geometry. The geographic adapter reads
existing district and place IDs; no existing gameplay IDs were renamed or
deleted. Procedural fallback remains available through Settings,
`?world=legacy`, and `yaounde-world-mode=legacy`.

## Next action

1. Run the manual offline browser pass described in
   `OFFLINE_WORLD_PACKAGING.md` (download, reload offline, walk the slice,
   update the pack, verify old-cache cleanup).
2. Record real-device low/mid/high metrics and tune the quality thresholds.
3. Review the new market clusters, shop boards, vehicles, gutters and pavements
   in the browser, and adjust density/placement after the visual pass.
4. Review the new waterway ribbons in the browser for terrain alignment,
   especially where streams cross roads or steep slopes.
5. Run a local cultural review of signage colours and market dressing before
   treating M8 as complete.
6. Review and commit the offline-cache hardening and test round once the
   browser and device checks are recorded or explicitly deferred.
