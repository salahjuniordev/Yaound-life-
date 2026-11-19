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

The origin is the south-west corner of each pack's configured bbox projected to
UTM 32N. Nlongkak example:

```text
lon 11.512546690536405
lat 3.878000158820163
east 779036.8796419629
north 429056.09154497687
```

The Nlongkak bbox is `11.5126,3.8780,11.5305,3.8960`; the generated slice is
`1995.14 m × 1997.49 m`, split into 512 m chunks (4 × 4 = 16 chunks). Mvog-Mbi
uses bbox `11.5156,3.8445..11.5258,3.8583`, about `1,138 m × 1,530 m`, split into
3 × 3 chunks. Mokolo uses bbox `11.4929,3.8713..11.5040,3.8800`, about
`1,236 m × 966 m`, split into 3 × 2 chunks. Bastos uses bbox
`11.5039,3.8882..11.5168,3.8999`, about `1,437 m × 1,299 m`, split into 3 × 3
chunks. Ngoa-Ekelle uses bbox `11.4935,3.8505..11.5065,3.8625`, about
`1,449 m × 1,332 m`; Boulevard du 20 Mai uses bbox
`11.5125,3.8594..11.5215,3.8686`, about `1,003 m × 1,021 m`; Lac Municipal uses
bbox `11.5045,3.8600..11.5145,3.8700`, about `1,115 m × 1,110 m`; Mvan uses bbox
`11.5108,3.8170..11.5220,3.8282`, about `1,248 m × 1,243 m`; and Mont Febe uses
bbox `11.4840,3.9050..11.4960,3.9185`, about `1,338 m × 1,498 m`. Ngoa-Ekelle,
Lac Municipal, Mvan and Mont Febe are 3 × 3 grids; Boulevard du 20 Mai is a
2 × 2 grid. Every pack stores its own origin and bounds in its manifest.

## Elevation

- Source: Copernicus DEM GLO-30.
- The pipeline samples elevation in projected space, smooths it once, and
  subtracts each pack's local vertical offset (Nlongkak `713.3 m`; Mvog-Mbi
  `698.9 m`; Mokolo `717.1 m`; Bastos `726.6 m`; Ngoa-Ekelle `711.4 m`;
  Boulevard du 20 Mai `699.9 m`; Lac Municipal `707.1 m`; Mvan `679.2 m`; Mont
  Febe `762.7 m`).
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
