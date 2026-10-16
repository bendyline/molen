# St. Mary's Cathedral

![Molen preview](preview.png)

Individual medium-fi Tallinn St. Mary cathedral:off-white basilica with clerestory/aisle roofs,polygonal eastern choir/apse,western clock tower/two-bulb spire/open lantern,north rooms,connected south frontage with pedimented pointed entrance and east hip-roofed bay,mapped buttresses and minor choir roof lantern. Exact inscriptions/sculpture/tracery,full interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Tallinna_toomkirik.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Exterior_of_St_Mary%27s_Cathedral,_Tallinn.JPG)
- [Reference](https://news.err.ee/1609782225/st-mary-s-cathedral-in-tallinn-to-shine-brightly-thanks-to-newly-restored-roof)

Five existing 256-square lime plaster,raw limestone,standing-seam metal,copper and plain wood graphs. Off-white walls/pale stone frames,gray-brown main roofs,brown/burgundy two-bulb spire,restrained gold clocks/finial and flat blue-gray glazing. Metric UVs,hard architectural normals,no embedded images.

## Model and axes

7,625 triangles; 22,875 vertices; 8 material groups; 919,728 bytes. Native bounds: -29.419, -3.965, -22.935 to 29.315, 71.300, 24.432. Source hash: `sha256:c842f30e8c65be7ed9978e4712639082a03e347410a3722b1e67f874855ed038`.

{"x":"east toward polygonal choir","y":"up","z":"south toward pedimented entry frontage"}

Standard DEM datum 56.265474m;estimated common floor 2.3m clears sampled compound peak 1.911m and perimeter -3.61..1.29m. Foundations follow coarse hill terrain. Exact street/door thresholds,absolute altitude and certified walking unverified;no independent survey.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0354` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSM way26902813 matches current PMTiles main feature35184398991645 by the documented way-ID offset;21 current church building parts retain their unscaled plans and height tags. Current tower37m,lower octagonal roof43m and upper spire69m control total silhouette;old whole-building42m tag is retained as a conflicting coarse control. Other current20/28m aisle/clerestory,20m choir,12/11m north rooms and9..11m south frontage tags are interpreted as roof tops,with picture-led lower eaves/wall subdivisions. Exact eaves,bulb/lantern/cornice subdivisions and minor choir turret are estimates,not surveyed architecture.
- Standard DEM datum 56.265474m;estimated common floor 2.3m clears sampled compound peak 1.911m and perimeter -3.61..1.29m. Foundations follow coarse hill terrain. Exact street/door thresholds,absolute altitude and certified walking unverified;no independent survey.
- Exterior approximation from three useful ground/aerial pictures and standard PMTiles/DEM. Main/part height tags conflict and do not specify eaves:all lower wall/roof subdivisions,clock cornice,two bulb/lantern profiles,window and annex facade rhythms,minor choir turret, estimated entry steps/ramp over the coarse DEM and exact thresholds are picture-led estimates. Palette reflects inspected 2013/2015 and labeled 2023 images;later roof-restoration appearance is not independently verified. Exact inscriptions,clock numerals,tracery,sculpture and full interiors excluded. Certified walking and physical device timings pending.
- Skyline keeps mapped masses,main two-bulb spire,open four-post rectangular lantern and coarse small roof turret/buttresses. District adds shared graphs,flat windows/closed doors,clocks/cornices and octagonal round-arched lantern. Street opens real facade recesses and adds sparse mullions/lantern rails. Closeup/master refine curved facets,clock marks,frames and upper lantern ornament. Curvature,openings and ornament change visibly. Swedish-cottage neighbors are synthetic context,not local map buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
