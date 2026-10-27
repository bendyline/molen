# Les Ferreres Aqueduct

![Molen preview](preview.png)

Two-tier Roman aqueduct with25 upper and11 lower real open arches, tapered rusticated stone piers, broad projecting impost bands, pale voussoir rings, cornices, extended end walls and a continuous open dry water channel.

Editable geometry lives in models/; model-brief.json records the material library, four authored runtime levels, reference pictures and reconstruction limits. The detailed master is reproducible from this editable recipe; inspection and readiness decisions are recorded separately. All GLBs are ignored generated outputs.

Regenerate with `node content/worldgen/source/places/sp/sp2/les_ferreres_aqueduct/models/generate-ferreres.mjs --ids=les_ferreres_aqueduct`. Append `--check` to verify exact reconstruction. Import with `node packages/worldgen/scripts/import-structure-models.mjs --ids=les_ferreres_aqueduct`, then generate runtime levels with `node packages/tooling/scripts/generate-landmark-lods.mjs --ids=les_ferreres_aqueduct`.

## Review status

Current completion decisions are in qa.json and QA-REVIEW.md when present; the readiness catalog is authoritative. integration-review.json retains the earlier source-promotion checkpoint, including its original pending work. placement-draft.json preserves the proposed orientation, datum and bounded replacement rules. A source build alone grants no visual or geographic approval.

Original geometry uses the repository license. Map-derived controls: © OpenStreetMap contributors, ODbL-1.0. Reference photos retain their own rights and are not model textures.
