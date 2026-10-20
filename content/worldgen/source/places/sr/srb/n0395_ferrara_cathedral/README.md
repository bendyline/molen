# Ferrara Cathedral

![Molen preview](preview.png)

Individual Ferrara Cathedral medium-fi exterior:triple-peaked marble arcade/rose facade and projecting two-stage protyrus,long brick body with three raised transverse roofs,rounded eastern apse,continuous southern shop range and separate striped Renaissance campanile. Four budgeted levels and shared textures. Fine sculptural program,shop branding,temporary works,interiors and engineering are excluded or approximate.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Cattedrale_di_San_Giorgio_a_Ferrara.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ferrare_-_D%C3%B4me_-_Ext%C3%A9rieur.jpg)

Five existing cached256-square brick,ashlar,continuous limestone,ceramic tile and plain wood graphs serve seven merged groups.Linear tints,metric UVs,flat architectural normals.No embedded images,reference-photo textures,unique facade maps or baked lighting.

## Model and axes

30,986 triangles; 92,958 vertices; 7 material groups; 3,722,540 bytes. Native bounds: -62.270, -1.515, -21.980 to 60.850, 45.400, 29.480. Source hash: `sha256:fb3f9caea02b2488fd1cf2cc0a4b8f9c273fbe77af93caa688278614f8503bb3`.

{"x":"east-southeast toward choir/apse","y":"up","z":"south-southwest toward shop row and campanile"}

Standard viewer DEM datum17.206994 m, raw control perimeter-1.16..0.19 m. Estimated floor0.4 m; footings crossY=0 and extend below samples. No flattening,host DEM change or road replacement. Exact pavement/door joins,base clipping,absolute altitude and walking remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0395` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Whole height21 m and roof:height7 m retained as lower body/eave21 m and ordinary tile ridge28 m. Current parts30 m control the three front gable peaks;29 m parts control three broad transverse roofs and long choir/apse roof;34/35 m inset parts control the raised central roof monitors. Their roof-wall split is estimated: transverse eaves21 m, monitor eaves29 m, apse eaves26 m. Separate mapped campanile45 m is its adopted total above the estimated0.4 m floor. Four tower-stage boundaries10/21/32/45 m, round/pointed aperture partitions and local facade/porch heights are picture estimates, with unverified part datums. Shop8 m height is retained for its mapped western control; extension of the shop row along the south side is picture-led. No independent dimension facts or horizontal rescale.
- Standard viewer DEM datum17.206994 m, raw control perimeter-1.16..0.19 m. Estimated floor0.4 m; footings crossY=0 and extend below samples. No flattening,host DEM change or road replacement. Exact pavement/door joins,base clipping,absolute altitude and walking remain unverified.
- Medium-fi exterior from two actually inspected western and southern2024/2009 photographs and standard viewer PMTiles/DEM only.Fine sculpture,saints/lions,relief panels,tracery lobes,inscriptions,shop branding,hidden roof partitions,full interiors/bells and engineering are approximate or excluded.Tower top partly cropped in side reference;flat completion follows the visible unfinished square stage.Temporary works omitted.Current finish and exact host-ground joins unverified.Physical laptop/phone timing pending.
- Skyline retains triple-gable front,projecting porch,tower air/flat cap,long shop/brick body,raised transverse roofs and round apse.District adds shared surfaces,selected galleries/doors and tower-stage rhythm.Street adds fuller arcades,recessed glazing/doors,actual open protyrus and triple belfry apertures.Closeup/master refine nested surrounds,slender columns and gable arcade rhythm.Regional neighbors are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
