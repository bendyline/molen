# Maiden's Tower — maidens_tower

![Lit Molen preview](preview.png)

Restored Bosphorus castle-tower ensemble: stone square shaft, projecting octagonal plaster room, curved lead-colored cap, ornamental balconies, tall mast, crenellated courtyard and one-storey pavilion.

## Identity and evidence

Exact catalog identity **Q848397**. Source facts: `{"restoration":"2023 restoration follows the Mahmut II period arrangement with timber upper structure and a one-storey western building.","modeledHeightMeters":32.5,"heightBasis":"Photo-proportioned full mast envelope; not a published measured height.","originalMasterHash":"sha256:edc07774f5ba692057bb7c1ff2a5434e52ac14466f05501839bf8a372fc4f4b0","basis":"Medium-fi restored2023 daylight exterior: actual mapped6.4m shaft and fort/pavilion plan control horizontal placement;32.5m mast envelope, arch heights, timber covertways, roof/coping and ornament details are proportional reconstruction from official restoration text/illustrations. The homepage courtyard image is an architectural illustration, not a survey photograph. Closed old roof polygons are not recreated after2023 courtyard reopening. Exact masonry, curved profiles, Fatih doorway shape, full visitor/internal routes, flag cloth, night laser show and underground reinforcement are outside this architectural exterior scope. Host terrain supplies inhabited island height; no artificial water offset or footprint replacement."}`. The source specification keeps published dimensions separate from reconstructed details.

- https://kizkulesi.gov.tr/en/restoration-diary
- https://www.openstreetmap.org/way/398210643
- https://www.openstreetmap.org/way/103821245
- https://kizkulesi.gov.tr/images/kiz-kulesi-banner1.png
- https://kizkulesi.gov.tr/images/kiz-kulesi-komepage-lastImage.png

Original geometry and shared procedural materials. Official photographs are research references only; no reference imagery or third-party mesh is embedded or redistributed.

## Authored geometry and materials

18,588 triangles, 33,984 vertices, 7 surface groups; 1,450,636 source bytes. SHA-256: `sha256:3a502828ef109259fc7906731c1ad21ea4850adf33477961057d09468235908d`. Actual bounds: -4.109, 0.000, -11.610 to 16.010, 32.500, 11.500 m.

Shared canonical material graphs with metric UV repeats in extras.molenSurface; portable glTF PBR factors and vertex colors remain. Dark recesses/lantern panels retain local fallback materials. Shared references: `matgraph:molen.worldgen.material.plaster_lime` (2 × 2 m), `matgraph:molen.worldgen.material.stone_ashlar` (2.4 × 1.5 m), `matgraph:molen.worldgen.material.tile_ceramic` (2.4 × 2.4 m), `matgraph:molen.worldgen.material.metal_painted` (2 × 2 m), `matgraph:molen.worldgen.material.stone_granite` (2 × 2 m), `matgraph:molen.worldgen.material.wood_plain` (2 × 0.25 m). Model-native axes: {"up":"+Y","front":"+Z east-northeast","origin":"Native+X follows the mapped north-northwest fort axis; native+Z faces east-northeast. Heading1.721295251 places west pavilion, north court entry and newly reopened east Fatih doorway on their published sides. Tower center averages the four actual shaft corners. Historic roof polygons are map controls, not the restored open courtyard."}.

## Placement proposal

Native+X follows the mapped north-northwest fort axis; native+Z faces east-northeast. Heading1.721295251 places west pavilion, north court entry and newly reopened east Fatih doorway on their published sides. Tower center averages the four actual shaft corners. Historic roof polygons are map controls, not the restored open courtyard. Medium-fi restored2023 daylight exterior: actual mapped6.4m shaft and fort/pavilion plan control horizontal placement;32.5m mast envelope, arch heights, timber covertways, roof/coping and ornament details are proportional reconstruction from official restoration text/illustrations. The homepage courtyard image is an architectural illustration, not a survey photograph. Closed old roof polygons are not recreated after2023 courtyard reopening. Exact masonry, curved profiles, Fatih doorway shape, full visitor/internal routes, flag cloth, night laser show and underground reinforcement are outside this architectural exterior scope. Host terrain supplies inhabited island height; no artificial water offset or footprint replacement. Proposed anchor 29.004089875, 41.021059 (longitude, latitude), heading 1.721295251 radians. Elevation policy: **terrain-contact**. This is a reviewable proposal, not a completed site-fit certification. Ground models require terrain contact; offshore models also require water-datum and base-height checks.

## Limitations and review

- The modeled exterior follows the cited published facts and inspected photographs. Unpublished dimensions and local fittings are explicitly photo-proportioned; no claim of engineering survey accuracy is made.
- Portable PBR and shared metric surfaces are provided. Surface weathering, material color under local lighting and fine facade relief require close render review before maximum-detail acceptance.
- Main shaft width/center, fort axis and pavilion side are mapped. Total mast height32.5m, restored pavilion roof/window proportions and seawall boundary follow official restoration images; these are photographic reconstructions, not measured survey elevations. Decorative railing motifs are geometric reconstructions and moving flag cloth is excluded from the architectural source.

Near/far fixtures are in `spec.qaCameras`. Float32 finite geometry, triangle degeneracy and winding are checked by the generator. Current rendering, shared-material, maximum-fidelity and geographic review results are recorded in `qa.json` and the readiness ledger; source generation alone does not approve a model.

Regenerate with `node packages/worldgen/scripts/generate-lighthouse-models.mjs --ids=maidens_tower`; add `--check` for reproducibility. Editable component recipes are in `packages/worldgen/scripts/lighthouse-expansion-models.mjs`. The generator protects artist-edited master hashes and preserves import/capture/shared-capture/QA documents.
