# Coordinate System

The world uses WGS 84 / UTM zone 32N (`EPSG:32632`) for all metric calculations.
No Web Mercator metres are used for geometry, distances or collision.

## Axes

| Space | x / east | y | z / north |
| --- | --- | --- | --- |
| Geographic | longitude | elevation | latitude |
| Projected | easting (m) | elevation (m) | northing (m) |
| Game | east (m) | local elevation (m) | **south** (m) |

Game `z` increases south so the scene matches Three.js' right-handed view with
`y` up. This means:

```text
x = (east - origin.east) * unitsPerMetre
z = -(north - origin.north) * unitsPerMetre
```

and the inverse:

```text
east  = x / unitsPerMetre + origin.east
north = -z / unitsPerMetre + origin.north
```

`unitsPerMetre` is currently `1`, so one game unit is one metre. The field exists
so the scale can change without rewriting the renderer.

## Origin

The origin is the south-west corner of the configured bbox projected to UTM 32N:

```text
lon 11.512546690536405
lat 3.878000158820163
east 779036.8796419629
north 429056.09154497687
```

The bbox is `11.5126,3.8780,11.5305,3.8960`. The generated slice is
`1995.14 m × 1997.49 m`, split into 512 m chunks (4 × 4 = 16 chunks). Bounds are
stored in the manifest in both projected and game coordinates.

## Elevation

- Source: Copernicus DEM GLO-30.
- The pipeline samples elevation in projected space, smooths it once, and
  subtracts a local vertical offset (currently `713.3 m`).
- `localHeight = max(0, elevation - verticalOffset)`.
- `verticalScale` is `1`; `verticalOffset` is stored in the manifest so absolute
  elevation can be reconstructed.
- Water levels are stored relative to the same offset.
- The renderer and collision use local height; no absolute elevation is used in
  gameplay.

## Chunk indexing

```text
ix = floor((east - origin.east) / chunkSize)
iz = floor((north - origin.north) / chunkSize)
id = `c_${ix}_${iz}`
```

Because game `z` is south-positive, the chunk's game bounds are:

```text
minX = ix * chunkSize
maxX = (ix + 1) * chunkSize
minZ = -(iz + 1) * chunkSize
maxZ = -iz * chunkSize
```

Chunk keys and bounds are tested in `test/chunks.test.ts`. Adjacent chunk
heightfields are required to share identical edge samples
(`test/terrain.test.ts`).

## Conversion API

Use `WorldTransform` from `src/world/transform.ts`:

- `gameFromLonLat`, `lonLatFromGame`
- `gameFromProjected`, `projectedFromGame`
- `metresToGame`, `gameToMetres`
- `project`, `unproject`

Do not hand-roll conversions in renderer or gameplay code. Tests compare the UTM
implementation against known reference points and verify round trips.
