# Metropolitan Museum of Art

![Molen preview](preview.png)

Specific Metropolitan Museum of Art Fifth Avenue exterior: complete mapped irregular complex, three monumental recessed entrance arches and eight paired Corinthian columns, broad front stair, classical front wings/end pavilions, varied gallery roofs and rooflights, historic central core, rear polygonal Lehman wing, large sloping glazed Rockefeller and Dendur enclosures and American Wing court. Only the museum parent is replaced. Independent Central Park and Upper East Side buildings, streets and original terrain remain native. Existing photographic configuration; proposed Tang wing, temporary exhibitions/banners, copied inscriptions/artworks, furnished collection rooms and landscaping excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://www.metmuseum.org/perspectives/history-of-the-met)
- [Reference](https://commons.wikimedia.org/wiki/File:Metropolitan_Museum_of_Art_main_building,_5th_Avenue_entrance_04.jpg)
- [Reference](https://www.mountainsoftravelphotos.com/USA%20-%20New%20York%20City/07%20Central%20Park/slides/31B%20The%20Back%20Of%20The%20Metropolitan%20Museum%20Of%20Art%20From%20Central%20Park%20East%20Side%2082%20St.html)

Specific Metropolitan Museum of Art Fifth Avenue exterior: complete mapped irregular complex, three monumental recessed entrance arches and eight paired Corinthian columns, broad front stair, classical front wings/end pavilions, varied gallery roofs and rooflights, historic central core, rear polygonal Lehman wing, large sloping glazed Rockefeller and Dendur enclosures and American Wing court. Only the museum parent is replaced. Independent Central Park and Upper East Side buildings, streets and original terrain remain native. Existing photographic configuration; proposed Tang wing, temporary exhibitions/banners, copied inscriptions/artworks, furnished collection rooms and landscaping excluded.

## Model and axes

22,509 triangles; 67,527 vertices; 6 material groups; 2,704,964 bytes. Native bounds: -134.290, -4.195, -159.688 to 157.131, 28.491, 180.080. Source hash: `sha256:cefb98cd5ac443ee51d660c6e38fc4b46968594fec5be3ee439d51a8d8fb8c4e`.

{"x":"east","y":"up","z":"south"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=metropolitan_museum_of_art` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Specific Metropolitan Museum of Art Fifth Avenue exterior: complete mapped irregular complex, three monumental recessed entrance arches and eight paired Corinthian columns, broad front stair, classical front wings/end pavilions, varied gallery roofs and rooflights, historic central core, rear polygonal Lehman wing, large sloping glazed Rockefeller and Dendur enclosures and American Wing court. Only the museum parent is replaced. Independent Central Park and Upper East Side buildings, streets and original terrain remain native. Existing photographic configuration; proposed Tang wing, temporary exhibitions/banners, copied inscriptions/artworks, furnished collection rooms and landscaping excluded.
- Retained Q160236/relation3698894 and named native museum parent52776561832142 establish identity. Current standard PMTiles supplies a single39-point approximately305.7x189.7m outer footprint and unqualified26.8m height; it does not supply separate wing footprints. The retained undirected axis1.066209682834rad and ordinary photographs resolve positive internalX uptown/northeast and positiveZ toward Fifth Avenue. Anchor[-73.963549859,40.779486387]/world heading0/native east-south; wing subdivisions, roof forms and facade inventory are picture-led allocations clipped to the actual outer footprint, not mapped part controls.
- Native26.8m building height/28m elevation tags have unqualified datums. Working plaza floor-1.5093119261653207m relative to original anchor28.259306309605005m, entry3m above that plaza, classical front cornices22.4..26.8m, central historic roof30m, modern glazed wings18..26m and rear Lehman roof23m. These varied architectural heights, bays/columns/steps, rooflight and mullion inventories, ornament and facing are approximate visual allocations from ordinary photographs, not a survey or access/engineering certification. Shared opaque glazing approximates reflections and does not expose furnished galleries.
- Original standard6m Mapzen grid/roads/water and independent native buildings remain unchanged. Owned boundary samples span-3.6950338398745046..5.046267405826558m relative to anchor. Ground opening is limited to occupied museum and front stair surfaces present at every LOD; no Central Park precinct slab or flattening. Foundations extend from original boundary minimum into occupied bodies; coarse DEM at the park margins remains approximate. Detailed replacement uses99.5percent coverage, generalized tiles bounded area clipping. Failure retains original context; unloading restores terrain/water and disposes model geometry.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.
