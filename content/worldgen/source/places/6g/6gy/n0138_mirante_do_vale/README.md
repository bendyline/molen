# Mirante do Vale

![Molen preview](preview.png)

The170 m narrow modernist slab follows the mapped clipped end, with dense metal window grid, projecting floor bands, exterior air-conditioning boxes with louvers and Sampa Sky glass observation boxes at150 m.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://www.sampasky.com.br/sobre-nos)
- [Reference](https://www.farolsantander.com.br/assets/sites/2/20241204172903/Manual-de-Eventos-Farol-Santander-2025.pdf?_rsc=1mcjp)

No third-party geometry, photograph or bitmap texture is embedded. Shared surface graphs come from the central library; vertex tints carry model colors. Glass is an opaque PBR approximation.

## Model and axes

86,720 triangles; 229,494 vertices; 4 material groups; 9,075,740 bytes. Native bounds: -36.275, 0.000, -11.475 to 35.275, 170.000, 11.475. Source hash: `sha256:b1573f18714ec0e35b96836cb51583f84f42471116996ed088f9aab9bb90040a`.

{"up":"+Y","longitudinal":"+X along the mapped building long axis","front":"+Z","origin":"Ground-level center of exact-QID mapped footprint frame"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=N0138` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exterior geometry uses published overall dimensions and map evidence; panel subdivision, connection dimensions and local entrance details are reconstructed. Glazing uses opaque PBR with explicit geometry; no copied facade photograph is embedded.
- Individual AC positions and window tint/opening state are synthesized from the characteristic existing facade pattern. Observation box projections and roof fittings are reconstructed.

This bundle contains source geometry, not a claim of maximum-fidelity completion. Hash-bound visual acceptance is recorded separately after capture inspection.
