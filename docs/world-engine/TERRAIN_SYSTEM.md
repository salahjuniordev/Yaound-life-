# Terrain System

Terrain is derived from Copernicus DEM GLO-30 and sampled in EPSG:32632. It is
gameplay geometry, not a survey product.

## Pipeline

1. Decode the Copernicus tile `N03_00_E011_00`.
2. For each fine grid point (8 m spacing), convert game → projected → lon/lat
   and sample the DEM.
3. Smooth the fine field once with a 3 × 3 kernel.
4. Subtract `verticalOffset` (currently 713.3 m) and clamp to ≥ 0.
5. Build a `YLT1` heightfield per 512 m chunk.
6. Sample the fine field at 16 m spacing to create the coarse gameplay field.
7. Write the global coarse field and per-chunk fine fields.

Current counts: 62,750 terrain samples, 16 chunks.

## Sampling

`heightAt` performs bilinear interpolation:

```text
fx = (x - originX) / cellSize
fz = (z - originZ) / cellSize
clamp to [0, width-1] × [0, height-1]
interpolate the four surrounding samples
```

The player, props and buildings use the fine chunk field when loaded, falling
back to the coarse global field. Chunk edges share identical samples because all
fields come from the same global field (tested).

## Rendering

- Chunk terrain meshes are built from the fine heightfield.
- Material is low-poly with flat shading and a restrained palette.
- Quality controls shadows and prop density, not terrain resolution.
- Water polygons are rendered at their stored relative level, slightly below the
  minimum terrain edge to avoid z-fighting.
- Waterway ribbons are rendered slightly above their per-point DEM surface so
  streams remain visible without carving the terrain.
- No runtime terrain deformation; the world is static.

## Vertical scale

`verticalScale = 1` and `verticalOffset = 713.3`. Absolute elevation is
`verticalOffset + localHeight`. Keep both in the manifest when changing terrain
generation; do not hard-code 713.3 in runtime code.

## Water

- Two OSM water polygons are included.
- Water level is `max(0, min terrain edge - 0.15)` per feature, relative to the
  same offset.
- 35 OSM waterway lines (5 rivers, 29 streams, 1 drain; 5,868 m) are rendered as
  narrow ribbons. Each point stores a DEM-derived surface height and the
  renderer lifts the ribbon 0.12 m above it. There is no flow simulation,
  channel carving or separate bridge geometry.

## Known limits

- GLO-30 is ~30 m source data; 8 m sampling does not add real detail.
- Smoothing removes small terrain features and is not hydrologically exact.
- Buildings are grounded to terrain but not cut into slopes.
- No erosion, vegetation masks or seasonal water changes.
