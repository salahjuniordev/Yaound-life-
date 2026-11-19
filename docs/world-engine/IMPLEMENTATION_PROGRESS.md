# Implementation Progress

Last updated: 2026-11-19

## Milestones

| Milestone | Status | Evidence |
| --- | --- | --- |
| M0 — Baseline and contract | Done | Baseline verified before the slice commit; architecture and decisions documented here and in `WORLD_ENGINE_ARCHITECTURE.md` |
| M1 — Coordinates and data layer | Done | `src/world/`, manifest/transform/chunk/terrain/road/building tests |
| M2 — Real Yaoundé data | Done with documented exclusion | Nlongkak, Mvog-Mbi and Mokolo packs from OSM 2026-10-30 + Copernicus GLO-30; Open Buildings excluded with blocker |
| M3 — Real road network | Done | 426 Nlongkak + 224 Mvog-Mbi + 100 Mokolo clipped roads, classes/widths/roundabouts, graph, spatial index |
| M4 — Buildings and terrain | Done | 8,085 Nlongkak + 2,659 Mvog-Mbi + 1,989 Mokolo buildings; 16 + 9 + 6 heightfield chunks; water polygons and waterway lines; collision metadata |
| M5 — Chunking and rendering | Done | `ChunkLru` stable over-cap planning, streaming, near/far LOD, disposal, grounding, safe spawn, quality tiers |
| M6 — Offline packaging | Done | `files.json`, `precache.json`, registry-aware versioned world caches, Settings pack download UI, progress/quota/cancel, multi-pack cleanup, service-worker and cache download tests |
| M7 — Gameplay/district alignment | Done | Manifest-driven district adapter, safe spawn, NPC placement, POI anchors, travel alignment, save compatibility |
| M8 — Visual/cultural/legal/perf | Partial | Waterway lines, six OSM bridge decks/parapets, market-stall clustering, painted shop signage, mixed vehicles, drainage/pavement detail, utility poles/cables/street signs, roadside shrubs, compound walls/gates, upper-floor balconies, vendor umbrellas/display tables, bounded parking bays with parked cars, architecture, lighting, attribution and budgets exist; an internal cultural review, a renderer-only geometry review and single-view WebGL frames for spawn, compound, balcony, market, bridge and parking are complete. The cross-chunk spawn road defect and the dark-gate framing finding are resolved. Android Chrome/device performance/offline checks and a named local Cameroonian cultural review remain |
| Phase 5 — Geographic expansion | Infrastructure done; three packs generated | District-keyed registry, manifest/version/area checks, generic adapter, multi-pack offline UI/cache cleanup, service-worker path-aware caching and save round-trips are tested. Nlongkak (`world/v1`), Mvog-Mbi (`world/mvog-mbi/v1`) and Mokolo (`world/mokolo/v1`) are registered; Mvog-Mbi and Mokolo visual/device/offline/cultural acceptance remains open |

## Current packs

Nlongkak:

- Area: Nlongkak, Yaoundé (`nlongkak`), bbox `11.5126,3.8780,11.5305,3.8960`.
- World version: `nlongkak-2026-10-30-v2`; generator version `1.1.0`.
- Chunks: 16 (4 × 4, 512 m).
- Features: 426 roads (including six `bridge`-tagged ways), 8,085 buildings, 409 POIs, 2 water polygons, 35 waterway lines (5 rivers, 29 streams, 1 drain; 5,868 m of centrelines), 62,750 terrain samples.
- Offline catalog: 90 files, 5,391,242 bytes; initial precache 53 files (8 global files + 3 × 3 chunks, about 5.1 MB).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 713.3 m.

Mvog-Mbi:

- Area: Mvog-Mbi, Yaoundé (`mvog_mbi`), bbox `11.5156,3.8445..11.5258,3.8583`, derived from OSM relation `3093787` and padded for edge geometry.
- World version: `mvog-mbi-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 9 (3 × 3, 512 m); 1,138 m × 1,530 m.
- Features: 224 roads, 2,659 buildings, 89 POIs, 5 water polygons, 18 waterway lines, 27,456 terrain samples.
- Offline catalog: 55 files, 2,042,372 bytes; initial precache 53 files (8 global files + 3 × 3 chunks).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 698.9 m.

Mokolo:

- Area: Mokolo, Yaoundé (`mokolo`), bbox `11.4929,3.8713..11.5040,3.8800`, derived from OSM relation `2758122` and padded for edge geometry.
- World version: `mokolo-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 6 (3 × 2, 512 m); 1,236 m × 966 m.
- Features: 100 roads, 1,989 buildings, 38 POIs, 1 water polygon, 15 waterway lines, 19,032 terrain samples.
- Offline catalog: 40 files, 1,347,034 bytes; initial precache 38 files (8 global files + all 6 chunks). Registered for on-demand download (`precacheOnInstall` off).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 717.1 m.

Registry and deployment:

- `public/world/registry.json` registers `nlongkak` at `world/v1`, `mvog_mbi` at `world/mvog-mbi/v1`, and `mokolo` at `world/mokolo/v1`. Nlongkak and Mvog-Mbi are precached on install; Mokolo is available through the Settings download. The registry is deployment metadata outside the pack catalogs.
- The full deployed `public/world` tree is 192 files, 8,808,536 bytes raw / 1,481,539 bytes gzip.
- Mvog-Mbi and Mokolo have runtime-loader, chunk, manifest and default-spawn clearance evidence only. Neither has had visual, Android/device/offline or named local cultural review.

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
- `npm test`: 241 pass, 0 fail.
- `build`: pass; generated `dist/app-shell.json` with 16 entries.
- `size`: all budgets pass — JS 579,007 B gzip, CSS 8,625 B, HTML 1,815 B,
  first load 589,447 B, world assets 8,808,536 B raw / 1,481,539 B gzip (192 files).
- `world:validate`: pass for all three registered packs.
- Nlongkak production geometry after the road correction: 640,576 building,
  102,550 prop and 157,182 road triangles at high quality across 16 chunks.
  Mvog-Mbi and Mokolo geometry have not yet had a production visual/performance pass.

## Latest round: third geographic pack (Mokolo)

Mokolo is now a real, separate geographic pack:

- Derived from the pinned OSM Cameroon 2026-10-30 extract and Copernicus DEM
  tile using OSM relation `2758122`, padded to bbox
  `11.4929,3.8713..11.5040,3.8800`.
- `data/geodata/config/mokolo.json` declares the area, sources, output path and
  disabled Open Buildings reason. It sets `precacheOnInstall: false`, so the
  pack is downloaded explicitly from Settings instead of increasing the
  install precache for every user.
- Generated `public/world/mokolo/v1` with 6 chunks (3 x 2), 100 roads, 1,989
  buildings, 38 POIs, 1 water polygon, 15 waterway lines and 19,032 terrain
  samples. Its offline catalog is 40 files / 1,347,034 bytes.
- The registry now has three packs, and the built-in fallback mirrors all
  three. Registry, runtime-loader, manifest, chunk and default-spawn checks now
  iterate every registered pack instead of only Mvog-Mbi.
- Nlongkak and Mvog-Mbi pack data, gameplay district IDs, save format and
  renderer behavior are unchanged. Mokolo has not had visual, Android/device,
  offline or named local cultural review, so it is not claimed device-playable.
  Browser-based checks are deferred by product direction for now.
- The all-pack runtime test now checks every gameplay place for each registered
  pack: it must be exposed, remain inside the pack bounds, stay clear of
  buildings and sit within 3.5 m of a walkable road. A production-loader
  geometry smoke test builds terrain, clipped roads, buildings and props for all
  six Mokolo chunks and asserts non-empty finite positions. These are static
  code/data checks, not rendered-frame or device evidence.

## Previous round: second geographic pack (Mvog-Mbi)

Mvog-Mbi is now a real, separate geographic pack rather than a registry-only
test fixture:

- Acquired from the pinned raw inputs already in the repository
  (`cameroon-261030.osm.pbf` and the Copernicus GLO-30 N03/E011 tile), using OSM
  relation `3093787` to define the district bbox. `osmium` and Pillow are now
  installed in the build environment, so the extraction and DEM decode are
  reproducible.
- `data/geodata/config/mvog_mbi.json` declares the bbox, output path,
  world version, source files and disabled Open Buildings reason. The processed
  inputs remain gitignored.
- Generated `public/world/mvog-mbi/v1` with 9 chunks, 224 roads, 2,659
  buildings, 89 POIs, 5 water polygons, 18 waterway lines and 27,456 terrain
  samples. `world:validate` passes for the pack and every chunk hash/payload.
- `scripts/world-acquire.sh` now accepts an area config and derives the bbox,
  source/output paths and DEM window; `scripts/world-build.mjs` accepts a config
  argument and always upserts `public/world/registry.json`;
  `scripts/world-inspect.mjs` accepts an area config; `scripts/world-validate.mjs`
  accepts an optional pack path, and `scripts/world-validate-all.mjs` validates
  every registered pack by default.
- `BUILTIN_WORLD_REGISTRY` mirrored both then-current packs so an offline
  registry fetch failure still selected the correct district.
- Added a runtime-loader test that loads Mvog-Mbi's manifest, global data and
  all 9 chunks from the committed files, then checks that the default spawn is
  outside building footprints and within 3 m of a walkable road. Settings
  removal now deletes only the selected pack's cache; other registered packs
  and their offline data are preserved.
- No Nlongkak pack data, gameplay district ID, save format, collision rule or
  renderer behavior changed. Mvog-Mbi has not yet had visual, Android/device,
  offline or named local cultural review, so this is not a claim that the new
  pack is device-playable.

## Previous round: optional Open Buildings importer contract

The optional production blocker was turned into a tested, opt-in contract
without adding any production footprints or changing the pack:

- `src/world/openBuildings.ts` validates source ID, selected licence, attribution,
  snapshot date and relative CSV export path. It accepts only the two licences
  Google publishes for Open Buildings V3 (`CC-BY-4.0` or `ODbL-1.0`).
- The importer parses Open Buildings CSV plus closed `POLYGON`/`MULTIPOLYGON`
  WKT, rejects holes/3D/non-polygon geometry, filters confidence, area and
  bounds, and deduplicates accepted detections against OSM and against each
  other. OSM geometry is collected first and is never replaced.
- Accepted candidates carry source, deterministic source ID, snapshot date,
  selected licence, attribution, confidence and `geometryStatus: inferred`.
  Heights/floors remain inferred and classification is `unknown`.
- `scripts/world-build.mjs` runs the importer only when an area config has
  `openBuildings.enabled: true`; there is no such block in `nlongkak.json`.
  When enabled, `manifest.json`, `licenses.json` and
  `metadata/build-report.json` include the source, obligations and import
  statistics. The current pack was not regenerated.
- `test/openBuildings.test.ts` adds 10 synthetic-fixture tests for config
  validation, opt-in gating, checked-in-config safety, WKT/CSV parsing,
  confidence/bounds/area filtering, OSM deduplication, duplicate rejection and
  simplified-ring provenance.
- `test/fixtures/open-buildings-synthetic.csv` and
  `test/fixtures/open-buildings-malformed.csv` are test-only synthetic data.

`npm run typecheck`, 227/227 tests, build, size budgets and `world:validate`
pass. No world-pack, gameplay-ID, collision or save-format change was made.
Production ingestion remains blocked on a licensed local export and a legal
review of the chosen dual licence.

## Previous round: M8 cross-chunk road ownership and live spawn fix

The M8 acceptance investigation confirmed that the live spawn grass was a real
renderer defect, not camera framing. The pack stores each whole OSM way in the
chunk containing its midpoint. The renderer then drew the full way using that
chunk's terrain, so roads that crossed a chunk boundary could be absent in the
neighbouring chunk or lie under its heightfield. At spawn, `Rue Marcus Etoundi`
(`osm-w35897073`) belonged to `c_1_2` but extended north into `c_1_1`; the road
surface there was about 2.1 m below the local terrain, mostly because a 157 m
quad was interpolated against the owning chunk's heightfield.

The fix is renderer-only and does not regenerate the pack or change road IDs,
gameplay collision or saves:

- `roadsForChunk` in `src/world/roads.ts` clips the global road network to each
  chunk with a Liang-Barsky segment clip. It handles segments whose endpoints
  are both outside the box, keeps bridge ways whole in their midpoint chunk,
  and preserves contiguous pieces.
- `GeoScene` builds road, shoulder, gutter, curb and pavement geometry from
  that local clipped set and the local heightfield. `buildPropsGeometry` uses
  the same local roads, so street furniture, compound gates and parking bays
  face roads the player can actually see.
- Long road segments are subdivided at 10/16/24 m for high/mid/low and the
  carriageway/shoulder is split laterally, so terrain undulations cannot leave
  a long flat quad buried under a hill.
- Added `roadsForChunk` regression coverage for a way crossing a chunk with
  both endpoints outside, an outside way and a bridge way.

A real Three.js/WebGL single-view harness now lives at
`review/m8-single-view.html` / `review/m8-single-view.ts`; it imports the
production loader and geometry and renders spawn, compound gate/top, balcony,
market, bridge top and parking frames under Chromium + Mesa llvmpipe Vulkan.
The controlled compound gate frame shows a readable dark-green leaf with pale
rails; the earlier live near-black compound frame was camera framing inside a
neighbouring roof. No gate material/LOD change was needed.

The rebuilt live app at Nlongkak now shows asphalt, centre markings and
pavements at spawn: 16 chunks, 8,085 active buildings, 736,857 rendered
triangles, 92 draw calls and about 4 FPS under software Mesa. A live frame at
the actual placed compound gate shows the wall, dark-green leaf and pale rails:
944,258 triangles and 94 draw calls at the same software frame rate. The gate
capture used a temporary review placement hook in the dev mirror only; no
teleport is committed. This is not Android or hardware-device evidence. Typecheck is clean, 217/217 tests pass,
build and all size budgets pass, and `world:validate` passes.

## Previous round: M8 parking/transport detail and remaining-work audit

The master-brief audit against the current implementation found one explicit
M8 asset category with no dedicated geometry: parking areas and roadside
transport activity. This round adds bounded parking bays without changing the
world pack, gameplay IDs or saves:

- Commercial/civic POIs (`marketplace`, `mall`, shops, restaurants, fuel,
  transport, schools, clinics, civic buildings) get parking aligned to the
  nearest vehicle road. The bay is checked against building footprints,
  carriageways and existing prop obstacles before any geometry is emitted.
- A bay gets an asphalt slab, painted bay lines and up to two parked cars
  through the existing vehicle builder, so the cars receive the same collision
  circles as street traffic. Bays are visual/collision-only; the slab itself
  has no collision volume.
- Caps are 2/1/0 bays per high/mid/low chunk. Parking has a separate cap and
  does not consume the street-prop budget, so market/vendor detail is not
  starved. The pre-correction pass measured 75 vendor umbrellas and 75 display
  tables; the current local-road pass measures 86 of each.
- `PropBuild.counts` now exposes `parkingBays` and `parkedVehicles`.
  `test/geo.test.ts` covers the high-quality bay, parked cars, low-tier
  exclusion and deterministic geometry.
- The pre-correction production-loader pass measured 17 parking bays and 34
  parked vehicles at high quality. Prop geometry rose from 96,789 to 100,869
  triangles (+4,080, 4.2%); building geometry remained 640,576 triangles. After
  the later local-road correction the counts are 18 bays and 36 parked
  vehicles, and a single-view WebGL parking frame has now been reviewed.
- Added `docs/world-engine/REMAINING_WORK.md`, which now records the completed
  single-view/spawn/gate investigation and the remaining Android/device/culture
  gates, then audits the remaining master-brief work: Open Buildings ingestion
  and Phase 5 geographic expansion. The brief defines M0–M8 only; there is no
  M9.
- M8 remains partial. Live Chromium + Mesa WebGL frames exist for spawn,
  walking and market views, and the later single-view harness completes the
  compound/balcony/bridge/parking review; Android Chrome/device checks and the
  named local cultural review remain outstanding.
- At that round, typecheck was clean, 216/216 tests passed, build and all size
  budgets passed (JS 575,941 B gzip, first load 586,381 B), and
  `world:validate` passed. The later cross-chunk fix raised this to 217/217 and
  JS 576,491 B gzip; no world-pack files changed.

## Previous round: M8 frontage detail and renderer-only visual review

This round completes the remaining procedural frontage detail requested by the
master brief, records a visual review of the production geometry, and applies
the one review-driven fix. The world pack was not regenerated:

- The near building mesh now adds deterministic upper-floor balconies on a
  capped set of eligible two-storey-plus houses, shops, offices, public
  buildings and apartments. Each balcony has a slab, a framed dark opening,
  an open metal front rail with seven balusters, two side rails with corner
  posts and two support brackets. The initial solid 0.78 m front panel was
  replaced after review because at street distance it read as an
  air-conditioning box rather than a balcony. Caps are 10/5/0 per high/mid/low
  chunk.
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
- A production-loader pass over all 16 chunks measured 128 compound walls/gates,
  75 vendor stands/tables, 640,576 building triangles and 96,789 prop triangles
  at high quality. The earlier frontage-only measurement was 619,456 building
  triangles; the open-rail/door detail adds 21,120 triangles (3.4%).
- Added `test/geo.test.ts` coverage for deterministic balcony geometry, the
  compound-wall cap and gate counts, low-tier exclusion, and market vendor
  umbrellas/display tables.
- Headless Chromium with Three.js still loses the WebGL context under
  SwiftShader, so no live-app screenshot was possible. A temporary Node
  software rasterizer imported the production terrain, road, building and prop
  builders and rendered seven review frames at 1100×760 for chunks `c_1_0` to
  `c_1_3` at high quality: compound gate, Nlongkak roadside vendor, road-facing
  balcony, Nkol Eton market close/wide, bridge approach and Nlongkak street.
  These are renderer-geometry artifacts, not live-app, browser or Android
  screenshots. They are intentionally kept outside the repository; the review
  record is in `M8_VISUAL_CULTURAL_REVIEW.md`.
- Review findings: the compound gate, caps, piers and partly open leaf read
  correctly; the roadside parasol, centre pole, display table and produce boxes
  read; the market cluster shows stalls, umbrellas, tables, painted signage and
  utility wires; the street view shows a taxi, moto, utility poles/cables and
  road markings; the bridge approach shows parapets, deck and markings.
  Limitations: compound walls hug the building and a gate can open toward a
  blank facade; some seeded balconies face away from roads or are obscured by
  neighbours; the market ground remains terrain rather than a verified paved or
  packed-earth surface; the static review cannot assess people, UI, shadows,
  frame rate or input.
- An internal cultural review was completed against the brief. It considers the
  compound walls, balconies, vendor tables, taxis/motos, painted commerce and
  utility lines plausible for Nlongkak and avoids folklore caricature. A named
  local Cameroonian cultural review is still outstanding, so M8 remains partial.
- No world-pack files, gameplay IDs or save data changed. Compound walls and
  gates are visual-only: there are no collision volumes yet, and balconies are
  facade geometry rather than enterable floors. No live-browser visual check or
  real-device performance/offline check was performed.

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

1. **Open Buildings not ingested in production.** The optional importer contract
   and synthetic tests now exist, but the dataset still requires a licensed
   Google export that is not in the repository. The current packs contain no
   Open Buildings geometry. Exact blocker is in `GEOGRAPHIC_DATA_SOURCES.md`.
2. **Waterway hydrology is visual only.** Surface heights are inferred from the
   DEM; there is no flow simulation, flooding or channel carving beyond the
   rendered ribbon. The six OSM bridge ways now get decks and ramps, but bridge
   hydraulics are not modelled.
3. **Real-device performance is unmeasured.** The overlay and budgets exist, but
   no low-end Android numbers are recorded. Chromium + Mesa produced live WebGL
   frames (about 4.0 FPS at 736,857 rendered triangles and 92 draw calls after
   the road fix), but this is software rendering, not device evidence.
4. **Three districts are geographic; six remain procedural.** Nlongkak,
   Mvog-Mbi and Mokolo have real packs. The Phase 5 registry, loader, generic
   adapter and multi-pack offline plumbing are implemented and tested, but
   Mvog-Mbi and Mokolo still need visual/device/performance/cultural review,
   and the other six districts still need verified packs.
5. **M8 still needs device and local review.** The renderer-only review
   inspected compound walls/gates, balconies, roadside and market vendors,
   vehicles/utilities and bridge approaches, and found one concrete facade
   defect: the balcony front rail read as a solid box. The rail and opening
   were fixed. Single-view Chromium + Mesa WebGL frames now cover the compound
   gate/top, balcony, market, bridge top, parking and spawn ground/top; the
   grassy spawn and near-black gate findings are resolved. Android Chrome and
   the named local cultural review remain.
6. **Offline browser behavior is only unit-tested.** The first-load shell gap
   was found in a real cache audit and fixed, but a real install-then-offline
   reload, Settings download/cancel/remove flow, persistent-storage prompt and
   quota accounting still need a device pass.
7. **No automated visual regression test.** Geometry is tested numerically, not
   screenshot-tested.
8. **The real-browser canvas fix is confirmed only under Chromium + Mesa.**
   The live app rendered a full frame and metrics in headless Chromium using
   Mesa/lavapipe Vulkan. Android Chrome still cannot be foregrounded, so the
   on-device canvas, input and screenshot evidence remain missing.
9. **Bridge dressing is not fully physical.** The walkable height sampler
   follows the deck and ramps, but parapets have no collision volumes and there
   is no fall, underpass or hydraulic model. Bridge decks use a straight grade
   between endpoints rather than a surveyed bridge profile.
10. **Compound walls and balconies are visual only.** Compound wall panels and
    gate leaves have no collision volumes, and balconies are facade geometry
    rather than enterable floors. Both are capped LOD accents; vendor stands use
    the existing circle-obstacle approximation.
11. **Parking bays are visually reviewed but not device-tested.** The slab has
    no collision volume; parked cars use the existing vehicle circle obstacles
    and are static. 18 bays/36 cars are placed at high quality after the road
    correction; the single-view WebGL frame shows a marked bay with two cars,
    but no local reviewer or Android device has judged their placement.

## Save compatibility

Saves store player state, not world geometry. The geographic adapter reads
existing district and place IDs; no existing gameplay IDs were renamed or
deleted. Procedural fallback remains available through Settings,
`?world=legacy`, and `yaounde-world-mode=legacy`.

## Next action

1. Browser-based, Android/device and named cultural checks are deferred by
   product direction. Do not schedule browser automation now and do not mark
   M8 complete without later evidence.
2. Continue Phase 5 with one more verified district pack when needed: use a
   per-area OSM/DEM config, `npm run world:acquire -- ...`, then
   `world:validate`; do not regenerate existing packs or invent inputs.
3. Keep automated pack/runtime/chunk/spawn validation and size budgets green
   for every registered pack. A static renderer-geometry pass is useful; visual
   claims still require later review.
4. Use the Open Buildings importer only when a licensed export and licence
   review exist.
5. Update `IMPLEMENTATION_CHECKLIST.md` and this file after each step; keep
   every change within the existing size and world-pack budgets.
