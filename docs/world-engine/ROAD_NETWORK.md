# Road Network

Roads come from OSM ways tagged `highway`. They are clipped to the world bbox,
validated, assigned a gameplay class and width, and split across chunks. The
current packs have 426 clipped Nlongkak road pieces, 224 Mvog-Mbi road pieces
and 100 Mokolo road pieces.

## Classes and widths

| Class | Default width (m) | Walkable |
| --- | --- | --- |
| motorway | 14 | no |
| trunk | 12 | no |
| primary | 11 | yes |
| secondary | 9 | yes |
| tertiary | 8 | yes |
| unclassified | 7 | yes |
| residential | 6.5 | yes |
| service | 4.5 | yes |
| living_street | 6 | yes |
| pedestrian | 4 | yes |
| footway | 2.2 | yes |
| path | 1.8 | yes |
| cycleway | 2.4 | yes |
| steps | 2 | yes |
| track | 3 | yes |
| roundabout | 7 | yes |

Explicit `width` tags override the default and mark `widthStatus: real`;
otherwise the width is `inferred`. `access=private` and `foot=no` make a road
non-walkable.

## Processing

1. Collect `highway` ways and their node IDs.
2. Convert each line to game coordinates.
3. Clip polylines to the bbox.
4. Classify (`roundabout` wins when `junction=roundabout|circular`).
5. Validate: at least 2 points, finite coordinates, positive length.
6. Assign the midpoint to a chunk and store the clipped piece. This is pack
   ownership for data loading, not a guarantee that the rendered way stops at
   the chunk boundary; long ways can extend into a neighbour.
7. Keep OSM node IDs when the clipped piece preserves every original node.

## Graph and connectivity

`buildRoadGraph` creates nodes keyed by OSM ID (or a 0.25 m coordinate bucket)
and edges for each segment. Edges record length, class, oneway and walkability.
The graph supports nearest-node queries and shortest-path routing for gameplay
and NPC placement. Shared OSM nodes connect ways across the network.

## Rendering

- The renderer loads the global `roads/network.json` and clips it to each
  loaded chunk before building a ribbon. It uses the local chunk heightfield,
  not the midpoint-owning chunk's terrain. This is required because a way stored
  in one chunk can cross into a neighbour; without clipping it can disappear or
  sit below the neighbouring terrain. Bridges stay whole and belong to the
  chunk containing the midpoint so decks and parapets are not cut.
- Road ribbons are built per chunk from the clipped polylines and terrain
  height. Long segments are subdivided along their length and wide surfaces
  across their width so the ribbon follows terrain undulations.
- Vehicle roads add a shoulder, an open drainage gutter and a curb; trunk,
  primary, secondary and tertiary roads also get a pavement strip with periodic
  gutter crossings. Gutter/pavement geometry is visual detail inferred from the
  road class, not mapped infrastructure.
- Widths are in metres; sidewalks/kerbs are visual additions, not separate data.
- Six OSM bridge ways get a raised deck, side fascia, concrete parapets,
  abutments, approach ramps and a major-road centre marking. The shared
  `bridgeSurfaceAt` sampler feeds the player/crowd/camera height so the deck is
  walkable; the normal road ribbon remains underneath for continuity.
- Tunnels are tagged but not cut into terrain and do not get a portal mesh.
- Bridge parapets are visual only: there is no collision volume, fall model or
  underpass traversal.
- Roundabouts follow the real circular geometry; no invented junction meshes are
  placed where OSM has none.
- Road collision/query uses the road index, not the rendered ribbon.

## Known limits

- No lane-level data, turn restrictions, live closures or traffic.
- Footpaths are walkable but not rendered as a separate pedestrian network.
- Some OSM ways may be split at chunk boundaries; renderer-clipped pieces after
  the first piece include a `#<n>` suffix. The first clipped piece keeps the
  original ID so normal way lookups and saves are unaffected.
