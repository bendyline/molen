# Lakhta Centre

![Molen preview](preview.png)

The462 m five-petal glass flame with a continuous90-degree helical sweep, widening lower profile, tapering upper observation/spire section, individually framed parallelogram glazing and ten fine spiral arrises.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://gorproject.ru/en/projects/lakhta-center/)
- [Reference](https://www.mignat.com/en/unternehmenskommunikation-en/tallest-european-skyscraper-in-saint-petersburg-reached-its-final-height-of-462-meters/)
- [Reference](https://europe.arcelormittal.com/newsandmedia/europenews/news-2019/Lakhta)
- [Reference](https://www.openstreetmap.org/relation/18102137)

No third-party geometry, photograph or bitmap texture is embedded. Shared surface graphs come from the central library; vertex tints carry model colors. Glazing uses PBR materials; transparent surfaces are declared per model.

## Model and axes

15,202 triangles; 34,978 vertices; 3 material groups; 1,443,972 bytes. Native bounds: -38.709, 0.000, -34.025 to 34.371, 462.000, 40.237. Source hash: `sha256:cc5ea11c5d2a9f9636e305ae8bd60ed1022e913a7c7a52ee2668fe711b34ce32`.

{"up":"+Y","longitudinal":"+X along the mapped building long axis","front":"+Z","origin":"Ground-level center of exact-QID mapped footprint frame"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=N0160` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exterior geometry uses published overall dimensions and map evidence; panel subdivision, connection dimensions and local entrance details are reconstructed. Glazing uses opaque PBR with explicit geometry; no copied facade photograph is embedded.
- Individual glazing panels and helical arrises are explicit. Exact curved pane sag and floor-specific petal bulge are reconstructed. Only the main tower is included; adjacent long low complex and entrance arch are excluded.

This bundle contains source geometry, not a claim of maximum-fidelity completion. Hash-bound visual acceptance is recorded separately after capture inspection.
