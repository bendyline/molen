/// <reference types="node" />
import { join } from 'node:path';
import { runReplayFile } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// A committed replay fixture is the long-lived half of the determinism guarantee. The pinned hash
// in headless.test.ts freezes one run of the current build; this freezes a *recorded command log*
// plus per-tick reference hashes, so when behaviour drifts the harness reports the first tick that
// diverged instead of "the hash moved". It also distinguishes a non-deterministic build from an
// intentional behaviour change — refresh with `molen replay <fixture> --record`.

describe('top-down-arena: recorded replay', () => {
  it('reproduces the recorded run tick for tick', async () => {
    const result = await runReplayFile({
      path: join(process.cwd(), 'arena-skirmish.replay.json'),
    });
    expect(result.error).toBeUndefined();
    expect(result.ok, result.report).toBe(true);
    expect(result.actualHash).toBe(result.expectedHash);
    expect(result.firstDivergentTick).toBeUndefined();
  }, 60_000);
});
