# Geographic world: nine Yaoundé district packs

This document describes the real-geography world packs for Yaoundé Life. Every
district now has a geographic pack; the procedural world remains available as an
explicit fallback. The packs have automated pack/runtime validation, but they
are not yet device/visual accepted. This is not a claim that the whole city is
finished or that every pack has passed production review.

## Current status

- Geographic areas: Nlongkak, Mvog-Mbi, Mokolo, Bastos, Ngoa-Ekelle, Boulevard du 20 Mai, Lac Municipal, Mvan and Mont Febe, Yaoundé, Cameroon.
- Area ids: `nlongkak`, `mvog_mbi`, `mokolo`, `bastos`, `ngoa_ekelle`, `boulevard`, `lac_municipal`, `mvan` and `mont_febe`.
- World packages: `public/world/v1/` (Nlongkak), `public/world/mvog-mbi/v1/`, `public/world/mokolo/v1/`, `public/world/bastos/v1/`, `public/world/ngoa-ekelle/v1/`, `public/world/boulevard/v1/`, `public/world/lac-municipal/v1/`, `public/world/mvan/v1/` and `public/world/mont-febe/v1/`; district selector: `public/world/registry.json`.
- Runtime default: the registry selects the versioned pack registered for the current gameplay district. All nine gameplay districts have packs; the legacy procedural world remains available through the rollback paths below.
- Rollback: Settings -> geographic-world toggle, `?world=legacy`, or localStorage key `yaounde-world-mode=legacy`.
- Force preview: `?world=geo`.
- The world packages are generated at build time and are loaded from the app origin. There is no runtime Overpass, geocoding, or map-tile dependency.
- Offline: `public/sw.js` resolves `world/registry.json`, precaches the build-generated `app-shell.json` (HTML, hashed JS/CSS, manifest, fonts and icons), `world/registry.json`, and the initial files for registered packs flagged `precacheOnInstall` (Nlongkak and Mvog-Mbi). The other seven packs are registered for on-demand download. It then serves world assets cache-first from a versioned `yaounde-world-<version>` cache. Settings → Offline world lets the player choose any registered pack and downloads its full catalog with progress, cancel and quota handling. Removing a pack deletes only that pack's cache; cleanup preserves every version still listed in the registry. A completed download or removal invalidates the service worker's memoized world version so the next request uses the new cache immediately.
- Catalog sizes: Nlongkak 90 files / 5.39 MB; Mvog-Mbi 55 / 2.04 MB; Mokolo 40 / 1.35 MB; Bastos 55 / 2.00 MB; Ngoa-Ekelle 55 / 2.77 MB; Boulevard du 20 Mai 30 / 1.08 MB; Lac Municipal 55 / 1.17 MB; Mvan 55 / 1.21 MB; Mont Febe 55 / 0.71 MB. The full deployed tree is 509 files / 17,805,627 bytes raw / 3,241,290 bytes gzip.
- Water: Nlongkak has 2 polygon water features plus 35 real OSM waterway centrelines; Mvog-Mbi has 5 water polygons and 18 waterway centrelines; Mokolo 1 and 15; Bastos 0 and 11; Ngoa-Ekelle 25 and 50; Boulevard du 20 Mai 17 and 7; Lac Municipal 5 and 7; Mvan 1 and 29; Mont Febe 0 and 2. All are rendered as terrain-following geometry.
- Implementation suite: `docs/world-engine/` (architecture, data sources, coordinates, manifest, chunks, roads, terrain, buildings, offline packaging, licensing, budgets, progress, M8 review, remaining work).

## Source data

| Source | Snapshot | Use | Licence / attribution |
| --- | --- | --- | --- |
| OpenStreetMap Cameroon extract, Geofabrik | 2026-10-30 (`cameroon-261030.osm.pbf`) | Roads, buildings, water polygons and waterway lines, POIs and district slices for all nine packs | ODbL 1.0, (c) OpenStreetMap contributors |
| Copernicus DEM GLO-30, tile `N03_00_E011_00` | Copernicus DEM GLO-30 | Terrain elevation for all nine packs | (c) ESA, Copernicus DEM GLO-30 |
| OSM relation 3095854 | 2026-10-30 | Nlongkak boundary and anchoring | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM relation 3093787 | 2026-10-30 | Mvog-Mbi boundary for district bbox and anchoring | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM relation 2758122 | 2026-10-30 | Mokolo boundary for district bbox and anchoring | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM relation 3096136 | 2026-10-30 | Bastos boundary reference; central slice bbox chosen inside it | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM relation 3092564 | 2026-10-30 | Mvan boundary for district bbox and anchoring | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM way 583759448 (`+university`) | 2026-10-30 | Ngoa-Ekelle university-area anchor | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM way 1054466544 (`+shore`) | 2026-10-30 | Lac Municipal shoreline-derived gameplay anchor | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM node 6310721515 | 2026-10-30 | Boulevard du 20 Mai anchoring | ODbL 1.0, (c) OpenStreetMap contributors |
| OSM node 2370598711 | 2026-10-30 | Mont Febe anchoring | ODbL 1.0, (c) OpenStreetMap contributors |

Google Open Buildings V3 is intentionally not used in any pack. Its licence and attribution obligations therefore do not apply to these packages. An opt-in importer contract exists for a future licensed export but is disabled in all nine area configs.

## Area and coordinates

| Area | Configured bbox | Chunks | Approx. size | Vertical offset |
| --- | --- | --- | --- | --- |
| Nlongkak | `11.5126,3.8780,11.5305,3.8960` | 16 (4 × 4) | 1,995 m × 1,997 m | 713.3 m |
| Mvog-Mbi | `11.5156,3.8445..11.5258,3.8583` | 9 (3 × 3) | 1,138 m × 1,530 m | 698.9 m |
| Mokolo | `11.4929,3.8713..11.5040,3.8800` | 6 (3 × 2) | 1,236 m × 966 m | 717.1 m |
| Bastos | `11.5039,3.8882..11.5168,3.8999` | 9 (3 × 3) | 1,437 m × 1,299 m | 726.6 m |
| Ngoa-Ekelle | `11.4935,3.8505..11.5065,3.8625` | 9 (3 × 3) | 1,449 m × 1,332 m | 711.4 m |
| Boulevard du 20 Mai | `11.5125,3.8594..11.5215,3.8686` | 4 (2 × 2) | 1,003 m × 1,021 m | 699.9 m |
| Lac Municipal | `11.5045,3.8600..11.5145,3.8700` | 9 (3 × 3) | 1,115 m × 1,110 m | 707.1 m |
| Mvan | `11.5108,3.8170..11.5220,3.8282` | 9 (3 × 3) | 1,248 m × 1,243 m | 679.2 m |
| Mont Febe | `11.4840,3.9050..11.4960,3.9185` | 9 (3 × 3) | 1,338 m × 1,498 m | 762.7 m |

The Lac Municipal anchor is a shoreline point (`11.5115261,3.8654830`) chosen on a footway at the lake edge, not the lake centroid. Its provenance records `way/1054466544+shore`, and the `lac_path`/`taxi_lac` gameplay places are mapped to shore-side road positions. This is a gameplay anchor decision, not a claim about an official district boundary.

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
npm run world:acquire -- data/geodata/config/bastos.json   # download, extract, decode DEM, build, validate
npm run world:inspect -- data/geodata/config/bastos.json   # source presence, bbox, chunk grid, raw feature counts
npm run world:build -- data/geodata/config/bastos.json     # regenerate one pack and upsert its registry entry
npm run world:validate                                     # verify every registered pack
npm run world:validate -- world/bastos/v1                  # verify one pack
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

The shippable derived packages are `public/world/registry.json` plus one versioned directory per district. Chunk and catalog counts:

| Pack | Chunks | Catalog files |
| --- | --- | --- |
| Nlongkak (`public/world/v1/`) | 16 | 90 |
| Mvog-Mbi (`public/world/mvog-mbi/v1/`) | 9 | 55 |
| Mokolo (`public/world/mokolo/v1/`) | 6 | 40 |
| Bastos (`public/world/bastos/v1/`) | 9 | 55 |
| Ngoa-Ekelle (`public/world/ngoa-ekelle/v1/`) | 9 | 55 |
| Boulevard du 20 Mai (`public/world/boulevard/v1/`) | 4 | 30 |
| Lac Municipal (`public/world/lac-municipal/v1/`) | 9 | 55 |
| Mvan (`public/world/mvan/v1/`) | 9 | 55 |
| Mont Febe (`public/world/mont-febe/v1/`) | 9 | 55 |

Each pack has `manifest.json`, `licenses.json`, `files.json`, `precache.json`, global terrain/roads/POIs/water/waterways/districts, and its chunk files. Registry entries are deployment metadata, not part of any pack catalog.

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
- `precache.json`: initial offline file list used by the service worker. Nlongkak, Mvog-Mbi, Bastos, Ngoa-Ekelle, Lac Municipal, Mvan and Mont Febe list 53 files (8 global files + 3 × 3 chunks around spawn); Boulevard du 20 Mai lists all 4 chunks (28 files); Mokolo lists all 6 chunks (38 files).

Every rendered feature carries provenance. Status values mean:

- `real`: derived from a source feature.
- `inferred`: a conservative estimate from real geometry or tags.
- `designed`: authored gameplay content, not a claim about the real feature.
- `procedural`: generated content.

## Runtime behaviour

- `src/world/` is the pure data layer: UTM transforms, chunk math, terrain sampling, road graph utilities, building decoding/collision, registry and manifest validation, and async loading.
- `src/render/geo/` is the Three.js adapter: collision grid, road index, terrain/road/building/prop/water/waterway geometry, runtime adapter, and the streaming `GeoScene`.
- `src/world/registry.ts` validates the district → pack mapping, rejects duplicate districts/unsafe paths, checks manifest-format compatibility, and provides a built-in nine-pack fallback if `world/registry.json` cannot be fetched. The loader also enforces the registry's `worldVersion` and `area.id` against the fetched manifest.
- The geographic adapter uses the loaded manifest's `area.id` and `WorldDistrictAnchor`. It does not hard-code a district anchor, place filter or `districtAt` result.
- Chunk radius: low = current chunk, mid = 3 x 3, high = 5 x 5 (capped by the pack grid: 4 x 4 for Nlongkak, 2 x 2 for Boulevard du 20 Mai, 3 x 2 for Mokolo, and 3 x 3 for the other six packs). `ChunkLru` caps loaded chunks at 5/10/16, keeps a stable nearest-first subset when the desired radius exceeds the cap, retains keep-ring buffers in spare slots, and disposes geometry on unload.
- Building LOD: near detail includes windows, doors, awnings, painted shop boards/blade signs, roof details, capped upper-floor balconies, and rooftop props; far detail is a simplified massing mesh. Mid/high use both; low uses the simple mesh.
- Terrain LOD: chunk meshes are always built from the fine heightfield; quality controls props, building detail, shadows, and draw distance.
- Street detail: vehicle roads get a shoulder, concrete drainage gutter, curb and (on trunk/primary/secondary/tertiary roads) a pavement strip with periodic gutter crossings. Vehicles mix yellow taxis, private cars, minibuses, trucks and motos by road class.
- Real `marketplace` and `mall` POIs seed clustered stalls, produce mats and a market board before the rest of the prop budget is spent. Market clusters also place bounded vendor umbrellas and display tables; roadside vendor stands use the same prop budget. Shop signage is generated from building classification and a deterministic palette, not real shop names.
- Selected small houses get a capped compound wall around the footprint, with a gate opening facing the nearest road, concrete piers and a partly open metal leaf. Placement checks building, road and prop clearance.
- Player grounding uses loaded fine chunk heightfields and falls back to the coarse global field.
- Building collision uses footprint push-out with a spatial grid. Trees, lamps, stalls, vendor stands, benches and vehicles add circular obstacles. Compound walls/gates and balconies are visual-only and add no collision volumes.
- Places are gameplay content. In geographic mode, places for the loaded district are deterministically mapped near real roads and are explicitly not presented as real business addresses.
- NPCs whose schedules are outside the loaded geographic district are hidden. NPCs inside it are placed near walkable roads.
- Travel to another district switches to that district's registered pack. If a pack is missing or fails validation, the app falls back to the legacy procedural world.
- Debug metrics: `?debug=world` or `localStorage.setItem('yaounde-world-debug', '1')` shows FPS, frame time, chunks, buildings, triangles, draw calls, geometries and textures.

## Known limitations

- All nine gameplay districts now have geographic packs. The procedural fallback remains available but is no longer the default for a district with a valid pack.
- All nine packs have automated pack/runtime/geometry validation. Only Nlongkak has had the internal renderer-only and Chromium + Mesa WebGL review; the other eight packs have not had a production visual, Android/device, offline/Settings or named local cultural review. Browser-based checks are deferred for now.
- Building heights are mostly inferred from footprint area and tags; only tagged heights/levels are real.
- Waterway ribbons use DEM-derived per-point heights; there is no flow, flooding or channel-carving simulation. OSM bridge decks use a straight grade between endpoints and have no hydraulic, underpass or parapet-collision model.
- There is no real-time traffic, routing, live closures, or live geocoding. Parked/waiting vehicles, market stalls, vendor umbrellas, produce and signage are deterministic visual dressing, not vendor registries, real shop names or traffic data.
- Compound walls/gates and balcony slabs are bounded visual accents without collision volumes or enterable floors.
- Drainage gutters, pavements and curbs are inferred from road class for visual detail; they are not mapped infrastructure and do not simulate flow or flooding.
- Nlongkak has a boundary polygon from OSM; Mvog-Mbi, Mokolo, Bastos and Mvan use OSM relations to define their slices; Ngoa-Ekelle, Lac Municipal, Boulevard du 20 Mai and Mont Febe use point anchors. Their runtime district anchors are points, not official boundaries.
- Fictional businesses and NPC schedules are designed gameplay content mapped into the real slice, not statements about real establishments.
- The slices are not a photoreal or Google-Maps-like replica. They are a low-poly, deterministic interpretation of OSM geometry and Copernicus terrain.
- Device performance on low-end Android still needs a real-device pass.

## Attribution

When showing a geographic district in the product, display or link the attribution:

- `Map data (c) OpenStreetMap contributors, ODbL 1.0`
- `Elevation (c) ESA, Copernicus DEM GLO-30`

The machine-readable copies are in `public/world/v1/licenses.json`, `public/world/mvog-mbi/v1/licenses.json`, `public/world/mokolo/v1/licenses.json`, `public/world/bastos/v1/licenses.json`, `public/world/ngoa-ekelle/v1/licenses.json`, `public/world/boulevard/v1/licenses.json`, `public/world/lac-municipal/v1/licenses.json`, `public/world/mvan/v1/licenses.json` and `public/world/mont-febe/v1/licenses.json`.
