# Crystal Cathedral

![Molen preview](preview.png)

Individual Crystal/Christ Cathedral:the mapped four-point glass shell has large faceted sloping roof/wall planes,high sharp tips and inward valleys,blue-gray shared glazing grid,silver main frame lines and pale low entrance canopies/doors. Separate mapped73m open steel spire has staggered pointed blade/prism elements,actual gaps/open base,cross-connectors,simplified inner bell rows and a small pale circular pavilion with gold-toned shallow cap. Four existing shared glazing/polished steel/painted metal/concrete graphs,four browser levels and explicit approximate roof/entrance/terrain limits. Fine individual bell count,engineered steel details,reflected surroundings,interiors and exact thresholds are excluded or simplified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Crystal_Cathedral_with_Spire.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Crys-ext.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Crystal_Cathedral_spire_complete.jpg)

Four existing cached256-square commercial window-grid,polished stainless steel,painted metal and plain concrete graphs.Linear blue-gray glazing/silver/pale-concrete tints,metric UVs and flat architectural normals.Gold-toned pavilion/bell accents use local geometric PBR colors.Opaque reflective exterior glazing;no interior/transmission simulation,no embedded images,unique facade maps or baked sky/tree reflections.

## Model and axes

7,960 triangles; 23,880 vertices; 5 material groups; 958,508 bytes. Native bounds: -57.799, -0.435, -29.377 to 57.838, 73.800, 28.427. Source hash: `sha256:2aa1548f65441586177b2bea9cdf9ec7117f254b081458c7390fe0a9449ca89c`.

{"x":"east-southeast along long glass shell","y":"up","z":"south-southwest across shell;spire lies on negative side"}

Standard viewer DEM datum39.853387m;estimated floor0.8m,raw main/spire perimeter-0.09..0.37m. Coarse urban DEM is not a floor survey. Footings crossY=0 and extend below raw terrain;entrance landing/canopy bases are approximate. No preview flattening or host DEM change. Runtime base clipping,exact plaza/street/door joins,absolute altitude and walking remain unverified. Other campus buildings,water basins,gardens/trees and roads remain host content;no road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0387` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID way/29280620/Q1051217 (current name Christ Cathedral,legacy candidate Crystal Cathedral) matches current whole35184401369452. Current11-vertex main and4-vertex associated73m spire35184492802876 retain all15 raw vertices/tags rigidly,without rescale. Earlier32 distinct whole vertices/multilingual identity retained separately. Main height40m and separate spire height73m remain verbatim;there are no retained Wikidata height/width/length facts. Native+X east-southeast along long shell and+Z south-southwest across it;the separate spire lies at native[-44.91,-20.71],signing retained heading-0.442946546014rad. Main glass shell is reconstructed as eight large star/fold control corners,with40m high outward wing tips/central ridges and24m inward valleys (valley/ridge interpretation is a picture estimate,not mapped roof geometry). The small mapped northern notch is a low estimated entrance projection. Spire square map control determines location,plan axes and about8.93x9.68m base. Pointed steel blade count/offsets,open-base heights,connectors,bell rows and small pavilion dimensions are picture estimates,with highest tip73m. Low entrance canopies/doors and pavilion4.8m cap/shape are approximate. All elevations interpreted above an estimated0.8m floor;source height datum,hidden roof joints and thresholds are unverified.
- Standard viewer DEM datum39.853387m;estimated floor0.8m,raw main/spire perimeter-0.09..0.37m. Coarse urban DEM is not a floor survey. Footings crossY=0 and extend below raw terrain;entrance landing/canopy bases are approximate. No preview flattening or host DEM change. Runtime base clipping,exact plaza/street/door joins,absolute altitude and walking remain unverified. Other campus buildings,water basins,gardens/trees and roads remain host content;no road replacement.
- Medium-fi exterior from three actually inspected2007/2009 photographs plus standard viewer PMTiles/DEM.No bespoke plans/surveys researched or photographs/reflections redistributed.Main roof fold/valley interpretation,entrance locations/profiles,spire blade count/sections/offsets,inner bell count and pavilion details are approximate.Opaque reflective exterior glazing simplifies transparency/interiors.Canonical shared pane grid differs from exact glazing pitch.Fine signage,engineering details,interiors and current campus renovations excluded or simplified.Other campus buildings,basins,trees/gardens and roads remain host content.Physical phone/laptop timing pending.
- Skyline preserves folded shell,sharp tips,open spire gaps/staggered crown and small base pavilion.District adds shared pane grid,coarse geometric roof-frame lines,spire connectors and real entrance/pavilion recesses.Street adds finer roof/wall frame lines and simplified inner bell rows.Closeup/master refine frame density,blade seams,connectors and bell profiles.Each level retains open spire geometry.Synthetic cottages are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
