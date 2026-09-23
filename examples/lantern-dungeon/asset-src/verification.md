# Verification evidence

Verified on 2026-09-05 on Windows, Node 24.18.0, pnpm 10.33.0, with headless Chromium / SwiftShader.

- **28/28 imports** validate and pass SHA-256 verification through Molen's public operations.
- **4,991,892 bytes** of runtime GLBs (4.76 MiB); **41,838 triangles** across one copy of each model.
- Every GLB embeds its buffers and textures. No model/texture network dependency exists beyond the local app origin.
- **112 turntable PNGs** (four per model), including creature idle poses, were captured and visually inspected. The final [catalog](CATALOG.md) uses the front views. All final angles are under `../.artifacts/assets/`.
- `assets:check` passes: source GLBs, derived textures and the catalog reproduce byte for byte.
- The final browser suite loads **all 28 models** successfully, plays through movement/turn/attack/restart, reports no page or engine diagnostics, and captures desktop and narrow layouts.
- **8 dungeon unit tests** pass, including command-only victory, checkpoint continuation, asset integrity/budgets and sword-animation restart.
- Full workspace: `pnpm typecheck` passes; `pnpm test:unit` passes **595 tests**; `pnpm lint` passes (11 existing warnings, 2 infos); `pnpm docs:check` passes (18 generated schema files).
- `pnpm -r test:golden`: **15 tests pass** across tooling and the other examples after completing the three suites interrupted by terrain's failure. The terrain-flyover golden still differs by **0.014356825086805556** against its 0.005 threshold, exactly the pre-existing result. No terrain code or golden was changed.
- `git diff --check` passes. Changes remain in the working tree.

## Deterministic CLI evidence

`molen sim run scene.json --ticks 90 --commands commands.json --assert checks.json --hash`:
3/3 assertions pass, health 76, player Z 5.61, status playing.
State hash: `sha256:82a2d9a113e855de239798c4e67ba8f01880ea478b696f6e0e5660c1d083c876`.

`molen shot scene.json --ticks 3 --size 1280x800 --out .artifacts/dungeon-render.png`:
227 rendered entities, 406 reported draw calls, 291,988 reported triangles.
State hash: `sha256:b4a1c7103ad39aa4887b14115b39f27ff44934a04406ce91da5089c8da01674e`.

`molen shot asset-gallery.json --ticks 8 --size 1440x1080 --out .artifacts/asset-gallery.png`:
57 rendered entities, 122 reported draw calls, 42,186 reported triangles.
State hash: `sha256:018b86335dc4ea50119dc32a43007fb876b3efedd0c9ac0dd8e090b3653d70bc`.
The gallery includes explicit lighting, a shadow-casting sun and receiving ground. Cast shadows,
front/back faces, grounding and material response were inspected. Neutral ceiling turntables
are supplemented by the first-person underside view in the actual dungeon.

## Visual decisions and limits

The final pass fixed ceiling joins, removed metallic-looking floor cracks, reduced first-person
weapon scale, and moved the player light away from the held lantern to avoid excessive highlights.
The browser's final preview is [../preview.png](../preview.png). The art uses a deliberate faceted
style. Wall normals/roughness are approximations derived from albedo; creature motion is rigid-node
idle animation, not a full skeletal action set. Three creature variants are decorative. Sidecar
collision hulls are not automatically installed as gameplay colliders. These limits are explicit
in the [source guide](README.md).

Original ImageGen bitmap: 1254 x 1254; runtime maps: 256 x 256.
Original bitmap SHA-256: `63a4b092e5d459d97452e7243246493546bd4012cac698eb26e35459ef54296d`.
Source and imported model hashes, geometry statistics, bounds and importer warnings are retained
in [import-report.json](import-report.json). Repeating UVs cause the optimizer to log that it keeps
UVs unquantized; this is intentional and renders correctly.
