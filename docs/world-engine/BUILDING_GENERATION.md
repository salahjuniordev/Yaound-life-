# Building Generation

Buildings are low-poly, deterministic interpretations of real OSM footprints.
Footprints are real; most heights and all architectural details are inferred or
designed.

## Pipeline

1. Read OSM building ways/relations.
2. Convert rings from lon/lat to game metres.
3. Drop a repeated closing vertex.
4. Simplify with the configured tolerance (0.35 m).
5. Reject rings with fewer than 3 points or area below the configured minimum
   (12 m²).
6. Reject centroids more than 40 m outside the bbox.
7. Deduplicate by `round(centroidX):round(centroidZ):round(area)`.
8. Infer classification, floors and height.
9. Assign the building to the chunk containing its centroid.
10. Encode geometry as `YLB1` and metadata as JSON.

The current pack contains 8,085 buildings.

## Classification

`classifyBuilding` maps tags in priority order:

- church/mosque (`building=church|mosque`, `amenity=place_of_worship` + religion)
- school/college/university
- hospital/clinic
- market/marketplace
- shop; restaurant/cafe/bar
- office
- warehouse/industrial/factory
- public/government/townhall/courthouse
- apartment (or residential with ≥ 4 levels)
- small house (`house`, `detached`, `yes`)
- tourism → public
- otherwise `unknown`

Classes drive facade details, roof props, colours and interaction labels. They are
not claims about current use.

## Height and floors

Priority:

1. `building:levels` (1–40) → real floors.
2. `height` (2–200 m) → real floors at 3.2 m per floor.
3. Otherwise inferred from footprint area and a stable seeded jitter:
   - > 900 m²: 3–4 floors
   - > 450 m²: 2–3
   - > 180 m²: 1–2
   - small: 1, occasionally 2
4. Height = `clamp(floors * 3.1 + 0.4, 3, 40)` metres, unless an explicit height
   is present (clamped to 200 m).

`heightStatus` is `real` only when levels or height tags exist; otherwise
`inferred`. This is shown in provenance.

## Geometry and collision

- Footprint vertices are quantised to 5 cm in `YLB1`.
- `buildingFootprintAabb`, point-in-polygon and closest-edge push-out provide
  collision.
- A spatial grid accelerates collision queries.
- Buildings also act as obstacles for the crowd/player.
- The near mesh adds windows, doors, awnings, painted shop boards/blade signs,
  roof details and rooftop props seeded by building id; shop dressing is placed
  on the longest edge so boards do not wrap every wall. The far mesh is simple
  massing.
- Low quality uses the far mesh only (no signage).

## Colours and determinism

Wall and roof colours come from fixed palettes selected by FNV-1a hashes of the
building id. Rebuilding the same data produces the same colours, props and
heights. No runtime randomness is used for persistent appearance.

## Provenance

Each building records:

- `source`: `openstreetmap`
- `sourceId`, `sourceVersion`, `license`
- `geometryStatus: real`
- `heightStatus: real | inferred`
- `architectureStatus: procedural`
- `gameplayStatus: designed`
- confidence (currently 1 for OSM geometry)

Fictional businesses and place names are not building metadata; they are
gameplay content mapped separately.
