import { World } from '@bendyline/molen-kernel';
import { describe, expect, it } from 'vitest';
import { installRapier } from '../src/index';

// This file must NOT call initRapier(): it pins the guidance for the most common integration
// mistake. Vitest isolates module state per file, so the init flag is untouched here even
// though the other suites await initRapier() in their own files.
describe('installRapier without initRapier', () => {
  it('names the missing init instead of surfacing a raw WASM error', () => {
    const w = new World({ tickRate: 60, seed: 'init-guard' });
    let thrown: unknown;
    try {
      installRapier(w);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('Rapier is not initialized');
    expect(message).toContain('await initRapier() before installRapier()');
    // The opaque WASM failure is kept as the cause rather than swallowed.
    expect((thrown as Error).cause).toBeDefined();
  });
});
