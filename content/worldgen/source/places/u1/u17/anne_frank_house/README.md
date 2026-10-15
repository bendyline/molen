# Anne Frank House

Prinsengracht 263 only: three-bay black storefront and brick upper facade, white cornice and hoist, slate front-house roof, narrow connecting section and transverse red-tiled annex roof.

![Molen preview](preview.png)

Authoring state: **review-in-qa.json**. Current completion evidence is in [qa.json](qa.json) and the [local 100 ledger](../../../../qualla-structures/batches/PROGRESS.md).

- [Anne Frank House](https://qualla.com/anne-frank-house/)

Original medium-fi exterior, not a measured reconstruction. Facade follows local Qualla photos; the hidden courtyard/annex arrangement follows the museum historical cutaway and the local model photograph.

The zoom-15 map supplies a generalized 5.88 by 24.1 m envelope. Front/connector/annex partition and window/roof dimensions are estimates; small modern alterations and interiors are omitted.

Adjacent 261, 265 and the modern museum block are excluded. The former draft rear polygon was a neighboring property and has been removed.

Ground contact is reviewed against independently preserved coarse host-terrain samples; this is not elevation survey data. Reference images remain in Qualla and are not embedded in the asset.

Build: `node packages/worldgen/scripts/generate-authored-places.mjs --ids=anne_frank_house`. Add `--check` to verify exact regeneration. 2448 triangles; 5 materials; no embedded photographs.
