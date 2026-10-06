import { defineConfig } from 'vitest/config';

// Golden-image tests play the built explorer in headless Chromium (Playwright + SwiftShader), so
// they run as a separate task (test:golden) after `pnpm build`, not with the fast unit tests.
//
// The budget is deliberately generous. A scenario spends most of its time inside `wait-for-stable`
// on the streaming HUD, and on a software rasterizer that settle can take minutes; CI runners run
// 3-5x slower than a developer machine. The timeouts are "this is definitely wedged" thresholds,
// not expected durations, so raising them costs nothing when things work. testTimeout must stay
// above the sum of every played scenario's own action timeouts, or vitest kills the run first and
// the scenario's precise failure message — which action, which probe text — is lost; today the
// only played scenario is walk-navigation's test/visual/walk-mode.play.json, about 2300s.
//
// Scenarios that stream real map data in Human mode (store library, soundscape, live quality,
// tunnels) were removed from this lane: on CI they failed far more often from software-rendering
// speed than from regressions, and unit tests cover their logic. Their play files that remain in
// test/visual are for manual review with `molen play`.
//
// Files run one at a time, for the reason `test:golden` pins --workspace-concurrency=1: each file
// drives its own software-rasterized browser, and on a 4-vCPU CI runner three at once starved the
// streaming scenarios until they missed their 240s settles with layers still loading.
export default defineConfig({
  test: {
    include: ['test/golden/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 3_600_000,
    hookTimeout: 60_000,
  },
});
