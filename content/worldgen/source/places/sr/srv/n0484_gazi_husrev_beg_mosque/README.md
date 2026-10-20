# Gazi Husrev-beg Mosque

![Molen preview](preview.png)

Individual Gazi Husrev-beg Mosque exterior: retained stepped plaster/stone envelope,tall domed central hall,rear and two side domes,five-cupola open pointed porch with stone columns and green collars,opaque windows and timber doors,an original coarse blue-gray portal surround with stepped canopy,three shallow front treads,and a slender stone minaret with open balcony and gray conical cap. Adjacent fountain,tombs,clock tower,bazaar,trees,fences,people,furniture,inscriptions,historic decorative art,furnished interiors and engineering are excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:GaziHusrev-begMosqueSarajevo.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Mosqu%C3%A9e_Gazi_Husrev-beg_de_Sarajevo,_Bosnie.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Begova_d%C5%BEamija.jpg)

Six existing shared256² lime plaster,coursed/weathered limestone,standing-seam metal,bronze and plain wood graphs;seven merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Portal fields,canopy tiers,grids and ribs are original abstractions;no historic artwork or inscriptions are copied.

## Model and axes

8,278 triangles; 24,834 vertices; 7 material groups; 997,636 bytes. Native bounds: -18.736, -0.668, -17.180 to 18.775, 47.366, 15.708. Source hash: `sha256:bb7c4f7ed8ec06625e97afc5ac726e62ad75d593f2837c5d3654023a09287b09`.

{"x":"eastern side rooms","y":"up","z":"southern rear dome"}

Standard Protomaps20261014 and Mapzen/USGS viewer extractN0484;datum 550.3027496728663 m. 403 occupied samples range -0.30135438233412515 to 0.3688173920952522 m;floor 0.36622681375433785 m is the median of 112 compound/tread edge samples plus0.25 m. Footings follow sampled grade;the review fixture seats the compound and estimated1.5 m front tread apron with a3 m margin. Adjacent fountain,tombs and other buildings remain separate. Finished ground levels,stairs,thresholds,drainage and structural foundations are not surveyed.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0484` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained Q1255835 way/609903435 preserves anchor,undirected heading,16 exterior vertices,original tags and empty dimensional facts. Current ordinary PMTiles has a named12-vertex compound plus17 height-tagged parts for hall,porch/side/rear roofs and minaret stages. Their raw geometry and tags are retained. The five mapped porch cupolas establish the northern porch rhythm;the western projection and mapped tower stages establish the minaret base. Signed facade bearing and roof transitions are reviewed approximations from pictures and ordinary map parts.
- Current parts retain heights8,9,9.5,10.5,11,15,17,19,26,29,31 and47 m;the balcony part also retains min_height28 m. The model applies these as approximate part tops above the local floor;the map gives no survey datum. Main hall19 m,main dome shell26 m,minaret finial47 m,side/rear shells15/17 m and porch shells10.5/11 m follow those tags. Inferred main/side/rear dome spring levels20/11.2/11.5 m,balcony floor29.5 m,cone spring41.3 m and small roof finial extensions are visual estimates. Porch arches,columns,portal pattern,small windows and three shallow treads are original coarse reconstructions;exact thresholds,dimensions and current condition are unverified.
- Standard Protomaps20261014 and Mapzen/USGS viewer extractN0484;datum 550.3027496728663 m. 403 occupied samples range -0.30135438233412515 to 0.3688173920952522 m;floor 0.36622681375433785 m is the median of 112 compound/tread edge samples plus0.25 m. Footings follow sampled grade;the review fixture seats the compound and estimated1.5 m front tread apron with a3 m margin. Adjacent fountain,tombs and other buildings remain separate. Finished ground levels,stairs,thresholds,drainage and structural foundations are not surveyed.
- Two porch/minaret pictures and one supplemental portal close-up guide vocabulary. Roof spring levels,column/arch rhythm,tower stage transitions,portal ornament,tread heights and complete current condition remain approximate. Furnished interiors,engineering and physical-device/full-city performance are unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.
