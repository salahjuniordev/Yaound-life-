# Licensing and Attribution

This file is a practical summary, not legal advice. The machine-readable source
record is `public/world/v1/licenses.json` and `manifest.sources`.

## OpenStreetMap

- Data: OpenStreetMap Cameroon extract, snapshot 2026-10-30.
- Licence: ODbL 1.0.
- Attribution: `Map data © OpenStreetMap contributors, ODbL 1.0`.
- Derived data (clipped roads, buildings, water polygons, waterway lines, POIs,
  boundary) is distributed under the same obligations. Keep attribution visible
  in the product and in redistributed data.
- Do not imply OSM endorses Yaoundé Life.

## Copernicus DEM GLO-30

- Data: Copernicus DEM GLO-30, tile `N03_00_E011_00`.
- Attribution: `Elevation © ESA, Copernicus DEM GLO-30`.
- Used under the Copernicus DEM licence terms. Keep the attribution in the
  product and in `licenses.json`.

## Google Open Buildings V3

Not used. The pack contains no Open Buildings geometry, so its licence and
attribution terms do not apply. See `GEOGRAPHIC_DATA_SOURCES.md` for the blocker
and the requirements for adding it later.

## Gameplay content

Districts, fictional businesses, NPC schedules, missions and place mappings are
original game content. They are not claims about real people, businesses or
addresses. In geographic mode, places are labelled as gameplay locations and
mapped near real roads.

## Attribution placement

- Settings → About/attribution shows the OSM and Copernicus lines.
- `docs/WORLD.md` and `README.md` carry the same lines.
- `licenses.json` is shipped with the world pack.
- The service worker caches `licenses.json` in the initial pack.

## Redistribution checklist

1. Keep `manifest.json`, `licenses.json` and `docs/world-engine/` with the pack.
2. Keep the attribution text visible or reachable in the UI.
3. Do not add a source without recording its licence and snapshot.
4. Do not remove provenance fields from generated features.
5. Re-run `npm run world:validate` after any data change.
