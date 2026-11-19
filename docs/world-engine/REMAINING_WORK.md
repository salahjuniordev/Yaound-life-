# Remaining World-Engine Work

Last updated: 2026-11-19

Status: **M0–M7 complete; M8 partial; four geographic packs registered
(Nlongkak, Mvog-Mbi, Mokolo and Bastos) with Phase 5 infrastructure. The master
brief defines no M9.** Browser-based/device/cultural acceptance checks are deferred by
product direction and remain unverified; they are not the active build goal.
The remaining active build work is further district packs, per-area static
review, and the blocked Open Buildings production import. Nothing in this
document is a claim that an unperformed check has passed.

## M8 acceptance work — status

These were the live-review/device/culture items parked while the remaining
master-brief build audit proceeded. **Browser-based checks are now explicitly
deferred by product direction.** The recorded gaps still prevent an M8-complete
claim, but they should not be scheduled as the next build task.

1. **Done 2026-11-16 — single-view WebGL frames.** A committed harness at
   `review/m8-single-view.html` / `review/m8-single-view.ts` renders the
   production loader and geometry in real Three.js/WebGL under Chromium + Mesa
   llvmpipe Vulkan. Frames cover the compound gate and top, balcony, market,
   bridge top, parking and spawn ground/top. The multi-view harness is
   superseded; it is not used as compound/balcony proof.
2. **Resolved 2026-11-16 — live findings.**
   - The grassy spawn was a real renderer/data-ownership defect: cross-chunk
     roads were missing or sampled against the wrong heightfield. The renderer
     now clips the global road network per chunk, rebuilds it against the local
     terrain, and subdivides long/wide road surfaces. The live spawn now shows
     asphalt, markings and pavements.
   - The near-black compound approach was camera framing under a neighbouring
     roof, not a gate material/LOD defect. A controlled production-geometry
     frame and a live-app frame at the actual placed gate show the dark-green
     leaf and pale rails; no gate material change was made.
3. **Done 2026-11-16 — verification and documentation.** `npm run typecheck`,
   217/217 tests, build, size budgets and `world:validate` pass. Production
   geometry is 640,576 building + 102,550 prop + 157,182 road triangles at high
   quality. `M8_VISUAL_CULTURAL_REVIEW.md` records the frames, root causes and
   limits. The world pack, gameplay IDs and saves were not changed.
4. **Deferred — external gates.** Actual Android Chrome on the SM-A716U:
   screenshots, input, real-device low/mid/high FPS, Settings
   download/cancel/remove and offline reload. Named local Cameroonian cultural
   review of gates, balconies, market dressing, vendor tables, signage,
   vehicles and bridge parapets. Do them later; do not claim them done.

The Mesa run is real WebGL evidence, but it is **not** Android Chrome or
real-device performance evidence.

## What remains to be built from the master brief

### M8 — Visual, cultural, legal and performance hardening

The master brief's M8 hardening scope is implemented, including the last
explicit missing asset category:

| M8 item | State | Evidence / limitation |
| --- | --- | --- |
| Environmental assets | Built | Pavements, drainage, utility poles/cables, street signs, streetlights, vegetation |
| Local architecture | Built | Painted concrete walls, gabled/corrugated roofs, shop fronts, awnings, compound walls/gates, balconies |
| Vegetation | Built | Bounded tropical trees, palms, bushes and terrain grass |
| Vehicles | Built | Taxis, private cars, minibuses, trucks and motos |
| Signs | Built | Painted shop boards, blade signs, street-name boards |
| Market details | Built | Market clusters, stalls, produce mats, boards, vendor umbrellas and display tables |
| Pedestrians | Integrated | Existing instanced crowd/LOD mapped onto the geographic world |
| Lighting | Built | Day/night lighting and streetlight geometry; real-device frame rate unmeasured |
| Visual variety | Built | Deterministic archetypes, colours, signs, traffic and props |
| Mobile optimization | Budgeted, not device-verified | Size/triangle caps pass; Android FPS and draw-call targets remain unmeasured |
| Data attribution | Built | In-app attribution, `licenses.json`, in-pack provenance |
| Licensing documentation | Built | `LICENSING_AND_ATTRIBUTION.md`, source-specific obligations |
| Feature flags and rollback | Built | Geographic world flag, per-district packs/legacy fallback and Settings control |
| Parking areas / roadside transport | Built 2026-11-16 | 18 bays and 36 parked vehicles after the road correction; single-view WebGL parking frame reviewed; device appearance untested |

M8 is still **partial** because the live/device/offline/cultural acceptance
gates are not complete. See `M8_VISUAL_CULTURAL_REVIEW.md`. Browser-based
checks are deferred and should not block continued pack work.

The renderer now clips the global road network per chunk instead of trusting
the pack's midpoint ownership. This fixed the missing/buried spawn road and
also gave props and compound gates the same local road set the player can see.
It is a renderer-only correction: the pack, road IDs, gameplay collision and
saves are unchanged.

### Open Buildings ingestion

Google Open Buildings V3 is still **not ingested**. No licensed local export is
present, and the brief forbids fabricating production footprints to hide that
gap. The current packs contain no Open Buildings geometry and remain built from
OSM plus Copernicus DEM only.

The optional importer contract is now implemented:

- `src/world/openBuildings.ts` validates the explicit source/licence/attribution
  config, parses Open Buildings V3 CSV/WKT, filters confidence/area/bounds,
  deduplicates against OSM and other detections, and emits provenance-bearing
  candidates.
- `scripts/world-build.mjs` runs the importer only when the area config contains
  `openBuildings.enabled: true`; otherwise it is a no-op. OSM buildings are
  collected first and Open Buildings candidates are only appended for gaps.
  OSM geometry is never replaced.
- `test/openBuildings.test.ts` covers the contract with synthetic fixtures in
  `test/fixtures/`; no synthetic footprint is production data.
- `metadata/build-report.json` records enabled-import statistics and rejection
  examples. `licenses.json` and manifest sources switch to the selected
  dual-licence attribution when an import is enabled.

This cannot produce production footprints until a licensed export exists.
A future real import still needs a rebuilt pack, `world:validate`, visual review
and licence review. The current `worldVersion` and save format must not change
solely because the importer contract exists.

### Phase 5 — Geographic city expansion

Nlongkak, Mvog-Mbi, Mokolo and Bastos are geographic. Ngoa-Ekelle, Mvan, Mont
Febe, Lac Municipal, Boulevard du 20 Mai and the remaining gameplay areas still
render the legacy procedural world.

The multi-pack infrastructure is implemented without changing gameplay district
IDs or the save format:

1. **Area build configuration and reproducible extraction.** Nlongkak,
   Mvog-Mbi, Mokolo and Bastos each have an explicit config
   (`data/geodata/config/*.json`). The `world:acquire` script takes an area
   config, derives its bbox and DEM window, and runs `world:build`; the raw
   OSM/DEM inputs remain pinned and gitignored. Mvog-Mbi used OSM relation
   `3093787`; Mokolo used relation `2758122`; Bastos uses relation `3096136` as
   a reference for a central slice; all use the same 2026-10-30 OSM/Copernicus
   inputs as Nlongkak.
2. **Registry/selector.** `public/world/registry.json` maps gameplay district IDs
   to versioned packs. `src/world/registry.ts` validates unique districts, safe
   site-relative `basePath`s, version tokens and manifest-format compatibility,
   and provides a built-in four-pack fallback if the registry request fails.
3. **Loader and offline support.** `loadWorldRegistry` and `loadManifest` check
   the registered `worldVersion` and `area.id`. Settings selects among
   compatible registered packs, downloads each separately and removes only the
   selected pack; cleanup preserves every registered version. Nlongkak and
   Mvog-Mbi have `precacheOnInstall: true`; Mokolo and Bastos are on-demand.
4. **Adapter and gameplay mapping.** `src/render/geo/adapter.ts` derives its
   district, anchor, place filter, `districtAt` and position mapping from the
   loaded manifest/`WorldDistrictAnchor`. A non-Nlongkak adapter test and
   runtime-loader, chunk and default-spawn checks over every registered pack
   cover the path.
5. **Save compatibility.** `test/registry.test.ts` round-trips saves for a
   geographic and a legacy district without changing district IDs or save
   format.
6. **Per-area review.** Automated pack/runtime review now covers all four
   packs. Visual, Android/offline/Settings and named cultural review remain
   deferred for Nlongkak, Mvog-Mbi, Mokolo and Bastos.

Remaining Phase 5 work:

- add one more verified district pack when needed, one coherent pack at a time;
- keep automated manifest/runtime/chunk/spawn validation and size budgets green
  for every pack;
- record visual/device/offline/cultural evidence later, when browser and local
  review work is resumed, before claiming any new area device-playable;
- keep unaffected districts on the legacy procedural fallback.

Do not generate all of Yaoundé in one operation. Keep the existing Nlongkak,
Mvog-Mbi, Mokolo and Bastos `worldVersion`s unchanged unless their inputs or
format are rebuilt and revalidated.

## Not build work

These require hardware, people or external accounts and cannot be closed by
code alone:

- actual Android Chrome input/screenshots and real-device performance;
- Settings download/cancel/remove and a real offline reload on device;
- named local Cameroonian cultural review;
- Cloudflare/Sentry/PostHog production deployment and email/SMTP setup;
- real playtest acceptance criteria (50-player crash rate, local first-day
  playtest).

## Already complete

- M0–M7 and their documented gates.
- Real Nlongkak pack: 426 roads, 8,085 buildings, 409 POIs, 2 water polygons,
  35 waterway lines.
- Real Mvog-Mbi pack: 224 roads, 2,659 buildings, 89 POIs, 5 water polygons,
  18 waterway lines; runtime loader, all 9 chunks and default-spawn clearance
  validated.
- Real Mokolo pack: 100 roads, 1,989 buildings, 38 POIs, 1 water polygon, 15
  waterway lines; runtime loader, all 6 chunks and default-spawn clearance
  validated; registered for on-demand download.
- Real Bastos pack: 170 roads, 2,270 buildings, 352 POIs, 11 waterway lines;
  runtime loader, all 9 chunks and default-spawn clearance validated;
  registered for on-demand download.
- Offline packaging, registry-driven service-worker lifecycle, app-shell
  precache, pack download UI and multi-pack cache cleanup with automated tests.
- Phase 5 multi-pack infrastructure: district-keyed registry, manifest/version
  validation, generic adapter, path-aware service-worker caching and save
  compatibility tests. Nlongkak, Mvog-Mbi, Mokolo and Bastos are registered.
- M8 geometry implementation, attribution/licensing, feature flag/rollback and
  size budgets.
- Current verification (2026-11-19): typecheck pass, 241/241 tests, build pass,
  all size budgets pass, `world:validate` pass for all four packs.
- Renderer-only visual review and internal cultural plausibility review.
- Live-app Chromium + Mesa WebGL capture at Nlongkak and the market. No
  equivalent visual/device review exists yet for Mvog-Mbi, Mokolo or Bastos.

## Exact next action

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
5. Update `IMPLEMENTATION_PROGRESS.md` and `IMPLEMENTATION_CHECKLIST.md` after
   each step; keep every change within the existing size and world-pack
   budgets.
