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
| M8 — Visual/cultural/legal/perf | Partial | Waterway lines, six OSM bridge decks/parapets, market-stall clustering, painted shop signage, mixed vehicles, drainage/pavement detail, utility poles/cables/street signs, roadside shrubs, compound walls/gates, upper-floor balconies, vendor umbrellas/display tables, architecture, lighting, attribution and budgets exist; real-device performance and local cultural review remain |

## Current pack

- Area: Nlongkak, Yaoundé (`nlongkak`), bbox `11.5126,3.8780,11.5305,3.8960`.
- World version: `nlongkak-2026-10-30-v2`; generator version `1.1.0`.
- Chunks: 16 (4 × 4, 512 m).
- Features: 426 roads (including six `bridge`-tagged ways), 8,085 buildings, 409 POIs, 2 water polygons, 35 waterway lines (5 rivers, 29 streams, 1 drain; 5,868 m of centrelines), 62,750 terrain samples.
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
- `npm test`: 215 pass, 0 fail.
- `build`: pass; generated `dist/app-shell.json` with 16 entries.
- `size`: all budgets pass — JS 575,052 B gzip, CSS 8,625 B, HTML 1,813 B,
  first load 585,490 B, world raw 5,402,073 B, world gzip 853,458 B.
- `world:validate`: pass.

## Latest round: M8 compound walls, balconies and vendor umbrellas

This round completes the remaining procedural frontage detail requested by the
master brief, without regenerating the world pack:

- The near building mesh now adds deterministic upper-floor balconies on a
  capped set of eligible two-storey-plus houses, shops, offices, public
  buildings and apartments. Each balcony has a slab, front and side rails,
  handrail and two support brackets. Caps are 10/5/0 per high/mid/low chunk.
- The near prop mesh now adds compound walls around selected small houses. Each
  wall follows the building footprint at a 1.05 m offset, leaves a gate opening
  on the edge nearest a road, and adds concrete gate piers, a partly open metal
  gate leaf and a pale wall cap. Candidates are checked against building
  footprints, roads and existing prop obstacles before any geometry is emitted.
  Caps are 8/4/0 compounds per high/mid/low chunk.
- Market POIs now place up to two vendor umbrellas with display tables, produce
  boxes and a central pole in their cluster. Roadside vendor stands reuse the
  same builder within the existing prop budget. `PropBuild.counts` exposes
  `compoundWalls`, `compoundGates`, `vendorUmbrellas` and `displayTables`.
- A scripted geometry pass over the actual 16-chunk pack using the decode path
  and a flat test heightfield produced 128 compound walls/gates, 75 vendor
  stands/tables and 619,456 building triangles at high quality. The same
  measurement before this round was 606,016 building triangles, so the added
  building detail is about 13.4 k triangles (2.2%).
- Added `test/geo.test.ts` coverage for deterministic balcony geometry, the
  compound-wall cap and gate counts, low-tier exclusion, and market vendor
  umbrellas/display tables.
- No world-pack files, gameplay IDs or save data changed. Compound walls and
  gates are visual-only: there are no collision volumes yet, and balconies are
  facade geometry rather than enterable floors. No real-browser visual check
  was performed for this round.

## Previous round: OSM bridge decks and walkable bridge heights

The Nlongkak pack contains six OSM ways tagged `bridge` (five crossings near
the Mfoundi and one secondary crossing over a separate stream). The renderer
previously ignored the flag and drew them as ordinary terrain-following road
ribbons.

- Added `src/render/geo/bridges.ts` with a shared bridge-corridor sampler. It
  raises the deck 0.3 m above the endpoint terrain grade, blends through 2.4 m
  approach ramps, and returns the normal terrain height outside the corridor.
- `GeoScene` now derives player, crowd and camera height from that sampler, so
  walking across a tagged bridge follows the rendered deck instead of the
  terrain beneath it.
- Bridge road meshes now add a raised deck, side fascia, concrete parapets with
  caps, end abutments, approach ramps and a centre marking on major roads.
  Geometry is part of the existing road mesh, not the prop budget; all six
  bridges are bounded to their real OSM ways.
- Added geometry and sampler tests in `test/geo.test.ts`. No gameplay IDs,
  world-pack format or save data changed.
- This remains a visual/gameplay approximation: there is no hydraulic model,
  underpass traversal, fall model or collision volume for the parapets, and the
  deck uses a straight grade between bridge endpoints. It has not been checked
  in a real browser.

## Earlier round: app shell, canvas sizing and roadside infrastructure

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

## Earlier round: offline cache hardening and automated tests

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

## Earlier round: M8 street and market detailing

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

## Earlier round: waterway lines and stable streaming

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

Commit `3b07a69` (2026-11-13) contains the first-load offline shell, fullscreen
canvas sizing, generated app-shell manifest and the M8 roadside utility
infrastructure, and is pushed to `origin/main`. The OSM bridge-deck round and
this M8 frontage round are committed directly after that baseline on `main`;
they change renderer, tests and documentation only and leave the world pack,
gameplay IDs and save format untouched.

## Known defects and gaps

1. **Open Buildings not ingested.** The dataset requires a Google export that is
   not in the repository. Exact blocker is in `GEOGRAPHIC_DATA_SOURCES.md`.
2. **Waterway hydrology is visual only.** Surface heights are inferred from the
   DEM; there is no flow simulation, flooding or channel carving beyond the
   rendered ribbon. The six OSM bridge ways now get decks and ramps, but bridge
   hydraulics are not modelled.
3. **Real-device performance is unmeasured.** The overlay and budgets exist, but
   no low-end Android numbers are recorded. The first probe never received
   renderer metrics because the canvas was collapsed; the CSS fix still needs a
   real render to confirm it.
4. **Only Nlongkak is geographic.** The other eight districts remain procedural.
5. **M8 visual variety still needs human review.** Market stalls, signage,
   vehicles, street drainage, compound walls, balconies and vendor umbrellas are
   now present, but their placement and cultural fit have not been reviewed in a
   browser or by local reviewers.
6. **Offline browser behavior is only unit-tested.** The first-load shell gap
   was found in a real cache audit and fixed, but a real install-then-offline
   reload, Settings download/cancel/remove flow, persistent-storage prompt and
   quota accounting still need a device pass.
7. **No automated visual regression test.** Geometry is tested numerically, not
   screenshot-tested.
8. **The real-browser canvas fix is unconfirmed.** The probe observed the
   300 × 150 canvas and missing metrics, but Chrome could not be foregrounded
   again after the CSS change. No rendered frame or screenshot exists yet.
9. **Bridge dressing is not fully physical.** The walkable height sampler
   follows the deck and ramps, but parapets have no collision volumes and there
   is no fall, underpass or hydraulic model. Bridge decks use a straight grade
   between endpoints rather than a surveyed bridge profile.
10. **Compound walls and balconies are visual only.** Compound wall panels and
    gate leaves have no collision volumes, and balconies are facade geometry
    rather than enterable floors. Both are capped LOD accents; vendor stands use
    the existing circle-obstacle approximation.

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
3. Review the new bridges, market clusters, shop boards, vehicles, gutters,
   pavements, compound walls, balconies, vendor umbrellas and waterway ribbons
   in the browser, and adjust density/placement after the visual pass.
4. Run a local cultural review of signage colours, market dressing, compound
   gate treatments and bridge parapets before treating M8 as complete.
5. The next large product step after M8 is a second geographic district pack;
   that requires new verified source data and a separate acceptance pass.
