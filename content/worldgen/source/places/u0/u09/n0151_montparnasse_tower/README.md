# Montparnasse Tower

![Molen preview](preview.png)

The pre-renovation dark Montparnasse silhouette follows its mapped bowed long facades and recessed ends, with 59-storey facade bands, closely spaced dark mullions, observation glazing, rooftop parapets, railings and service enclosure.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://www.tourmontparnasse56.com/fr/la-tour-montparnasse-en-chiffres/)
- [Reference](https://www.paris.fr/pages/la-tour-montparnasse-fete-ses-50-ans-24034)

No third-party geometry, photograph or bitmap texture is embedded. Shared surface graphs come from the central library; vertex tints carry model colors. Glazing uses PBR materials; transparent surfaces are declared per model.

## Model and axes

9,424 triangles; 25,368 vertices; 3 material groups; 1,028,696 bytes. Native bounds: -30.974, 0.000, -19.599 to 30.974, 210.027, 19.599. Source hash: `sha256:b9b0a91cc68ff1dd3f043a07501972888a2e2d037954b4c923fd811a9adbd491`.

{"up":"+Y","longitudinal":"+X along the mapped building long axis","front":"+Z","origin":"Ground-level center of exact-QID mapped footprint frame"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=N0151` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exterior geometry uses published overall dimensions and map evidence; panel subdivision, connection dimensions and local entrance details are reconstructed. Glazing uses opaque PBR with explicit geometry; no copied facade photograph is embedded.
- The source intentionally records the established dark exterior, not the planned future renovation. Roof equipment and observation terrace fittings are simplified from their visible envelope.

This bundle contains source geometry, not a claim of maximum-fidelity completion. Hash-bound visual acceptance is recorded separately after capture inspection.
