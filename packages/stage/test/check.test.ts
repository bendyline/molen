import { describe, expect, it } from 'vitest';
import { checkDocument, documentKind } from '../src/index';

const film = {
  format: 'molen/film@1',
  name: 'Two Friends',
  look: 'morning',
  cast: [
    { id: 'ana', preset: 'human.adult', at: [-4, 0] },
    { id: 'ben', preset: 'human.adult', at: [4, 0] },
  ],
  beats: [{ at: 1, who: 'ana', do: 'walk-to', target: 'ben', seconds: 4 }],
  shots: [{ at: 0, kind: 'wide', on: ['ana', 'ben'] }],
};

const game = {
  format: 'molen/game@1',
  name: 'Pond Run',
  kind: 'top-down',
  layout: { archetype: 'arena', size: 'small' },
  pieces: { P: { role: 'player' }, o: { role: 'pickup', count: 3 } },
  win: { collect: 'all' },
};

const scene = {
  format: 'molen/scene@3',
  name: 'porch',
  seed: 'porch',
  tickRate: 30,
  entities: [
    {
      id: 'floor',
      components: {
        transform: { pos: [0, -0.05, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#8a6f4e' },
        primitive: { size: [8, 0.1, 8] },
      },
    },
    {
      id: 'ana',
      components: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'figure' },
        figure: { preset: 'human.adult' },
      },
    },
  ],
};

describe('checkDocument', () => {
  it('tells the three documents apart by format', () => {
    expect([film, game, scene].map(documentKind)).toEqual(['film', 'game', 'scene']);
    expect(documentKind({ format: 'molen/prefab@1' })).toBeNull();
    expect(documentKind('molen/film@1')).toBeNull();
  });

  it('compiles a film and says what it is', () => {
    const r = checkDocument(film);
    expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe('film');
      expect(r.scene.scripts).toEqual([]);
      expect(r.summary).toMatch(
        /^a film "Two Friends" \d+\.\d s long with 2 cast members and 0 props$/,
      );
    }
  });

  it('compiles a game and names its level size', () => {
    const r = checkDocument(game);
    expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
    if (r.ok) expect(r.summary).toMatch(/^a top-down game "Pond Run" on a level \d+ cells wide/);
  });

  it('validates a scene with a figure that names no ref', () => {
    const r = checkDocument(scene);
    expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
    if (r.ok) expect(r.summary).toBe('a data-only scene "porch" with 2 entities');
  });

  it('refuses a scene that carries scripts', () => {
    const r = checkDocument({ ...scene, scripts: [{ id: 'behavior', code: 'export default {}' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.map((i) => i.code)).toEqual(['scripts_not_allowed']);
      expect(r.formatted).toContain('a data-only scene has no scripts');
    }
  });

  it('returns a film or game document’s own issues', () => {
    const r = checkDocument({ ...film, beats: [{ at: 1, who: 'anna', do: 'sit' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('film');
      expect(r.formatted).toContain('did you mean "ana"?');
    }
  });

  it('names the formats it reads when given something else', () => {
    const r = checkDocument({ format: 'molen/prefab@1' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBeNull();
      expect(r.formatted).toContain('"molen/film@1", "molen/game@1", "molen/scene@3"');
    }
  });
});
