# Remaining World-Engine Work

Last updated: 2026-11-16

Status: **M0–M7 complete; M8 partial. The master brief defines no M9.** The
remaining items are M8 acceptance gates, two build items that were explicitly
outside the current slice, and Phase 5 expansion. Nothing in this document is a
claim that an unperformed check has passed.

## Parked M8 acceptance work — return here later

These are the live-review/device/culture items deliberately parked while the
remaining master-brief build audit proceeds.

1. Capture single-view WebGL frames for the compound gate, balcony, market and
   bridge. The multi-view harness only rendered the market quadrant correctly;
   it needs a single-view mode. The live app has already rendered at Nlongkak
   and the market under Chromium + Mesa llvmpipe Vulkan, but that is software
   rendering, not Android Chrome or real-device evidence.
2. Investigate two findings from the live pass:
   - the spawn view is a large grass area with no road visible;
   - the compound wall/gate is nearly black in morning light and the gate is
     hard to read.
   Determine whether these are framing/spawn issues or real material/LOD
   defects before changing production code.
3. Fix anything confirmed, rerun `typecheck`, tests, build, size and
   `world:validate`, then update `M8_VISUAL_CULTURAL_REVIEW.md` and commit.
4. Finish the external gates:
   - Actual Android Chrome on the SM-A716U: screenshots, input, real-device
     low/mid/high FPS, Settings download/cancel/remove, offline reload.
   - Named local Cameroonian cultural review of gates, balconies, market
     dressing, vendor tables, signage, vehicles and bridge parapets.

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
| Parking areas / roadside transport | Built 2026-11-16 | 17 bays and 34 parked vehicles across 16 chunks at high quality; static visual review outstanding |

M8 is still **partial** because the live/device/offline/cultural acceptance
gates are not complete. See `M8_VISUAL_CULTURAL_REVIEW.md`.

### Open Buildings ingestion

Google Open Buildings V3 is still **not ingested**. No licensed local export is
present, and the brief forbids fabricating production footprints to hide that
gap. The current pipeline documents the exclusion but does not yet implement a
real optional importer interface. If an export is supplied later, the build
must validate it, filter confidence, preserve provenance, deduplicate against
OSM and never silently replace OSM geometry.

This is a bounded build task that can proceed without the dataset by adding an
importer contract and synthetic fixtures. It cannot produce production
footprints until the export exists.

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

1. Return to the four parked M8 acceptance items above; do not mark M8 complete
   until they have actual evidence.
2. If continuing build work first, implement the optional Open Buildings
   importer contract with synthetic tests, then start a single-district Phase 5
   pack and its pack registry.
3. Update `IMPLEMENTATION_PROGRESS.md` and `IMPLEMENTATION_CHECKLIST.md` after
   each step; keep every change within the existing size and world-pack
   budgets.
