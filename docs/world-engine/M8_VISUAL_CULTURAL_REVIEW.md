# M8 Renderer-Only Visual and Internal Cultural Review

Status: **renderer-geometry and single-view WebGL review complete; live-app
review partial; named local Cameroonian review outstanding. M8 is not
complete.**

This document records what was actually reviewed, how it was produced, what
changed as a result, and what remains unverified. It is not an approval. The
parked acceptance checklist and the remaining master-brief work are consolidated
in `REMAINING_WORK.md`.

## Scope and method

The review used the production world loader and the production geometry
builders:

- `loadManifest`, `loadChunk` and `heightAt` for the real 16-chunk Nlongkak pack;
- `buildTerrainGeometry`, `buildRoadGeometry`, `buildBuildingGeometry` and
  `buildPropsGeometry` at the `high` quality tier;
- chunk neighbourhoods `c_1_0`/`c_1_1`/`c_1_2`/`c_0_1`/`c_2_1` for the spawn,
  compound, balcony and parking views; `c_1_1`/`c_1_2`/`c_0_2`/`c_2_2` for the
  market; and `c_1_3`/`c_2_3`/`c_2_2` for the bridge.

The first pass used a temporary Node software rasterizer outside the
repository (under the review environment's `yaounde-probe/m8-review/`
directory) to render seven 1100×760 PNG frames. The current single-view evidence
comes from a real Three.js/WebGL harness committed at
`review/m8-single-view.html` and `review/m8-single-view.ts`, which imports the
same production loader and geometry builders. It renders 1400×1000 frames under
Chromium + Mesa llvmpipe Vulkan with a neutral directional/hemisphere light and
no game UI, characters or crowds. The multi-view market harness is superseded by
this single-view harness for the compound, balcony, market, bridge and parking
evidence.

The seven software-rasterized frames are not live WebGL captures or browser
screenshots. The later single-view harness **is** a real browser WebGL capture,
but it still is not the live game: it shows production geometry and colours,
not the game's shaders, shadows, post-processing, UI, characters, crowds, LOD
transitions, frame rate or input. The separate live-app capture below is the
only frame with game UI and runtime systems.

Headless Chromium was tried first. The R3F app and even a minimal Three.js scene
lose the WebGL context under SwiftShader (`GPU stall due to ReadPixels`,
`WebGL: CONTEXT_LOST_WEBGL`, `THREE.WebGLRenderer: Context Lost`), producing
blank screenshots. Raw-WebGL-only test pages still render, isolating the
failure to Three.js/SwiftShader rather than page setup. The software rasterizer
was adopted only to inspect the static production geometry.

### Later live WebGL evidence — partial, software-rendered

A later pass found a working headless Chromium path using Mesa llvmpipe Vulkan
(`--use-angle=vulkan --use-vulkan=native --enable-features=Vulkan` with the
lavapipe ICD), instead of SwiftShader. This produced real Three.js/WebGL frames
of the live app, separate from the seven software-rasterized review frames:

- Nlongkak spawn at high quality: 16 chunks, 8,085 active buildings, 870,756
  triangles, 93 draw calls, about 4.9 FPS under software Mesa.
- After walking away from the spawn: 16 chunks, 655,441 triangles, 93 draw
  calls, about 4.9–5.5 FPS.
- A live compound approach and a WebGL market-frontage harness frame; the
  market frame showed 8 compound walls/gates and 7 vendor umbrellas/tables in
  `c_1_1`.

These are **not** Android Chrome, hardware-GPU or real-device performance
measurements. The live walk showed the player visible and the camera following
while moving. The two pass findings were investigated and are resolved:

- the spawn grass area was a real cross-chunk road-ownership defect, not camera
  framing; the renderer now clips the global road network per chunk and samples
  the local heightfield;
- the near-black compound approach was camera framing inside a neighbouring
  roof, not a gate material or LOD defect; a controlled production-geometry
  frame shows the dark-green leaf and pale rails against the wall.

After rebuilding, the live app at the same spawn renders asphalt, centre
markings and pavements: 16 chunks, 8,085 active buildings, 736,857 rendered
triangles and 92 draw calls at about 4 FPS under software Mesa. A second live
frame at the actual placed compound gate (camera on the road, player at the
gate) renders the wall, dark-green leaf and pale rails clearly: 944,258
triangles and 94 draw calls at the same software frame rate. This remains
software-rendered evidence, not device evidence.

## Frames reviewed

| Frame | Scene | Triangles |
| --- | --- | ---: |
| `m8-review-compound-gate.png` | Elevated view of the c_1_2 compound near `(728.0, -1276.2)` and its road-facing gate | 144,043 |
| `m8-review-roadside-vendor.png` | Street-level vendor stand near the Nlongkak roundabout, c_1_1 | 155,065 |
| `m8-review-balcony-street.png` | Road-facing balcony `osm-a387924672` at `(554.2, -962.9)`, c_1_1 | 39,025 |
| `m8-review-market-close.png` | Nkol Eton market cluster, c_1_2 | 116,168 |
| `m8-review-market-wide.png` | Nkol Eton market cluster with surrounding street and utilities | 116,178 |
| `m8-review-bridge.png` | Approach to the OSM bridge on Rue 1.810, c_1_3 | 15,036 |
| `m8-review-nlongkak-street.png` | Nlongkak roundabout, road, vehicles, utilities and vendor | 61,009 |

### Single-view WebGL frames

These are real browser WebGL renders of production geometry at the `high`
quality tier. Counts for the single-view rows are the renderer counts for the
four or five loaded review chunks, not full-pack totals; the two live rows load
the full 16-chunk high tier.

| Frame | Scene | Triangles | Draw calls |
| --- | --- | ---: | ---: |
| `m8-single-final-spawn-road.png` | Ground-level view along the spawn road after the cross-chunk fix | 140,542 | 8 |
| `m8-single-spawn-top-fixed3.png` | Top view of the spawn road; the road now covers the spawn point | 202,557 | 12 |
| `m8-single-compound-gate-fixed.png` | Ground-level compound gate on `osm-a387926624` at `(775.73, -944.54)` | 203,584 | 12 |
| `m8-single-final-compound-top.png` | Top view of the same compound, wall and gate opening | 193,071 | 10 |
| `m8-single-final-market.png` | Nkol Eton market cluster, stalls, vendor parasols, road and bus | 216,765 | 12 |
| `m8-single-final-balcony.png` | Road-facing upper-floor balcony | 203,584 | 12 |
| `m8-single-final-bridge-top.png` | Top view of the OSM bridge deck, parapets and abutments | 211,972 | 12 |
| `m8-single-final-parking.png` | Parking bay with painted lines and two parked cars | 202,557 | 12 |
| `live-spawn-road-fix.png` | Live app at the Nlongkak spawn after the fix (Chromium + Mesa) | 736,857 | 92 |
| `live-compound-gate-fixed.png` | Live app at the actual placed gate `osm-a387926624`, viewed from the road (Chromium + Mesa) | 944,258 | 94 |

The frame counts vary with the loaded chunk set and help confirm that the
single-view harness is exercising the same road, building and prop meshes as
the production scene. The two live frames are the only ones with game UI,
crowd, vehicles, shadows and the runtime lighting pass. The live gate frame was
made by placing the review player at the known gate in the mirrored dev tree
with a temporary hook; no teleport or review hook is committed to production.

## Findings and actions

### Cross-chunk road burial — fixed

The live spawn showed a large grass area with no road. Production geometry
confirmed the cause was not camera framing:

- the world builder stores each whole OSM road piece in the chunk containing
  its midpoint;
- the renderer used only that chunk's road list and sampled the owning chunk's
  heightfield for every vertex;
- the spawn road `Rue Marcus Etoundi` (`osm-w35897073`) is stored in `c_1_2`
  but runs north into `c_1_1`; at the nearest centreline point to spawn the
  road surface was about 2.1 m below the `c_1_1` terrain after a 157 m quad
  crossed the hill.

The renderer now clips the global `roads/network.json` to each chunk with a
Liang-Barsky segment clip, builds each visible road piece against that chunk's
terrain, and uses the same local road set for props and compound-gate
placement. Long segments are subdivided longitudinally at 10/16/24 m for
high/mid/low, and the carriageway and shoulder are split laterally at about
4 m, so the surface follows the local terrain instead of one flat quad. Bridges
stay whole and belong to the chunk containing their midpoint.

The world pack was not regenerated and no road, building, POI, gameplay ID or
save format changed. The production-loader geometry count is now 157,182 road
triangles across all 16 chunks at high quality (the old road count was much
lower because many cross-chunk pieces were not rendered). The live spawn frame
shows the asphalt, centre line and pavements, and the single-view ground frame
confirms the same result without UI.

### Spawn area — accepted after the road fix

The spawn point is 2.8 m from the centreline of a 19.8 m tertiary road. It is
on the carriageway rather than a separate pavement, but the road, markings and
curbs are now visible and the live player/character is grounded correctly. A
future safe-spawn refinement can move the initial point to a pavement or
compound entrance; that would be a gameplay change and is not part of this
renderer fix.

### Balcony readability — fixed

The first balcony frame showed a solid 0.78 m dark-green front panel. At street
distance it read as an air-conditioning enclosure, planter or utility box, not
a balcony. The facade behind it was also blank.

The balcony builder now emits:

- a concrete slab and two support brackets, unchanged;
- an open front rail with top and bottom rails, seven vertical balusters, two
  side rails and two corner posts;
- a light concrete-framed dark opening behind the slab so the balcony visually
  connects to a room.

The fix adds about 132 triangles per balcony, 21,120 across all 16 chunks at
high quality: building geometry is now 640,576 triangles, up from 619,456
(3.4%). Balconies remain visual-only and are not enterable.

The reviewed road-facing balcony is legible after the fix. Side rails still
read as a compact metal cage at very close range, which is plausible for a
small upper-floor balcony but is a detail for the local review.

### Compound walls and gates — accepted with limitations

The controlled single-view frame and the live app frame at the actual placed
gate both show a continuous capped wall, gate piers, a dark-green metal leaf
with pale horizontal rails and a clear opening. The wall reads as a boundary
wall rather than a fence floating in the street. The earlier live compound
approach frame was nearly black because the camera was under/inside a
neighbouring roof; it did not show the gate material. There is no evidence of a
gate material or LOD defect, so no production material change was made.

Limitations:

- the wall follows the building footprint at a 1.05 m offset, so the gated area
  can read as a narrow sleeve around the house rather than a usable yard;
- the gate faces the nearest road, not necessarily the building's entrance, so
  it can open toward a blank facade;
- there are no parcel boundaries, paths, doors or collision volumes;
- some walls/gates are hidden by neighbouring buildings or terrain in normal
  play.

No review-driven change was made for these limitations because parcel and door
data are not available in the pack.

### Vendor stands and market — accepted with limitations

The roadside frame at Nlongkak shows a red parasol with a centre pole, a display
table and produce boxes. This is the intended vendor-umbrella form and reads at
street level. The Nkol Eton frames show multiple canopies, display tables,
painted boards/signage, utility poles and wires.

Limitations:

- market canopies supported by four legs read as tarp gazebos/stalls, while the
  centre-pole parasols are the vendor umbrellas; the mix is intentional but the
  distinction is not obvious in every frame;
- the market ground is the terrain material (grass) rather than a verified
  paved or packed-earth market surface;
- the static geometry contains no people, goods variety, trading activity or
  clutter;
- no local reviewer has judged stall form, colours, goods or signage.

No market surface or layout change was made without verified source data.

### Parking bays and parked vehicles — visually reviewed

The M8 transport brief also lists parking areas and roadside transport activity.
The original review frames did not contain a dedicated parking area, so a
bounded parking pass was added and then re-reviewed in the new single-view
frame:

- commercial/civic POIs get up to two bays per chunk at high quality, one at
  mid and none at low;
- each bay is aligned to the nearest vehicle road, kept clear of buildings,
  existing props and the carriageway, and gets painted bay lines;
- each bay can add two parked cars through the existing vehicle builder, so
  they receive the same collision circles as traffic;
- the pass has its own cap and does not consume the street-prop budget, so the
  market/roadside vendor detail is preserved (86 umbrellas and 86 display
  tables in the current local-road pass).

After the cross-chunk road correction, a production-loader pass over all 16
chunks measured 18 parking bays and 36 parked vehicles, 86 vendor
umbrellas/display tables, 102,550 prop triangles and 157,182 road triangles at
high quality; building geometry remains 640,576 triangles. The parking frame
shows a marked bay with a yellow taxi and a red private car; the bay reads as a
parking area rather than a widened shoulder. The parking bay slab itself has no
collision volume, and the parked cars are static visual props. This closes the
static parking visual review; on-device appearance and input remain untested.

### Street, vehicles and utilities — accepted with limitations

The Nlongkak street frame shows a yellow taxi, a moto with rider, a roadside
vendor, utility poles and cable spans, road markings and a grassy roundabout
island. These elements are coherent and read as everyday street infrastructure
rather than themed decoration.

Limitations:

- vehicles are low-poly and a distant taxi can read as a flat yellow bar;
- the software frame cannot assess vehicle motion, traffic spacing or collision
  behaviour;
- drainage channels are present in the road mesh but were not isolated in a
  dedicated close-up frame;
- no real-device frame-rate, draw-call or LOD-switching evidence exists.

### Bridges — accepted with limitations

The single-view top frame shows raised deck geometry, concrete parapets with
pale caps, abutments and edge/centre markings. The span is a short OSM bridge
way, so it reads as a culvert-like crossing rather than a landmark bridge. The
static review does not include waterway or water geometry, hydraulic context or
collision testing.

## Internal cultural review

This is an internal plausibility review against the master brief and the
existing cultural packet, not a Cameroonian cultural approval.

What appears culturally grounded:

- boundary walls with concrete caps, masonry piers and metal gates are common
  in dense Yaoundé neighbourhoods;
- small upper-floor balconies with concrete slabs and painted metal rails fit
  the mixed housing stock;
- roadside produce tables under parasols, painted shop boards and mixed
  taxis/motos/private cars fit the Nlongkak street economy;
- utility poles, overhead cables, roadside shrubs and short drainage/curb
  details fit the infrastructure layer;
- the palette is muted and material-led; the geometry does not use folklore
  costume, exotic signage or caricatured architecture.

What still needs a named local reviewer:

- whether the compound wall/gate proportions and colours feel right in
  Nlongkak specifically;
- whether the balcony rail forms, door surrounds and balcony placement match
  local housing;
- whether the vendor tables, parasols, goods boxes and market ground read as a
  real Nkol Eton market rather than a generic market;
- whether the shop boards, street-name signs and vehicle mix are specific and
  respectful;
- whether the scene avoids over-representing one ethnic, linguistic or
  religious visual identity.

The local review remains **outstanding**. No local reviewer has seen these
frames, and this document must not be presented as local approval.

## Verification

The review-driven balcony, parking and cross-chunk road correction were checked
with the repository gates:

- `npm run typecheck`: pass;
- `npm test`: 217 pass, 0 fail;
- `npm run build`: pass, 16 app-shell entries;
- `npm run size`: all budgets pass (JS 576,491 B gzip, first load 586,930 B,
  world raw 5,402,073 B, world gzip 853,458 B);
- `npm run world:validate`: pass, world `nlongkak-2026-10-30-v2`;
- production-loader geometry count after the road correction: 128
  compounds/gates, 86 vendor umbrellas/display tables, 18 parking bays, 36
  parked vehicles, 640,576 building triangles, 102,550 prop triangles and
  157,182 road triangles at high quality across 16 chunks.

## Remaining acceptance gates

M8 must stay partial until all of these are done:

- [~] live-app WebGL visual review at desktop size — spawn, walking, market and
      actual-gate frames captured under Chromium + Mesa; single-view compound,
      balcony, market, bridge and parking frames now exist, and the spawn road
      and dark gate findings are resolved; Android Chrome/device evidence is
      still absent;
- [ ] actual Android Chrome/device visual and input review;
- [ ] real-device FPS, draw-call/triangle and offline reload checks;
- [ ] Settings download/cancel/remove and real offline reload on device;
- [ ] named local Cameroonian cultural review with recorded corrections or
      explicit approval.

## Sign-off

| Review | Status | Reviewer |
| --- | --- | --- |
| Renderer-geometry visual review | Complete, with documented limits | Internal agent |
| Internal cultural plausibility review | Complete, with documented limits | Internal agent |
| Live-app/browser visual review | Partial: Chromium + Mesa; single-view WebGL frames complete, device absent | Internal agent |
| Android device visual/input review | Not performed | — |
| Local Cameroonian cultural review | Not performed | — |
