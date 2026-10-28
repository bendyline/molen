# Pont du Garigliano

![Molen preview](preview.png)

Full three-span shallow green haunched steel crossing, six longitudinal girders and cross ribs, two paired tapered stone-clad piers with open trapezoid portals, raised broad walks, close vertical railings and curved green lamps. Exact sections are ordinary-photo reconstruction controls; short flared landing transitions meet standard mapped paving; current native review remains required.

Editable geometry lives in models/; model-brief.json records the material library, four authored runtime levels, reference pictures and reconstruction limits. The detailed master is reproducible from this editable recipe; inspection and readiness decisions are recorded separately. All GLBs are ignored generated outputs.

Regenerate with `node content/worldgen/source/places/u0/u09/pont_du_garigliano/models/generate-garigliano.mjs --ids=pont_du_garigliano`. Append `--check` to verify exact reconstruction. Import with `node packages/worldgen/scripts/import-structure-models.mjs --ids=pont_du_garigliano`, then generate runtime levels with `node packages/tooling/scripts/generate-landmark-lods.mjs --ids=pont_du_garigliano`.

## Review status

Current completion decisions are in qa.json and QA-REVIEW.md when present; the readiness catalog is authoritative. integration-review.json retains the earlier source-promotion checkpoint, including its original pending work. placement-draft.json preserves the proposed orientation, datum and bounded replacement rules. A source build alone grants no visual or geographic approval.

Original geometry uses the repository license. Map-derived controls: © OpenStreetMap contributors, ODbL-1.0. Reference photos retain their own rights and are not model textures.
