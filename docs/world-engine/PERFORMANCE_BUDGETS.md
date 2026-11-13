# Performance Budgets

Budgets are enforced by `npm run size` on the production build. Runtime targets
are instrumented, but real-device measurements are still pending.

## Bundle and asset budgets

| Check | Budget | Current |
| --- | --- | --- |
| JS total (gzip) | 620 KB | 568,466 B |
| CSS total (gzip) | 24 KB | 8,622 B |
| HTML total (gzip) | 5 KB | 1,815 B |
| First load JS+CSS+HTML (gzip) | 1 MB | 578,903 B |
| World assets raw | 12 MB | 5,402,073 B |
| World assets gzip | 6 MB | 853,458 B |

The world pack is 90 catalog files plus `files.json`/`precache.json`; the size
check sees 92 files under `dist/world/`.

## Quality tiers

| Tier | Chunk radius | Max loaded chunks | Shadows | Building detail |
| --- | --- | --- | --- | --- |
| low | 0 (1 × 1) | 5 | off | far mesh only |
| mid | 1 (3 × 3) | 10 | off | near + far |
| high | 2 (5 × 5) | 16 | on | near + far |

The pack has only 16 chunks, so high can load the whole slice. Chunks outside
the keep radius are evicted first; the LRU never evicts an in-flight load.

## Runtime LOD

- Building near detail (windows, doors, awnings, shop boards, roof details,
  props) is used within roughly 560 m; far massing beyond that.
- Street props (trees, lamps, stalls, vehicles, benches) are culled beyond
  roughly 760 m. Market clusters are capped by the same per-chunk prop budget.
- Road drainage gutters, curbs and pavements are part of the road mesh, so they
  scale with road length rather than prop budget; quality only changes disk
  segment counts.
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
- No automated frame-time regression test; only bundle/asset budgets are CI-safe.
- Shadows and near building detail are the first things to disable if a device
  misses the frame target.
