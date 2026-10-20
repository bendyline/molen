# Jefferson Memorial

Circular marble memorial with 26 outer Ionic columns, eight-column north pedimented portico and four axial inner openings, stepped dome, circular stairs and bronze standing silhouette.

![Molen preview](preview.png)

Authoring state: **review-in-qa.json**. Current completion evidence is in [qa.json](qa.json) and the [local 100 ledger](../../../../qualla-structures/batches/PROGRESS.md).

- [Jefferson Memorial](https://qualla.com/jefferson-memorial/)

Started with three cleared published Qualla CC0 aerials, supplemented by a verified creator-CC0 front photograph, explicit NPS public-domain cleaned-dome original and native original HABS1994 north elevation/longitudinal section. All native title blocks and drawing credits inspected; earlier attribution-licensed images excluded from current approval. Not a survey or photogrammetric reconstruction.

NPS text establishes26 outer,12 portico and16 inner columns. Map part counts are incomplete. The measured north elevation supplies12.519025m stylobate-to-architrave height; the longitudinal section supplies approximately29.16555m main-floor-to-dome height. The elevation chain instead totals29.708475m; this0.542925m original-source discrepancy is retained in survey-controls.json. Overall model proportions follow the section. Fine volutes, dome masonry and hidden pier openings are simplified.

Main circular steps, north stair flight and immediate raised supporting terrace included; wider gardens, Tidal Basin, distant approachway, undercroft and modern accessibility equipment excluded. Vertical stair levels are approximate relative to the independent terrain contact.

Standing statue and pediment relief are original simplified silhouettes, not portrait-quality sculptures. Inscriptions, exact coffer pattern and detailed interiors are excluded; no photo pixels are embedded.

Independent terrain is preserved unchanged and foundation extends beneath it. Another host DEM can change exact ground contact.

Build: `node packages/worldgen/scripts/generate-authored-places.mjs --ids=jefferson_memorial`. Add `--check` to verify exact regeneration. 63386 triangles; 4 materials; no embedded photographs.
