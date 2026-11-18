# Geographic world: Nlongkak and Mvog-Mbi

This document describes the real-geography world packs for Yaoundé Life. Two
districts have geographic packs; the rest of the city is still procedural. Mvog-Mbi
is validated but not yet device/visual accepted. This is not a claim that the
whole city is finished.

## Current status

- Geographic areas: Nlongkak and Mvog-Mbi, Yaoundé, Cameroon.
- Area ids: `nlongkak` and `mvog_mbi`.
- World packages: `public/world/v1/` (Nlongkak) and `public/world/mvog-mbi/v1/` (Mvog-Mbi); district selector: `public/world/registry.json`.
- Runtime default: the registry selects the versioned pack registered for the current gameplay district. Mvog-Mbi and Nlongkak have packs; the other seven districts continue to use the legacy procedural world.
- Rollback: Settings -> geographic-world toggle, `?world=legacy`, or localStorage key `yaounde-world-mode=legacy`.
- Force preview: `?world=geo`.
- The world packages are generated at build time and are loaded from the app origin. There is no runtime Overpass, geocoding, or map-tile dependency.
- Offline: `public/sw.js` resolves `world/registry.json`, precaches the build-generated `app-shell.json` (HTML, hashed JS/CSS, manifest, fonts and icons), `world/registry.json`, and the initial files for registered packs flagged `precacheOnInstall` (both current packs). It then serves world assets cache-first from a versioned `yaounde-world-<version>` cache. Settings → Offline world lets the player choose a registered pack and downloads its full catalog (Nlongkak: 90 files / 5.39 MB; Mvog-Mbi: 55 files / 2.04 MB) with progress, cancel and quota handling. Removing a pack deletes only that pack's cache; cleanup preserves every version still listed in the registry. A completed download or removal invalidates the service worker's memoized world version so the next request uses the new cache immediately.
- Water: Nlongkak has 2 polygon water features plus 35 real OSM waterway centrelines (5.9 km); Mvog-Mbi has 5 water polygons and 18 waterway centrelines. All are rendered as terrain-following geometry.
- Implementation suite: `docs/world-engine/` (architecture, data sources, coordinates, manifest, chunks, roads, terrain, buildings, offline packaging, licensing, budgets, progress, M8 review, remaining work).

## Source data

| Source | Snapshot | Use | Licence / attribution |
| --- | --- | --- | --- |
| OpenStreetMap Cameroon extract, Geofabrik | 2026-10-30 (`cameroon-261030.osm.pbf`) | Roads, buildings, water polygons and waterway lines, POIs, Nlongkak and Mvog-Mbi boundaries | ODbL 1.0, (c) OpenStreetMap contributors |
| Copernicus DEM GLO-30, tile `N03_00_E011_00` | Copernicus DEM GLO-30 | Terrain elevation for both packs | (c) ESA, Copernicus DEM GLO-30 |
| OSM relation 3095854 | 2026-10-30 | Nlongkak boundary for district anchoring | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM relation 3093787 | 2026-10-30 | Mvog-Mbi boundary for district bbox and anchoring | ODbL 1.0, (c) OpenStreetMap contributors |

Google Open Buildings V3 is intentionally not used in either pack. Its licence and attribution obligations therefore do not apply to these packages. An opt-in importer contract exists for a future licensed export but is disabled in `data/geodata/config/nlongkak.json` and `data/geodata/config/mvog_mbi.json`.

## Area and coordinates

Nlongkak:

- Configured bbox: `11.5126,3.8780,11.5305,3.8960`.
- Terrain chunk size: 512 m; 4 x 4 grid of 16 chunks.
- Vertical offset: 713.3 m.

Mvog-Mbi:

- Configured bbox: `11.5156,3.8445..11.5258,3.8583`, derived from OSM relation `3093787` and padded for edge geometry.
- Terrain chunk size: 512 m; 3 x 3 grid of 9 chunks; about 1,138 m x 1,530 m.
- Vertical offset: 698.9 m.

Shared:

- Projection: EPSG:32632 / WGS 84 UTM zone 32N.
- Origin: the minimum projected easting and northing of the pack's bbox corners.
- Game coordinates: `x` increases east, `z` increases south, `y` is relative elevation in metres.
- Scale: 1 game unit = 1 metre.
- Fine terrain cell: 8 m. Coarse gameplay terrain cell: 16 m.
- Absolute elevation = `verticalOffset + localHeight`.
- Water level: polygon water stores one relative level per feature; waterway lines store one DEM-derived surface level per point.

## Build and verification

Requirements: Node, `osmium-tool`, Python 3 with Pillow, and curl.

```bash
npm run world:acquire -- data/geodata/config/mvog_mbi.json   # download, extract, decode DEM, build, validate
npm run world:inspect -- data/geodata/config/mvog_mbi.json   # source presence, bbox, chunk grid, raw feature counts
npm run world:build -- data/geodata/config/mvog_mbi.json     # regenerate one pack and upsert its registry entry
npm run world:validate                                      # verify every registered pack
npm run world:validate -- world/mvog-mbi/v1                 # verify one pack
```

The default config remains `data/geodata/config/nlongkak.json` when no config is passed. Do not run the Nlongkak build casually: it would rebuild `public/world/v1` and change its generated timestamp.

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

The shippable derived packages are `public/world/registry.json` plus `public/world/v1/` and `public/world/mvog-mbi/v1/`. Nlongkak includes 16 chunk packs and a 90-file offline catalog; Mvog-Mbi includes 9 chunk packs and a 55-file offline catalog. Each pack has `manifest.json`, `licenses.json`, `files.json`, `precache.json`, global terrain/roads/POIs/water/waterways/districts, and its chunk files. Registry entries are deployment metadata, not part of either pack catalog.

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
- `precache.json`: initial offline file list used by the service worker (53 files: 8 global files + 3 x 3 chunks around spawn, for each current pack).

Every rendered feature carries provenance. Status values mean:

- `real`: derived from a source feature.
- `inferred`: a conservative estimate from real geometry or tags.
- `designed`: authored gameplay content, not a claim about the real feature.
- `procedural`: generated content.

## Runtime behaviour

- `src/world/` is the pure data layer: UTM transforms, chunk math, terrain sampling, road graph utilities, building decoding/collision, registry and manifest validation, and async loading.
- `src/render/geo/` is the Three.js adapter: collision grid, road index, terrain/road/building/prop/water/waterway geometry, runtime adapter, and the streaming `GeoScene`.
- `src/world/registry.ts` validates the district → pack mapping, rejects duplicate districts/unsafe paths, checks manifest-format compatibility, and provides a built-in two-pack fallback if `world/registry.json` cannot be fetched. The loader also enforces the registry's `worldVersion` and `area.id` against the fetched manifest.
- The geographic adapter uses the loaded manifest's `area.id` and `WorldDistrictAnchor`. It does not hard-code a district anchor, place filter or `districtAt` result.
- Chunk radius: low = current chunk, mid = 3 x 3, high = 5 x 5 (capped by the pack grid: 4 x 4 for Nlongkak, 3 x 3 for Mvog-Mbi). `ChunkLru` caps loaded chunks at 5/10/16, keeps a stable nearest-first subset when the desired radius exceeds the cap, retains keep-ring buffers in spare slots, and disposes geometry on unload.
- Building LOD: near detail includes windows, doors, awnings, painted shop boards/blade signs, roof details, capped upper-floor balconies, and rooftop props; far detail is a simplified massing mesh. Mid/high use both; low uses the simple mesh.
- Terrain LOD: chunk meshes are always built from the fine heightfield; quality controls props, building detail, shadows, and draw distance.
- Street detail: vehicle roads get a shoulder, concrete drainage gutter, curb and (on trunk/primary/secondary/tertiary roads) a pavement strip with periodic gutter crossings. Vehicles mix yellow taxis, private cars, minibuses, trucks and motos by road class.
- Real `marketplace` and `mall` POIs seed clustered stalls, produce mats and a market board before the rest of the prop budget is spent. Market clusters also place bounded vendor umbrellas and display tables; roadside vendor stands use the same prop budget. Shop signage is generated from building classification and a deterministic palette, not real shop names.
- Selected small houses get a capped compound wall around the footprint, with a gate opening facing the nearest road, concrete piers and a partly open metal leaf. Placement checks building, road and prop clearance.
- Player grounding uses loaded fine chunk heightfields and falls back to the coarse global field.
- Building collision uses footprint push-out with a spatial grid. Trees, lamps, stalls, vendor stands, benches and vehicles add circular obstacles. Compound walls/gates and balconies are visual-only and add no collision volumes.
- Places are gameplay content. In geographic mode, places for the loaded district are deterministically mapped near real roads and are explicitly not presented as real business addresses.
- NPCs whose schedules are outside the loaded geographic district are hidden. NPCs inside it are placed near walkable roads.
- Travel to another district switches to that district's registered pack if one exists, otherwise to the legacy procedural world. Returning to a geographic district switches back to its pack.
- Debug metrics: `?debug=world` or `localStorage.setItem('yaounde-world-debug', '1')` shows FPS, frame time, chunks, buildings, triangles, draw calls, geometries and textures.

## Known limitations

- Nlongkak and Mvog-Mbi are geographic. The other seven districts remain procedural until their own reproducible packs are built and reviewed.
- Mvog-Mbi has automated pack/runtime validation but has not had a production visual, Android/device, offline/Settings or named local cultural review yet.
- Building heights are mostly inferred from footprint area and tags; only tagged heights/levels are real.
- Waterway ribbons use DEM-derived per-point heights; there is no flow, flooding or channel-carving simulation. OSM bridge decks use a straight grade between endpoints and have no hydraulic, underpass or parapet-collision model.
- There is no real-time traffic, routing, live closures, or live geocoding. Parked/waiting vehicles, market stalls, vendor umbrellas, produce and signage are deterministic visual dressing, not vendor registries, real shop names or traffic data.
- Compound walls/gates and balcony slabs are bounded visual accents without collision volumes or enterable floors.
- Drainage gutters, pavements and curbs are inferred from road class for visual detail; they are not mapped infrastructure and do not simulate flow or flooding.
- Nlongkak has a boundary polygon from OSM; Mvog-Mbi uses relation `3093787` to define its bbox but its runtime district anchor is still a point. Other district anchors are points, not official boundaries.
- Fictional businesses and NPC schedules are designed gameplay content mapped into the real slice, not statements about real establishments.
- The slice is not a photoreal or Google-Maps-like replica. It is a low-poly, deterministic interpretation of OSM geometry and Copernicus terrain.
- Device performance on low-end Android still needs a real-device pass.

## Attribution

When showing a geographic district in the product, display or link the attribution:

- `Map data (c) OpenStreetMap contributors, ODbL 1.0`
- `Elevation (c) ESA, Copernicus DEM GLO-30`

The machine-readable copies are in `public/world/v1/licenses.json` and `public/world/mvog-mbi/v1/licenses.json`.
