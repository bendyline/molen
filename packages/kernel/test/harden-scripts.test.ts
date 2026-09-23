import { describe, expect, it } from 'vitest';
import { componentHandle } from '../src/component';
import { hardenScripts, installScripting, scriptsHardened } from '../src/scripting';
import { stateHash } from '../src/snapshot';
import { World } from '../src/world';

// SES lockdown() is process-global and irreversible, so this whole FILE runs behind one call to
// hardenScripts(): vitest gives each test file its own process, which is what makes that safe.
// The un-hardened half of the story (a script reaching the host global) is pinned in
// scripting.test.ts, which runs in a process nobody locked down.
const firstCall = hardenScripts();
const secondCall = hardenScripts();

const Counter = componentHandle<{ n: number }>('counter');
const Tag = componentHandle<{ name: string }>('tag');

/** Run `source` as a script and return what it wrote into `probe`'s tag component. */
function probe(source: string, seed = 'harden'): string {
  const w = new World({ tickRate: 30, seed });
  w.spawnRaw({ tag: { name: '' } }, 'probe');
  installScripting(w, [{ id: 'probe', source }]);
  w.stepN(1);
  return w.get('probe', Tag)?.name ?? '';
}

describe('hardenScripts', () => {
  it('is idempotent: the first call locks down, later calls report it was already done', () => {
    expect(firstCall).toBe(true);
    expect(secondCall).toBe(false);
    expect(hardenScripts()).toBe(false);
    expect(scriptsHardened()).toBe(true);
  });

  it('closes the constructor("return globalThis") route to a mutable host global', () => {
    const reported = probe(
      `
      let out;
      try {
        const g = (() => {}).constructor('return globalThis')();
        out = { escaped: true, frozen: Object.isFrozen(g), hasProcess: typeof g.process };
      } catch (error) {
        out = { escaped: false, message: String(error && error.message) };
      }
      molen.on('tick', () => { molen.set('probe', 'tag', { name: JSON.stringify(out) }); });
    `,
    );
    const out = JSON.parse(reported) as { escaped: boolean; frozen?: boolean };
    // Either the escape throws (SES tames Function.prototype.constructor) or what it hands back
    // is a frozen realm. What must NOT happen is a writable host global.
    expect(out.escaped && out.frozen !== true).toBe(false);
  });

  it('makes the shared intrinsics unwritable from a script', () => {
    const reported = probe(
      `
      let assigned;
      try {
        Array.prototype.__molenHardenProbe = 1;
        assigned = [].__molenHardenProbe === 1;
      } catch (error) { assigned = 'threw'; }
      molen.on('tick', () => { molen.set('probe', 'tag', { name: String(assigned) }); });
    `,
      'pollution',
    );
    expect(reported).not.toBe('true');
    // And the host realm the kernel itself runs in is untouched.
    expect((Array.prototype as unknown as Record<string, unknown>).__molenHardenProbe).toBe(
      undefined,
    );
  });

  it('still ticks a world: systems, scripts, rng and the state hash all work after lockdown', () => {
    const run = (): { n: number; hash: string } => {
      const w = new World({ tickRate: 30, seed: 'post-lockdown' });
      w.spawnRaw({ counter: { n: 0 } }, 'c');
      installScripting(w, [
        {
          id: 'inc',
          config: { step: 2 },
          source: `
            molen.on('tick', () => {
              const c = molen.get('c', 'counter');
              molen.set('c', 'counter', { n: c.n + config.step });
              molen.spawn({ tag: { name: 'r' + molen.math.floor(molen.rng() * 100) } });
            });
          `,
        },
      ]);
      w.stepN(5);
      return { n: w.get('c', Counter)?.n ?? -1, hash: stateHash(w) };
    };
    const a = run();
    expect(a.n).toBe(10);
    // Determinism survives hardening (it never depended on it).
    expect(run().hash).toBe(a.hash);
  });
});
