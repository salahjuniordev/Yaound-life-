# Chunk Format and Streaming

The current packs use 512 m chunks: Nlongkak is a 4 × 4 grid (16 chunks),
Mvog-Mbi is a 3 × 3 grid (9 chunks) and Mokolo is a 3 × 2 grid (6 chunks). Each
chunk has five payload files plus a manifest reference.

## Files per chunk

| File | Format | Contents |
| --- | --- | --- |
| `terrain/c_IX_IZ.bin` | `YLT1` binary | Fine heightfield, 8 m cells |
| `roads/c_IX_IZ.json` | JSON | Roads clipped to the chunk |
| `buildings/c_IX_IZ.bin` | `YLB1` binary | Quantised footprints, height, colours, flags |
| `buildings/c_IX_IZ.json` | JSON | Building metadata/provenance |
| `pois/c_IX_IZ.json` | JSON | POIs assigned to the chunk |

Global files: `terrain/heightfield.bin`, `roads/network.json`, `pois/pois.json`,
`water/water.json`, `water/waterways.json`, `districts/districts.json`.

## `YLT1` heightfield

Little-endian:

```text
0   char[4]  "YLT1"
4   u16      version = 1
6   u16      reserved
8   u32      width
12  u32      height
16  f32      cellSize
20  f32      originX
24  f32      originZ
28  f32      minElevation
32  f32      maxElevation
36  f32[]    heights, row-major, width * height
```

`heightAt` does bilinear interpolation and clamps outside the field. Adjacent
chunks sample the same global field, so shared edges match exactly (tested).

## `YLB1` buildings

Little-endian header:

```text
0   char[4]  "YLB1"
4   u16      version = 1
6   u16      reserved
8   u32      count
12  f32      originX
16  f32      originZ
20  f32      scale (0.05 m)
24  ...      records
```

Each record:

```text
u16 vertexCount
u8  classification index
u8  flags
u16 height in decimetres
u8  wall R, G, B
u8  roof R, G, B
i16 (x - originX) / scale
i16 (z - originZ) / scale   (repeated vertexCount times)
```

The runtime decodes to `DecodedBuilding` and pairs records with the JSON metadata
by order. Flags encode shop/awning/roof-detail/rooftop-prop variations.

## Roads and POIs

Roads are JSON objects with `id`, `roadClass`, `points: [[x,z], ...]`, width,
oneway/bridge/tunnel, walkable and provenance. The global `network.json` adds
OSM node IDs for connectivity and routing.

POIs are JSON objects with `id`, `name`, `kind`, `pos: [x,z]`, optional French
name, district and provenance.

## Streaming

`GeoScene` uses `ChunkLru` (`src/world/chunkManager.ts`):

- Visible radius: low `0` (1 × 1), mid `1` (3 × 3), high `2` (5 × 5).
- Max loaded chunks: low `5`, mid `10`, high `16`.
- Desired chunks are requested; missing ones load concurrently.
- Eviction prefers chunks outside the keep radius, then least-recently-used
  chunks, and never evicts in-flight loads.
- `touch` refreshes LRU order on visibility.
- Unloaded chunks dispose geometries/materials and remove their groups.

Each chunk build decodes data once and creates:

- terrain mesh from the fine heightfield;
- road ribbons from clipped polylines, including shoulders, drainage gutters,
  curbs and major-road pavements;
- near building geometry (windows, doors, awnings, shop boards, roof details,
  capped upper-floor balconies, props) and a far massing mesh;
- street props (trees, lamps, stalls, benches, mixed vehicles, vendor umbrellas,
  display tables) seeded by chunk id, with market stalls clustered around real
  market POIs;
- a capped compound-wall pass around selected small houses, with a road-facing
  gate opening, piers and a partly open leaf; candidates are checked against
  buildings, roads and existing props before geometry is emitted. Compound
  walls/gates and balconies are visual-only and add no collision volumes.

Global waterway ribbons are built once from `water/waterways.json` and follow
their per-point DEM-derived levels. Quality changes remount the geo scene; low
quality uses only the far building mesh and disables shadows. The pack grid caps
the high tier (Nlongkak: 4 × 4 = 16 chunks; Mvog-Mbi: 3 × 3 = 9 chunks;
Mokolo: 3 × 2 = 6 chunks); over-cap plans keep a stable nearest-first subset
instead of reloading chunk sets each tick.

## Caching

- `files.json` is the byte catalog.
- `precache.json` is the initial offline set (global files + 3 × 3 around spawn
  for Nlongkak and Mvog-Mbi; all 6 chunks for Mokolo).
- The service worker stores responses in `yaounde-world-<worldVersion>`.
- Chunk fetches use the cache first and fall back to the network; older world
  caches are consulted if the current bucket misses a file.
