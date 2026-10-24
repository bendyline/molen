# Haapsalu Castle

![Molen preview](preview.png)

Current Haapsalu: roofed cathedral, circular baptismal chapel and lower side roofs, tall round clock tower with curved cone, roofless U-shaped main-castle upper rooms, black modern pavilion/folded stairs and mapped curtain/tower remains.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://strapi.lumia.ee/uploads/03_01_Vendo_Jugapuu_a3ece4c6ec.webp)
- [Reference](https://strapi.lumia.ee/uploads/03_02_Tonu_Tunnel_3c4e8fd6bc.webp)
- [Reference](https://strapi.lumia.ee/uploads/03_12_Tonu_Tunnel_b8e3552928.webp)
- [Reference](https://strapi.lumia.ee/uploads/03_16_Tonu_Tunnel_b86482d2db.webp)
- [Reference](https://strapi.lumia.ee/uploads/03_DSC_1908_Vendo_Jugapuu_Copy_892a42a4d8.webp)
- [Reference](https://strapi.lumia.ee/uploads/2_1st_floor_3fcf0aa362.webp)
- [Reference](https://strapi.lumia.ee/uploads/4_section_1_e15947da68.webp)
- [Reference](https://strapi.lumia.ee/uploads/5_section_2_6a20a887e1.webp)
- [Reference](https://www.lumia.ee/en/projects/haapsalu-castle)
- [Reference](https://linnus.salm.ee/haapsalu-piiskopilinnuse-arendus/)
- [Reference](https://giid.salm.ee/en/introduction-en)
- [Reference](https://api.openstreetmap.org/api/0.6/map?bbox=23.5349,58.9455,23.5424,58.9492)
- [Reference](https://linnus.salm.ee/en/the-castle/)

Five existing shared256-square weathered limestone, painted metal, lime plaster, timber and gravel graphs; metric repeats and linear tint. Glass stays flat. No unique or embedded texture or borrowed mesh.

## Model and axes

5,973 triangles; 17,919 vertices; 7 material groups; 720,976 bytes. Native bounds: -114.387, -2.570, -78.645 to 137.291, 38.000, 112.774. Source hash: `sha256:1e544640a9d57c44488e69abfd0eb2a82427660371a4d70736b9498d3d992f2b`.

{"up":"+Y","longitudinal":"Native+X east,+Z south; heading0 preserves all attributed footprints.","origin":"Wikidata horizontal reference inside cathedral; Y0=7.2m EH2000 exterior contact plane. Numeric source ground controls, not a surveyed floor datum."}

Native+X east,+Z south, heading0. Exact castle identity node and separate named physical footprints; no exact-QID area invented. ModelY0=7.2m EH2000 exterior attachment, based on the attributed official terrain grid. The architect interior datum8.30m is separate. Actual-terrain review uses the source-local heightfield; generic shared-viewer stage establishes transforms/materials only.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=haapsalu_castle` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Q866154 is an exact mapped castle identity node687056785. Named cathedral106803938/Q16412871, museum112303709 and surrounding named curtain walls are separately matched physical controls; no exact-QID castle area is invented.
- Mapped museum height38 is a whole-envelope value containing the clock tower. Individual wing/wall sections remain lower and partly roofless. Cathedral25m mapper height is separate. Tower38m is an archival museum reference, not a new survey.
- Architect drawings publish section levels+18.50/+19.96 and interior+0.00=8.30m. Original estimated architectural sections use exterior modelY0=7.2m EH2000, based on the official DTM; this is not a certified floor/door elevation survey or a literal plan copy.
- Nave, south circular baptismal chapel, lower lateral vestries, open upper museum rooms and black modern pavilion/stair zigzags are independent geometry. Lost medieval roofs, reconstructed cloister, full interiors, exhibits, event infrastructure, playground/trees and adjacent city buildings are not invented.
- Surviving wall/tower section heights, church window rhythms, pavilion proportions and folded walkway attachments are original medium-fi estimates reviewed against current architect/museum references. Fine masonry loss, exact window counts and museum interiors are outside the declared exterior scope. Footprint replacement remains off.
- Five existing shared256-square weathered limestone, painted metal, lime plaster, timber and gravel graphs use metric repeats and linear tints. No new unique image, embedded photograph or borrowed mesh.
- Reference photographs/drawings stay private. The attributed numeric terrain grid and its 16-bit review heightfield ship as ground evidence, not a unique model texture. Automated DTM classification can retain raised built terraces; doors/interiors are not terrain survey controls. Host terrain must agree with the recorded EH2000 mean-sea-level datum and adequate local resolution. Physical laptop/phone performance remains unmeasured; captures and software budgets do not certify device frame rates.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

© OpenStreetMap contributors; Foundation of Haapsalu and Läänemaa Museums; LUMIA/KAOS and credited photographers Tõnu Tunnel and Vendo Jugapuu.
