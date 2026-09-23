import { defineConfig } from 'vitest/config';

// Golden-image tests play the built explorer in headless Chromium (Playwright + SwiftShader), so
// they run as a separate task (test:golden) after `pnpm build`, not with the fast unit tests.
//
// The budget is deliberately generous. A scenario spends most of its time inside `wait-for-stable`
// on the streaming HUD, and on a software rasterizer that settle can take minutes. The switch to
// Human mode is the slowest step: the synthetic lineup's measured 124-133s on a developer machine
// and about 240s on a 4-vCPU CI runner, and store-library's (40-45s locally) projects to over 200s
// on the slowest runners seen, which run it 3-5x slower than a developer machine. So every wait
// after a switch to Human mode allows 600s. Screenshots in those dense scenes allow 120s instead of
// the default 30s: the lineup's takes about 7s locally (0.4s before the switch). These numbers are
// "this is definitely wedged" thresholds, not expected durations: a healthy runner finishes far
// inside them, so raising them costs nothing when things work. testTimeout must stay above the sum
// of every scenario's own action timeouts (test/visual/*.play.json), or vitest kills the run first
// and the scenario's precise failure message — which action, which probe text — is lost; the
// largest sum today is store-library's, about 2280s.
//
// Files run one at a time, for the reason `test:golden` pins --workspace-concurrency=1: each file
// drives its own software-rasterized browser, and on a 4-vCPU CI runner three at once starved the
// streaming scenarios until they missed their 240s settles with layers still loading.
export default defineConfig({
  test: {
    include: ['test/golden/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 2_400_000,
    hookTimeout: 60_000,
  },
});
