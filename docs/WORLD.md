# Geographic world: Nlongkak vertical slice

This document describes the first real-geography world pack for Yaoundé Life. It is a playable vertical slice, not a claim that the whole city is finished.

## Current status

- Geographic area: Nlongkak, Yaoundé, Cameroon.
- Area id: `nlongkak`.
- World package: `public/world/v1/`.
- Runtime default: geographic Nlongkak when the player is in Nlongkak; other districts continue to use the legacy procedural world.
- Rollback: Settings -> `Geographic Nlongkak (preview)`, `?world=legacy`, or localStorage key `yaounde-world-mode=legacy`.
- Force preview: `?world=geo`.
- The world package is generated at build time and is loaded from the app origin. There is no runtime Overpass, geocoding, or map-tile dependency.
- Offline: `public/sw.js` precaches `world/v1/precache.json` and serves world assets cache-first.

## Source data

| Source | Snapshot | Use | Licence / attribution |
| --- | --- | --- | --- |
| OpenStreetMap Cameroon extract, Geofabrik | 2026-10-30 (`cameroon-261030.osm.pbf`) | Roads, buildings, water, POIs, Nlongkak boundary | ODbL 1.0, (c) OpenStreetMap contributors |
| Copernicus DEM GLO-30, tile `N03_00_E011_00` | Copernicus DEM GLO-30 | Terrain elevation | (c) ESA, Copernicus DEM GLO-30 |
| Nominatim / OSM relation 3095854 | 2026-10-30 | Nlongkak boundary for district anchoring | ODbL 1.0, (c) OpenStreetMap contributors |

Google Open Buildings V3 is intentionally not used. Its licence and attribution obligations therefore do not apply to this pack. This exclusion is recorded in `data/geodata/config/nlongkak.json`.

## Area and coordinates

- Configured bbox: `11.5126,3.8780,11.5305,3.8960`.
- Projection: EPSG:32632 / WGS 84 UTM zone 32N.
- Origin: the minimum projected easting and northing of the bbox corners.
- Game coordinates: `x` increases east, `z` increases south, `y` is relative elevation in metres.
- Scale: 1 game unit = 1 metre.
- Terrain chunk size: 512 m. The slice is a 4 x 4 grid of 16 chunks.
- Fine terrain cell: 8 m. Coarse gameplay terrain cell: 16 m.
- Vertical offset: the generated pack uses a local offset (currently 713.3 m) so terrain heights stay small. Absolute elevation = `verticalOffset + localHeight`.
- Water level: stored relative to the same offset.

## Build and verification

Requirements: Node, `osmium-tool`, Python 3 with Pillow, and curl.

```bash
npm run world:acquire   # download, extract, decode DEM, build, validate
npm run world:inspect   # show source presence, bbox, chunk grid, raw feature counts
npm run world:build     # regenerate public/world/v1 from processed inputs
npm run world:validate  # verify manifest, hashes, counts, binary payloads
```

The full app checks are:

```bash
npm run typecheck
npm test
npm run build
npm run size
```

Raw and intermediate geodata are intentionally gitignored:

- `data/geodata/raw/`
- `data/geodata/processed/`

The shippable derived package is `public/world/v1/`, including `manifest.json`, `licenses.json`, `precache.json`, global terrain/roads/POIs/water/districts, and 16 chunk packs.

## Package format

- `manifest.json`: format/version, projection, origin, bounds, vertical offset, sources, feature counts, chunk index, hashes, validation.
- `terrain/heightfield.bin`: global coarse terrain, `YLT1` header plus little-endian float32 samples.
- `terrain/c_IX_IZ.bin`: fine terrain per chunk, same format.
- `roads/c_IX_IZ.json`: clipped roads for the chunk.
- `buildings/c_IX_IZ.bin`: `YLB1` binary building footprints with quantised vertices at 0.05 m.
- `buildings/c_IX_IZ.json`: building metadata, height/floors/classification/provenance.
- `pois/c_IX_IZ.json`: POIs assigned to the chunk.
- `roads/network.json`: global road network with OSM node IDs for connectivity.
- `pois/pois.json`, `water/water.json`, `districts/districts.json`: global gameplay data.
- `licenses.json`: source attribution and obligations.
- `metadata/validation.json`, `metadata/build-report.json`: build evidence.
- `precache.json`: offline cache manifest used by the service worker.

Every rendered feature carries provenance. Status values mean:

- `real`: derived from a source feature.
- `inferred`: a conservative estimate from real geometry or tags.
- `designed`: authored gameplay content, not a claim about the real feature.
- `procedural`: generated content.

## Runtime behaviour

- `src/world/` is the pure data layer: UTM transforms, chunk math, terrain sampling, road graph utilities, building decoding/collision, manifest validation, and async loading.
- `src/render/geo/` is the Three.js adapter: collision grid, road index, terrain/road/building/prop/water geometry, runtime adapter, and the streaming `GeoScene`.
- Chunk radius: low = current chunk, mid = 3 x 3, high = 5 x 5 (capped by the 4 x 4 pack). Distant chunks are removed.
- Building LOD: near detail includes windows, doors, awnings, roof details, and rooftop props; far detail is a simplified massing mesh. Mid/high use both; low uses the simple mesh.
- Terrain LOD: chunk meshes are always built from the fine heightfield; quality controls props, building detail, shadows, and draw distance.
- Player grounding uses loaded fine chunk heightfields and falls back to the coarse global field.
- Building collision uses footprint push-out with a spatial grid. Trees, lamps, stalls, benches, and taxis add circular obstacles.
- Places are gameplay content. In geographic mode, Nlongkak places are deterministically mapped near real roads and are explicitly not presented as real business addresses.
- NPCs whose schedules are outside Nlongkak are hidden in geographic mode. NPCs inside Nlongkak are placed near walkable roads.
- Travel to another district switches to that district's legacy world. Returning to Nlongkak switches back to the geographic slice.

## Known limitations

- Only Nlongkak is geographic. The other eight districts remain procedural until their own packs are built.
- Building heights are mostly inferred from footprint area and tags; only tagged heights/levels are real.
- Water currently includes polygon water features. Streams tagged as lines are not rendered yet.
- There is no real-time traffic, routing, live closures, or live geocoding.
- Nlongkak has a boundary polygon from OSM; other district anchors are points, not official boundaries.
- Fictional businesses and NPC schedules are designed gameplay content mapped into the real slice, not statements about real establishments.
- The slice is not a photoreal or Google-Maps-like replica. It is a low-poly, deterministic interpretation of OSM geometry and Copernicus terrain.
- Device performance on low-end Android still needs a real-device pass.

## Attribution

When showing geographic Nlongkak in the product, display or link the attribution:

- `Map data (c) OpenStreetMap contributors, ODbL 1.0`
- `Elevation (c) ESA, Copernicus DEM GLO-30`

The machine-readable copy is in `public/world/v1/licenses.json`.
