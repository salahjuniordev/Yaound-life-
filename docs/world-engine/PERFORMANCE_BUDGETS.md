# Performance Budgets

Budgets are enforced by `npm run size` on the production build. Runtime targets
are instrumented, but real-device measurements are still pending.

## Bundle and asset budgets

| Check | Budget | Current |
| --- | --- | --- |
| JS total (gzip) | 620 KB | 579,007 B |
| CSS total (gzip) | 24 KB | 8,625 B |
| HTML total (gzip) | 5 KB | 1,815 B |
| First load JS+CSS+HTML (gzip) | 1 MB | 589,447 B |
| World assets raw | 12 MB | 8,808,536 B |
| World assets gzip | 6 MB | 1,481,539 B |

The deployed world tree is 192 files: Nlongkak has 90 catalog files plus
`files.json`/`precache.json` (92 files), Mvog-Mbi has 55 catalog files plus those
two metadata files (57 files), Mokolo has 40 catalog files plus those two
metadata files (42 files), and `registry.json` is shared. The size check sees
all 192 under `dist/world/`.

## Quality tiers

| Tier | Chunk radius | Max loaded chunks | Shadows | Building detail |
| --- | --- | --- | --- | --- |
| low | 0 (1 × 1) | 5 | off | far mesh only |
| mid | 1 (3 × 3) | 10 | off | near + far |
| high | 2 (5 × 5) | 16 | on | near + far |

Nlongkak has 16 chunks, Mvog-Mbi has 9 and Mokolo has 6; high can load each
whole slice. Chunks outside the keep radius are evicted first; the LRU never
evicts an in-flight load.

## Runtime LOD

- Building near detail (windows, doors, awnings, shop boards, roof details,
  props) is used within roughly 560 m; far massing beyond that.
- Street props (trees, lamps, stalls, vehicles, benches, utility poles, wires,
  street signs, shrubs) are culled beyond roughly 760 m. Market clusters and
  utility pairs are capped by the same per-chunk prop budget (1/2/3 pole pairs
  for low/mid/high).
- Frontage detail is split between the existing near meshes and is capped per
  chunk: compound wall assemblies are 0/4/8 and upper-floor balconies are
  0/5/10 for low/mid/high. Each balcony uses a slab, a framed opening, an open
  metal rail with seven balusters, two side rails and two brackets. Compound
  candidates are limited to small houses with 4–8 footprint vertices and
  70–420 m² area; a gate opening faces the nearest road. Walls, gate piers and
  leaves are visual-only and do not add collision volumes. Vendor umbrellas/display tables are 2 per market cluster and one
  possible roadside stand per sampled road point, all inside the normal prop
  budget.
- The renderer clips the global road network to each loaded chunk and rebuilds
  it against that chunk's heightfield. Long segments are subdivided at 10/16/24
  m for high/mid/low and wide carriageway/shoulder surfaces are split laterally
  at roughly 4 m, so a long flat quad cannot be buried under a hill. This raises
  the static high-tier road count, but it fixes missing/buried cross-chunk
  roads without regenerating the pack.
- Road drainage gutters, curbs and pavements are part of the road mesh, so they
  scale with road length rather than prop budget; quality changes subdivision
  and disk segment counts.
- Bridge decks, parapets, abutments and ramps are part of the road mesh for the
  six OSM bridge ways; they do not consume the prop budget. The shared height
  sampler loops over those six ways per terrain query, not all 426 roads.
- A production-loader high-quality pass over the 16-chunk pack measured 640,576
  building triangles after the review-driven open balcony rail (619,456 before
  that correction, +21,120 or 3.4%), 102,550 prop triangles and 157,182 road
  triangles, with 128 compounds/gates, 86 vendor umbrellas/display tables, 18
  parking bays and 36 parked vehicles. These are geometry counts, not rendered
  frame measurements. The live software-Mesa frame at the spawn reported
  736,857 rendered triangles and 92 draw calls; the live frame at the actual
  compound gate reported 944,258 triangles and 94 draw calls.
- Terrain meshes always use the fine 8 m heightfield; quality changes props,
  shadows and draw distance.
- Data saver lowers quality and crowd density where supported.

These are code-level thresholds, not measured device guarantees.

## Instrumentation

`src/render/geo/metrics.ts` publishes:

- `fps`, `frameMs`
- `loadedChunks`, `activeBuildings`
- `triangles`, `drawCalls`, `geometries`, `textures`

Enable the overlay with `?debug=world` or
`localStorage.setItem('yaounde-world-debug', '1')`. The overlay updates once per
second and is hidden by default.

## Measurement procedure

1. Build and serve the production app on the target device.
2. Enable the overlay and walk through dense areas (markets, main roads).
3. Record FPS, frame time, draw calls, triangles and chunk count for low/mid/high.
4. Repeat with the network offline and the full pack downloaded.
5. Record first playable time and download time on a typical connection.

## Known gaps

- No real low-end Android measurement has been recorded in this repository.
  The only current runtime frame is Chromium + Mesa llvmpipe Vulkan at about 4
  FPS, which is software rendering and not a device target.
- No automated frame-time regression test; only bundle/asset budgets are CI-safe.
- No explicit triangle/draw-call cap is enforced in CI. The high-tier static
  geometry is about 900k triangles across all 16 chunks before terrain, crowd,
  water and shadow passes; device measurements should decide whether the road
  subdivision or building detail needs a lower tier.
- Shadows and near building detail are the first things to disable if a device
  misses the frame target.
