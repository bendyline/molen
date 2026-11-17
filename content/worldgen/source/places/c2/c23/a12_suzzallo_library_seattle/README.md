# Suzzallo Library, Seattle — A12

Collegiate Gothic library on Red Square: the 1926 west wing with eleven tall pointed stained-glass windows between brick buttresses topped by terra-cotta figures and stone pinnacles, three west portals, a pierced cast-stone parapet, end oriels and a slate gable with copper cresting; the angled 1935 south wing in the same dress; and the 1963 concrete-and-glass east wing.

Built by `content/worldgen/source/places/c2/c23/a12_suzzallo_library_seattle/models/generate-suzzallo-library.mjs` with the shared emitter
`packages/worldgen/scripts/place-master-emitter.mjs`: 12127 triangles,
8 materials, no embedded bitmaps. The runtime asset is `molen.worldgen.structure.a12_suzzallo_library_seattle`; its runtime
levels come from the landmark LOD generator after import.

## Frame

`footprint.json` holds the mapped outlines this recipe follows, already in the model frame: +X
along heading -1.744416 rad from the anchor [-122.308078, 47.655779], +Y up from the
ground there (45.58 m). The placement in
`content/earth/source/placements` uses the same anchor and heading.

## Dimensions

- Plan: the mapped OSM building 52776561088698 and its parts 35185476291734 (west wing), 35185476291733 (east wing) and 35185476291732 (lobby) (footprint.json)
- Graduate Reading Room on the west front is 250 ft long, 52 ft wide and 65 ft high; its tall leaded windows hold 35 ft stained-glass panels (https://en.wikipedia.org/wiki/Suzzallo_Library)
- Eleven 36 ft pointed-arch windows separated by brick and terra-cotta buttresses; 18 terra-cotta figures in niches atop buttresses capped with pinnacles; three cast-stone figures over the three west portals (https://lib.uw.edu/suzzallo/visit/tour)
- Sandstone, precast stone, terra cotta and brick walls under a slate roof with copper decorative grillwork (https://sah-archipedia.org/node/79313)
- West wing 1926, south wing 1935, modernist concrete-and-glass east wing 1963 (https://en.wikipedia.org/wiki/Suzzallo_Library)

## Limitations

- Eave, ridge and floor heights are estimated from the reading-room height and photographs; the mapped height (20 m) is a roof-line approximation.
- Window tracery is reduced to mullions and transoms; figures are blocky stand-ins at medium-fi scale; coats of arms are plain shields.
- The south wing is a straight 13.5 m wing on the mapped centreline; its end bays and the 1963 wing elevations are simplified.
- The separate Allen Library (1990) to the north is not part of this model.
- Original deterministic geometry from mapped footprints, published dimensions and general knowledge of the building; not a survey, photogrammetric reconstruction or replica of any third-party model. No photographs or generated bitmaps are embedded.

## Rebuild

```sh
node content/worldgen/source/places/c2/c23/a12_suzzallo_library_seattle/models/generate-suzzallo-library.mjs          # add --check to verify
```
