# Licensing and Attribution

This file is a practical summary, not legal advice. The machine-readable source
records are `public/world/v1/licenses.json`,
`public/world/mvog-mbi/v1/licenses.json`,
`public/world/mokolo/v1/licenses.json`,
`public/world/bastos/v1/licenses.json`, and each pack's `manifest.sources`.

## OpenStreetMap

- Data: OpenStreetMap Cameroon extract, snapshot 2026-10-30.
- Licence: ODbL 1.0.
- Attribution: `Map data © OpenStreetMap contributors, ODbL 1.0`.
- Derived data (clipped roads, buildings, water polygons, waterway lines, POIs,
  boundaries) in all four packs is distributed under the same obligations.
  Keep attribution visible in the product and in redistributed data.
- Do not imply OSM endorses Yaoundé Life.

## Copernicus DEM GLO-30

- Data: Copernicus DEM GLO-30, tile `N03_00_E011_00`.
- Attribution: `Elevation © ESA, Copernicus DEM GLO-30`.
- Used under the Copernicus DEM licence terms. Keep the attribution in the
  product and in `licenses.json`.

## Google Open Buildings V3

Not used in any current pack. None of the shipped packs contains Open Buildings
geometry, so its licence and attribution terms do not apply to the Nlongkak,
Mvog-Mbi, Mokolo or Bastos packages.
See `GEOGRAPHIC_DATA_SOURCES.md` for the blocker and the opt-in import contract.

If an export is added later, the importer accepts either licence Google
publishes for Open Buildings V3:

- Creative Commons Attribution 4.0 (`CC-BY-4.0`), or
- Open Data Commons Open Database License 1.0 (`ODbL-1.0`).

The chosen licence, snapshot date and attribution must be written into
`manifest.json` and `licenses.json`, and retained on every imported building.
The attribution must name Google Open Buildings. Because the pack already
contains ODbL-derived OSM data, the chosen Open Buildings licence and the
resulting database obligations need legal review before redistribution; the
importer enforces source/licence provenance but is not a legal opinion.

Open Buildings footprints are machine-generated. They must be confidence
filtered, deduplicated against OSM, and never used to replace OSM geometry
silently.

## Gameplay content

Districts, fictional businesses, NPC schedules, missions and place mappings are
original game content. They are not claims about real people, businesses or
addresses. In geographic mode, places are labelled as gameplay locations and
mapped near real roads.

## Attribution placement

- Settings → About/attribution shows the OSM and Copernicus lines.
- `docs/WORLD.md` and `README.md` carry the same lines.
- `licenses.json` is shipped with each world pack.
- The service worker caches `licenses.json` in the initial pack.

## Redistribution checklist

1. Keep `manifest.json`, `licenses.json` and `docs/world-engine/` with the pack.
2. Keep the attribution text visible or reachable in the UI.
3. Do not add a source without recording its licence and snapshot.
4. Do not remove provenance fields from generated features.
5. Re-run `npm run world:validate` after any data change.
