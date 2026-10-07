# Grande Arche

![Molen preview](preview.png)

A real open monumental granite cube with office glazing on both piers, jointed white stone end frames, raised terrace and broad stair, four external glass elevators and a suspended three-lobed fabric cloud.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://pop.culture.gouv.fr/notice/merimee/ACR0000683)
- [Reference](https://www.parisladefense.com/en/district/towers-buildings/grande-arche)

No third-party geometry, photograph or bitmap texture is embedded. Shared surface graphs come from the central library; vertex tints carry model colors. Glazing uses PBR materials; transparent surfaces are declared per model.

## Model and axes

22,776 triangles; 54,576 vertices; 4 material groups; 2,240,860 bytes. Native bounds: -53.570, 0.000, -56.025 to 53.570, 111.728, 56.025. Source hash: `sha256:d959b6b13fd64328d83eaec9c0dcdbd2c5ebad5ad983541af6f9b2c4e795f229`.

{"up":"+Y","longitudinal":"+Z along the published 112 m depth","front":"+Z toward the southeast historic axis","origin":"Ground-level center of exact-QID mapped footprint frame"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=N0147` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exterior geometry uses published overall dimensions and map evidence; panel subdivision, connection dimensions and local entrance details are reconstructed. Glazing uses opaque PBR with explicit geometry; no copied facade photograph is embedded.
- Cloud membrane shape, opening dimensions, stair count and elevator car elevations are exterior approximations. The internal mural is not reproduced.

This bundle contains source geometry, not a claim of maximum-fidelity completion. Hash-bound visual acceptance is recorded separately after capture inspection.
