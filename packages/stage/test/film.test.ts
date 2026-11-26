import { componentHandle } from '@bendyline/molen-kernel';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { compileFilm, type FilmDoc, lintFilm } from '../src/index';
import { build } from './bot';

const TRANSFORM = componentHandle('transform');
const FIGURE_INTENT = componentHandle('figureIntent');

const meeting: FilmDoc = {
  format: 'molen/film@1',
  name: 'The Meeting',
  look: 'evening',
  set: { ground: 'plaza', props: [{ id: 'fountain', shape: 'fountain', at: [0, 0] }] },
  marks: { west: [-8, 3], east: [3, 3] },
  cast: [
    { id: 'ana', preset: 'human.adult', at: 'west' },
    { id: 'ben', preset: 'human.adult', at: 'east' },
    { id: 'rex', preset: 'dog', at: [5, -1] },
  ],
  beats: [
    { at: 0, who: 'ben', do: 'look-at', target: 'ana' },
    { at: 1, who: 'ana', do: 'walk-to', target: 'ben', seconds: 5 },
    { at: 7, who: 'rex', do: 'sit' },
  ],
  shots: [
    { at: 0, kind: 'wide', on: ['ana', 'ben'] },
    { at: 6, kind: 'close', on: ['ana', 'ben'] },
    { at: 8, kind: 'push-in', on: 'rex' },
  ],
  captions: [{ at: 0.5, seconds: 3, text: "Saturday, nine o'clock." }],
};

const pos = (w: ReturnType<typeof build>, id: string): number[] =>
  (w.get(id, TRANSFORM) as { pos: number[] }).pos;

describe('compiled films', () => {
  it('compiles to a valid data-only scene with its camera track and captions inline', () => {
    const r = compileFilm(meeting);
    if (!r.ok) throw new Error(r.formatted);
    expect(r.scene.scripts).toEqual([]);
    const v = validateByKind('scene', r.scene);
    expect(v.ok, v.ok ? '' : v.formatted).toBe(true);
    const keys = r.scene.cameraTrack?.keyframes ?? [];
    expect(keys.length).toBeGreaterThan(3);
    expect(keys.filter((k) => k.cut === true)).toHaveLength(2);
    expect(r.scene.hud?.captions?.[0]).toEqual({
      tick: 15,
      ticks: 90,
      text: "Saturday, nine o'clock.",
    });
    expect(r.info.lengthTicks).toBe(270);
  });

  it('plays the beats as data: the walker stops beside the other person and the dog sits', () => {
    const r = compileFilm(meeting);
    if (!r.ok) throw new Error(r.formatted);
    const w = build(r.scene);
    w.stepN(r.info.lengthTicks);
    const a = pos(w, 'ana');
    const b = pos(w, 'ben');
    const gap = Math.hypot(
      (a[0] as number) - (b[0] as number),
      (a[2] as number) - (b[2] as number),
    );
    expect(gap).toBeGreaterThan(0.9);
    expect(gap).toBeLessThan(1.5);
    expect((w.get('rex', FIGURE_INTENT) as { mode?: string } | undefined)?.mode).toBe('sit');
    expect((w.get('ben', FIGURE_INTENT) as { lookAt?: unknown } | undefined)?.lookAt).toEqual({
      entity: 'ana',
    });
  });

  it('stands a flag on its tower and the tower on its hill', () => {
    const r = compileFilm({
      format: 'molen/film@1',
      name: 'Tower',
      set: {
        props: [
          { id: 'hill', shape: 'hill', at: [0, 0] },
          { id: 'tower', shape: 'tower', on: 'hill' },
          { id: 'flag', shape: 'flag', on: 'tower' },
        ],
      },
      shots: [{ at: 0, kind: 'push-in', on: 'tower' }],
    });
    if (!r.ok) throw new Error(r.formatted);
    const ent = (id: string) =>
      r.scene.entities.find((e) => e.id === id)?.components.transform as { pos: number[] };
    const tower = ent('tower').pos;
    const flag = ent('flag-pole').pos;
    expect(tower[1]).toBeGreaterThan(3); // on the hill
    expect((flag[1] as number) - 1.1).toBeGreaterThan((tower[1] as number) + 2.9); // above the tower top
  });

  it('loops by putting everyone back on their marks', () => {
    const r = compileFilm({ ...meeting, loop: true, length: 9 });
    if (!r.ok) throw new Error(r.formatted);
    const director = r.scene.entities.find((e) => e.id === 'director')?.components.cues as {
      loop: number;
    };
    expect(director.loop).toBe(270);
    const w = build(r.scene);
    w.stepN(271);
    expect(pos(w, 'ana')[0]).toBeCloseTo(-8, 3);
  });

  it('names an unknown cast member with a did-you-mean', () => {
    const r = compileFilm({
      ...meeting,
      beats: [{ at: 1, who: 'anna', do: 'walk-to', target: 'ben' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.formatted).toContain('did you mean "ana"?');
  });
});

describe('film lint', () => {
  it('finds nothing to report in a well-staged film', () => {
    expect(lintFilm(meeting)).toEqual([]);
  });

  it('reports a subject hidden behind a prop', () => {
    // a wide shot taken from the usual side: the house stands between the camera and the horse
    const issues = lintFilm({
      format: 'molen/film@1',
      name: 'Hide and seek',
      set: { props: [{ id: 'house', shape: 'house', at: [0, -1] }] },
      cast: [
        { id: 'horse', preset: 'horse', at: [0, -5] },
        { id: 'kid', preset: 'human.child', at: [0, 6] },
      ],
      shots: [{ at: 0, kind: 'wide', on: ['horse', 'kid'] }],
    });
    const hidden = issues.filter((i) => i.code === 'subject_hidden');
    expect(hidden.map((i) => i.message)).toEqual([
      'in the wide shot at 0.0 s, "horse" is mostly hidden behind "house"',
    ]);
  });
});
