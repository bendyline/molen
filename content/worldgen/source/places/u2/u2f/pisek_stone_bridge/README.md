# Písek Stone Bridge

![Molen preview](preview.png)

Seven real arch openings including a larger western span; bent narrow masonry deck, solid parapets and coping, individual pointed cutwaters, six wooden ice guards and four independent three-dimensional Baroque statue ensembles at mapped POI positions.

Editable geometry lives in models/; model-brief.json records the material library, four authored runtime levels, reference pictures and reconstruction limits. The detailed master is reproducible from this editable recipe; inspection and readiness decisions are recorded separately. All GLBs are ignored generated outputs.

Regenerate with `node content/worldgen/source/places/u2/u2f/pisek_stone_bridge/models/generate-pisek.mjs --ids=pisek_stone_bridge`. Append `--check` to verify exact reconstruction. Import with `node packages/worldgen/scripts/import-structure-models.mjs --ids=pisek_stone_bridge`, then generate runtime levels with `node packages/tooling/scripts/generate-landmark-lods.mjs --ids=pisek_stone_bridge`.

## Review status

Current completion decisions are in qa.json and QA-REVIEW.md when present; the readiness catalog is authoritative. integration-review.json retains the earlier source-promotion checkpoint, including its original pending work. placement-draft.json preserves the proposed orientation, datum and bounded replacement rules. A source build alone grants no visual or geographic approval.

Original geometry uses the repository license. Map-derived controls: © OpenStreetMap contributors, ODbL-1.0. Reference photos retain their own rights and are not model textures.
