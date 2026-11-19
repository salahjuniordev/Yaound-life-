# Geographic Data Sources

All runtime geometry comes from committed, registry-selected packs. Three
production packs are registered: Nlongkak at `public/world/v1/`, Mvog-Mbi at
`public/world/mvog-mbi/v1/` and Mokolo at `public/world/mokolo/v1/`.
`public/world/registry.json` maps each to its gameplay district. The game does
not query geodata services at play time.

## Sources in the current packs

| Source | Snapshot | Used for | Licence / attribution |
| --- | --- | --- | --- |
| OpenStreetMap Cameroon extract (Geofabrik), `cameroon-261030.osm.pbf` | 2026-10-30 | Roads, buildings, water polygons, waterway lines, POIs, Nlongkak, Mvog-Mbi and Mokolo boundaries | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `3095854` | 2026-10-30 | Nlongkak boundary anchoring | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `3093787` | 2026-10-30 | Mvog-Mbi boundary bbox and anchoring | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `2758122` | 2026-10-30 | Mokolo boundary bbox and anchoring | ODbL 1.0, © OpenStreetMap contributors |
| Copernicus DEM GLO-30, tile `N03_00_E011_00` | Copernicus DEM GLO-30 release | Terrain elevation for all three packs | © ESA, Copernicus DEM GLO-30 |

The exact source URLs, snapshot identifiers and usage notes are stored in each
pack's `manifest.json` and `licenses.json`:

- `public/world/v1/manifest.json` and `public/world/v1/licenses.json`;
- `public/world/mvog-mbi/v1/manifest.json` and
  `public/world/mvog-mbi/v1/licenses.json`;
- `public/world/mokolo/v1/manifest.json` and
  `public/world/mokolo/v1/licenses.json`.

The build configurations are `data/geodata/config/nlongkak.json`,
`data/geodata/config/mvog_mbi.json` and `data/geodata/config/mokolo.json`.

## Acquisition and processing

Requirements: Node, `osmium-tool`, Python 3 with Pillow, and `curl`.

```bash
# One area at a time; the default is Nlongkak only when no config is passed.
npm run world:acquire -- data/geodata/config/mokolo.json
npm run world:inspect -- data/geodata/config/mokolo.json
npm run world:build -- data/geodata/config/mokolo.json

# Validates every registered pack by default, or one explicit pack.
npm run world:validate
npm run world:validate -- world/mokolo/v1
```

The acquisition script derives the OSM bbox, source/output paths and DEM window
from the area config. It downloads the pinned raw files only when missing,
extracts the bbox with `osmium extract --bbox`, exports GeoJSON/OPL, decodes the
DEM window with Pillow, then runs `world:build` and `world:validate`.

Raw and intermediate data stay out of git:

- `data/geodata/raw/`
- `data/geodata/processed/`

Only the derived, versioned packs are committed. `world:build` writes
`metadata/build-report.json` with input counts and skipped features, and
`metadata/validation.json` with validation evidence. It also upserts the area's
entry in `public/world/registry.json`, keyed by gameplay district, without
deleting other registered packs.

Current packs:

- Nlongkak, `nlongkak-2026-10-30-v2`, 16 chunks, 426 roads, 8,085 buildings,
  409 POIs, 2 water polygons, 35 waterway lines; 90-file catalog.
- Mvog-Mbi, `mvog-mbi-2026-10-30-v1`, 9 chunks, 224 roads, 2,659 buildings,
  89 POIs, 5 water polygons, 18 waterway lines; 55-file catalog.
- Mokolo, `mokolo-2026-10-30-v1`, 6 chunks, 100 roads, 1,989 buildings, 38 POIs,
  1 water polygon, 15 waterway lines; 40-file catalog. Registered for on-demand
  download.

## Processing rules

- Roads: OSM ways tagged `highway`, clipped to the bbox, validated, and assigned
  a gameplay class/width. OSM node IDs are retained for connectivity.
- Buildings: OSM building footprints, simplified, filtered by minimum area,
  deduplicated by centroid/area, and assigned conservative heights.
- Water: polygon water features plus `waterway=river|stream|canal|drain|ditch`
  centrelines. Waterways keep real OSM IDs and widths; surface levels are
  inferred per point from the fine DEM so ribbons follow terrain.
- POIs: named OSM points inside the bbox, with a tag-derived kind.
- Terrain: Copernicus elevation sampled in EPSG:32632, smoothed once, converted
  to a local vertical datum and split into 512 m chunks.

## Google Open Buildings V3

Open Buildings V3 is **not used** in any current pack. The exact blocker:

- The dataset is distributed as country/region tiles through Google's download
  flow and requires accepting Google's terms and exporting tiles for the area.
  No such export is present in this repository, and the build must remain
  reproducible without a Google account or a manual export step.
- The current slices already have dense OSM building coverage. Mixing a second
  footprint source without a verified local export would create unverifiable
  geometry and licensing claims.

The optional importer contract is implemented in
`src/world/openBuildings.ts` and covered by `test/openBuildings.test.ts` using
only synthetic fixtures in `test/fixtures/`. It is build-time code, not runtime
renderer code. Production ingestion stays disabled until a licensed export is
committed or supplied locally.

### Enabling a licensed export

Add an explicit `openBuildings` block to one area config. Ingestion only runs
when `enabled` is exactly `true`:

```json
"openBuildings": {
  "enabled": true,
  "id": "google_open_buildings_v3",
  "name": "Google Open Buildings V3",
  "url": "https://sites.research.google/open-buildings/",
  "license": "CC-BY-4.0",
  "attribution": "Google Open Buildings (CC BY 4.0)",
  "snapshotDate": "2023-05-01",
  "exportFile": "data/geodata/external/open-buildings-nlongkak.csv",
  "minConfidence": 0.75,
  "usage": "Optional building footprints, confidence-filtered and deduplicated against OpenStreetMap."
}
```

Contract rules enforced by the build:

- The source ID must be `google_open_buildings_v3`.
- The licence must be one of the two licences Google publishes for the dataset:
  `CC-BY-4.0` or `ODbL-1.0`. The selected licence and attribution are copied
  into provenance, `manifest.json`, and `licenses.json`.
- `snapshotDate` must be a real date; `exportFile` must be a relative `.csv`
  path with no parent traversal.
- The CSV must contain `latitude`, `longitude`, `area_in_meters`, `confidence`,
  and `geometry` columns. `geometry` must be closed `POLYGON` or
  `MULTIPOLYGON` WKT; holes, 3D WKT and non-polygon WKT are rejected.
- Detections below `minConfidence` (default `0.75`, minimum `0.65`) are dropped.
  This is deliberately conservative; per-tile precision thresholds are not
  substituted for a verified export.
- Projected footprints below the area's `minBuildingArea`, outside the world
  bounds, or overlapping an accepted OSM footprint are dropped. OSM geometry is
  never removed or replaced; Open Buildings are only appended for gaps.
- Identical/overlapping Open Buildings detections are deduplicated.
- Accepted features retain source, deterministic source ID, snapshot date,
  licence, attribution, confidence, and `geometryStatus: inferred`. Their
  heights remain inferred and their architecture remains procedural.

`metadata/build-report.json` records the import statistics and rejection
examples. A production pack must still be built, validated and reviewed with
the real export; the synthetic fixtures are never production data.

### Current decision

The exclusion is recorded in all three configs
(`data/geodata/config/nlongkak.json`,
`data/geodata/config/mvog_mbi.json`,
`data/geodata/config/mokolo.json`) and in `docs/WORLD.md`. If a local Open
Buildings export is later supplied, it must be added as an explicitly licensed
source, used only to fill gaps after OSM footprints are accepted, and
deduplicated against OSM footprints. It must not silently replace OSM geometry.

## Reproducibility and pinning

- Source snapshot dates are written into the manifest and every feature's
  provenance.
- Generated IDs and colours are deterministic functions of source IDs.
- The build fails validation if a chunk file is missing, a hash/count is wrong,
  or the offline catalog does not match the manifest.
- Do not edit generated files by hand. Change the pipeline and rebuild.

## Attribution obligations

The product must display or link:

- `Map data © OpenStreetMap contributors, ODbL 1.0`
- `Elevation © ESA, Copernicus DEM GLO-30`

See `LICENSING_AND_ATTRIBUTION.md`.
