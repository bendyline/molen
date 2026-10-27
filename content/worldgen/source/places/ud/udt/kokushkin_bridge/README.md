# Kokushkin Bridge

![Molen preview](preview.png)

Complete shallow green panel-girder crossing with eight alternating circle/lozenge fascia panels, cast brackets, Empire wreath/rosette railings with small rings and swags, raised walks, granite abutments/flared end cheeks and the photographed navigation plaque/diamond. Preserve correct bridge proportions while native noisy-bank placement remains disabled.

Editable geometry lives in models/; model-brief.json records the material library, four authored runtime levels, reference pictures and reconstruction limits. The detailed master is reproducible from this editable recipe; inspection and readiness decisions are recorded separately. All GLBs are ignored generated outputs.

Regenerate with `node content/worldgen/source/places/ud/udt/kokushkin_bridge/models/generate-kokushkin.mjs --ids=kokushkin_bridge`. Append `--check` to verify exact reconstruction. Import with `node packages/worldgen/scripts/import-structure-models.mjs --ids=kokushkin_bridge`, then generate runtime levels with `node packages/tooling/scripts/generate-landmark-lods.mjs --ids=kokushkin_bridge`.

## Review status

Current completion decisions are in qa.json and QA-REVIEW.md when present; the readiness catalog is authoritative. integration-review.json retains the earlier source-promotion checkpoint, including its original pending work. placement-draft.json preserves the proposed orientation, datum and bounded replacement rules. A source build alone grants no visual or geographic approval.

Original geometry uses the repository license. Map-derived controls: © OpenStreetMap contributors, ODbL-1.0. Reference photos retain their own rights and are not model textures.
