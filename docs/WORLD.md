# Geographic world: Nlongkak vertical slice

This document describes the first real-geography world pack for Yaoundé Life. It is a playable vertical slice, not a claim that the whole city is finished.

## Current status

- Geographic area: Nlongkak, Yaoundé, Cameroon.
- Area id: `nlongkak`.
- World package: `public/world/v1/`; district selector: `public/world/registry.json`.
- Runtime default: the registry selects the versioned pack registered for the current gameplay district. Only Nlongkak is registered today; other districts continue to use the legacy procedural world.
- Rollback: Settings -> `Geographic Nlongkak (preview)`, `?world=legacy`, or localStorage key `yaounde-world-mode=legacy`.
- Force preview: `?world=geo`.
- The world package is generated at build time and is loaded from the app origin. There is no runtime Overpass, geocoding, or map-tile dependency.
- Offline: `public/sw.js` resolves `world/registry.json`, precaches the build-generated `app-shell.json` (HTML, hashed JS/CSS, manifest, fonts and icons), `world/registry.json`, and the initial files for registered packs flagged `precacheOnInstall` (currently `world/v1`). It then serves world assets cache-first from a versioned `yaounde-world-<version>` cache. Settings → Offline world lets the player choose a registered pack and downloads the full 5.4 MB Nlongkak catalog (90 files) with progress, cancel and quota handling. Cleanup preserves every version still listed in the registry. A completed download or removal invalidates the service worker's memoized world version so the next request uses the new cache immediately.
- Water: 2 polygon water features plus 35 real OSM waterway centrelines (rivers, streams, drains; 5.9 km) rendered as terrain-following ribbons.
- Implementation suite: `docs/world-engine/` (architecture, data sources, coordinates, manifest, chunks, roads, terrain, buildings, offline packaging, licensing, budgets, progress, M8 review, remaining work).

## Source data

| Source | Snapshot | Use | Licence / attribution |
| --- | --- | --- | --- |
| OpenStreetMap Cameroon extract, Geofabrik | 2026-10-30 (`cameroon-261030.osm.pbf`) | Roads, buildings, water polygons and waterway lines, POIs, Nlongkak boundary | ODbL 1.0, (c) OpenStreetMap contributors |
| Copernicus DEM GLO-30, tile `N03_00_E011_00` | Copernicus DEM GLO-30 | Terrain elevation | (c) ESA, Copernicus DEM GLO-30 |
| Nominatim / OSM relation 3095854 | 2026-10-30 | Nlongkak boundary for district anchoring | ODbL 1.0, (c) OpenStreetMap contributors |

Google Open Buildings V3 is intentionally not used. Its licence and attribution obligations therefore do not apply to this pack. An opt-in importer contract exists for a future licensed export but is disabled for Nlongkak. This exclusion is recorded in `data/geodata/config/nlongkak.json`.

## Area and coordinates

- Configured bbox: `11.5126,3.8780,11.5305,3.8960`.
- Projection: EPSG:32632 / WGS 84 UTM zone 32N.
- Origin: the minimum projected easting and northing of the bbox corners.
- Game coordinates: `x` increases east, `z` increases south, `y` is relative elevation in metres.
- Scale: 1 game unit = 1 metre.
- Terrain chunk size: 512 m. The slice is a 4 x 4 grid of 16 chunks.
- Fine terrain cell: 8 m. Coarse gameplay terrain cell: 16 m.
- Vertical offset: the generated pack uses a local offset (currently 713.3 m) so terrain heights stay small. Absolute elevation = `verticalOffset + localHeight`.
- Water level: polygon water stores one relative level per feature; waterway lines store one DEM-derived surface level per point.

## Build and verification

Requirements: Node, `osmium-tool`, Python 3 with Pillow, and curl.

```bash
npm run world:acquire   # download, extract, decode DEM, build, validate
npm run world:inspect   # show source presence, bbox, chunk grid, raw feature counts
npm run world:build     # regenerate a pack from processed inputs and upsert its registry entry
npm run world:validate  # verify registry, manifest, hashes, counts and binary payloads
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

The shippable derived package is `public/world/registry.json` plus `public/world/v1/`. The Nlongkak pack includes `manifest.json`, `licenses.json`, `files.json`, `precache.json`, global terrain/roads/POIs/water/waterways/districts, and 16 chunk packs. A second district must add its own directory and registry entry; the registry is not part of the pack's 90-file offline catalog.

## Package format

- `manifest.json`: format/version, projection, origin, bounds, vertical offset, sources, feature counts, chunk index, hashes, validation.
- `terrain/heightfield.bin`: global coarse terrain, `YLT1` header plus little-endian float32 samples.
- `terrain/c_IX_IZ.bin`: fine terrain per chunk, same format.
- `roads/c_IX_IZ.json`: clipped roads for the chunk.
- `buildings/c_IX_IZ.bin`: `YLB1` binary building footprints with quantised vertices at 0.05 m.
- `buildings/c_IX_IZ.json`: building metadata, height/floors/classification/provenance.
- `pois/c_IX_IZ.json`: POIs assigned to the chunk.
- `roads/network.json`: global road network with OSM node IDs for connectivity.
- `pois/pois.json`, `water/water.json`, `water/waterways.json`, `districts/districts.json`: global gameplay data. Waterway records carry their kind, width, per-point surface heights and provenance.
- `licenses.json`: source attribution and obligations.
- `metadata/validation.json`, `metadata/build-report.json`: build evidence.
- `files.json`: versioned offline catalog with every world file and byte size.
- `precache.json`: initial offline file list used by the service worker (53 files: 8 global files + 3 x 3 chunks around spawn).

Every rendered feature carries provenance. Status values mean:

- `real`: derived from a source feature.
- `inferred`: a conservative estimate from real geometry or tags.
- `designed`: authored gameplay content, not a claim about the real feature.
- `procedural`: generated content.

## Runtime behaviour

- `src/world/` is the pure data layer: UTM transforms, chunk math, terrain sampling, road graph utilities, building decoding/collision, registry and manifest validation, and async loading.
- `src/render/geo/` is the Three.js adapter: collision grid, road index, terrain/road/building/prop/water/waterway geometry, runtime adapter, and the streaming `GeoScene`.
- `src/world/registry.ts` validates the district → pack mapping, rejects duplicate districts/unsafe paths, checks manifest-format compatibility, and provides a built-in Nlongkak fallback if `world/registry.json` cannot be fetched. The loader also enforces the registry's `worldVersion` and `area.id` against the fetched manifest.
- The geographic adapter uses the loaded manifest's `area.id` and `WorldDistrictAnchor`. It no longer hard-codes the Nlongkak anchor, place filter or `districtAt` result.
- Chunk radius: low = current chunk, mid = 3 x 3, high = 5 x 5 (capped by the 4 x 4 pack). `ChunkLru` caps loaded chunks at 5/10/16, keeps a stable nearest-first subset when the desired radius exceeds the cap, retains keep-ring buffers in spare slots, and disposes geometry on unload.
- Building LOD: near detail includes windows, doors, awnings, painted shop boards/blade signs, roof details, capped upper-floor balconies, and rooftop props; far detail is a simplified massing mesh. Mid/high use both; low uses the simple mesh.
- Terrain LOD: chunk meshes are always built from the fine heightfield; quality controls props, building detail, shadows, and draw distance.
- Street detail: vehicle roads get a shoulder, concrete drainage gutter, curb and (on trunk/primary/secondary/tertiary roads) a pavement strip with periodic gutter crossings. Vehicles mix yellow taxis, private cars, minibuses, trucks and motos by road class.
- Real `marketplace` and `mall` POIs seed clustered stalls, produce mats and a market board before the rest of the prop budget is spent. Market clusters also place bounded vendor umbrellas and display tables; roadside vendor stands use the same prop budget. Shop signage is generated from building classification and a deterministic palette, not real shop names.
- Selected small houses get a capped compound wall around the footprint, with a gate opening facing the nearest road, concrete piers and a partly open metal leaf. Placement checks building, road and prop clearance.
- Player grounding uses loaded fine chunk heightfields and falls back to the coarse global field.
- Building collision uses footprint push-out with a spatial grid. Trees, lamps, stalls, vendor stands, benches and vehicles add circular obstacles. Compound walls/gates and balconies are visual-only and add no collision volumes.
- Places are gameplay content. In geographic mode, Nlongkak places are deterministically mapped near real roads and are explicitly not presented as real business addresses.
- NPCs whose schedules are outside Nlongkak are hidden in geographic mode. NPCs inside Nlongkak are placed near walkable roads.
- Travel to another district switches to that district's legacy world. Returning to Nlongkak switches back to the geographic slice.
- Debug metrics: `?debug=world` or `localStorage.setItem('yaounde-world-debug', '1')` shows FPS, frame time, chunks, buildings, triangles, draw calls, geometries and textures.

## Known limitations

- Only Nlongkak is geographic. The registry, loader, adapter, offline UI and service worker can handle multiple registered packs, but the other eight districts remain procedural until their own reproducible packs are built and reviewed. No second production pack exists yet.
- Building heights are mostly inferred from footprint area and tags; only tagged heights/levels are real.
- Waterway ribbons use DEM-derived per-point heights; there is no flow, flooding or channel-carving simulation. OSM bridge decks use a straight grade between endpoints and have no hydraulic, underpass or parapet-collision model.
- There is no real-time traffic, routing, live closures, or live geocoding. Parked/waiting vehicles, market stalls, vendor umbrellas, produce and signage are deterministic visual dressing, not vendor registries, real shop names or traffic data.
- Compound walls/gates and balcony slabs are bounded visual accents without collision volumes or enterable floors.
- Drainage gutters, pavements and curbs are inferred from road class for visual detail; they are not mapped infrastructure and do not simulate flow or flooding.
- Nlongkak has a boundary polygon from OSM; other district anchors are points, not official boundaries.
- Fictional businesses and NPC schedules are designed gameplay content mapped into the real slice, not statements about real establishments.
- The slice is not a photoreal or Google-Maps-like replica. It is a low-poly, deterministic interpretation of OSM geometry and Copernicus terrain.
- Device performance on low-end Android still needs a real-device pass.

## Attribution

When showing geographic Nlongkak in the product, display or link the attribution:

- `Map data (c) OpenStreetMap contributors, ODbL 1.0`
- `Elevation (c) ESA, Copernicus DEM GLO-30`

The machine-readable copy is in `public/world/v1/licenses.json`.
