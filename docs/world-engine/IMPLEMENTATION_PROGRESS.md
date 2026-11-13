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
| M8 — Visual/cultural/legal/perf | Partial | Waterway lines, market-stall clustering, painted shop signage, mixed vehicles, drainage/pavement detail, utility poles/cables/street signs, roadside shrubs, architecture, lighting, attribution and budgets exist; real-device performance and local cultural review remain |

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
- `npm test`: 211 pass, 0 fail.
- `build`: pass; generated `dist/app-shell.json` with 16 entries.
- `size`: all budgets pass — JS 572,013 B gzip, CSS 8,625 B, HTML 1,817 B,
  first load 582,455 B, world raw 5,402,073 B, world gzip 853,458 B.
- `world:validate`: pass.

## Latest round: app shell, canvas sizing and roadside infrastructure

A real Chrome 158 / Android 10 probe reached the Nlongkak HUD, requested
geographic chunks and advanced the game clock. It also exposed two issues that
the VM tests could not see:

- The only game canvas stayed at its default 300 × 150 size and never published
  `window.__yaoundeWorldMetrics`. DOM inspection showed that `.game-root` and
  `.game-root canvas` had layout rules, but `.game-canvas` had no sizing rule.
  `.game-canvas` now owns the full viewport with `position: absolute; inset: 0`,
  and `test/layout.test.ts` guards that rule. The CSS fix has **not** yet been
  confirmed by a second real-browser render.
- The app cache contained only fonts and icons after install, despite the
  documented promise to cache the HTML and hashed JS/CSS. The build now writes
  `dist/app-shell.json`; the worker reads it during install, rejects unsafe
  paths, requires a cached HTML document before installation can succeed, and
  caches the shell files. A content-derived build ID is stamped into
  `dist/sw.js` and the app cache name so changed hashed assets trigger a worker
  update instead of leaving a stale shell cached forever.

Roadside detailing also landed in this round:

- Roadside utility infrastructure now follows the longest vehicle roads in
  low/mid/high chunks: deterministic pole pairs, three sagging cable spans,
  street-name boards and a small shrub pass. Poles use the existing prop budget
  and collision metadata, and `PropBuild.counts` exposes pole, wire, sign and
  bush counts for tests.
- Added `test/geo.test.ts` coverage for utility poles, cable spans and street
  signs.

Added `test/serviceWorker.test.ts` coverage for generated shell manifests,
unsafe paths, install rejection without a document, and a first-load
navigation/assets boot with the network offline. Typecheck is clean and
211/211 tests pass. The build, size budgets and `world:validate` pass.

The browser probe could not be completed: Android subsequently blocked
Termux from bringing Chrome back to the foreground, and screen wake/input
injection is unavailable. Real-browser offline reload, settings download/
cancel/remove behavior, device metrics, screenshots and visual/cultural review
therefore remain **unperformed**, not merely unrecorded.

## Previous round: offline cache hardening and automated tests

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

Commit `125d704` (2026-11-13) contains the offline-cache hardening, the
service-worker/world-cache tests, the world pack and the M8 street-detailing
work, and is pushed to `origin/main`.

Uncommitted since that commit:

- `src/styles.css` — fullscreen `.game-canvas` layout and `test/layout.test.ts`
  guard.
- `src/render/geo/geometry.ts`, `test/geo.test.ts` — bounded utility-pole pairs,
  cable spans, street-name boards, roadside shrubs and geometry tests.
- `public/sw.js`, `vite.config.ts` — build-generated `app-shell.json`,
  first-load shell precache, unsafe-path filtering, install rejection without a
  document, build-ID stamping and first-load offline test coverage.
- `test/serviceWorker.test.ts`, `test/offlineCache.test.ts`,
  `test/offline.test.ts` — app-shell version/test updates.
- `docs/world-engine/OFFLINE_WORLD_PACKAGING.md`,
  `docs/world-engine/PERFORMANCE_BUDGETS.md`,
  `docs/world-engine/IMPLEMENTATION_PROGRESS.md` and
  `IMPLEMENTATION_CHECKLIST.md` — this round's documentation and measurements.

## Known defects and gaps

1. **Open Buildings not ingested.** The dataset requires a Google export that is
   not in the repository. Exact blocker is in `GEOGRAPHIC_DATA_SOURCES.md`.
2. **Waterway hydrology is visual only.** Surface heights are inferred from the
   DEM; there is no flow simulation, flooding, bridges over streams, or channel
   carving beyond the rendered ribbon.
3. **Real-device performance is unmeasured.** The overlay and budgets exist, but
   no low-end Android numbers are recorded. The first probe never received
   renderer metrics because the canvas was collapsed; the CSS fix still needs a
   real render to confirm it.
4. **Only Nlongkak is geographic.** The other eight districts remain procedural.
5. **M8 visual variety still needs human review.** Market stalls, signage,
   vehicles and street drainage are now present, but their placement and
   cultural fit have not been reviewed in a browser or by local reviewers.
6. **Offline browser behavior is only unit-tested.** The first-load shell gap
   was found in a real cache audit and fixed, but a real install-then-offline
   reload, Settings download/cancel/remove flow, persistent-storage prompt and
   quota accounting still need a device pass.
7. **No automated visual regression test.** Geometry is tested numerically, not
   screenshot-tested.
8. **The real-browser canvas fix is unconfirmed.** The probe observed the
   300 × 150 canvas and missing metrics, but Chrome could not be foregrounded
   again after the CSS change. No rendered frame or screenshot exists yet.

## Save compatibility

Saves store player state, not world geometry. The geographic adapter reads
existing district and place IDs; no existing gameplay IDs were renamed or
deleted. Procedural fallback remains available through Settings,
`?world=legacy`, and `yaounde-world-mode=legacy`.

## Next action

1. Re-run the real-browser probe when Chrome can be foregrounded on the
   device. Confirm the canvas fills the viewport and publishes metrics, then
   complete the online screenshot, first-load offline reload and Settings
   download/cancel/remove checks.
2. Record real-device low/mid/high metrics and tune the quality thresholds.
3. Review the new market clusters, shop boards, vehicles, gutters, pavements and
   waterway ribbons in the browser, and adjust density/placement after the
   visual pass.
4. Run a local cultural review of signage colours and market dressing before
   treating M8 as complete.
5. Commit the app-shell/canvas round once the browser checks are recorded or
   the device limitation is explicitly accepted.
