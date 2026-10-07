# International Commerce Centre

![Molen preview](preview.png)

KPF’s484 m glazed tower with re-entrant corners, a gently tapered silver facade, continuous fine projecting vertical fins, mechanical bands, and separately mapped splayed glass canopies and long northern entrance atrium.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://www.kpf.com/project/international-commerce-centre)
- [Reference](https://www.skyscrapercenter.com/building/international-commerce-centre/137)
- [Reference](https://www.shkp.com/Content/Uploads/en-US/annual-reports/2009-2010/14_329_en.pdf)
- [Reference](https://www.openstreetmap.org/way/25590249)

No third-party geometry, photograph or bitmap texture is embedded. Shared surface graphs come from the central library; vertex tints carry model colors. Glazing uses PBR materials; transparent surfaces are declared per model.

## Model and axes

121,424 triangles; 359,660 vertices; 4 material groups; 14,407,700 bytes. Native bounds: -50.966, 0.000, -34.950 to 100.296, 484.000, 34.722. Source hash: `sha256:3a7c593be32c1d563caae502825891a5a5e57e5bc5f791093c683afce07db69b`.

{"up":"+Y","longitudinal":"+X along the mapped building long axis","front":"+Z","origin":"Ground-level center of exact-QID mapped footprint frame"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=N0154` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exterior geometry uses published overall dimensions and map evidence; panel subdivision, connection dimensions and local entrance details are reconstructed. Glazing uses opaque PBR with explicit geometry; no copied facade photograph is embedded.
- Subtle facade taper and pane schedule are reconstructed. The tower-area podium has a local ground-contact base; the surrounding Elements complex is excluded. Static daylight facade omits programmable light-show content.

This bundle contains source geometry, not a claim of maximum-fidelity completion. Hash-bound visual acceptance is recorded separately after capture inspection.
