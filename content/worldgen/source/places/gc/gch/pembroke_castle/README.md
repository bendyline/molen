# Pembroke Castle

![Molen preview](shots/shared/angle-0.png)

25m circular limestone keep with domed crown, asymmetric oblique gatehouse and low curved barbican, hollow perimeter towers and irregular curtain ring, roofless Great/Norman/western halls, mostly lost inner-gate footings, StAnne projection, original cliff/promontory with walled Wogan mouth and schematic visitor map.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://api.openstreetmap.org/api/0.6/map?bbox=-4.9224,51.6757,-4.9183,51.6786)
- [Reference](https://pembrokecastle.co.uk/)
- [Reference](https://pembrokecastle.co.uk/explore/)
- [Reference](https://cadwpublic-api.azurewebsites.net/reports/listedbuilding/FullReport?id=6314)
- [Reference](https://cadwpublic-api.azurewebsites.net/reports/sam/FullReport?id=3013&lang=en)
- [Reference](https://coflein.gov.uk/en/site/94945/)
- [Reference](https://coflein.gov.uk/en/archives/6174476)
- [Reference](https://pembrokecastle.co.uk/wogan-cavern/)
- [Reference](https://pembrokecastle.co.uk/wp-content/uploads/2026/02/Dinnis-et-al-2023-CKS-WC22.pdf)
- [Reference](https://pembrokecastle.co.uk/wp-content/uploads/2024/12/Jarrold-Pembroke-Castle-409.jpg)
- [Reference](https://pembrokecastle.co.uk/wp-content/uploads/2024/12/Jarrold-Pembroke-Castle-333.jpg)
- [Reference](https://pembrokecastle.co.uk/wp-content/uploads/2025/01/Directions-Parking.jpg)
- [Reference](https://pembrokecastle-co-uk.inprogress.uk/wp-content/uploads/2024/11/map-screenshot.jpg)
- [Reference](https://coflein.gov.uk/media/132/30/large_di2006_0556.jpg)
- [Reference](https://pembrokecastle.co.uk/blocks/download/20190213035045Pembroke%20Castle%20Information%20pack.pdf)

Five existing256-square shared graphs, linear palette and central metric repeats. No new/embedded textures, copied map artwork or downloaded meshes. Preserve unresolved cave-section/DEM discrepancy.

## Model and axes

14,971 triangles; 44,913 vertices; 7 material groups; 1,800,580 bytes. Native bounds: -71.060, -8.470, -73.150 to 76.285, 33.000, 72.105. Source hash: `sha256:49d674e48c19598734af1c517d4f5e3fc843094c1c826756f468c51cc563a68c`.

{"up":"+Y","front":"Oblique southeastern main entrance, baked in East/South coordinates","longitudinal":"+Z south","origin":"Site anchor; Y0 standard PMTiles working datum."}

Reference picture shows the high round keep, roofless hall and gatehouse silhouettes above a bounded riverside cliff. Retained east/south mapped controls and standard viewer PMTiles set approximate location, scale, orientation and coarse ground. Reconstructed court floor atY8 stays above coarse terrain; the cliff base reaches the same PMTiles sampler at all levels. The Wogan mouth is an approximate exterior feature; the original detailed section and master remain preserved. Anchor -4.920555555,51.676944444; heading 0; standard PMTiles datum 10.602262091697735m. Floors are reconstructed and foundations extend below the coarse sampled ground.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=pembroke_castle` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Approximate exterior and fit from inspected picture and standard viewer PMTiles; no bespoke survey or exact thresholds.
- Detailed original master/hash/recipe preserved. Ruins, cliff shape, Wogan aperture and reconstructed floors are approximate; full interiors, complete cave circulation, collision and water simulation excluded.
- Five common graphs plus explicit glass/foliage color slots; zero embedded images. Host terrain supplies the surrounding hillside; bounded castle cliff retained.
- Footprint replacement remains off; physical-device timing unmeasured.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

© OpenStreetMap contributors; Cadw; Pembroke Castle Trust; RCAHMW/Toby Driver; Dinnis et al2023/British Cave Research Association; Mapzen/NASA/USGS terrain data.
