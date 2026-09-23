# Structure workshop: measured prototype results

Run date: 2026-09-21 (Pacific), continuing into 2026-09-22 UTC. This is a prototype for static, stylized building exteriors. It does not establish reliable autonomous production art, a general local-model capability ceiling, or a measured success rate across seeds.

The follow-up [local model comparison](MODEL-COMPARISON.md) records Muse Glimmer, Qwen Flash Next, the Gemma download, additional image/approval handoff fixes, and separately labeled diagnostic renders.

## What is implemented

The project-local [craftbook](../../.gezel/craftbooks/structure-workshop/versions/1.0.0/craftbook.json) takes 1–8 building requests. It prepares attributed reference images, creates one real Gezel child task per building, compiles a model-authored box/beam/lathe recipe, bakes canonical Molen material graphs into base-color and metallic/roughness PNGs, imports a GLB, validates and simulates a scene, captures eight views, and loops rejected reviews back to the builder. Three rendered revisions and nine total compiler attempts bound each asset. Each revision contains editable source, textures, runtime GLB, asset sidecar, scene, source inventory, documentation and screenshots.

All generation and review instructions link [Molen's building style guide](../../docs-src/guide/3d-art-guidelines.md). This avoids asking a small model to author glTF buffers and indices. The model still decides the geometry, proportions, materials and visual assessment; the compiler does not contain school or Space Needle templates.

`wikimedia_image_search` is a new Gezel tool backed by the Wikimedia Commons API. It returns reference-image URLs, source pages, creator credit and license metadata without an API key. A live smoke test searched Commons, downloaded a real exterior photograph, preserved its CC BY-SA attribution, and opened the image. Search results can be irrelevant and licenses differ by file. The craftbook teaches tool use; no model weights were trained.

## Evidence and comparison

Both eval scenarios run the actual project craftbook and real Molen compiler. A fresh workspace receives two requests and the same frozen Library of Congress photographs. No example geometry or review answers are seeded. `molen-structure-workshop` includes preparation and fanout; `molen-structure-workshop-assets` prepares inputs deterministically first to isolate modeling from research orchestration. These runs test interpreting photographs, not autonomous live web discovery. Commons discovery has a separate live tool smoke test.

| Trial | Result | Interpretation |
| --- | --- | --- |
| Assisted compiler baseline | Two verified textured assets; 1,824 school triangles and 1,808 Space Needle triangles | Recipes authored by the coding agent, manually inspected. Compiler/render proof only; not an autonomous Gezel model result. |
| Qwen 3.8 27B Q4 full, `hvtf` | Interrupted after 585 seconds, no compiled models | Valid writable setup, but did not finish request preparation. Incomplete workflow evidence, not a geometry ceiling. |
| GPT-5.5, `dgq0` | 378 seconds, generated both models, failed image-read requirement | Codex provider hid the scoped image tool; shell base64 output was not visual inspection. Framework failure. |
| GPT-5.5, `oe9t` | 419 seconds, actual image inspection; Space Needle approved, school rejected | Reviewer correctly objected to an obstructed doorway and missing rear windows. Failed compilation had consumed visual retry slots; compiler budget fixed. |
| GPT-5.5, `21dh` | 275 seconds, generated models, zero image reads; rejected | Making the tool available did not ensure use. Motivated the generic `imageEvidence` gate. |
| GPT-5.5, `qu3q` | 286 seconds, two completed children, 20 image reads, technical/receipt gate pass | Independent visual review rejected the school's blank rear and sides. Space Needle is usable as a stylized study. Tightened all-side review criteria. CLI compatibility was patched during this exploratory run. |
| GPT-5.5 stricter review, `fn3f` | 391 seconds, both first renders rejected and repaired, then stopped | Exposed Chromium IPC permission and stale generalist step-tag bugs during repair. Both fixed and regression-tested. |
| GPT-5.5, `taoc` | Interrupted at 401 seconds after both models rendered; one child complete | Repeated exact-command approvals replaced each other during fanout. Later progressed, but stopped to fix the store and rerun; do not score as a model ceiling. |
| Final GPT-5.5 run, `e0lm` | Completed in 309.7 seconds; 92 tool calls, 21 image reads, two accepted children | End-to-end autonomous craftbook proof with frozen references. No mid-run code changes or operator geometry edits. Art remains prototype quality. |
| Qwen with working vision, `x6s5` | 20-minute deadline; 17 tool calls, one real image read, no compiler invocation | Valid image handoff, incomplete modeling workflow. Advancement rejected for missing build receipt. |
| Qwen prepared-input run, `o011` | Operator-interrupted at 2,562 seconds; 50 tool calls, two image reads, no compiler invocation | **Invalid visual evaluation:** the old MLX handoff dropped image pixels despite successful receipts. Repeated recipe rewrites are observable, but this cannot establish visual ability. |

Setup probes with a stale model cache, missing project toolsets, default read-only external workspace, or a wrong fanout entry were excluded from capability claims. They remain in Gezel's eval logs. Use the `~/.gezel-dev` model source here: its installed Qwen catalog version is 1.0.4; the ordinary home had stale 1.0.2 weights.

An unchanged Qwen recipe snapshot was also compiled by the operator in a separate diagnostic directory. It produced a valid 636-triangle GLB and six texture PNGs. The renders show repeated windows extending beyond the building, a single window row and unfinished rear/side facades. This is **not** an autonomous build or an accepted model. It establishes that the recipe can serialize and render while the geometry still needs correction.

The post-fix prepared-input trial (`x6s5`) reached its 20-minute hard ceiling (1,207.2 seconds including cleanup). It made 17 tool calls: seven file reads, five directory listings, one real image read, three writes and one rejected advancement. It never invoked the compiler, completed no child, and produced no GLB. The gate correctly refused advancement without build.json. Actual vision inference is verified in engine logs; unlike the older run, pixels reached the model. Long reasoning passes and uncached visual prefill are both relevant. This single bounded failure does not establish that local models cannot generate geometry. Its mid-turn persisted session is incomplete; use recording, telemetry and daemon logs.

An operator-only post-trial compile of the unchanged `x6s5` recipe succeeded: 1,260 triangles and six texture PNGs. Independent inspection rejects it at **2/10**: blank facades, window planes buried inside the wall volumes or covered by solid trim, an obscured doorway and canopy posts floating above ground. This diagnostic demonstrates both valid serialization and actual geometry mistakes. It is stored separately from the timed-out trial and does not change its failure result. A generic facade-relative window/door primitive could reduce these coordinate/occlusion mistakes in a later format experiment.

## Independent visual assessment

These are visual judgments by the coding agent after opening the contact sheets; they are separate from the eval's fixed rubric and the model's 1–5 self-review scores.

| Output | Visual score / 10 | Judgment |
| --- | --- | --- |
| `frontier-gated/brick-school` | 5 | Recognizable two-storey front with stone portal and window rhythm; blank rear and side walls make it an unfinished full exterior. Do not treat the self-approval as production acceptance. |
| `frontier-gated/space-needle` | 7 | Recognizable saucer, antenna and open, splayed support structure; plausible at distance and rotated scale. Structural members and base are simplified; a low-poly landmark study. |
| `qwen-diagnostic/brick-school` | 3 | Valid textured geometry, but detached repeated windows and incomplete facade design are obvious visual defects. Reject. |
| `taoc/brick-school`, `taoc/space-needle` | 6, 5 | School now has rear and side windows and a clear entrance, but remains boxy and sparsely detailed. Tower silhouette is recognizable; support members are too spindly. Interrupted trial, not collection acceptance. |
| `qwen-vision-diagnostic/brick-school` | 2 | Operator-compiled unchanged post-fix recipe; window/door geometry is occluded and canopy posts float. Not usable as a finished school and not an autonomous success. |
| Final frontier assets | 6, 6 | School has a readable two-storey facade and entrance, but sparse rear/wing detailing. Needle silhouette is recognizable, with excessively thin support members. Both useful prototypes; neither polished production art. |

Local output folders under `.artifacts/structure-workshop/` are intentionally gitignored. `compiler-baseline/`, `commons-smoke/`, `frontier-rejected/`, `frontier-gated/`, `qwen-diagnostic/` and the final run folders preserve the actual artifacts on this machine. Do not call `qwen-diagnostic` a local-model success. Tracked fixture recipes reproduce only the assisted compiler baseline.

### Final frontier preview

![Frontier school contact sheet](../../.artifacts/structure-workshop/frontier-final/school-contact.png)

![Frontier Space Needle contact sheet](../../.artifacts/structure-workshop/frontier-final/needle-contact.png)

![Post-fix Qwen diagnostic, operator compiled](../../.artifacts/structure-workshop/qwen-vision-diagnostic/school-contact.png)

## Bugs fixed and what remains

- **Gezel image delivery:** Codex's provider excluded `read_image_as_base64` despite craftbooks requiring it. It is now exposed. The new `imageEvidence` gate requires successful workspace-image reads for every path in a manifest, scoped to the current child, step and activation. Artifact-drawer reads, earlier revisions, failed reads, unrelated tasks and shell base64 text cannot substitute. This proves image delivery, not correct judgment.
- **Gezel MLX image handoff:** the MCP bridge returned text only and the Python server dropped image fields. The provider now forwards successful image-tool pixels and attachments, launches the complete installed vision tower when enabled, validates bounded in-memory images, and uses an uncached vision path. Text KV state and Qwen multimodal position state are isolated under a shared generation lock. Real Qwen probes correctly read two distinct synthetic images, a real MCP image read, concurrent text/image requests, and text after vision. The machine-broker inference wire also preserves image history after tool pairs; its version-2 image extension fails explicitly on older/unsupported brokers rather than dropping pixels.
- **Gezel command execution:** `run_package_script` inserted npm's `--` separator when executing pnpm, which forwards it to the program. The shared runner now forwards the exact argument vector; the Molen CLI tolerates the old separator for compatibility.
- **Gezel fanout command approvals:** the approval store retained only one exact invocation per command name, so sibling tasks could invalidate each other's approvals. It now retains up to 64 independently approved exact hashes, serializes concurrent updates per project and clears the entire set on decline. Body, argument and input-file binding remain mandatory; no command-wide wildcard was introduced. Regression tests cover concurrent distinct invocations, changed inputs, migration and revocation.
- **Gezel Chromium startup:** approved workspace commands now permit Chromium's narrowly named Mach rendezvous registration on macOS. The real eight-view Molen render passes through this sandbox in 19 seconds. Write confinement and gate-script network denial remain in place. The rule uses the `global-name-regex` form also used by [WebKit's sandbox profile](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/com.apple.WebProcess.sb.in).
- **Gezel generalist repair evidence:** a reused bridge could retain `stepId=review` after the task returned to build. Image evidence now uses task identity and the current activation timestamp for generalist tasks; stepwise tasks retain the exact step tag requirement. An integration regression rejects earlier activations while accepting new reads through the stale generalist tag.
- **Gezel eval capture:** external trial workspaces were omitted from final snapshots. The harness now captures the project's actual working directory, including generated binary assets.
- **Molen screenshots:** inline scenes with an explicit project path lost the project asset registry, so capture could succeed while omitting the GLB. Inline scenes now load project context. A real-render golden regression checks geometry presence.
- **Workshop repair budget:** compile failures no longer consume the three opportunities to review a successfully rendered model. Failed attempt folders remain inspectable.
- **Molen source inventories:** the checker ignores Finder's `.DS_Store` metadata instead of treating it as an unlisted source asset.

The pre-fix Qwen session really had `run_package_script`, image reading, file writing and task advancement available (11 tools). The missing compiler invocation was not explained by a hidden command tool. However, the broken vision handoff invalidates any conclusion about image-informed geometry from that run. Its repeated rewrites hit Gezel's loop detector. The recovery message in `packages/service/src/providers/tool-repeat-tracker.ts` then demands another complete file write; that advice is poorly suited to a valid recipe awaiting compilation. A next framework experiment should distinguish invalid/incomplete source from a valid artifact awaiting its next validation action. Measure that change here and on an unrelated code-generation task before changing a global recovery prompt.

Another useful experiment is splitting recipe authoring from deterministic compilation, so a local model has fewer action choices before seeing render feedback. A separate critic can test whether independent review reduces the frontier model's optimistic self-scoring. No sampling or model-profile tuning was changed in this work.

A prior unrelated Qwen `fanout-stories` run completed five children with fixed-rubric composite 9.0, so these observations do not establish a general fanout failure or “frontier models only” conclusion. Current evidence supports the compact format and frontier prototype, with local orchestration and spatial quality still unresolved. The live image probes prove delivery and basic recognition, not asset quality.

## Validation

- Workshop: four deterministic tests pass, including real glTF/PBR/import/simulation, finite geometry and budgets, horizontal lathe rims, stale evidence, rejected scores and retry caps.
- Gezel: 188 focused Commons/tool-policy/provider tests, 171 gate/sandbox/workspace-command tests, 23 core schema tests and 169 eval-runner tests pass. After the fanout approval fix, all 26 approval/answer/script tests pass, including three new regressions. Service and eval typechecks pass. Core, client, MCP and service builds pass.
- MLX: 267 provider, Python-suite, capability and bridge-pool regressions pass; all five Pillow-enabled Python image tests and 76 MCP bridge integration tests pass. The additional remote-session/wire/real-service route suite passes 69 tests; an added seeded-image continuation test covers stateless MLX tool follow-ups. Live fixtures/results are preserved under `.artifacts/structure-workshop/vision-handoff/`.
- Molen: full workspace build passes. Tooling unit tests and all 29 tooling golden tests pass, including the explicit-project inline-GLB regression. The broad unit run had two worldgen timeouts; both affected files pass when rerun serially.
- Repository-wide Molen verification is **not entirely green**: `pnpm verify` stops at stale generated `landmark-catalog` schema docs associated with concurrent landmark changes. Two world-explorer golden tests still time out waiting for loaded map layers on serial rerun; these are outside the changed workshop/tooling path. The third world-explorer timeout from the broad run passes serially. Existing work was preserved.

This prototype does not produce interiors, rigging, custom gameplay collision, authored LODs or final KTX2 packing. Visual quality remains a judgment, not a property that hashes and JSON schemas can prove. Frontier CLI throughput/memory figures in the harness are not usable hardware benchmarks; use elapsed time and receipts here.

## MLX vision limits

Vision forwards the actual reference pixels, with PNG/JPEG/WebP decoding, 8 MiB per-image and 32 MiB aggregate image-file byte limits, at most 32 images and a 1,024-pixel maximum side. Images stay in the session history. Vision requests currently re-prefill that history without text-KV reuse or speculative decoding; long visual tool loops can therefore be much slower than text-only work. Engine-level vision support is explicit; disabling native vision or selecting a text-only checkpoint fails image reads clearly. Bound native MLX sessions advertise vision capability. Remote tool-image history is supported; automatic pasted-image routing through older remote admission metadata remains a separate limitation.

Synthetic recognition probes completed in 1.2–3.3 seconds per image; the real MCP/tool probe took 9.1 seconds. Those small prompts are not representative building-task throughput. The full-vision loop is new and has only been exercised on the installed Qwen checkpoint here.

## Reproduce

From Molen, after building installed packages:

```sh
pnpm -r build
pnpm structure:workshop:test
```

Open this repo as a writable Gezel project, allow its installed package command, and invoke `/structure-workshop` with a fresh `runId` and the building requests. Enable external research for live Commons discovery. See [README](README.md) for the request and recipe formats.

From the sibling Gezel `evals/` directory, after rebuilding the changed packages:

```sh
node --import tsx src/bin/run.ts molen-structure-workshop --provider codex-cli --model gpt-5.5 --generalist on --timeout 45m
node --import tsx src/bin/run.ts molen-structure-workshop-assets --provider mlx --model qwen3.8-27b-q4 --mlx-source-home /Users/mike/.gezel-dev --generalist on --timeout 45m
```

Set `MOLEN_REPO` if the built Molen checkout is not a sibling. Full logs, fixed-rubric scores, transcripts, tool histories and per-trial postmortems are in Gezel's `evals/runs/molen-structure-workshop*/` directories. The final eval workspace snapshot includes model assets; earlier exploratory snapshots were repaired from the preserved temporary workspaces.
