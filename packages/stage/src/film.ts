import {
  formatIssues,
  getSchema,
  type JsonObject,
  type JsonValue,
  nearest,
  type PlayAction,
  registerSchema,
  type SceneCameraTrack,
  type SceneManifest,
  type ValidationIssue,
  validateByKind,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import {
  colorField,
  environmentFor,
  FIGURE_PRESET_NAMES,
  FIGURE_PRESETS,
  type FigurePreset,
  issue,
  type Look,
  lookField,
  primitive,
  round3,
  slug,
  TICK_RATE,
} from './common';

// molen/film@1: a short film as choices. The model names the cast, props, marks, beats and
// shots in seconds and ground points; this compiler does the staging (nobody walks into anyone,
// a flag stands on its tower), the framing (shots become camera keyframes on the subjects'
// bounds, a new shot is a cut) and the timing (beats become cues and paths). The output is a
// data-only scene@3 with its camera track inline: no scripts.

const FOV = 60;
const ASPECT = 16 / 9;

export type PropShape =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'ball'
  | 'rock'
  | 'tree'
  | 'bench'
  | 'lamp'
  | 'table'
  | 'tower'
  | 'hill'
  | 'flag'
  | 'fountain'
  | 'house'
  | 'car'
  | 'stall'
  | 'fence';

/** Prop presets: size in meters [width, height, depth] and a default color. */
export const PROP_SHAPES: Readonly<
  Record<PropShape, { size: [number, number, number]; color: string }>
> = {
  box: { size: [1, 1, 1], color: '#9a9a9a' },
  sphere: { size: [1, 1, 1], color: '#9a9a9a' },
  cylinder: { size: [1, 1, 1], color: '#9a9a9a' },
  ball: { size: [0.35, 0.35, 0.35], color: '#d1342f' },
  rock: { size: [1.2, 0.8, 1], color: '#8d8a84' },
  tree: { size: [2.4, 4.4, 2.4], color: '#4f8a3c' },
  bench: { size: [1.8, 0.95, 0.6], color: '#8b5a2b' },
  lamp: { size: [0.45, 3.8, 0.45], color: '#2f2f35' },
  table: { size: [2.4, 0.85, 1.2], color: '#8b5a2b' },
  tower: { size: [2.6, 6, 2.6], color: '#9a948a' },
  hill: { size: [18, 3.5, 18], color: '#6f9d58' },
  flag: { size: [0.9, 2.2, 0.1], color: '#d1342f' },
  fountain: { size: [3, 0.8, 3], color: '#8a8f99' },
  house: { size: [4, 3.2, 4], color: '#d8c3a5' },
  car: { size: [4, 1.4, 1.8], color: '#2e86de' },
  stall: { size: [2.5, 2.2, 1.4], color: '#c0392b' },
  fence: { size: [4, 1, 0.1], color: '#8b6b4a' },
};

export type Ground = 'grass' | 'plaza' | 'sand' | 'street' | 'wood' | 'snow' | 'dirt' | 'water';
const GROUNDS: Readonly<Record<Ground, string>> = {
  grass: '#7fae6a',
  plaza: '#b9b1a3',
  sand: '#dcc89a',
  street: '#6e6e72',
  wood: '#a0754b',
  snow: '#f2f4f7',
  dirt: '#9b7b58',
  water: '#4f7fa8',
};

export type BeatAction = 'walk-to' | 'run-to' | 'move-to' | 'roll-to' | 'sit' | 'stand' | 'look-at';
const MOVES: readonly BeatAction[] = ['walk-to', 'run-to', 'move-to', 'roll-to'];

export type ShotKind =
  | 'wide'
  | 'establishing'
  | 'medium'
  | 'close'
  | 'push-in'
  | 'pull-out'
  | 'orbit'
  | 'follow'
  | 'over-the-shoulder';

type XZ = [number, number];
type Place = string | XZ;

export interface FilmProp {
  id: string;
  shape: PropShape;
  at?: Place;
  on?: string;
  size?: [number, number, number];
  color?: string;
}
export interface FilmCastMember {
  id: string;
  preset: FigurePreset;
  at: Place;
  colors?: { top?: string; bottom?: string };
}
export interface FilmBeat {
  at: number;
  who: string;
  do: BeatAction;
  target?: Place;
  seconds?: number;
}
export interface FilmShot {
  at: number;
  kind: ShotKind;
  on: string | string[];
}
export interface FilmCaption {
  at: number;
  seconds?: number;
  text: string;
}

export interface FilmDoc {
  format: 'molen/film@1';
  name: string;
  look?: Look;
  length?: number;
  loop?: boolean;
  set?: { ground?: Ground; props?: FilmProp[] };
  marks?: Record<string, XZ>;
  cast?: FilmCastMember[];
  beats?: FilmBeat[];
  shots?: FilmShot[];
  captions?: FilmCaption[];
}

const xz = z.tuple([z.number(), z.number()]);
const place = z
  .union([z.string().min(1), xz])
  .describe('A mark name, a cast or prop id, or a ground point [x, z] in meters.');

export const filmSchema: z.ZodType<FilmDoc> = z.strictObject({
  format: z.literal('molen/film@1').describe("Always 'molen/film@1'."),
  name: z.string().min(1).describe('Title of the film.'),
  look: lookField.optional(),
  length: z
    .number()
    .positive()
    .max(120)
    .describe('Length in seconds (default: the last beat plus two seconds).')
    .optional(),
  loop: z.boolean().describe('Play again from the start when it ends.').optional(),
  set: z
    .strictObject({
      ground: z
        .enum(Object.keys(GROUNDS) as [Ground, ...Ground[]])
        .describe('Ground: grass (default), plaza, sand, street, wood, snow, dirt or water.')
        .optional(),
      props: z
        .array(
          z.strictObject({
            id: z.string().min(1).describe('A name for the prop, used by beats and shots.'),
            shape: z
              .enum(Object.keys(PROP_SHAPES) as [PropShape, ...PropShape[]])
              .describe(
                'box, sphere, cylinder, ball, rock, tree, bench, lamp, table, tower, hill, flag, fountain, house, car, stall or fence.',
              ),
            at: place.optional(),
            on: z
              .string()
              .min(1)
              .describe('Another prop this one stands on (a flag on a tower).')
              .optional(),
            size: z
              .tuple([z.number().positive(), z.number().positive(), z.number().positive()])
              .describe('Size [width, height, depth] in meters (default: the shape’s own).')
              .optional(),
            color: colorField.describe('Color "#rrggbb".').optional(),
          }),
        )
        .describe('Things on the set.')
        .optional(),
    })
    .describe('The set: ground and props.')
    .optional(),
  marks: z
    .record(z.string(), xz)
    .describe('Named ground points [x, z] in meters, e.g. "door": [4, -2].')
    .optional(),
  cast: z
    .array(
      z.strictObject({
        id: z.string().min(1).describe('A name for the person or animal.'),
        preset: z
          .enum(FIGURE_PRESET_NAMES as [FigurePreset, ...FigurePreset[]])
          .describe('human.adult, human.child, human.elder, dog, cat, horse, deer, cow or sheep.'),
        at: place.describe('Where they start.'),
        colors: z
          .strictObject({
            top: colorField.describe('Shirt or coat color.').optional(),
            bottom: colorField.describe('Trousers or skirt color.').optional(),
          })
          .describe('Clothing colors.')
          .optional(),
      }),
    )
    .describe('People and animals.')
    .optional(),
  beats: z
    .array(
      z.strictObject({
        at: z.number().min(0).describe('Second the beat starts.'),
        who: z.string().min(1).describe('A cast member (or a prop, for roll-to and move-to).'),
        do: z
          .enum(['walk-to', 'run-to', 'move-to', 'roll-to', 'sit', 'stand', 'look-at'])
          .describe('walk-to, run-to, move-to, roll-to (props), sit, stand or look-at.'),
        target: place.optional(),
        seconds: z
          .number()
          .positive()
          .describe('How long a move takes (default: its pace).')
          .optional(),
      }),
    )
    .describe('What happens, in seconds.')
    .optional(),
  shots: z
    .array(
      z.strictObject({
        at: z.number().min(0).describe('Second the shot starts; each new shot is a cut.'),
        kind: z
          .enum([
            'wide',
            'establishing',
            'medium',
            'close',
            'push-in',
            'pull-out',
            'orbit',
            'follow',
            'over-the-shoulder',
          ])
          .describe(
            'wide, establishing, medium, close, push-in, pull-out, orbit, follow or over-the-shoulder.',
          ),
        on: z
          .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
          .describe('Who or what the shot is on: an id or a list of ids.'),
      }),
    )
    .describe('The camera, in seconds.')
    .optional(),
  captions: z
    .array(
      z.strictObject({
        at: z.number().min(0).describe('Second the caption appears.'),
        seconds: z.number().positive().describe('How long it stays (default 3).').optional(),
        text: z.string().min(1).describe('Caption text.'),
      }),
    )
    .describe('Words on screen.')
    .optional(),
});

const FILM_EXAMPLE: FilmDoc = {
  format: 'molen/film@1',
  name: 'The Meeting',
  look: 'evening',
  set: { ground: 'plaza', props: [{ id: 'fountain', shape: 'fountain', at: [0, 0] }] },
  marks: { west: [-8, 3], east: [3, 3] },
  cast: [
    { id: 'ana', preset: 'human.adult', at: 'west', colors: { top: '#c0392b' } },
    { id: 'ben', preset: 'human.adult', at: 'east', colors: { top: '#2e86de' } },
  ],
  beats: [
    { at: 0, who: 'ben', do: 'look-at', target: 'ana' },
    { at: 1, who: 'ana', do: 'walk-to', target: 'ben', seconds: 5 },
  ],
  shots: [
    { at: 0, kind: 'wide', on: ['ana', 'ben'] },
    { at: 6, kind: 'close', on: ['ana', 'ben'] },
  ],
  captions: [{ at: 0.5, seconds: 3, text: "Saturday, nine o'clock." }],
};

if (getSchema('film') === undefined) {
  registerSchema('film', filmSchema, {
    id: 'molen/film@1',
    title: 'Film',
    description:
      'A short film as choices (cast, props, marks, beats, shots, captions) that @bendyline/molen-stage compiles into a data-only scene with its camera track inline.',
    examples: [FILM_EXAMPLE as unknown as JsonValue],
    docsRef: 'guide/authoring-documents.md',
  });
}

// --- planning ---

interface PropBase {
  x: number;
  y: number;
  z: number;
  size: [number, number, number];
  shape: PropShape;
  support?: string;
}

interface Segment {
  t0: number;
  t1: number;
  from: XZ;
  to: XZ;
  ease: 'linear' | 'smooth';
}

interface Cue {
  tick: number;
  id: string;
  type: 'mode' | 'look';
  value: string | XZ | null;
  after?: boolean;
}

interface CameraKey {
  tick: number;
  position: [number, number, number];
  lookAt: [number, number, number];
  cut?: boolean;
}

interface FilmPlan {
  scene: SceneManifest;
  lengthTicks: number;
  castIds: string[];
  propIds: string[];
  shots: { index: number; t0: number; t1: number; kind: ShotKind; on: string[] }[];
  keyframes: CameraKey[];
  pos2: (id: string, tick: number) => XZ;
  heightOf: (id: string) => number;
  baseY: (id: string, p: XZ) => number;
  props: Map<string, PropBase>;
  isFigure: (id: string) => boolean;
}

const hyp = (a: XZ, b: XZ): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

function plan(
  doc: unknown,
): { ok: true; plan: FilmPlan } | { ok: false; issues: ValidationIssue[] } {
  const v = validateByKind('film', doc);
  if (!v.ok) return { ok: false, issues: v.issues };
  const f = v.value as FilmDoc;
  const errors: ValidationIssue[] = [];
  const marks = f.marks ?? {};
  const props = f.set?.props ?? [];
  const cast = f.cast ?? [];
  const ids = new Set<string>();
  props.forEach((p, i) => {
    if (ids.has(p.id))
      errors.push(issue(`/set/props/${i}/id`, 'duplicate_id', `"${p.id}" is used twice.`));
    ids.add(p.id);
  });
  cast.forEach((c, i) => {
    if (ids.has(c.id))
      errors.push(issue(`/cast/${i}/id`, 'duplicate_id', `"${c.id}" is used twice.`));
    ids.add(c.id);
  });
  const known = [...ids, ...Object.keys(marks)];
  const propById = new Map(props.map((p) => [p.id, p]));
  const castById = new Map(cast.map((c) => [c.id, c]));
  const unknown = (ptr: string, name: string, kinds = 'a cast member, prop or mark'): void => {
    const near = nearest(name, known);
    errors.push(
      issue(
        ptr,
        'unknown_name',
        `"${name}" is not ${kinds}.`,
        near !== undefined ? `did you mean "${near}"?` : undefined,
      ),
    );
  };

  // Prop bases, in order of support (a prop "on" another needs that one placed first).
  const propBase = new Map<string, PropBase>();
  const resolving = new Set<string>();
  const resolvePoint = (where: Place, ptr: string): XZ => {
    if (Array.isArray(where)) return [where[0], where[1]];
    const mark = marks[where];
    if (mark !== undefined) return [mark[0], mark[1]];
    if (propById.has(where)) {
      const b = baseOf(where, ptr);
      return b !== undefined ? [b.x, b.z] : [0, 0];
    }
    const c = castById.get(where);
    if (c !== undefined) {
      if (Array.isArray(c.at)) return [c.at[0], c.at[1]];
      const m = marks[c.at];
      return m !== undefined ? [m[0], m[1]] : [0, 0];
    }
    unknown(ptr, where);
    return [0, 0];
  };
  // Keep a prop on the thing it stands on (a ball cannot roll off the end of the table).
  const keepOn = (b: PropBase, below: PropBase | undefined, [x, zz]: XZ): XZ => {
    if (below === undefined || below.shape === 'hill') return [x, zz];
    const r = Math.max(b.size[0], b.size[2]) / 2;
    const hx = Math.max(0, below.size[0] / 2 - r);
    const hz = Math.max(0, below.size[2] / 2 - r);
    return [
      Math.min(below.x + hx, Math.max(below.x - hx, x)),
      Math.min(below.z + hz, Math.max(below.z - hz, zz)),
    ];
  };
  function baseOf(id: string, ptr: string): PropBase | undefined {
    const done = propBase.get(id);
    if (done !== undefined) return done;
    if (resolving.has(id)) {
      errors.push(issue(ptr, 'circular_on', `"${id}" is placed on itself through "on".`));
      return undefined;
    }
    resolving.add(id);
    const i = props.findIndex((p) => p.id === id);
    const p = props[i] as FilmProp;
    const size = (p.size ?? PROP_SHAPES[p.shape].size) as [number, number, number];
    let x = 0;
    let zz = 0;
    let y = 0;
    // A prop placed at another prop stands on it: two props cannot share a spot side by side.
    const support = p.on ?? (typeof p.at === 'string' && propById.has(p.at) ? p.at : undefined);
    if (support !== undefined) {
      if (!propById.has(support)) unknown(`/set/props/${i}/on`, support, 'a prop');
      else {
        const below = baseOf(support, `/set/props/${i}/${p.on !== undefined ? 'on' : 'at'}`);
        if (below !== undefined) {
          x = below.x;
          zz = below.z;
          y = below.y + below.size[1] * (propById.get(support)?.shape === 'hill' ? 0.92 : 1);
        }
      }
    }
    if (p.at !== undefined && p.at !== support) [x, zz] = resolvePoint(p.at, `/set/props/${i}/at`);
    const b: PropBase = {
      x,
      y,
      z: zz,
      size,
      shape: p.shape,
      ...(support !== undefined && propById.has(support) ? { support } : {}),
    };
    if (b.support !== undefined) [b.x, b.z] = keepOn(b, propBase.get(b.support), [b.x, b.z]);
    propBase.set(id, b);
    resolving.delete(id);
    return b;
  }
  for (const p of props) baseOf(p.id, '/set/props');

  // Standing on a hill raises a figure.
  const groundAt = (x: number, zz: number): number => {
    let y = 0;
    for (const b of propBase.values()) {
      if (b.shape !== 'hill') continue;
      const r = b.size[0] / 2;
      const d = Math.hypot(x - b.x, zz - b.z);
      if (d < r) y = Math.max(y, b.y + b.size[1] * Math.sqrt(Math.max(0, 1 - (d / r) ** 2)));
    }
    return y;
  };
  // Nobody stands inside a prop: a point within one moves to its edge, on the side of `toward`.
  const outsideProps = (p: XZ, toward?: XZ): XZ => {
    let q = p;
    for (const b of propBase.values()) {
      if (b.shape === 'hill' || b.support !== undefined) continue;
      const hx = b.size[0] / 2 + 0.45;
      const hz = b.size[2] / 2 + 0.45;
      if (Math.abs(q[0] - b.x) >= hx || Math.abs(q[1] - b.z) >= hz) continue;
      let dx = (toward ?? q)[0] - b.x;
      let dz = (toward ?? q)[1] - b.z;
      if (Math.hypot(dx, dz) < 1e-6) [dx, dz] = [-0.34, 0.94];
      const k =
        Math.min(hx / Math.max(Math.abs(dx), 1e-9), hz / Math.max(Math.abs(dz), 1e-9)) * 1.001;
      q = [b.x + dx * k, b.z + dz * k];
    }
    return q;
  };
  const start = new Map<string, XZ>();
  cast.forEach((c, i) => {
    let p: XZ;
    if (typeof c.at === 'string' && (propById.has(c.at) || castById.has(c.at))) {
      const q = resolvePoint(c.at, `/cast/${i}/at`);
      const pb = propBase.get(c.at);
      const r = pb !== undefined ? Math.max(pb.size[0], pb.size[2]) / 2 : 0.5;
      p = [q[0], q[1] + r + 0.8];
    } else p = resolvePoint(c.at, `/cast/${i}/at`);
    start.set(c.id, outsideProps(p));
  });

  // Beats -> move segments per actor (ticks) + mode and look cues.
  const moves = new Map<string, Segment[]>();
  const cues: Cue[] = [];
  const at2 = (id: string): XZ => {
    const segs = moves.get(id);
    if (segs !== undefined && segs.length > 0) return (segs[segs.length - 1] as Segment).to;
    const s = start.get(id);
    if (s !== undefined) return s;
    const b = propBase.get(id);
    return b !== undefined ? [b.x, b.z] : [0, 0];
  };
  const posNow = (id: string, tick: number): XZ => {
    let p = start.get(id) ?? at2(id);
    for (const sg of moves.get(id) ?? []) {
      if (tick < sg.t0) break;
      const k = Math.min(1, (tick - sg.t0) / Math.max(1, sg.t1 - sg.t0));
      p = [sg.from[0] + (sg.to[0] - sg.from[0]) * k, sg.from[1] + (sg.to[1] - sg.from[1]) * k];
    }
    return p;
  };
  // At the same moment, people settle (sit, stand, look) before anyone walks toward them.
  const isMove = (b: { do: BeatAction }): number => (MOVES.includes(b.do) ? 1 : 0);
  const beats = (f.beats ?? [])
    .map((b, i) => ({ ...b, i }))
    .sort((a, b) => a.at - b.at || isMove(a) - isMove(b));
  let lastTick = 0;
  for (const b of beats) {
    const ptr = `/beats/${b.i}`;
    const isCast = castById.has(b.who);
    const isProp = propById.has(b.who);
    if (!isCast && !isProp) {
      unknown(`${ptr}/who`, b.who, 'a cast member or prop');
      continue;
    }
    const t0 = Math.round(b.at * TICK_RATE);
    if (MOVES.includes(b.do)) {
      if (b.target === undefined) {
        errors.push(
          issue(
            `${ptr}/target`,
            'missing_target',
            `"${b.do}" needs a target: a mark, a cast member, a prop or [x, z].`,
          ),
        );
        continue;
      }
      if (isCast && b.do === 'roll-to') {
        errors.push(
          issue(
            `${ptr}/do`,
            'wrong_beat',
            '"roll-to" is for props; people and animals use "walk-to" or "run-to".',
          ),
        );
      }
      const from = at2(b.who);
      let to = resolvePoint(b.target, `${ptr}/target`);
      // Stop short of a person or a prop instead of walking into it.
      if (typeof b.target === 'string' && (castById.has(b.target) || propById.has(b.target))) {
        let gap: number;
        if (castById.has(b.target)) {
          to = at2(b.target);
          gap = isCast ? 1.1 : 0.6;
        } else {
          const s = (propBase.get(b.target) as PropBase).size;
          gap = Math.max(s[0], s[2]) / 2 + 0.6;
        }
        const d = hyp(from, to);
        to =
          d > gap
            ? [to[0] + ((from[0] - to[0]) / d) * gap, to[1] + ((from[1] - to[1]) / d) * gap]
            : from;
        if (isCast && castById.has(b.target)) {
          cues.push({ tick: t0, id: b.who, type: 'look', value: b.target, after: true });
        }
      }
      const pb = propBase.get(b.who);
      if (isProp && pb?.support !== undefined) to = keepOn(pb, propBase.get(pb.support), to);
      const preset = castById.get(b.who)?.preset;
      const pace = preset !== undefined ? FIGURE_PRESETS[preset] : undefined;
      const speed =
        b.do === 'run-to' ? (pace?.run ?? 3) : b.do === 'walk-to' ? (pace?.walk ?? 1.3) : 2;
      const seconds = b.seconds ?? Math.max(0.5, hyp(from, to) / speed);
      const t1 = t0 + Math.max(1, Math.round(seconds * TICK_RATE));
      const segs = moves.get(b.who) ?? [];
      const prev = segs[segs.length - 1];
      if (prev !== undefined && prev.t1 > t0) prev.t1 = t0; // a new move cuts the old one short
      let pieces: Omit<Segment, 'ease'>[] = [{ t0, t1, from, to }];
      if (isCast) {
        to = outsideProps(to, from);
        const others = cast.map((c) => c.id).filter((id) => id !== b.who);
        // Never end on top of someone: stop a step short of whoever stands at the destination.
        for (const o of others) {
          const po = posNow(o, t1);
          if (hyp(to, po) < 1.0) {
            const back = hyp(from, po) || 1;
            to = [
              po[0] + ((from[0] - po[0]) / back) * 1.1,
              po[1] + ((from[1] - po[1]) / back) * 1.1,
            ];
          }
        }
        pieces = [{ t0, t1, from, to }];
        // Step around anyone standing in the way.
        const steps = Math.ceil(hyp(from, to) / 0.4);
        for (let k = 1; k < steps; k++) {
          const u = k / steps;
          const tk = Math.round(t0 + (t1 - t0) * u);
          const q: XZ = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
          const hit = others.find((o) => o !== b.target && hyp(q, posNow(o, tk)) < 0.8);
          if (hit === undefined) continue;
          const po = posNow(hit, tk);
          const dx = to[0] - from[0];
          const dz = to[1] - from[1];
          const len = Math.hypot(dx, dz) || 1;
          let nx = -dz / len;
          let nz = dx / len;
          if ((q[0] - po[0]) * nx + (q[1] - po[1]) * nz < 0) {
            nx = -nx;
            nz = -nz;
          }
          const via: XZ = [po[0] + nx * 1.2, po[1] + nz * 1.2];
          const l1 = hyp(from, via);
          const l2 = hyp(via, to);
          const tm = Math.round(t0 + ((t1 - t0) * l1) / (l1 + l2 || 1));
          pieces = [
            { t0, t1: tm, from, to: via },
            { t0: tm, t1, from: via, to },
          ];
          break;
        }
      }
      for (const pc of pieces) segs.push({ ...pc, ease: isCast ? 'linear' : 'smooth' });
      moves.set(b.who, segs);
      lastTick = Math.max(lastTick, t1);
      // look at the person you walked to once you arrive
      const look = cues[cues.length - 1];
      if (look?.after === true && look.id === b.who) {
        look.tick = t1;
        delete look.after;
      }
    } else if (b.do === 'sit' || b.do === 'stand') {
      if (!isCast)
        errors.push(issue(`${ptr}/who`, 'wrong_beat', `only cast members can "${b.do}".`));
      if (b.do === 'sit' && typeof b.target === 'string' && propById.has(b.target)) {
        const bb = propBase.get(b.target) as PropBase;
        const segs = moves.get(b.who) ?? [];
        segs.push({ t0, t1: t0 + 1, from: at2(b.who), to: [bb.x, bb.z + 0.15], ease: 'linear' });
        moves.set(b.who, segs);
      } else if (b.target !== undefined && b.do === 'sit') resolvePoint(b.target, `${ptr}/target`);
      cues.push({ tick: t0, id: b.who, type: 'mode', value: b.do === 'sit' ? 'sit' : null });
      lastTick = Math.max(lastTick, t0);
    } else if (b.do === 'look-at') {
      if (!isCast)
        errors.push(issue(`${ptr}/who`, 'wrong_beat', 'only cast members can "look-at".'));
      if (b.target === undefined) {
        errors.push(issue(`${ptr}/target`, 'missing_target', '"look-at" needs a target.'));
      } else if (
        typeof b.target === 'string' &&
        !castById.has(b.target) &&
        !propById.has(b.target)
      ) {
        if (marks[b.target] !== undefined) {
          cues.push({ tick: t0, id: b.who, type: 'look', value: marks[b.target] as XZ });
        } else unknown(`${ptr}/target`, b.target, 'a cast member, prop or mark');
      } else cues.push({ tick: t0, id: b.who, type: 'look', value: b.target });
      lastTick = Math.max(lastTick, t0);
    }
  }
  (f.shots ?? []).forEach((s, i) => {
    for (const id of [s.on].flat()) {
      if (!castById.has(id) && !propById.has(id))
        unknown(`/shots/${i}/on`, id, 'a cast member or prop');
    }
  });
  if (errors.length > 0) return { ok: false, issues: errors };

  const lengthTicks = Math.round((f.length ?? Math.max(6, lastTick / TICK_RATE + 2)) * TICK_RATE);
  const pos2 = (id: string, tick: number): XZ => {
    const b = propBase.get(id);
    let p: XZ = start.get(id) ?? (b !== undefined ? [b.x, b.z] : [0, 0]);
    for (const s of moves.get(id) ?? []) {
      if (tick < s.t0) break;
      const k = Math.min(1, (tick - s.t0) / Math.max(1, s.t1 - s.t0));
      p = [s.from[0] + (s.to[0] - s.from[0]) * k, s.from[1] + (s.to[1] - s.from[1]) * k];
    }
    return p;
  };
  const heightOf = (id: string): number => {
    const c = castById.get(id);
    return c !== undefined ? FIGURE_PRESETS[c.preset].height : (propBase.get(id)?.size[1] ?? 1);
  };
  const baseY = (id: string, p: XZ): number =>
    castById.has(id) ? groundAt(p[0], p[1]) : (propBase.get(id)?.y ?? 0);
  const radiusOf = (id: string): number => {
    const b = propBase.get(id);
    return b === undefined ? 0.4 : Math.max(b.size[0], b.size[2]) / 2;
  };

  // --- entities ---
  const entities: { id: string; components: JsonObject }[] = [];
  const add = (id: string, components: JsonObject): void => {
    entities.push({ id, components });
  };
  add('env', environmentFor(f.look));
  let extent = 45;
  for (const p of [
    ...start.values(),
    ...Object.values(marks),
    ...[...propBase.values()].map((b): XZ => [b.x, b.z]),
  ]) {
    extent = Math.max(extent, Math.abs(p[0]) + 12, Math.abs(p[1]) + 12);
  }
  add('ground', {
    transform: { pos: [0, -0.05, 0] },
    renderable: primitive('box', [extent * 2, 0.1, extent * 2], GROUNDS[f.set?.ground ?? 'grass']),
  });
  const prim = (
    id: string,
    ref: 'box' | 'sphere' | 'cylinder',
    size: [number, number, number],
    pos: [number, number, number],
    color: string,
  ): void => add(id, { transform: { pos }, renderable: primitive(ref, size, color) });
  const dark = f.look === 'night' || f.look === 'evening';
  for (const p of props) {
    const b = propBase.get(p.id) as PropBase;
    const s = b.size;
    const c = p.color ?? PROP_SHAPES[p.shape].color;
    const { x, y } = b;
    const zz = b.z;
    switch (p.shape) {
      case 'tree':
        prim(
          `${p.id}-trunk`,
          'cylinder',
          [s[0] * 0.15, s[1] * 0.5, s[2] * 0.15],
          [x, y + s[1] * 0.25, zz],
          '#7a5230',
        );
        prim(p.id, 'sphere', [s[0], s[1] * 0.55, s[2]], [x, y + s[1] * 0.72, zz], c);
        break;
      case 'bench':
        prim(p.id, 'box', [s[0], s[1] * 0.12, s[2]], [x, y + s[1] * 0.47, zz], c);
        prim(
          `${p.id}-back`,
          'box',
          [s[0], s[1] * 0.5, s[2] * 0.12],
          [x, y + s[1] * 0.75, zz - s[2] * 0.45],
          c,
        );
        prim(
          `${p.id}-legs`,
          'box',
          [s[0] * 0.9, s[1] * 0.42, s[2] * 0.8],
          [x, y + s[1] * 0.21, zz],
          '#4b3621',
        );
        break;
      case 'lamp':
        prim(p.id, 'cylinder', [s[0] * 0.3, s[1], s[2] * 0.3], [x, y + s[1] / 2, zz], c);
        prim(`${p.id}-head`, 'sphere', [s[0], s[0], s[2]], [x, y + s[1], zz], '#fff2c8');
        add(`${p.id}-light`, {
          transform: { pos: [x, y + s[1] - 0.1, zz] },
          light: { type: 'point', color: '#ffd9a0', intensity: dark ? 6 : 2, range: 14 },
        });
        break;
      case 'table':
        prim(p.id, 'box', [s[0], 0.1, s[2]], [x, y + s[1] - 0.05, zz], c);
        prim(
          `${p.id}-legs`,
          'box',
          [s[0] * 0.9, s[1] - 0.1, s[2] * 0.8],
          [x, y + (s[1] - 0.1) / 2, zz],
          '#5a3a1e',
        );
        break;
      case 'flag':
        prim(`${p.id}-pole`, 'cylinder', [0.08, s[1], 0.08], [x, y + s[1] / 2, zz], '#555555');
        prim(p.id, 'box', [s[0], s[1] * 0.25, s[2]], [x + s[0] / 2, y + s[1] * 0.85, zz], c);
        break;
      case 'hill':
        // A sphere's size is its diameter (size[0]); flatten the dome with the transform's scale.
        add(p.id, {
          transform: { pos: [x, y, zz], scale: [1, (s[1] * 2) / s[0], s[2] / s[0]] },
          renderable: primitive('sphere', [s[0], s[0], s[0]], c),
        });
        break;
      case 'house':
        prim(p.id, 'box', s, [x, y + s[1] / 2, zz], c);
        prim(
          `${p.id}-roof`,
          'box',
          [s[0] * 1.1, s[1] * 0.2, s[2] * 1.1],
          [x, y + s[1] * 1.1, zz],
          '#8e3b2f',
        );
        break;
      case 'stall':
        prim(p.id, 'box', [s[0], s[1] * 0.45, s[2]], [x, y + s[1] * 0.225, zz], '#8b5a2b');
        prim(`${p.id}-awning`, 'box', [s[0] * 1.1, s[1] * 0.08, s[2] * 1.2], [x, y + s[1], zz], c);
        break;
      default: {
        const ref = ['sphere', 'ball', 'rock'].includes(p.shape)
          ? 'sphere'
          : ['cylinder', 'tower', 'fountain'].includes(p.shape)
            ? 'cylinder'
            : 'box';
        prim(p.id, ref, s, [x, y + s[1] / 2, zz], c);
      }
    }
  }
  for (const c of cast) {
    const p = start.get(c.id) as XZ;
    const palette: JsonObject = {};
    if (c.colors?.top !== undefined) palette.top = c.colors.top;
    if (c.colors?.bottom !== undefined) palette.bottom = c.colors.bottom;
    add(c.id, {
      transform: { pos: [p[0], groundAt(p[0], p[1]), p[1]] },
      renderable: { kind: 'figure' },
      figure: { preset: c.preset, ...(Object.keys(palette).length > 0 ? { palette } : {}) },
    });
  }

  // Timing as data: each move is a path started by a cue; modes and looks are figure actions.
  const at3 = (id: string, p: XZ): [number, number, number] => {
    const pb = propBase.get(id);
    const y = pb !== undefined ? pb.y + pb.size[1] / 2 : groundAt(p[0], p[1]);
    return [round3(p[0]), round3(y), round3(p[1])];
  };
  const byTick = new Map<number, PlayAction[]>();
  const cueAt = (tick: number, action: PlayAction): void => {
    const list = byTick.get(tick) ?? [];
    list.push(action);
    byTick.set(tick, list);
  };
  if (f.loop === true) {
    // Each pass starts from the beginning: everyone back on their marks, sitting and looks reset.
    for (const id of moves.keys()) {
      const home = at3(id, pos2(id, 0));
      cueAt(0, { place: { target: `#${id}`, at: home } });
      cueAt(0, { path: { target: `#${id}`, points: [home], ticks: 1 } });
    }
    for (const c of cast) cueAt(0, { figure: { target: `#${c.id}`, mode: null, lookAt: null } });
  }
  for (const [id, segs] of moves) {
    for (const s of segs) {
      cueAt(s.t0, {
        path: {
          target: `#${id}`,
          points: [at3(id, s.to)],
          ticks: Math.max(1, s.t1 - s.t0),
          ...(s.ease === 'smooth' ? { easing: 'smooth' as const } : {}),
        },
      });
    }
  }
  for (const c of cues) {
    if (c.type === 'mode') {
      cueAt(c.tick, { figure: { target: `#${c.id}`, mode: c.value === 'sit' ? 'sit' : null } });
    } else if (typeof c.value === 'string') {
      cueAt(c.tick, { figure: { target: `#${c.id}`, lookAt: `#${c.value}` } });
    } else if (Array.isArray(c.value)) {
      cueAt(c.tick, { figure: { target: `#${c.id}`, lookAt: [c.value[0], 1.5, c.value[1]] } });
    }
  }
  if (byTick.size > 0) {
    add('director', {
      cues: {
        cues: [...byTick.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([tick, actions]) => ({ tick, do: actions })),
        ...(f.loop === true ? { loop: lengthTicks } : {}),
      },
    });
  }

  // --- camera ---
  const allIds = [...cast.map((c) => c.id), ...props.map((p) => p.id)];
  const shotList = [...(f.shots ?? [])]
    .map((s, index) => ({ ...s, index }))
    .sort((a, b) => a.at - b.at);
  if (shotList.length === 0)
    shotList.push({ at: 0, kind: 'wide', on: allIds.length > 0 ? allIds : ['ground'], index: -1 });
  const tanH = Math.tan((FOV * Math.PI) / 360);
  const bounds = (ids: string[], t0: number, t1: number) => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let t = t0; t <= t1; t += 5) {
      for (const id of ids) {
        const p = id === 'ground' ? ([0, 0] as XZ) : pos2(id, t);
        const r = id === 'ground' ? 10 : radiusOf(id);
        const y0 = id === 'ground' ? 0 : baseY(id, p);
        minX = Math.min(minX, p[0] - r);
        maxX = Math.max(maxX, p[0] + r);
        minZ = Math.min(minZ, p[1] - r);
        maxZ = Math.max(maxZ, p[1] + r);
        minY = Math.min(minY, y0);
        maxY = Math.max(maxY, y0 + (id === 'ground' ? 1 : heightOf(id)));
      }
    }
    return {
      c: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2] as [number, number, number],
      w: maxX - minX,
      depth: maxZ - minZ,
      h: maxY - minY,
      minY,
    };
  };
  type Bounds = ReturnType<typeof bounds>;
  const frame = (b: Bounds, kind: string, azimuthDeg = -20): Omit<CameraKey, 'tick'> => {
    const elev =
      ({ far: 12, wide: 14, establishing: 28, medium: 8, close: 4 } as Record<string, number>)[
        kind
      ] ?? 10;
    const fill =
      (
        { far: 0.22, wide: 0.75, establishing: 0.55, medium: 0.85, close: 0.9 } as Record<
          string,
          number
        >
      )[kind] ?? 0.7;
    const target: [number, number, number] = [
      b.c[0],
      b.minY + b.h * (kind === 'close' ? 0.85 : 0.5),
      b.c[2],
    ];
    const needH = kind === 'close' ? 0.9 : b.h / fill;
    // a close shot on several subjects widens to hold them all (a two-shot)
    const needW = kind === 'close' ? Math.max(1.4, (b.w + 0.4) / fill) : (b.w + 0.6) / fill;
    const d =
      Math.max(needH / (2 * tanH), needW / (2 * tanH * ASPECT), kind === 'close' ? 1.2 : 2.5) +
      (kind === 'close' ? 0 : b.depth / 2);
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elev * Math.PI) / 180;
    const pos: [number, number, number] = [
      target[0] + Math.sin(az) * Math.cos(el) * d,
      target[1] + Math.sin(el) * d,
      target[2] + Math.cos(az) * Math.cos(el) * d,
    ];
    pos[1] = Math.max(pos[1], groundAt(pos[0], pos[2]) + 0.6);
    return {
      position: pos.map(round3) as [number, number, number],
      lookAt: target.map(round3) as [number, number, number],
    };
  };
  const keyframes: CameraKey[] = [];
  const shots: FilmPlan['shots'] = [];
  shotList.forEach((s, i) => {
    const t0 = Math.round(s.at * TICK_RATE);
    const next = shotList[i + 1];
    const t1 = next !== undefined ? Math.round(next.at * TICK_RATE) - 1 : lengthTicks;
    if (t1 <= t0) return;
    const withStacked = (list: string[]): string[] => {
      const out = [...list];
      for (let grew = true; grew; ) {
        grew = false;
        for (const [id, pb] of propBase) {
          if (pb.support !== undefined && out.includes(pb.support) && !out.includes(id)) {
            out.push(id);
            grew = true;
          }
        }
      }
      return out;
    };
    const named = [...new Set([s.on].flat())];
    shots.push({ index: s.index, t0, t1, kind: s.kind, on: named });
    const on = withStacked(named);
    const b = bounds(on, t0, t1);
    // a push-in ends on, and a pull-out starts from, the first subject named (the detail)
    const detail = bounds(withStacked(named.slice(0, 1)), t0, t1);
    // two subjects are shot across the line between them, from the side nearer the usual angle
    const azAt = (t: number): number => {
      if (named.length < 2 || s.kind === 'wide' || s.kind === 'establishing') return -20;
      const a = pos2(named[0] as string, t);
      const c = pos2(named[1] as string, t);
      const len = hyp(a, c);
      if (len < 0.3) return -20;
      const n: XZ = [-(c[1] - a[1]) / len, (c[0] - a[0]) / len];
      const options = [Math.atan2(n[0], n[1]), Math.atan2(-n[0], -n[1])].map(
        (r) => (r * 180) / Math.PI,
      );
      const off = (deg: number): number => Math.abs(((((deg + 20) % 360) + 540) % 360) - 180);
      return off(options[0] as number) <= off(options[1] as number)
        ? (options[0] as number)
        : (options[1] as number);
    };
    const first = keyframes.length;
    const kf = (tick: number, pose: Omit<CameraKey, 'tick'>): void => {
      keyframes.push({ tick, ...pose });
    };
    switch (s.kind) {
      case 'push-in':
        kf(t0, frame(b, 'far'));
        kf(t1, frame(detail, 'medium'));
        break;
      case 'pull-out':
        kf(t0, frame(detail, 'medium'));
        kf(t1, frame(b, 'far'));
        break;
      case 'orbit':
        for (let k = 0; k <= 4; k++)
          kf(Math.round(t0 + ((t1 - t0) * k) / 4), frame(b, 'medium', -60 + k * 30));
        break;
      case 'follow':
        for (let t = t0; t <= t1; t += 15) kf(t, frame(bounds(on, t, t), 'medium', azAt(t)));
        break;
      case 'over-the-shoulder': {
        const a = on[0] as string;
        const other = on[1] ?? cast.find((c) => c.id !== a)?.id;
        const pa = pos2(a, t0);
        const pb = other !== undefined ? pos2(other, t0) : ([pa[0], pa[1] - 3] as XZ);
        const d = hyp(pa, pb) || 1;
        const back: XZ = [(pa[0] - pb[0]) / d, (pa[1] - pb[1]) / d];
        const hb = other !== undefined ? heightOf(other) * 0.9 : 1.5;
        const pose = {
          position: [
            pa[0] + back[0] * 1.6 + back[1] * 0.6,
            baseY(a, pa) + heightOf(a) * 0.95,
            pa[1] + back[1] * 1.6 - back[0] * 0.6,
          ].map(round3) as [number, number, number],
          lookAt: [pb[0], (other !== undefined ? baseY(other, pb) : 0) + hb, pb[1]].map(round3) as [
            number,
            number,
            number,
          ],
        };
        kf(t0, pose);
        kf(t1, pose);
        break;
      }
      default: {
        // A subject that moves more than the shot can hold is followed, not lost.
        let range = 0;
        const c0 = bounds(on, t0, t0).c;
        for (let t = t0; t <= t1; t += 15) {
          const c = bounds(on, t, t).c;
          range = Math.max(range, Math.hypot(c[0] - c0[0], c[2] - c0[2]));
        }
        const limit = s.kind === 'close' ? 0.5 : s.kind === 'medium' ? 1.2 : 4;
        if (range > limit) {
          for (let t = t0; t < t1; t += 15) {
            kf(t, frame(bounds(on, Math.max(t0, t - 8), Math.min(t1, t + 8)), s.kind, azAt(t)));
          }
          kf(t1, frame(bounds(on, Math.max(t0, t1 - 8), t1), s.kind, azAt(t1)));
        } else {
          const az = azAt(Math.round((t0 + t1) / 2));
          kf(t0, frame(b, s.kind, az));
          kf(t1, frame(b, s.kind, az));
        }
      }
    }
    if (i > 0 && keyframes[first] !== undefined) (keyframes[first] as CameraKey).cut = true;
  });
  const firstKey = keyframes[0] ?? { tick: 0, position: [0, 6, 16], lookAt: [0, 1, 0] };
  const cameraTrack: SceneCameraTrack = { easing: 'linear', loop: f.loop === true, keyframes };
  const captions = (f.captions ?? []).map((c) => ({
    tick: Math.round(c.at * TICK_RATE),
    ticks: Math.max(1, Math.round((c.seconds ?? 3) * TICK_RATE)),
    text: c.text,
  }));
  // A complete manifest (schema defaults written out): validating it needs the figures
  // capability registered, which is the host's to load, so the tests validate it instead.
  const scene: SceneManifest = {
    format: 'molen/scene@3',
    name: slug(f.name, 'film'),
    seed: f.name,
    tickRate: TICK_RATE,
    lateCommands: 'rewrite',
    keyframeInterval: 60,
    prefabs: {},
    entities: entities as SceneManifest['entities'],
    scripts: [],
    commands: {},
    components: {},
    camera: { mode: 'fixed', position: firstKey.position, lookAt: firstKey.lookAt, fov: FOV },
    cameraTrack,
    ...(captions.length > 0 ? { hud: { captions } } : {}),
  };
  return {
    ok: true,
    plan: {
      scene,
      lengthTicks,
      castIds: cast.map((c) => c.id),
      propIds: props.map((p) => p.id),
      shots,
      keyframes,
      pos2,
      heightOf,
      baseY,
      props: propBase,
      isFigure: (id) => castById.has(id),
    },
  };
}

// --- public API ---

export interface FilmInfo {
  /** Length in ticks at 30 ticks a second. */
  lengthTicks: number;
  cast: string[];
  props: string[];
}

export type CompileFilmResult =
  | { ok: true; scene: SceneManifest; info: FilmInfo }
  | { ok: false; issues: ValidationIssue[]; formatted: string };

function label(doc: unknown): string {
  const name = (doc as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? `film "${name}"` : 'film';
}

/** Validate a film document and compile it into a data-only scene@3 with its camera track. */
export function compileFilm(doc: unknown): CompileFilmResult {
  const r = plan(doc);
  if (!r.ok) return { ok: false, issues: r.issues, formatted: formatIssues(label(doc), r.issues) };
  return {
    ok: true,
    scene: r.plan.scene,
    info: { lengthTicks: r.plan.lengthTicks, cast: r.plan.castIds, props: r.plan.propIds },
  };
}

// --- lint: what a render would show ---

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function cameraAt(keys: CameraKey[], tick: number): { position: V3; lookAt: V3 } {
  const first = keys[0] as CameraKey;
  if (tick <= first.tick) return first;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i] as CameraKey;
    const b = keys[i + 1] as CameraKey;
    if (tick >= b.tick) continue;
    if (b.cut === true) return a;
    const f = b.tick > a.tick ? (tick - a.tick) / (b.tick - a.tick) : 0;
    const lerp = (p: V3, q: V3): V3 => [
      p[0] + (q[0] - p[0]) * f,
      p[1] + (q[1] - p[1]) * f,
      p[2] + (q[2] - p[2]) * f,
    ];
    return { position: lerp(a.position, b.position), lookAt: lerp(a.lookAt, b.lookAt) };
  }
  return keys[keys.length - 1] as CameraKey;
}

/** Whether point p is in frame from the camera, and large enough to read. */
function inFrame(cam: { position: V3; lookAt: V3 }, p: V3, height: number): boolean {
  const fwd = norm(sub(cam.lookAt, cam.position));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const v = sub(p, cam.position);
  const depth = dot(v, fwd);
  if (depth < 0.1) return false;
  const tanH = Math.tan((FOV * Math.PI) / 360);
  const x = dot(v, right) / (depth * tanH * ASPECT);
  const y = dot(v, up) / (depth * tanH);
  return Math.abs(x) <= 1 && Math.abs(y) <= 1 && height / (2 * depth * tanH) >= 0.04;
}

/** Does a prop's box stand between the camera and a point? */
function blocks(b: PropBase, from: V3, to: V3): boolean {
  const c: V3 = [b.x, b.y + b.size[1] / 2, b.z];
  const h: V3 = [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2];
  const A = [0, 1, 2].map((k) => ((from[k] as number) - (c[k] as number)) / (h[k] as number));
  const B = [0, 1, 2].map((k) => ((to[k] as number) - (c[k] as number)) / (h[k] as number));
  let t0 = 0.02;
  let t1 = 0.98;
  for (let k = 0; k < 3; k++) {
    const a = A[k] as number;
    const d = (B[k] as number) - a;
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(a) >= 1) return false;
      continue;
    }
    let u = (-1 - a) / d;
    let v = (1 - a) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * What a render of the film would show: each shot's subjects out of frame or hidden behind a
 * prop, and cast members standing inside each other. Returns notices (the film is valid either
 * way), or the document's validation issues when it does not compile.
 */
export function lintFilm(doc: unknown): ValidationIssue[] {
  const r = plan(doc);
  if (!r.ok) return r.issues;
  const p = r.plan;
  const out: ValidationIssue[] = [];
  if (p.keyframes.length === 0) return out;
  for (const shot of p.shots) {
    const path = shot.index >= 0 ? `/shots/${shot.index}` : '/shots';
    for (const id of shot.on) {
      let samples = 0;
      let framed = 0;
      let hiddenBy: string | undefined;
      for (let t = shot.t0; t <= shot.t1; t += 15) {
        samples++;
        const cam = cameraAt(p.keyframes, t);
        const at = p.pos2(id, t);
        const y0 = p.baseY(id, at);
        const h = p.heightOf(id);
        const points: V3[] = p.isFigure(id)
          ? [
              [at[0], y0 + h / 2, at[1]],
              [at[0], y0 + h * 0.9, at[1]],
            ]
          : [[at[0], y0 + h / 2, at[1]]];
        const visible = points.filter((q) => inFrame(cam, q, h));
        if (visible.length === 0) continue;
        const blocker = [...p.props.entries()].find(
          ([pid, b]) =>
            pid !== id &&
            b.shape !== 'hill' &&
            p.props.get(id)?.support !== pid &&
            visible.every((q) => blocks(b, cam.position, q)),
        );
        if (blocker === undefined) framed++;
        else hiddenBy = blocker[0];
      }
      if (samples > 0 && framed / samples < 0.5) {
        const when = `${(shot.t0 / TICK_RATE).toFixed(1)} s`;
        out.push({
          path,
          code: hiddenBy !== undefined ? 'subject_hidden' : 'subject_out_of_frame',
          message:
            hiddenBy !== undefined
              ? `in the ${shot.kind} shot at ${when}, "${id}" is mostly hidden behind "${hiddenBy}"`
              : `in the ${shot.kind} shot at ${when}, "${id}" is mostly out of frame`,
          hint:
            hiddenBy !== undefined
              ? 'move them, or shoot from another side (over-the-shoulder, orbit)'
              : 'use a wider shot, or put fewer subjects in it',
          severity: 'notice',
        });
      }
    }
  }
  const reported = new Set<string>();
  for (let t = 0; t <= p.lengthTicks; t += 15) {
    for (let i = 0; i < p.castIds.length; i++) {
      for (let j = i + 1; j < p.castIds.length; j++) {
        const a = p.castIds[i] as string;
        const b = p.castIds[j] as string;
        if (reported.has(`${a}|${b}`)) continue;
        if (hyp(p.pos2(a, t), p.pos2(b, t)) < 0.6) {
          reported.add(`${a}|${b}`);
          out.push({
            path: '/beats',
            code: 'cast_overlap',
            message: `"${a}" and "${b}" stand inside each other at ${(t / TICK_RATE).toFixed(1)} s`,
            hint: 'give one of them another mark',
            severity: 'notice',
          });
        }
      }
    }
  }
  return out;
}
