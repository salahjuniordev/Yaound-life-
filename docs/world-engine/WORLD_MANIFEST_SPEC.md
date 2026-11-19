# World Manifest Specification

`public/world/registry.json` selects a versioned pack for each gameplay
district. The selected pack's `manifest.json` is the entry point for its
geographic world and is fetched and validated before any chunk is used.

## Pack registry (`public/world/registry.json`)

```json
{
  "format": "yaounde-life-world-registry",
  "formatVersion": 1,
  "generatedAt": "...",
  "packs": [
    {
      "id": "bastos",
      "districtId": "bastos",
      "name": "Bastos",
      "basePath": "world/bastos/v1",
      "worldVersion": "bastos-2026-10-30-v1",
      "manifestFormatVersion": 1
    },
    {
      "id": "boulevard",
      "districtId": "boulevard",
      "name": "Boulevard du 20 Mai",
      "basePath": "world/boulevard/v1",
      "worldVersion": "boulevard-2026-10-30-v1",
      "manifestFormatVersion": 1
    },
    {
      "id": "lac_municipal",
      "districtId": "lac_municipal",
      "name": "Lac Municipal",
      "basePath": "world/lac-municipal/v1",
      "worldVersion": "lac-municipal-2026-10-30-v1",
      "manifestFormatVersion": 1
    },
    {
      "id": "mokolo",
      "districtId": "mokolo",
      "name": "Mokolo",
      "basePath": "world/mokolo/v1",
      "worldVersion": "mokolo-2026-10-30-v1",
      "manifestFormatVersion": 1
    },
    {
      "id": "mont_febe",
      "districtId": "mont_febe",
      "name": "Mont Febe",
      "basePath": "world/mont-febe/v1",
      "worldVersion": "mont-febe-2026-10-30-v1",
      "manifestFormatVersion": 1
    },
    {
      "id": "mvan",
      "districtId": "mvan",
      "name": "Mvan",
      "basePath": "world/mvan/v1",
      "worldVersion": "mvan-2026-10-30-v1",
      "manifestFormatVersion": 1
    },
    {
      "id": "mvog_mbi",
      "districtId": "mvog_mbi",
      "name": "Mvog-Mbi",
      "basePath": "world/mvog-mbi/v1",
      "worldVersion": "mvog-mbi-2026-10-30-v1",
      "manifestFormatVersion": 1,
      "precacheOnInstall": true
    },
    {
      "id": "ngoa_ekelle",
      "districtId": "ngoa_ekelle",
      "name": "Ngoa-Ekelle",
      "basePath": "world/ngoa-ekelle/v1",
      "worldVersion": "ngoa-ekelle-2026-10-30-v1",
      "manifestFormatVersion": 1
    },
    {
      "id": "nlongkak",
      "districtId": "nlongkak",
      "name": "Nlongkak",
      "basePath": "world/v1",
      "worldVersion": "nlongkak-2026-10-30-v2",
      "manifestFormatVersion": 1,
      "precacheOnInstall": true
    }
  ]
}
```

Rules enforced by `src/world/registry.ts`:

- `districtId` is unique, so at most one pack is selected for a gameplay area.
- `basePath` is a site-relative path below `world/`; absolute URLs, `..` and
  backslashes are rejected.
- `worldVersion` is a safe version token. The loaded manifest must match both
  the registered `worldVersion` and `area.id`.
- `manifestFormatVersion` must match the runtime's `WORLD_FORMAT_VERSION`;
  incompatible packs fall back explicitly instead of rendering silently.
- Unregistered districts keep the legacy procedural world. A missing or invalid
  registry falls back to the built-in nine-pack mapping (Nlongkak, Mvog-Mbi,
  Mokolo, Bastos, Ngoa-Ekelle, Boulevard du 20 Mai, Lac Municipal, Mvan and Mont
  Febe), then to legacy if the selected pack also fails validation.
- `precacheOnInstall` is opt-in. The service worker precaches only packs that
  set it; other registered packs remain available for explicit download.

The registry is a deployment file, not part of a pack's `files.json` catalog.
`npm run world:build` upserts the current area's entry without deleting other
registered packs; `npm run world:validate` checks the registry against every
registered manifest and validates every registered pack by default.

## Required fields

| Field | Meaning |
| --- | --- |
| `format` | Must be `yaounde-life-world` |
| `formatVersion` | Must be `1`; incompatible versions are rejected |
| `worldVersion` | Versioned pack id, e.g. `nlongkak-2026-10-30-v2`, `mvog-mbi-2026-10-30-v1`, `mokolo-2026-10-30-v1`, `bastos-2026-10-30-v1`, `ngoa-ekelle-2026-10-30-v1`, `boulevard-2026-10-30-v1`, `lac-municipal-2026-10-30-v1`, `mvan-2026-10-30-v1` or `mont-febe-2026-10-30-v1` |
| `generatorVersion` | Pipeline version |
| `generatedAt` | ISO timestamp of the build |
| `area` | `{ id, name, description }` |
| `projection` | Must be `EPSG:32632` with zone 32N, WGS84 |
| `origin` | `{ lon, lat, east, north }` |
| `unitsPerMetre` | Positive scale; currently `1` |
| `verticalScale` | Positive elevation scale; currently `1` |
| `verticalOffset` | Metres subtracted from absolute elevation |
| `elevationDatum` | Human-readable vertical datum |
| `terrainCellSize` | Fine cell size (8 m) |
| `coarseTerrainCellSize` | Gameplay/coarse cell size (16 m) |
| `chunkSize` | Chunk edge in metres (512) |
| `bounds` | Game and projected min/max values |
| `waterLevel` | Global relative water level or `null` |
| `sources` | Non-empty array of source/licence records |
| `featureCounts` | `chunks`, `roads`, `buildings`, `pois`, `waterPolygons`, optional `waterways`, `terrainSamples` |
| `chunks` | Non-empty array of chunk references |
| `contentHash` | Hash of the generated content |
| `validation` | `{ ok, errors, warnings }` |

## Chunk reference

```json
{
  "id": "c_0_0",
  "ix": 0,
  "iz": 0,
  "bounds": { "minX": 0, "maxX": 512, "minZ": -512, "maxZ": 0 },
  "terrainFile": "terrain/c_0_0.bin",
  "roadsFile": "roads/c_0_0.json",
  "buildingsFile": "buildings/c_0_0.bin",
  "buildingsMetaFile": "buildings/c_0_0.json",
  "poisFile": "pois/c_0_0.json",
  "buildingCount": 0,
  "roadCount": 0,
  "hash": "..."
}
```

`id` must match `^c_-?\d+_-?\d+$`; indices must be integers; counts must be
non-negative; all five file paths are required.

## Validation

`src/world/manifest.ts` validates structure and types. The build/validate
scripts additionally check:

- every chunk file exists and is non-empty;
- terrain/building binaries decode with the expected magic and version;
- road/POI JSON parses and counts match the manifest;
- waterway records have at least two points, one level per point and a positive width;
- `contentHash` and per-chunk hashes are stable;
- `world/registry.json` is valid, has unique districts and points at existing
  packs whose manifests match their `worldVersion`, `area.id` and format;
- `files.json` lists every world file with its byte size;
- `precache.json` exactly matches the catalog's initial list;
- `worldVersion` matches between manifest and catalog.

Run:

```bash
npm run world:validate                    # every registered pack
npm run world:validate -- world/v1        # one pack
```

## Offline catalog (`files.json`)

```json
{
  "format": "yaounde-life-world-catalog",
  "formatVersion": 1,
  "worldVersion": "nlongkak-2026-10-30-v2",
  "generatedAt": "...",
  "totalBytes": 5391242,
  "files": [{ "path": "world/v1/manifest.json", "bytes": 12345 }],
  "initial": ["world/v1/manifest.json", "world/v1/precache.json"]
}
```

Rules:

- Paths are relative to the site root, without leading `/`, and must not contain
  `..` or absolute URLs.
- Paths are unique; byte sizes are finite and non-negative.
- Every `initial` path must exist in `files`.
- `worldVersion` must equal the manifest's version.

`precache.json` is the service worker's initial set: global files plus up to the
nine chunks around the spawn chunk (radius 1). Packs smaller than 3 × 3 list all
their chunks; Boulevard du 20 Mai lists all 4 and Mokolo lists all 6. The rest
downloads on demand.

## Versioning

- Bump `worldVersion` when geometry, counts or formats change.
- Keep `formatVersion` at `1` until the runtime format changes incompatibly.
- A new `worldVersion` gets a new Cache Storage bucket
  (`yaounde-world-<version>`); old buckets are removed after a successful
  download, not during app-shell activation. Cleanup preserves every version
  still registered for another district.
- Saves do not embed the world version; they store player state only. Adding a
  registry entry does not change gameplay district IDs or save data.
