import { defineConfig } from 'vitest/config';

// Golden-image tests play the built explorer in headless Chromium (Playwright + SwiftShader), so
// they run as a separate task (test:golden) after `pnpm build`, not with the fast unit tests.
//
// The budget is deliberately generous. A scenario spends most of its time inside `wait-for-stable`
// on the streaming HUD, and on a software rasterizer that settle can take minutes — the synthetic
// lineup measured 124s for a single layer switch on a loaded developer machine. These numbers are
// "this is definitely wedged" thresholds, not expected durations: a healthy runner finishes far
// inside them, so raising them costs nothing when things work. They must stay above the sum of a
// scenario's own action timeouts (test/visual/*.play.json), or vitest kills the run first and the
// scenario's precise failure message — which action, which probe text — is lost.
export default defineConfig({
  test: {
    include: ['test/golden/**/*.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 60_000,
  },
});
