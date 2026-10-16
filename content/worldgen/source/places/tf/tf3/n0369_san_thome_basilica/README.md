# San Thome Basilica

![Molen preview](preview.png)

Individual San Thome Basilica, Chennai: white Gothic nave with triple pointed west portals/upper windows and gable, tall west-south offset tower with stepped pointed fields, octagonal upper stage and long white faceted needle/cross, smaller crossing spire, red tiled roofs, tall transept and three eastern fingers/chapels. Repeated stepped buttresses/pinnacles and two tiers of pointed side fields. Four budgeted browser levels, shared plaster/limestone/tile/wood, linear tints and metric UVs. Standard terrain foundations. Exact statues/reliefs/inscriptions, carved/parapet tracery, stained-glass artwork, full interior/crypt, liturgical column, flags, fences/palms/parking, adjoining town, surveyed paving/thresholds and walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Front_side_of_San_Thome_Basilica_-_Chennai.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:San_Thome_Basilica_-_Chennai_Lateral_Image.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Santhome_spire_and_church_sideview.jpg)

Four existing shared256-square lime plaster/limestone/flat tile/plain wood graphs. Off-white/red linear tints, metric UVs and flat normals; window/louvre/oculus fields use flat geometric PBR colors. No embedded images, bespoke facade textures or baked shadows.

## Model and axes

8,447 triangles; 25,341 vertices; 5 material groups; 1,016,912 bytes. Native bounds: -33.063, -1.772, -17.851 to 33.392, 45.900, 17.856. Source hash: `sha256:5480b8db6dc807180c25f06f88e56cf9dbcf86cc927f71919b303e72b85e1159`.

{"x":"east-southeast from west portals to eastern choir","y":"up","z":"south-southwest toward offset west tower"}

Standard viewer DEM datum 12.720526m; display offset 0.4m, raw mapped perimeter terrain -1.42..1.24m. Side-only foundations follow coarse terrain, doorway floor+0.2m is an estimate. Exact courtyard paving, entry steps/thresholds, absolute altitude and walking unverified. No global flattening or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0369` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact-QID way1115403900/Q733577 matches current PMTiles main35185487492732. Its30-vertex raw outline/tags retain height8m and absent min_height. The8m whole-building tag is inconsistent with the pictured spires and high nave; it is retained as coarse map metadata, not used as an overall roof or spire limit. No surveyed dimensions are retained. All heights are picture estimates: nave/choir/transept eave14.5m, nave ridge19.5m/transept19.5m/choir18.5m, lower chapel wall8m/roofs10.5m, west-south tower square20m/octagon29m/needle44.4m/cross45.5m, smaller crossing tower22m/needle26.4m/cross27.4m. Raw outline rotates rigidly; internal subplans and Boolean inputs quantized0.1mm subdivide/approximate it without rescale. Rear chapel/roof joins, north fenestration, carving and thresholds remain approximate.
- Standard viewer DEM datum 12.720526m; display offset 0.4m, raw mapped perimeter terrain -1.42..1.24m. Side-only foundations follow coarse terrain, doorway floor+0.2m is an estimate. Exact courtyard paving, entry steps/thresholds, absolute altitude and walking unverified. No global flattening or road replacement.
- Medium-fi exterior from three inspected front/reverse-side/elevated pictures and standard viewer PMTiles/DEM only. Heights, internal subplans/roof joins, north facade and thresholds are approximate. Exact statues/reliefs/text, tiny tracery/parapets, stained-glass art, liturgical column, full interiors/crypt, flags/fences/palms/parking/town and surveyed paving/steps/walking excluded. Oculi are framed flat geometric disks; upper tower fields use closed dark backing rather than verified bell-room interiors. Physical device timing pending.
- Skyline keeps the offset main tower/needle, smaller crossing spire, west pinnacles and roof/chapel form with open porch. District adds shared surfaces, flat pointed facade fields and coarser buttress/pinnacle rhythm. Street opens door/window/porch recesses and adds large mullions; closeup/master refine arch surrounds/tracery and pinnacle facets. Synthetic neighbors are review fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
