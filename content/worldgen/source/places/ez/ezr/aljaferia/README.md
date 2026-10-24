# Aljafería

![Molen preview](shots/shared/angle-0.png)

Six round east towers and26m rectangular Trovador, three physically open roof courts, selected lobed Taifa colonnades and formal garden, tiled barracks and throne-gallery wings, distinct flat contemporary hemiciclo, chapel glazing and mapped access bridges over an estimated moat.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://api.openstreetmap.org/api/0.6/map?bbox=-0.899,41.6554,-0.8954,41.6575)
- [Reference](https://patrimonioculturaldearagon.es/patrimonio/palacio-de-la-aljaferia/)
- [Reference](https://www.zaragoza.es/sede/portal/turismo/ver-y-hacer/servicio/monumento/7)
- [Reference](https://www.sipca.es/censo/1-INM-ZAR-017-297-629/.html)
- [Reference](https://islamicart.museumwnf.org/database_item.php?id=monument%3BISL%3Bes%3BMon01%3B4%3Bes)
- [Reference](https://www.pemanyfranco.com/corts-de-aragn)
- [Reference](https://www.pemanyfranco.com/biblioteca-c-san-martn)
- [Reference](https://patrimonioculturaldearagon.es/wp-content/uploads/2022/12/JCG0785.jpg)
- [Reference](https://patrimonioculturaldearagon.es/wp-content/uploads/2022/12/JCG0573b-scaled.jpg)
- [Reference](https://patrimonioculturaldearagon.es/wp-content/uploads/2022/12/JCG0772.jpg)
- [Reference](https://images.museumwnf.org/zoom/monuments/isl/es/1/4/4.jpg)
- [Reference](https://images.museumwnf.org/zoom/monuments/isl/es/1/4/plans/1.jpg)
- [Reference](https://static.wixstatic.com/media/f949b7_ee19a6dcc04f45feb34d806e903555d9~mv2_d_4724_6980_s_4_2.jpg)
- [Reference](https://static.wixstatic.com/media/f949b7_4aa16172c663421e9adee9e58e49c035~mv2_d_6996_4716_s_4_2.jpg)
- [Reference](https://static.wixstatic.com/media/f949b7_c11880355cec400980919a2b236e37d5.jpg)
- [Reference](https://bibliotecavirtual.aragon.es/es/catalogo_imagenes/grupo.do?path=3717944)

Six existing shared material graphs, linear palette and metric UVs; no new or embedded textures or imported meshes. Three mapped courtyards remain roof holes at every level. Estimated moat requires real host terrain cutout.

## Model and axes

18,078 triangles; 54,234 vertices; 8 material groups; 2,173,884 bytes. Native bounds: -59.241, -2.964, -52.645 to 86.112, 31.500, 69.842. Source hash: `sha256:d7aebaf752d170ac60b0f14e239f8c64d569fe0b0e84b919845b24e075d3cde3`.

{"up":"+Y","front":"+X east, mapped main entrance","longitudinal":"+Z south","origin":"Site anchor; Y0 standard PMTiles working datum."}

The inspected exterior picture supports six round crenellated east towers, warm pale masonry and a raised scarp. Retained east/south map coordinates set approximate footprint, scale and entrance orientation. Standard viewer PMTiles supply the ground; the derivative retains palace geometry and bounded scarp, omits duplicated moat grass/outer terrain walls and slopes the access bridges toward coarse approach ground. Courtyard floors stay above sampled terrain. The original detailed source master remains reproducible. Anchor -0.897048689,41.656484624; heading 0; standard PMTiles datum 206.4844743505745m. Floors are reconstructed and foundations extend below the coarse sampled ground.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=aljaferia` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Approximate exterior and fit from a reference picture and standard viewer PMTiles; no bespoke survey or exact thresholds.
- Detailed original master/hash/recipe preserved. Trovador dimensions, restoration details and ornate Taifa decoration remain interpreted; interiors and collision excluded.
- Six common graphs plus two explicit color slots, zero embedded images. The raised scarp is bounded; an excavated dry moat cannot be resolved by coarse terrain and no terrain cutout is added.
- Footprint replacement remains off; physical-device timing unmeasured.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

© OpenStreetMap contributors; Gobierno de Aragón; Ayuntamiento de Zaragoza; SIPCA; Museum With No Frontiers; Pemán y Franco; Pedro I.Sobradiel Valenzuela.
