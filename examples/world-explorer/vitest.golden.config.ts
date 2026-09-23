import { defineConfig } from 'vitest/config';

// Golden-image tests play the built explorer in headless Chromium (Playwright + SwiftShader), so
// they run as a separate task (test:golden) after `pnpm build`, not with the fast unit tests.
//
// The budget is deliberately generous. A scenario spends most of its time inside `wait-for-stable`
// on the streaming HUD, and on a software rasterizer that settle can take minutes — the synthetic
// lineup's switch to Human mode measured 124-133s on a developer machine and about 240s on a
// 4-vCPU CI runner, which is why that one wait allows 600s. These numbers are
// "this is definitely wedged" thresholds, not expected durations: a healthy runner finishes far
// inside them, so raising them costs nothing when things work. testTimeout must stay above the sum
// of every scenario's own action timeouts (test/visual/*.play.json), or vitest kills the run first
// and the scenario's precise failure message — which action, which probe text — is lost; the
// largest sum today is store-library's and walk-mode's, about 1200s.
//
// Files run one at a time, for the reason `test:golden` pins --workspace-concurrency=1: each file
// drives its own software-rasterized browser, and on a 4-vCPU CI runner three at once starved the
// streaming scenarios until they missed their 240s settles with layers still loading.
export default defineConfig({
  test: {
    include: ['test/golden/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 1_500_000,
    hookTimeout: 60_000,
  },
});
