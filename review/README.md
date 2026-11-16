# Single-view world review

`m8-single-view.html` and `m8-single-view.ts` render production world geometry
in a standalone Three.js scene. They are review tooling, not part of the game
bundle.

Start the normal dev server and open the page with a `view` query parameter:

```sh
npm run dev -- --port 5174
# http://127.0.0.1:5174/review/m8-single-view.html?view=spawn-road
```

Supported views:

- `spawn-road`, `spawn-top`
- `compound`, `compound-top`, `compound-oblique`
- `balcony`
- `market`
- `parking`, `parking-top`
- `bridge`, `bridge-top`

The harness loads `public/world/v1` through the production `loadChunk` API and
uses `buildTerrainGeometry`, `buildRoadGeometry`, `buildBuildingGeometry` and
`buildPropsGeometry` at the `high` tier. It also uses the production
`roadsForChunk` clip so the evidence matches the game's cross-chunk road path.
The fixed camera positions target an actually placed compound gate, a parking
bay and the OSM bridge in the Nlongkak pack.

The page exposes `window.__m8SingleView` with the loaded chunks, rendered
triangle count and draw-call count. The screenshot runner used for review is
outside the repository; captured PNGs and JSON summaries live under the review
environment's `yaounde-probe/` directory.
