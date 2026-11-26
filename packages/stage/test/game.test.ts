import { applyKeyframeTo, stateHash, takeKeyframe } from '@bendyline/molen-kernel/data';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { compileGame, type GameDoc, lintGame } from '../src/index';
import { build, playGame } from './bot';

// The four briefs from the Phase 0 probe, as a small model wrote them with a layout.
const BRIEFS: Record<string, GameDoc> = {
  coin: {
    format: 'molen/game@1',
    name: 'Coin Garden',
    kind: 'top-down',
    layout: 'garden',
    look: 'noon',
    pieces: {
      P: { role: 'player', figure: 'human.child', speed: 5 },
      o: { role: 'pickup', count: 5, color: '#ffd166' },
      d: { role: 'hazard', figure: 'dog', move: 'patrol', speed: 2 },
    },
    win: { collect: 'all' },
    lose: { lives: 3 },
  },
  maze: {
    format: 'molen/game@1',
    name: 'Key Maze',
    kind: 'top-down',
    layout: 'maze',
    pieces: {
      P: { role: 'player', speed: 5 },
      k: { role: 'key' },
      D: { role: 'door' },
      G: { role: 'goal' },
      g: { role: 'hazard', move: 'patrol', speed: 2 },
    },
    win: { reach: 'goal' },
    lose: { lives: 3 },
  },
  platform: {
    format: 'molen/game@1',
    name: 'Flag Run',
    kind: 'platformer',
    layout: 'level',
    pieces: {
      P: { role: 'player', speed: 7 },
      F: { role: 'goal' },
      s: { role: 'hazard', count: 2 },
    },
    win: { reach: 'goal' },
    lose: { lives: 3 },
  },
  survive: {
    format: 'molen/game@1',
    name: 'Last Minute',
    kind: 'top-down',
    layout: 'arena',
    pieces: {
      P: { role: 'player', speed: 6 },
      e: { role: 'hazard', shape: 'sphere', move: 'chase', speed: 3 },
    },
    spawn: [{ piece: 'e', every: 5, max: 6 }],
    win: { survive: 60 },
    lose: { lives: 3 },
  },
};

describe('compiled games', () => {
  for (const [brief, doc] of Object.entries(BRIEFS)) {
    it(`${brief}: compiles to a valid data-only scene a bot can win, and lose`, () => {
      const r = compileGame(doc);
      if (!r.ok) throw new Error(r.formatted);
      expect(r.scene.scripts).toEqual([]);
      const v = validateByKind('scene', r.scene);
      expect(v.ok, v.ok ? '' : v.formatted).toBe(true);
      build(r.scene); // builds through the scripts-free entry
      const win = playGame(r.scene, { mode: 'win' });
      expect(win.result, JSON.stringify(win)).toBe('won');
      const lose = playGame(r.scene, { mode: 'lose' });
      expect(lose.result, JSON.stringify(lose)).toBe('lost');
    }, 120_000);
  }

  it('replays the same commands to the same state, also after a keyframe restore', () => {
    const r = compileGame(BRIEFS.coin);
    if (!r.ok) throw new Error(r.formatted);
    const drive = (w: ReturnType<typeof build>, from: number, to: number): void => {
      for (let t = from; t < to; t++) {
        if (t % 40 === 0) {
          const a = (t / 40) % 4;
          const dir = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
          ][a] as number[];
          w.submitCommand({
            kind: 'command',
            seq: t,
            source: 'local',
            tick: w.tick,
            type: 'move',
            payload: { dir },
          });
        }
        w.step();
      }
    };
    const a = build(r.scene);
    drive(a, 0, 400);
    const b = build(r.scene);
    drive(b, 0, 150);
    const kf = takeKeyframe(b);
    const c = build(r.scene);
    applyKeyframeTo(c, kf);
    drive(c, 150, 400);
    expect(stateHash(c)).toBe(stateHash(a));
  });
});

describe('layout archetypes and their knobs', () => {
  const base = (layout: GameDoc['layout'], kind: GameDoc['kind'] = 'top-down'): GameDoc => ({
    format: 'molen/game@1',
    name: 'Knobs',
    kind,
    layout,
    pieces:
      kind === 'platformer'
        ? { P: { role: 'player' }, F: { role: 'goal' }, o: { role: 'pickup', count: 3 } }
        : { P: { role: 'player' }, o: { role: 'pickup', count: 4 } },
    win: { collect: 'all' },
  });
  const mapOf = (doc: GameDoc): string[] => {
    const r = compileGame(doc);
    if (!r.ok) throw new Error(r.formatted);
    return r.info.map;
  };

  it('draws a different level for a different seed, and the same one for the same seed', () => {
    const a = mapOf(base({ archetype: 'garden', seed: 'a' }));
    expect(mapOf(base({ archetype: 'garden', seed: 'a' }))).toEqual(a);
    expect(mapOf(base({ archetype: 'garden', seed: 'b' }))).not.toEqual(a);
  });

  it('sizes a level by word or by columns and rows', () => {
    const small = mapOf(base({ archetype: 'arena', size: 'small' }));
    const large = mapOf(base({ archetype: 'arena', size: 'large' }));
    expect(large.length).toBeGreaterThan(small.length);
    const custom = mapOf(base({ archetype: 'arena', size: [21, 15] }));
    expect([custom.length, (custom[0] as string).length]).toEqual([15, 21]);
  });

  it('makes wide maze corridors two cells across', () => {
    const wide = mapOf(base({ archetype: 'maze', corridors: 'wide', size: 'large' }));
    expect(wide.some((row) => row.includes('....'))).toBe(true);
    const twoRows = wide.some(
      (row, r) =>
        r > 0 && row.slice(1, -1) === (wide[r - 1] as string).slice(1, -1) && row.includes('..'),
    );
    expect(twoRows).toBe(true);
  });

  it('keeps a flat level flat, and adds ledges when asked', () => {
    const flat = mapOf(base({ archetype: 'level', hills: 'flat', ledges: 'many' }, 'platformer'));
    const groundRows = flat.filter((row) => row.includes('#'));
    expect(groundRows).toHaveLength(1);
    expect(flat.some((row) => row.includes('='))).toBe(true);
  });

  it('places as many pillars as asked in an arena', () => {
    const count = (m: string[]): number =>
      m.slice(1, -1).join('').split('#').length - 1 - 2 * (m.length - 2);
    const none = mapOf(base({ archetype: 'arena', pillars: 'none' }));
    const many = mapOf(base({ archetype: 'arena', pillars: 'many' }));
    expect(count(many)).toBeGreaterThan(count(none));
  });
});

describe('drawn maps and lint', () => {
  const drawn: GameDoc = {
    format: 'molen/game@1',
    name: 'Walled In',
    kind: 'top-down',
    map: ['#######', '#P..#o#', '#...###', '#######'],
    pieces: { P: { role: 'player' }, '#': { role: 'wall' }, o: { role: 'pickup' } },
    win: { collect: 'all' },
  };

  it('refuses a map whose pickup cannot be reached, saying where it is', () => {
    const r = compileGame(drawn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.formatted).toContain('the pickup at column 5 cannot be reached');
    expect(lintGame(drawn).map((i) => i.code)).toContain('unreachable');
  });

  it('names an unknown map letter with a did-you-mean', () => {
    const r = compileGame({ ...drawn, map: ['#######', '#P..xo#', '#######'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.formatted).toContain('"x", which no piece defines');
  });

  it('warns when nothing can cost a life', () => {
    const doc: GameDoc = { ...drawn, map: ['#######', '#P..o.#', '#######'], lose: { lives: 3 } };
    expect(lintGame(doc).map((i) => i.code)).toContain('cannot_lose');
  });

  it('asks for a layout or a map, not both', () => {
    const r = compileGame({ ...drawn, layout: 'garden' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.formatted).toContain('not both');
  });
});
