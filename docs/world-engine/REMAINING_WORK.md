# Remaining World-Engine Work

Last updated: 2026-11-16

Status: **M0–M7 complete; M8 partial. The master brief defines no M9.** The
remaining items are M8 acceptance gates, the blocked Open Buildings production
import, and Phase 5 expansion. Nothing in this document is a claim that an
unperformed check has passed.

## M8 acceptance work — status

These were the live-review/device/culture items parked while the remaining
master-brief build audit proceeded.

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
4. **Open — external gates.** Actual Android Chrome on the SM-A716U:
   screenshots, input, real-device low/mid/high FPS, Settings
   download/cancel/remove and offline reload. Named local Cameroonian cultural
   review of gates, balconies, market dressing, vendor tables, signage,
   vehicles and bridge parapets.

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
| Feature flags and rollback | Built | Geographic Nlongkak flag, legacy fallback and Settings control |
| Parking areas / roadside transport | Built 2026-11-16 | 18 bays and 36 parked vehicles after the road correction; single-view WebGL parking frame reviewed; device appearance untested |

M8 is still **partial** because the live/device/offline/cultural acceptance
gates are not complete. See `M8_VISUAL_CULTURAL_REVIEW.md`.

The renderer now clips the global road network per chunk instead of trusting
the pack's midpoint ownership. This fixed the missing/buried spawn road and
also gave props and compound gates the same local road set the player can see.
It is a renderer-only correction: the pack, road IDs, gameplay collision and
saves are unchanged.

### Open Buildings ingestion

Google Open Buildings V3 is still **not ingested**. No licensed local export is
present, and the brief forbids fabricating production footprints to hide that
gap. The current pack contains no Open Buildings geometry and remains built from
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

Only Nlongkak is geographic. Mvog-Mbi, Mokolo, Ngoa-Ekelle, Bastos, Mvan, Mont
Febe, Lac Municipal, Boulevard du 20 Mai and the remaining gameplay areas still
render the legacy procedural world.

The current renderer hard-codes one pack path (`world/v1`) and one anchor
district. Expansion needs, in order:

1. A per-area build configuration and reproducible OSM/DEM extraction.
2. A pack registry/selector keyed by gameplay district with explicit version
   compatibility and fallback.
3. Loader/cache support for more than one world version and offline catalog.
4. District adapter, safe spawn, crowd/NPC mapping and travel alignment for the
   new pack.
5. Save-compatibility tests. Existing district IDs and save data must not
   change.
6. A separate visual/performance/cultural review for each new area.

Do not generate all of Yaoundé in one operation. Add one coherent pack at a
time, validate it, and keep the legacy fallback until acceptance passes.

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
- Offline packaging, service-worker lifecycle, app-shell precache and download
  UI with automated tests.
- M8 geometry implementation, attribution/licensing, feature flag/rollback and
  size budgets.
- Renderer-only visual review and internal cultural plausibility review.
- Live-app Chromium + Mesa WebGL capture at Nlongkak and the market.

## Exact next action

1. Return to the open external M8 acceptance gates above: Android Chrome,
   real-device FPS and offline/Settings checks, and the named local cultural
   review; do not mark M8 complete until they have actual evidence.
2. If continuing build work first, use the implemented Open Buildings importer
   only when a licensed export and licence review exist; otherwise start a
   single-district Phase 5 pack and its pack registry.
3. Update `IMPLEMENTATION_PROGRESS.md` and `IMPLEMENTATION_CHECKLIST.md` after
   each step; keep every change within the existing size and world-pack
   budgets.
