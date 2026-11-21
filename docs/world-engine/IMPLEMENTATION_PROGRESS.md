# Implementation Progress

Last updated: 2026-11-21

## Milestones

| Milestone | Status | Evidence |
| --- | --- | --- |
| M0 — Baseline and contract | Done | Baseline verified before the slice commit; architecture and decisions documented here and in `WORLD_ENGINE_ARCHITECTURE.md` |
| M1 — Coordinates and data layer | Done | `src/world/`, manifest/transform/chunk/terrain/road/building tests |
| M2 — Real Yaoundé data | Done with documented exclusion | Nlongkak, Mvog-Mbi, Mokolo, Bastos, Ngoa-Ekelle, Boulevard du 20 Mai, Lac Municipal, Mvan and Mont Febe packs from OSM 2026-10-30 + Copernicus GLO-30; Open Buildings excluded with blocker |
| M3 — Real road network | Done | 426 Nlongkak + 224 Mvog-Mbi + 100 Mokolo + 170 Bastos + 198 Ngoa-Ekelle + 229 Boulevard du 20 Mai + 208 Lac Municipal + 102 Mvan + 91 Mont Febe clipped roads, classes/widths/roundabouts, graph, spatial index |
| M4 — Buildings and terrain | Done | 8,085 Nlongkak + 2,659 Mvog-Mbi + 1,989 Mokolo + 2,270 Bastos + 2,862 Ngoa-Ekelle + 467 Boulevard du 20 Mai + 743 Lac Municipal + 1,539 Mvan + 492 Mont Febe buildings; 16 + 9 + 6 + 9 + 9 + 4 + 9 + 9 + 9 heightfield chunks; water polygons and waterway lines; collision metadata |
| M5 — Chunking and rendering | Done | `ChunkLru` stable over-cap planning, streaming, near/far LOD, disposal, grounding, safe spawn, quality tiers |
| M6 — Offline packaging | Done | `files.json`, `precache.json`, registry-aware versioned world caches, Settings pack download UI, progress/quota/cancel, multi-pack cleanup, service-worker and cache download tests |
| M7 — Gameplay/district alignment | Done | Manifest-driven district adapter, safe spawn, NPC placement, POI anchors, travel alignment, save compatibility |
| M8 — Visual/cultural/legal/perf | Partial | Waterway lines, six OSM bridge decks/parapets, market-stall clustering, painted shop signage, mixed vehicles, drainage/pavement detail, utility poles/cables/street signs, roadside shrubs, compound walls/gates, upper-floor balconies, vendor umbrellas/display tables, bounded parking bays with parked cars, architecture, lighting, attribution and budgets exist; an internal cultural review, a renderer-only geometry review and single-view WebGL frames for spawn, compound, balcony, market, bridge and parking are complete. The cross-chunk spawn road defect and the dark-gate framing finding are resolved. Android Chrome/device performance/offline checks and a named local Cameroonian cultural review remain |
| Phase 5 — Geographic expansion | Infrastructure done; nine packs generated | District-keyed registry, manifest/version/area checks, generic adapter, multi-pack offline UI/cache cleanup, service-worker path-aware caching and save round-trips are tested. All nine district packs are registered; visual/device/offline/cultural acceptance remains open for every pack except Nlongkak's internal renderer/WebGL review |

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

Bastos:

- Area: central Bastos, Yaoundé (`bastos`), bbox `11.5039,3.8882..11.5168,3.8999`, a central slice inside OSM relation `3096136`.
- World version: `bastos-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 9 (3 × 3, 512 m); 1,437 m × 1,299 m.
- Features: 170 roads, 2,270 buildings, 352 POIs, 0 water polygons, 11 waterway lines, 29,503 terrain samples.
- Offline catalog: 55 files, 2,003,437 bytes; initial precache 53 files (8 global files + 3 × 3 chunks). Registered for on-demand download (`precacheOnInstall` off).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 726.6 m.

Ngoa-Ekelle:

- Area: Ngoa-Ekelle, Yaoundé (`ngoa_ekelle`), bbox `11.4935,3.8505..11.5065,3.8625`.
- World version: `ngoa-ekelle-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 9 (3 × 3, 512 m); 1,449 m × 1,332 m.
- Features: 198 roads, 2,862 buildings, 723 POIs, 25 water polygons, 50 waterway lines, 30,394 terrain samples.
- Offline catalog: 55 files, 2,771,389 bytes; initial precache 53 files. On-demand (`precacheOnInstall` off).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 711.4 m.

Boulevard du 20 Mai:

- Area: central Boulevard du 20 Mai, Yaoundé (`boulevard`), bbox `11.5125,3.8594..11.5215,3.8686`.
- World version: `boulevard-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 4 (2 × 2, 512 m); 1,003 m × 1,021 m.
- Features: 229 roads, 467 buildings, 250 POIs, 17 water polygons, 7 waterway lines, 16,254 terrain samples.
- Offline catalog: 30 files, 1,081,895 bytes; initial precache 28 files (8 global files + all 4 chunks). On-demand (`precacheOnInstall` off).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 699.9 m.

Lac Municipal:

- Area: Lac Municipal, Yaoundé (`lac_municipal`), bbox `11.5045,3.8600..11.5145,3.8700`.
- World version: `lac-municipal-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 9 (3 × 3, 512 m); 1,115 m × 1,110 m.
- Features: 208 roads, 743 buildings, 124 POIs, 5 water polygons, 7 waterway lines, 19,600 terrain samples.
- Offline catalog: 55 files, 1,165,404 bytes; initial precache 53 files. On-demand (`precacheOnInstall` off).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 707.1 m.
- Gameplay anchor is a shoreline point (`11.5115261,3.8654830`) on a lake-edge footway, not the lake centroid; provenance is `way/1054466544+shore`. The `lac_path` and `taxi_lac` places were moved to shore-side positions for road clearance.

Mvan:

- Area: Mvan, Yaoundé (`mvan`), bbox `11.5108,3.8170..11.5220,3.8282`.
- World version: `mvan-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 9 (3 × 3, 512 m); 1,248 m × 1,243 m.
- Features: 102 roads, 1,539 buildings, 20 POIs, 1 water polygon, 29 waterway lines, 24,492 terrain samples.
- Offline catalog: 55 files, 1,211,978 bytes; initial precache 53 files. On-demand (`precacheOnInstall` off).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 679.2 m.

Mont Febe:

- Area: Mont Febe, Yaoundé (`mont_febe`), bbox `11.4840,3.9050..11.4960,3.9185`.
- World version: `mont-febe-2026-10-30-v1`; generator version `1.1.0`.
- Chunks: 9 (3 × 3, 512 m); 1,338 m × 1,498 m.
- Features: 91 roads, 492 buildings, 12 POIs, 0 water polygons, 2 waterway lines, 31,584 terrain samples.
- Offline catalog: 55 files, 708,310 bytes; initial precache 53 files. On-demand (`precacheOnInstall` off).
- Projection: EPSG:32632; 1 unit = 1 m; vertical offset 762.7 m.

Registry and deployment:

- `public/world/registry.json` registers all nine packs: `nlongkak` at `world/v1`, `mvog_mbi` at `world/mvog-mbi/v1`, `mokolo` at `world/mokolo/v1`, `bastos` at `world/bastos/v1`, `ngoa_ekelle` at `world/ngoa-ekelle/v1`, `boulevard` at `world/boulevard/v1`, `lac_municipal` at `world/lac-municipal/v1`, `mvan` at `world/mvan/v1` and `mont_febe` at `world/mont-febe/v1`. Nlongkak and Mvog-Mbi are precached on install; the other seven are available through the Settings download. The registry is deployment metadata outside the pack catalogs.
- The full deployed `public/world` tree is 509 files, 17,805,627 bytes raw / 3,241,290 bytes gzip.
- All nine packs have runtime-loader, chunk, manifest and default-spawn clearance evidence. The other eight packs have not had visual, Android/device/offline or named local cultural review; Nlongkak has only the internal renderer/WebGL review.

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
- `npm test`: 250 pass, 0 fail.
- `build`: pass; generated `dist/app-shell.json` with 16 entries.
- `size`: all budgets pass — JS 583,787 B gzip, CSS 8,671 B, HTML 1,813 B,
  first load 594,271 B, world assets 17,805,627 B raw / 3,241,290 B gzip (509 files).
- `world:validate`: pass for all nine registered packs.
- Nlongkak production geometry after the road correction: 640,576 building,
  102,550 prop and 157,182 road triangles at high quality across 16 chunks.
  Every registered pack passes the production-loader geometry smoke test; only
  Nlongkak has had a renderer/WebGL review, and none has had a production
  visual/performance pass.

## Latest round: gameplay content parity for three districts

Boulevard du 20 Mai, Lac Municipal and Mont Febe now have designed gameplay
content mapped near their real road slices:

- Boulevard du 20 Mai: `boulevard_events_office`, `museum_garden_cafe` and
  `boulevard_kiosk`; jobs `museum_guide` and `civic_events_assistant`; NPC
  Clarisse (museum guide).
- Lac Municipal: `lac_cafe`, `lac_snack_kiosk` and `lac_shore_garden`; jobs
  `lakeside_server` and `lake_groundskeeper`; NPC Mireille (lakeside cafe
  manager).
- Mont Febe: `febe_guesthouse`, `febe_trailhead` and `febe_view_kiosk`; jobs
  `mountain_trail_guide` and `guesthouse_receptionist`; NPC Tsala (trail guide).
- The places reuse the existing `office`, `restaurant`, `hotel`, vendor and
  activity content. No new interior layout, world-pack geometry, district ID,
  existing place ID or save field was introduced.
- Off-schedule named NPCs now rest at their home district centre instead of
  falling back to the Mvog-Mbi default; a test covers this path for the new
  partial schedules.
- Tests now reject unknown activity references on places and enforce the three
  districts' minimum non-taxi place, taxi and job coverage. The named-NPC
  schedule test also covers Clarisse, Mireille and Tsala.
- These are fictional gameplay locations mapped near real roads, not claims
  about real business names or addresses. Production visual, Android/device,
  offline/Settings and named cultural review remain deferred for all three.

Verification: typecheck clean, 248/248 tests pass, production build passes, all
size budgets pass (JS 583,587 B gzip, first load 594,026 B, world assets
17,805,627 B raw / 3,241,290 B gzip across 509 files), and `world:validate`
passes for all nine packs.

In parallel, the backend gained the shared city-state migration and client
consumption described in `docs/BACKEND.md`. The migration was applied to the
hosted project on 2026-11-21; the daily cron job, generated row, client read
access, write denial and service-only generator access all pass verification
(`npm run db:verify`: 17/17 PASS). The phone now surfaces the state: News
renders the published bulletin with a local fallback, and Map shows weather,
fuel, taxi strike and the selected quartier's delestage window. Verification:
250/250 tests; JS 583,787 B gzip; first load 594,271 B.

## Earlier round: nine-pack city coverage and Bastos content close-out

Phase 5 district coverage is complete. The five remaining geographic packs are
now registered, and the Bastos content pass now matches its existing employers:

- Ngoa-Ekelle: `public/world/ngoa-ekelle/v1`, 9 chunks, 198 roads, 2,862
  buildings, 723 POIs, 25 water polygons and 50 waterway lines.
- Boulevard du 20 Mai: `public/world/boulevard/v1`, 4 chunks (2 × 2), 229 roads,
  467 buildings, 250 POIs, 17 water polygons and 7 waterway lines.
- Lac Municipal: `public/world/lac-municipal/v1`, 9 chunks, 208 roads, 743
  buildings, 124 POIs, 5 water polygons and 7 waterway lines. The anchor is a
  shoreline footway point, and `lac_path`/`taxi_lac` are mapped to shore-side
  road positions instead of the lake centre.
- Mvan: `public/world/mvan/v1`, 9 chunks, 102 roads, 1,539 buildings, 20 POIs, 1
  water polygon and 29 waterway lines.
- Mont Febe: `public/world/mont-febe/v1`, 9 chunks, 91 roads, 492 buildings, 12
  POIs and 2 waterway lines.
- Bastos gameplay content: added `hotel_beausejour`, `ministry_public_service`,
  `sanaga_tech`, `wouri_creative`, `sentinel_security`, `restaurant_bastos` and
  `bastos_hillside` in `src/data/places.ts`; added reusable `office` and `hotel`
  interior layouts; added the `business_lunch` activity; and the interior panel
  now shows the selected place name instead of only the generic interior name.
- The all-pack checks now require every non-taxi `PLACES` entry to exist on a
  registered district, stay inside the pack, avoid buildings and sit within
  3.5 m of a walkable road. Job-district content coverage is also checked, and
  the production-loader geometry smoke test covers every chunk in all nine
  packs.
- The registry and built-in fallback mirror all nine packs. Nlongkak and
  Mvog-Mbi remain the only install-precached packs; the other seven are
  on-demand. No existing pack data, gameplay district IDs, save format or place
  IDs were removed or renamed.
- The raw world-asset budget was raised from 12 MB to 24 MB for the nine-pack
  city tree; the gzip budget remains 6 MB. The deployed tree is 509 files /
  17,805,627 B raw / 3,241,290 B gzip.
- Browser-based/device/offline/cultural checks remain deferred. The five new
  packs and the earlier Mvog-Mbi, Mokolo and Bastos packs have not had
  production visual, Android/device, Settings/offline or named cultural review;
  do not describe any of them as device-accepted. M8 remains partial.

Verification: typecheck clean, 241/241 tests pass, production build passes, all
size budgets pass (JS 580,092 B gzip, first load 590,532 B), and
`world:validate` passes for all nine packs.

## Previous round: fourth geographic pack (Bastos)

Bastos is now a real, separate geographic pack:

- Derived from the pinned OSM Cameroon 2026-10-30 extract and Copernicus DEM
  tile. OSM relation `3096136` is the reference for the central slice bbox
  `11.5039,3.8882..11.5168,3.8999`.
- `data/geodata/config/bastos.json` declares the area, sources, output path and
  disabled Open Buildings reason. It sets `precacheOnInstall: false`, so the
  pack is downloaded explicitly from Settings instead of increasing the
  install precache for every user.
- Generated `public/world/bastos/v1` with 9 chunks (3 x 3), 170 roads, 2,270
  buildings, 352 POIs, 0 water polygons, 11 waterway lines and 29,503 terrain
  samples. Its offline catalog is 55 files / 2,003,437 bytes.
- At that round the registry had four packs, and the built-in fallback mirrored
  all four.
  Registry, runtime-loader, manifest, chunk, default-spawn and gameplay-place
  checks iterate every registered pack. The production-loader geometry smoke
  test covers Mokolo and Bastos.
- Existing pack data, gameplay district IDs, save format and renderer behavior
  are unchanged. Bastos has not had visual, Android/device, offline or named
  local cultural review, so it is not claimed device-playable. Browser-based
  checks are deferred by product direction for now.

## Previous round: third geographic pack (Mokolo)

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
- At that round the registry had three packs, and the built-in fallback mirrored
  all three. Registry, runtime-loader, manifest, chunk and default-spawn checks now
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

## Earlier round: second geographic pack (Mvog-Mbi)

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

The previous pack baseline is `343a0a9` (the four-pack round). The nine-pack
coverage and Bastos content round is committed directly after it on `main`; it
adds derived packs, configs, tests and documentation, while gameplay district
IDs and the save format are unchanged. Earlier M8 rounds remain in the history
behind that baseline.

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
4. **All nine districts have packs; acceptance is incomplete.** The Phase 5
   registry, loader, generic adapter and multi-pack offline plumbing are
   implemented and tested. Nlongkak has internal renderer/WebGL review; the
   other eight packs still need production visual, device/performance, offline
   and named cultural review. The procedural fallback remains available.
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
2. Phase 5 district coverage is complete. Do not regenerate a pack without a
   concrete reason; if a new area is needed, use a per-area OSM/DEM config,
   `npm run world:acquire -- ...`, then `world:validate`, and do not invent
   inputs.
3. Keep automated pack/runtime/chunk/spawn validation and size budgets green
   for every registered pack. A static renderer-geometry pass is useful; visual
   claims still require later review.
4. Use the Open Buildings importer only when a licensed export and licence
   review exist.
5. Update `IMPLEMENTATION_CHECKLIST.md` and this file after each step; keep
   every change within the existing size and world-pack budgets.
