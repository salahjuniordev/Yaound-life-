# Geographic Data Sources

All runtime geometry comes from committed, registry-selected packs. Nine
production packs are registered: Nlongkak at `public/world/v1/`, Mvog-Mbi at
`public/world/mvog-mbi/v1/`, Mokolo at `public/world/mokolo/v1/`, Bastos at
`public/world/bastos/v1/`, Ngoa-Ekelle at `public/world/ngoa-ekelle/v1/`,
Boulevard du 20 Mai at `public/world/boulevard/v1/`, Lac Municipal at
`public/world/lac-municipal/v1/`, Mvan at `public/world/mvan/v1/` and Mont Febe
at `public/world/mont-febe/v1/`. `public/world/registry.json` maps each to its
gameplay district. The game does not query geodata services at play time.

## Sources in the current packs

| Source | Snapshot | Used for | Licence / attribution |
| --- | --- | --- | --- |
| OpenStreetMap Cameroon extract (Geofabrik), `cameroon-261030.osm.pbf` | 2026-10-30 | Roads, buildings, water polygons, waterway lines, POIs and district slices for all nine packs | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `3095854` | 2026-10-30 | Nlongkak boundary anchoring | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `3093787` | 2026-10-30 | Mvog-Mbi boundary bbox and anchoring | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `2758122` | 2026-10-30 | Mokolo boundary bbox and anchoring | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `3096136` | 2026-10-30 | Bastos boundary reference for the central slice | ODbL 1.0, © OpenStreetMap contributors |
| OSM relation `3092564` | 2026-10-30 | Mvan boundary bbox and anchoring | ODbL 1.0, © OpenStreetMap contributors |
| OSM way `583759448` (`+university`) | 2026-10-30 | Ngoa-Ekelle university-area anchor | ODbL 1.0, © OpenStreetMap contributors |
| OSM way `1054466544` (`+shore`) | 2026-10-30 | Lac Municipal shoreline-derived gameplay anchor | ODbL 1.0, © OpenStreetMap contributors |
| OSM node `6310721515` | 2026-10-30 | Boulevard du 20 Mai anchoring | ODbL 1.0, © OpenStreetMap contributors |
| OSM node `2370598711` | 2026-10-30 | Mont Febe anchoring | ODbL 1.0, © OpenStreetMap contributors |
| Copernicus DEM GLO-30, tile `N03_00_E011_00` | Copernicus DEM GLO-30 release | Terrain elevation for all nine packs | © ESA, Copernicus DEM GLO-30 |

The exact source URLs, snapshot identifiers and usage notes are stored in each
pack's `manifest.json` and `licenses.json`:

- `public/world/v1/manifest.json` and `public/world/v1/licenses.json`;
- `public/world/mvog-mbi/v1/manifest.json` and
  `public/world/mvog-mbi/v1/licenses.json`;
- `public/world/mokolo/v1/manifest.json` and
  `public/world/mokolo/v1/licenses.json`;
- `public/world/bastos/v1/manifest.json` and
  `public/world/bastos/v1/licenses.json`;
- `public/world/ngoa-ekelle/v1/manifest.json` and
  `public/world/ngoa-ekelle/v1/licenses.json`;
- `public/world/boulevard/v1/manifest.json` and
  `public/world/boulevard/v1/licenses.json`;
- `public/world/lac-municipal/v1/manifest.json` and
  `public/world/lac-municipal/v1/licenses.json`;
- `public/world/mvan/v1/manifest.json` and
  `public/world/mvan/v1/licenses.json`;
- `public/world/mont-febe/v1/manifest.json` and
  `public/world/mont-febe/v1/licenses.json`.

The build configurations are `data/geodata/config/nlongkak.json`,
`data/geodata/config/mvog_mbi.json`, `data/geodata/config/mokolo.json`,
`data/geodata/config/bastos.json`, `data/geodata/config/ngoa_ekelle.json`,
`data/geodata/config/boulevard.json`, `data/geodata/config/lac_municipal.json`,
`data/geodata/config/mvan.json` and `data/geodata/config/mont_febe.json`.

## Acquisition and processing

Requirements: Node, `osmium-tool`, Python 3 with Pillow, and `curl`.

```bash
# One area at a time; the default is Nlongkak only when no config is passed.
npm run world:acquire -- data/geodata/config/bastos.json
npm run world:inspect -- data/geodata/config/bastos.json
npm run world:build -- data/geodata/config/bastos.json

# Validates every registered pack by default, or one explicit pack.
npm run world:validate
npm run world:validate -- world/bastos/v1
```

The acquisition script uses the configured OSM bbox, source/output paths and DEM
window. It downloads the pinned raw files only when missing, extracts the bbox
with `osmium extract --bbox`, exports GeoJSON/OPL, decodes the DEM window with
Pillow, then runs `world:build` and `world:validate`.

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
- Bastos, `bastos-2026-10-30-v1`, 9 chunks, 170 roads, 2,270 buildings, 352 POIs,
  0 water polygons, 11 waterway lines; 55-file catalog. Registered for on-demand
  download.
- Ngoa-Ekelle, `ngoa-ekelle-2026-10-30-v1`, 9 chunks, 198 roads, 2,862
  buildings, 723 POIs, 25 water polygons, 50 waterway lines; 55-file catalog.
  Registered for on-demand download.
- Boulevard du 20 Mai, `boulevard-2026-10-30-v1`, 4 chunks (2 × 2), 229 roads,
  467 buildings, 250 POIs, 17 water polygons, 7 waterway lines; 30-file catalog.
  Registered for on-demand download.
- Lac Municipal, `lac-municipal-2026-10-30-v1`, 9 chunks, 208 roads, 743
  buildings, 124 POIs, 5 water polygons, 7 waterway lines; 55-file catalog.
  Registered for on-demand download.
- Mvan, `mvan-2026-10-30-v1`, 9 chunks, 102 roads, 1,539 buildings, 20 POIs, 1
  water polygon, 29 waterway lines; 55-file catalog. Registered for on-demand
  download.
- Mont Febe, `mont-febe-2026-10-30-v1`, 9 chunks, 91 roads, 492 buildings, 12
  POIs, 0 water polygons, 2 waterway lines; 55-file catalog. Registered for
  on-demand download.

The Lac Municipal gameplay anchor is a shoreline point
(`11.5115261,3.8654830`) chosen on a footway at the lake edge rather than the
lake centroid. Its provenance records `way/1054466544+shore`, and the
`lac_path`/`taxi_lac` gameplay places are mapped to shore-side road positions
for clearance. This is a gameplay anchor decision, not a claim about an official
district boundary.

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

The exclusion is recorded in all nine area configs
(`data/geodata/config/nlongkak.json`, `data/geodata/config/mvog_mbi.json`,
`data/geodata/config/mokolo.json`, `data/geodata/config/bastos.json`,
`data/geodata/config/ngoa_ekelle.json`, `data/geodata/config/boulevard.json`,
`data/geodata/config/lac_municipal.json`, `data/geodata/config/mvan.json`,
`data/geodata/config/mont_febe.json`) and in `docs/WORLD.md`. If a local Open
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
