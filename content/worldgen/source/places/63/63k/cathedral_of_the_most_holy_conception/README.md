# Cathedral of the Most Holy Conception

![Molen preview](preview.png)

Present Concepcion Cathedral:rounded banded front pylons,recessed monumental glazed arch/rose over vertical glazing,three closed doors/warm lunettes,tall side arches,upper crown slots,grey metal nave/aisles,low faceted crossing lantern,rounded rear apse/transverse arms and selected roofline figure.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://www.diarioconcepcion.cl/ciudad/2023/12/19/designan-a-monsenor-bernardo-alvarez-como-administrador-diocesano-tras-salida-de-chomali.html)
- [Reference](https://www.iglesia.cl/33687-iglesia-de-concepcion-celebra-aniversario-454o.html)

Four existing256-square concrete,standing-seam metal,weathered limestone and wood graphs;grey concrete/trim share one graph. Warm lunette fields and fluting are vertex tints,not unique images. Metric UVs,linear colors,flat glazing,no embedded images.

## Model and axes

6,847 triangles; 20,541 vertices; 6 material groups; 825,456 bytes. Native bounds: -34.610, -2.413, -19.141 to 37.667, 35.700, 19.176. Source hash: `sha256:b27312f3a75d8bbf78902ba12c3e8278591f977349368edc6caa3b7774258ff6`.

{"x":"northeast toward plaza-facing facade","y":"up","z":"southeast toward southern side arm"}

StandardDEM datum34.659053m;estimated floor0.7m clears sampled footprint peak0.360m and perimeter-2.02..0.34m. Foundations follow coarse terrain;exact plaza/stair thresholds and all inferred roof/opening heights remain approximate. No independent survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=cathedral_of_the_most_holy_conception` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- One current mapped parent and retained exact-QID outline give35m overall height,69x38m envelope,rounded rear apse,two transverse projections and two rounded front pylon marks. No building-part heights are available. Estimated internal stages are picture-led:14.8m lower body,17.5..21.8m aisles,23.6..27.2m nave,20.8..23.4m rear apse,24.0m aisle front,31.5m pylons,32.4m central crown and27.0..33.2m crossing lantern. A simplified roofline figure reaches the map-derived35m overall crown. Openings,roof stage roles,back/side details and steps are approximate; no independently surveyed heights or exact sculpture.
- StandardDEM datum34.659053m;estimated floor0.7m clears sampled footprint peak0.360m and perimeter-2.02..0.34m. Foundations follow coarse terrain;exact plaza/stair thresholds and all inferred roof/opening heights remain approximate. No independent survey or certified walking.
- Crossing lantern,rear/side openings,roof divisions,front steps,warm lunette fields and faceted roofline figure are exterior approximations. Exact statue/mosaic figures,full interiors,adjacent civic/office wings,plaza and certified walking excluded. Physical phone/laptop timings pending.
- Skyline retains rounded pylons,central glazed arch,stepped facade/aisles,rounded apse,crossing lantern and simple roof finial with mean roof tints. District adds shared graphs,closed recessed doors/glazing and selected rose/mullions. Street adds actual crown/lantern slots,selected bands and coarse figure arms;closeup refines arch/pylon facets,rose spokes and fluting. Detail changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
