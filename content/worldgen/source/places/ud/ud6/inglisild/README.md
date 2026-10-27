# Inglisild / Angel’s Bridge

![Molen preview](preview.png)

Tartu Inglisild: mustard-and-white classical footbridge with eight tall framed square piers around three Lossi street/walk bays, twelve shorter wing piers, asymmetric mapped bank wings, white open vertical railings, timber entablature and dentils, raised central portrait frieze and simplified bronze profile medallion.

Editable geometry lives in models/; model-brief.json records the material library, four authored runtime levels, reference pictures and reconstruction limits. The detailed master is reproducible from this editable recipe; inspection and readiness decisions are recorded separately. All GLBs are ignored generated outputs.

Regenerate with `node content/worldgen/source/places/ud/ud6/inglisild/models/generate-inglisild.mjs --ids=inglisild`. Append `--check` to verify exact reconstruction. Import with `node packages/worldgen/scripts/import-structure-models.mjs --ids=inglisild`, then generate runtime levels with `node packages/tooling/scripts/generate-landmark-lods.mjs --ids=inglisild`.

## Review status

Current completion decisions are in qa.json and QA-REVIEW.md when present; the readiness catalog is authoritative. integration-review.json retains the earlier source-promotion checkpoint, including its original pending work. placement-draft.json preserves the proposed orientation, datum and bounded replacement rules. A source build alone grants no visual or geographic approval.

Original geometry uses the repository license. Map-derived controls: © OpenStreetMap contributors, ODbL-1.0. Reference photos retain their own rights and are not model textures.
