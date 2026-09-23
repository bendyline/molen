# Local model comparison: structure workshop

Status: the September 22 retry and standalone-prompt campaign is running. Earlier results are retained below; no earlier local trial completed the entire two-asset workflow within 20 minutes. [Live campaign status and output folders](../../.artifacts/structure-workshop/model-comparison/september22/README.md).

## Method

The same `molen-structure-workshop-assets` scenario prepares two requests (an American brick school and the Space Needle) and frozen reference photographs. Each model receives the unchanged project craftbook, compact geometry format and [Molen building style guide](../../docs-src/guide/3d-art-guidelines.md). No geometry or review answers are supplied. Each baseline has an explicit 20-minute budget, one native inference slot and catalog tuning. Research orchestration is excluded from this modeling comparison. Live Commons search has a separate smoke test.

One run per configuration is exploratory evidence, not a success-rate estimate. Completion requires real GLBs, textures, eight rendered views per asset, image-read receipts and a passing review. An independent visual judgment remains separate from technical gates and the fixed eval composite. Incomplete source compiled afterward by the operator is labeled diagnostic and never counted as an autonomous build.

## Results

| Configuration | Autonomous result | Visual assessment |
| --- | --- | --- |
| Qwen 3.8 27B Q4, MLX, earlier corrected-vision trial `x6s5` | Timed out at 20 minutes; recipe written, no compiler invocation | No autonomous render. Separate unchanged-recipe operator diagnostic: 2/10, rejected for occluded windows/door and floating supports. |
| Muse Glimmer 30B Q4, llama.cpp, `fnko` | Timed out at 20 minutes; 11 tool calls, one image read, research notes only | `noArtifact`: no recipe, GLB, textures or screenshots. |
| Qwen 3.8 Flash Next Q2, DS4, `ojf4` | Timed out at 20 minutes; 13 tools, research and recipe saved; reproduced approval-handoff defect blocked continuation | No autonomous render. Separate unchanged-recipe diagnostic: 6/10, useful school prototype with uneven window rhythm and coarse stone detailing. |
| Muse Glimmer 30B Q4, 512-token thinking budget, `fjf7` | Timed out at 20 minutes; 41 tools, 17 image reads, two school renders, no accepted child or Needle recipe | 2/10 for both autonomous revisions. A separate compile of its final saved recipe remains 2/10. |
| Gemma 4 31B oQ4, MLX, `s0p4` | Timed out at 20 minutes; research and recipe saved; manager recovery delayed the approved build continuation | No autonomous render. Separate unchanged-recipe diagnostic: 4/10, plausible front but unfinished sides/rear and roof/foundation. |

The earlier GPT-5.5 full-workflow trial `e0lm` completed both assets in 310 seconds, with independent visual scores of 6/10 each. It exercised the larger preparation workflow and remains a useful frontier reference, not a matched timing baseline for these prepared-input trials.

## Muse baseline

Run: `molen-structure-workshop-assets-muse-glimmer-30b-q4-2026-09-22T02-10-56-778Z-fnko`.

The first file write (research notes) arrived about 15 minutes after task startup. Native logs show long planning passes before ordinary tools, including roughly 343 seconds of generation before listing package scripts. No operator changed the task or geometry during the run. The fixed composite is 3.3/10; its partial-output credit is for research notes, not a usable 3D asset.

The follow-up used the existing `GEZEL_LLAMA_REASONING_BUDGET_TOKENS=512` override versus the catalog's 4,096, retaining sampling and prepared inputs. Native launch and request logs confirm the override. Research was saved around four minutes and the first render around eight, followed by a second around fifteen. The approval fix was also present, so this is not a pure end-to-end timing A/B; the baseline never reached an approval. No catalog tuning changed, and an unrelated task must be tested before recommending a model-wide default.

Both rendered revisions have windows floating beyond the building, unfinished facades and an obscured entrance. Muse inspected all eight views of each and attempted repairs instead of claiming acceptance. It saved another recipe just before timeout; a separate operator compile still has outlying windows. Geometry quality remains **2/10**. The live build nevertheless verifies the repaired command approval continuation.

The raw recording has 41 tool calls and 17 image reads. The fixed facts extractor sees only the last completed persisted turn (17 tools and one image), omitting the interrupted continuation. Its 3.3 composite is preserved, with this limitation noted in the postmortem. Use the raw events and preserved workspace for the full process evidence.

![Muse autonomous revision 2](../../.artifacts/structure-workshop/model-comparison/muse-512/revision-2-contact.png)

After this trial copied its inputs, the recipe README was clarified: rotation affects shape orientation, while repetition steps use world coordinates. This did not change any completed trial. A generic facade-relative opening primitive is a useful next format experiment; successful JSON/GLB serialization alone does not prevent spatial errors.

## Flash Next baseline

Run: `molen-structure-workshop-assets-ds4-qwen3-8-flash-next-q2-2026-09-22T02-33-07-546Z-ojf4`.

The model saved a 37-part school recipe around 17 minutes into the trial and requested a build. The harness answered its approval at 02:51:56 UTC, but the provider continued the same inference turn, blocking the queued follow-up until the hard deadline. This endpoint is framework-confounded. The raw automatic `model-default` classification is preserved alongside a manual adjudication; do not aggregate it as a clean capability failure. Long planning before the command is still a valid observation. Whether the repaired workflow would have completed both buildings is unmeasured.

After the run, the operator compiled the unchanged recipe in a separate diagnostic directory. It produced a verified 948-triangle GLB, eight texture PNGs and eight screenshots. Actual visual inspection found a recognizable grounded school with visible windows on all sides, a double entrance and pale stone steps/trim. Window rhythm is uneven and the portal is coarse. Independent score: **6/10**, a useful exterior prototype. No Space Needle recipe existed. This diagnostic never changes the autonomous failure result.

![Flash Next operator diagnostic](../../.artifacts/structure-workshop/model-comparison/flash-diagnostic/school-contact.png)

## Framework checks

- The llama.cpp tool loop previously dropped rich MCP image results. It now forwards pixels after complete tool/result pairs and refuses image inspection when no projector is loaded. DS4 shares that tool loop. An actual Muse service/MCP probe identified the synthetic image's shapes, colors and text. This establishes basic perception, not architectural quality.
- Explicit eval timeouts now take precedence over the large-model engine's default floor. Without an explicit timeout, throughput scaling and engine floors remain active. The DS4 baseline therefore uses the same 20-minute limit instead of silently receiving two hours.
- Structured pending command approvals now cause llama.cpp/DS4, MLX and broker-backed sessions to yield after their tool-result batch, allowing the queued approval answer to continue the task. Text in ordinary files cannot trigger this signal. The focused approval/bridge/pool/vision/cache suite passes 106 tests; the additional remote/session/approval suite passes 32, with eight new handoff regressions across the paths. Service typecheck and build pass.
- Focused verification: 219 llama.cpp provider/wire/image tests, 171 eval-runner tests, service and eval typechecks, and formatting checks passed.
- Flash Next's DS4 engine does not accept llama.cpp's numeric thinking-budget request field. Gezel deliberately omits it. The catalog's 4,096 value must not be reported as an enforced DS4 limit; the baseline requests its catalog `xhigh` effort.

Two Muse cache-preparation failures and one Flash Next launcher logging failure happened before model work and are excluded from modeling results. All completed evals retain raw recordings and final snapshots under Gezel's `evals/runs/`.

## Installed payloads and artifacts

- Muse: existing `.gezel-dev/engines/llama-cpp/models/muse-glimmer-30b-q4`, weights and projector hashes verified. Isolated APFS clones use the current catalog metadata for the same payload; the original install is unchanged.
- Flash Next: existing `.gezel-dev/engines/ds4/models/qwen3.8-flash-next-q2`, Q2 weights and Q8 vision encoder. Its 137 GiB on-disk file includes disk-only lookup data; file size is not resident RAM. An isolated clone uses current catalog metadata with the same pinned payload identity. No Flash Next weights were downloaded.
- Gemma: the requested `gemma4-31b-q4` MLX payload includes a vision tower and was installed in `.gezel-dev` with SHA256 verification at 04:20 UTC on September 22 (9:20 p.m. Pacific, September 21).
- [Muse baseline evidence](../../.artifacts/structure-workshop/model-comparison/muse-baseline/PROVENANCE.md).
- [Muse 512-budget renders and evidence](../../.artifacts/structure-workshop/model-comparison/muse-512/PROVENANCE.md), and its [separate final-recipe diagnostic](../../.artifacts/structure-workshop/model-comparison/muse-512-diagnostic/PROVENANCE.md).
- [Flash Next baseline evidence](../../.artifacts/structure-workshop/model-comparison/flash-baseline/PROVENANCE.md) and [separate diagnostic screenshots/model](../../.artifacts/structure-workshop/model-comparison/flash-diagnostic/PROVENANCE.md).
- [Live image-handoff probes](../../.artifacts/structure-workshop/vision-handoff/).
- [Earlier Qwen diagnostic screenshots](../../.artifacts/structure-workshop/qwen-vision-diagnostic/brick-school/revisions/1/shots/).

Prior unrelated Flash Next Q2 trials passed tic-tac-toe and symptom-debug in 85 and 82 seconds respectively. Those demonstrate functioning general tool use but do not establish success on this longer visual workflow. No unrelated Muse trial was available locally when this comparison began.

Gemma download status is tracked in `/tmp/workshop-gemma-install-status.json`; transport progress is in `/tmp/workshop-gemma-cdn-download.log`. A bounded completion monitor resumes failed transfers using existing partial files and the normal catalog checksum verifier. The independent fourth-shard download is only handed to the installer after its full SHA256 matches. The installer published its verified manifest at 04:20 UTC. A live Gezel/MCP/MLX probe correctly described a yellow triangle, two purple circles and the text MINT 83 in 16.3 seconds. The completed evaluation used the clarified coordinate documentation and provider handoff fixes; no geometry answers were seeded.

## Gemma 31B result

Trial s0p4 timed out after 1,211.0 seconds. Eleven tools included one failed image-path attempt, one successful reference read, research and a 12-part recipe. It reached the build request only at minute 19. The provider correctly yielded for approval, but the chat manager started a recovery turn immediately, delaying the approved answer until timeout. This is a different remaining layer of the approval handoff bug, now reproduced and fixed. Clean completion after the fix is unmeasured.

The unchanged recipe compiles separately to 288 triangles, six texture PNGs and eight screenshots. Actual inspection scores it **4/10**: readable school-like front with correctly placed windows, but blank side/rear facades, rudimentary entrance, and incomplete roof/foundation coverage. Better spatial placement than Muse; less complete than Flash Next. The diagnostic is not an autonomous success.

[Gemma evidence](../../.artifacts/structure-workshop/model-comparison/gemma-baseline/PROVENANCE.md) · [Diagnostic model/screenshots](../../.artifacts/structure-workshop/model-comparison/gemma-diagnostic/PROVENANCE.md)

![Gemma operator diagnostic](../../.artifacts/structure-workshop/model-comparison/gemma-diagnostic/school-contact.png)

## September 22 retries and new prompts

The local queue contains ten trials with an explicit 20-minute budget each: Gemma 31B and Flash Next retry the original two-asset request after both approval-handoff fixes, then all four local models run the Space Needle and medium-size American football stadium separately. The standalone landmark uses the original request and photo unchanged. The stadium is an original design with roughly 25,000-seat proportions, a marked field, goalposts, stepped stands, aisles, press box, scoreboard, floodlights, concourse and finished exterior. See [the exact stadium prompt](fixtures/requests-stadium.json) and [reference attribution](fixtures/references/football-stadium.PROVENANCE.md).

Native models run sequentially. Muse retains the explicitly experimental per-run 512-token reasoning limit; no global model tuning changes. Real reference images are seeded, geometry and reviews are not. Each output must still pass the compiler, eight-view image-read evidence and bounded visual review. The new eval gates also require the collected IDs to match the requested IDs exactly. GPT-5.5 is used separately as an end-to-end control for the new standalone cases.

The [campaign manifest](../../.artifacts/structure-workshop/model-comparison/september22/status.json) records exact commands, source hashes, status and run directories. The [live index](../../.artifacts/structure-workshop/model-comparison/september22/README.md) links preserved autonomous outputs, textured GLBs and screenshot contact sheets as each trial completes. A built model is not automatically an independent visual approval.

The eval facts extractor now reconciles tool counts per session across persisted transcripts and project history. This recovers Muse's 41 observed calls and 17 image reads rather than its earlier interrupted-transcript count of 17 calls. New reports use the corrected observation counts; old scores are retained as originally written until explicitly rescored. The scoring rubric itself is unchanged.

### Early campaign evidence

The standalone GPT-5.5 controls passed: Space Needle in 349.5 seconds (2,616 triangles, 10 texture PNGs; independent visual score 5/10) and stadium in 341.9 seconds (2,832 triangles, 14 texture PNGs; 6/10). Each has eight actual views and image-read receipts. Both are useful prototypes, with optimistic self-review scores.

Gemma retry 8ow1 produced its first autonomous school render near minute 20 (276 triangles). The approval handoff resumed in under two seconds; a subsequent model turn executed the compiler. The trial is still running. The runtime granted a progress extension to 35 minutes; 20 minutes is the starting budget, with a maximum of 40 when deliverables keep moving. See the campaign BUDGETS.md.
