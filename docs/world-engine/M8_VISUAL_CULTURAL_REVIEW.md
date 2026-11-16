# M8 Renderer-Only Visual and Internal Cultural Review

Status: **renderer-geometry visual review and internal cultural review complete;
live-app WebGL review partial; named local Cameroonian review outstanding. M8 is
not complete.**

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
- chunks `c_1_0`, `c_1_1`, `c_1_2` and `c_1_3`, covering the compound, balcony,
  vendor, market, street and bridge views.

A temporary Node software rasterizer outside the repository (under the review
environment's `yaounde-probe/m8-review/` directory) rendered seven 1100×760 PNG
frames with a directional/hemisphere lighting approximation and a z-buffer. The
review harness and images are intentionally not committed.

This is **not** a live Three.js/WebGL capture, a browser screenshot, an Android
Chrome capture or a device review. It shows production geometry and colours,
but not the game's shaders, shadows, post-processing, UI, characters, crowds,
LOD transitions, frame rate or input.

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
measurements. The live walk showed the player visible, the camera following and
no obvious clipping while moving, but the spawn composition remains a large
grass area with no road visible, and the compound wall/gate was very dark at
morning light. Those two findings are still being investigated. The WebGL
multi-view harness rendered only the market quadrant; the compound, context and
balcony quadrants were blank, so that image is not used as compound/balcony
proof.

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

## Findings and actions

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

The compound frame shows a continuous capped wall, gate piers, a partly open
striped metal leaf and a clear opening toward the road. The wall reads as a
boundary wall rather than a fence floating in the street.

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

### Parking bays and parked vehicles — added after the reviewed frames

The M8 transport brief also lists parking areas and roadside transport activity.
The reviewed frames did not contain a dedicated parking area, so a bounded
parking pass was added after this review:

- commercial/civic POIs get up to two bays per chunk at high quality, one at
  mid and none at low;
- each bay is aligned to the nearest vehicle road, kept clear of buildings,
  existing props and the carriageway, and gets painted bay lines;
- each bay can add two parked cars through the existing vehicle builder, so
  they receive the same collision circles as traffic;
- the pass has its own cap and does not consume the street-prop budget, so the
  75 vendor umbrellas/display tables remain intact.

A production-loader pass over all 16 chunks measured 17 parking bays and 34
parked vehicles at high quality. Prop geometry is now 100,869 triangles (up
from 96,789, +4,080, 4.2%); building geometry remains 640,576 triangles. The
parking bay slab itself has no collision volume, and the parked cars are static
visual props. **No parking frame has been reviewed yet**, so this section is an
implementation record, not an acceptance.

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

The bridge approach shows raised deck geometry, concrete parapets with pale
caps and edge/centre markings. The span is a short OSM bridge way, so it reads
as a culvert-like crossing rather than a landmark bridge. The static review
does not include waterway or water geometry, hydraulic context or collision
testing.

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

The review-driven balcony change and the later parking pass were checked with
the repository gates:

- `npm run typecheck`: pass;
- `npm test`: 216 pass, 0 fail;
- `npm run build`: pass, 16 app-shell entries;
- `npm run size`: all budgets pass (JS 575,941 B gzip, first load 586,381 B,
  world raw 5,402,073 B, world gzip 853,458 B);
- `npm run world:validate`: pass, world `nlongkak-2026-10-30-v2`;
- production-loader geometry count: 128 compounds/gates, 75 vendor
  stands/tables, 17 parking bays, 34 parked vehicles, 640,576 building
  triangles and 100,869 prop triangles at high quality across 16 chunks.

## Remaining acceptance gates

M8 must stay partial until all of these are done:

- [~] live-app WebGL visual review at desktop size — spawn, walking and market
      frames captured under Chromium + Mesa; single-view compound/balcony/
      bridge and the spawn/gate findings remain;
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
| Live-app/browser visual review | Partial: Chromium + Mesa, software renderer | Internal agent |
| Android device visual/input review | Not performed | — |
| Local Cameroonian cultural review | Not performed | — |
