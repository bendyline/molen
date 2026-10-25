# Sarlat Cathedral

![Molen preview](preview.png)

Individual medium-fi Sarlat exterior: irregular mapped aisles/chapels and attached south range; oblique high nave and polygonal choir; tall pointed glass, open flying buttress arches, round stair turret; Romanesque tower-porch with rectangular timber portal, blind arches, triple lights, paired louvered belfry lights, small clock and layered slate bulb roof/open lantern. Five shared texture graphs, four browser LODs. Fine sculpture and interiors simplified or excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Clocher_saint-Sacerdos_Sarlat.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Sarlat_-_Ancienne_cath%C3%A9drale_Saint-Sacerdos_-_PA00082916_-_011.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Cath%C3%A9drale_Saint-Sacerdos_de_Sarlat_-_Vue_du_Chevet.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Sarlat-la-Can%C3%A9da_-_Cath%C3%A9drale_Saint-Sacerdos_-_Clocher-porche_-4.jpg)

Five existing shared 256-square ashlar, sandstone, slate, plain wood and painted metal graphs serve six groups including local blue-grey glass. Linear tints, metric UVs and flat architectural normals. No embedded images, unique facade photographs, baked lighting or micro-carving.

## Model and axes

8,957 triangles; 26,871 vertices; 6 material groups; 1,078,564 bytes. Native bounds: -33.719, -1.168, -24.988 to 32.652, 51.500, 25.100. Source hash: `sha256:7969653a3eb8f566c9b0de0f8a1970d7681b9879b54fb7e32ba3fbc981a4ab7d`.

{"x":"generally east toward choir","y":"up","z":"generally south toward attached range"}

Standard viewer DEM datum 148.174833 m; selected raw perimeter -0.82 to 1.31 m. Floor 0.5 m; adaptive footings cross Y=0 and extend below retained samples. No terrain cutout or flattening. Exact parvis, steps, east terrace, door/base joins, absolute altitude and walking remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=sarlat_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way/376197270 and Q2942447 identify Cathédrale Saint-Sacerdos. Current standard viewer PMTiles whole 35184748286102 and roof part 35185096439581 plus two small unlabeled touching north projections provide 130 raw outline points. The small projections are interpreted as exterior buttress feet, not independently identified buildings. Preserve the original anchor and heading -0.322408167209 rad. The high nave follows its oblique mapped roof within this native frame: longitudinal positive toward the northeast choir, negative toward the southwest tower-porch. Do not rotate the nave to native X or relocate it to the older reference POI. Separate neighboring town houses and the Lanterne des Morts remain host content.
- No height, level or roof-height tags and no independent dimension facts. All heights are picture estimates above floor 0.5 m: low aisles and radiating chapels 10.5 m eaves / 13.5 m upper joins; high nave and polygonal choir 21 m eaves / 26 m ridge. Tower square body 30 m, flared lower slate cap 36.2 m, pinched upper bulb 44.3 m, open lantern 47.5 m, little cap 49.6 m and weather vane 51 m. Stair turret 23 m wall / 26.7 m cone. Internal component divisions, openings, flying buttresses, roof profiles, clock and simplified sculpture are estimates rather than measured architectural plans.
- Standard viewer DEM datum 148.174833 m; selected raw perimeter -0.82 to 1.31 m. Floor 0.5 m; adaptive footings cross Y=0 and extend below retained samples. No terrain cutout or flattening. Exact parvis, steps, east terrace, door/base joins, absolute altitude and walking remain unverified.
- Four inspected photographs and standard viewer PMTiles guide an approximate medium-fi exterior. All heights and detailed component partitions estimated. Fine tracery, sculpture, current finish, bells/interiors, engineering and exact host-ground contact simplified or unverified. Stair slits are shallow surface marks. Paired belfry lights retain dark louver panels; only the little top lantern is open. Synthetic Cotswold cottages are style fixtures, not a reconstruction of Sarlat. Physical phone/laptop timing pending.
- Skyline retains the oblique high choir, irregular low chapel envelope, porch tower, two-stage bulb roof/open lantern and round stair turret. District adds shared surfaces, paired/triple belfry lights, clerestory/choir recesses, blind tower arches and flying buttresses. Street adds chapel lancets, mullions, louvers and buttress finials. Close-up/master retain sparse portal sculpture abstractions and the small clock.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.
