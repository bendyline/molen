# Kyiv Hydroelectric Power Plant

The date-selectable model depicts the prewar exterior. Select `viewingDate: "2021-06-12"` to see it in the Earth viewer. The display interval ends before February 24, 2022. [Native preview](site-preview.png) · [QA record](qa.json)

The prewar reconstruction retains the sloping concrete supports, paired bays, two gantries, control room, open lock chamber and waterfront walls. The blue reservoir-side railing follows the dated close photograph. [Photographic references](reference-observations.json)

The signed crest and lock align to retained PMTiles. In the Earth viewer the dated terrain patches join four road approaches with measured differences under 5 cm. The default and end-date views load no historical GLB or model grading. Native testing uses retained current PMTiles and Terrarium context around the dated structure.

Five existing shared materials resolve with metric UVs. No GLB images are embedded. The dated model and its replacement surfaces are disposed on unload.

All six GLBs passed validation. The four detail levels have 956, 1,476, 7,388, 12,240 triangles. The two lightest levels total 205,908 bytes. The review covered 11 portable, 11 shared-material, 27 medium-fi and 30 dated native views.

The exterior follows the dated 2018 and 2020 plant photographs and the June 2021 lock photograph. The model depicts June 12, 2021. Structure heights and gates are visual approximations, the water stages are static, and the 2026 exterior remains unverified.

Rebuild with `node packages/worldgen/scripts/generate-kyiv-hydroelectric-power-plant.mjs`. Append `--check` to compare the generated source bytes.
