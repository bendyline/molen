import {
  formatIssues,
  getSchema,
  type JsonObject,
  type JsonValue,
  nearest,
  type PlayAction,
  type PlayCondition,
  type RuleEntry,
  registerSchema,
  type SceneManifest,
  type ValidationIssue,
  validateByKind,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import {
  colorField,
  environmentFor,
  FIGURE_PRESET_NAMES,
  type FigurePreset,
  issue,
  type Look,
  lookField,
  primitive,
  slug,
  TICK_RATE,
} from './common';
import {
  type Amount3,
  type Archetype,
  generateLayout,
  type LayoutSize,
  type LayoutSpec,
  LEDGE,
  MIN_RUNNER_SPEED,
  PLATFORM_CELL,
} from './layout';

// molen/game@1: a simple game as choices. The model names the pieces and their roles, a layout
// archetype (or draws a text map), and how to win and lose; this compiler draws the level, and
// builds the floor, walls, camera, controls, the rule for each role, score, lives, messages and
// restart. The output is a data-only scene@3: rules, triggers, movers and paths, no scripts.
//
// Contract for players and play tests: the player entity is "player"; pieces are tagged by role
// (pickup, key, door, goal, hazard); commands are move { dir: [x, y] }, jump { held } and
// restart; events are win, lose, hit, pickup and key; #game.vars holds score, lives and status.

export type Role = 'player' | 'wall' | 'pickup' | 'goal' | 'key' | 'door' | 'hazard';
const ROLES: readonly Role[] = ['player', 'wall', 'pickup', 'goal', 'key', 'door', 'hazard'];

export interface GamePiece {
  role: Role;
  count?: number;
  figure?: FigurePreset;
  shape?: 'box' | 'sphere' | 'cylinder';
  color?: string;
  speed?: number;
  move?: 'still' | 'patrol' | 'chase' | 'wander';
  points?: number;
}

export interface GameLayout {
  archetype: Archetype;
  size?: LayoutSize;
  seed?: string | number;
  hedges?: Amount3;
  loops?: 'none' | 'few' | 'many';
  corridors?: 'narrow' | 'wide';
  pillars?: 'none' | 'few' | 'many';
  gaps?: Amount3;
  hills?: 'flat' | 'rolling' | 'steep';
  ledges?: 'none' | 'some' | 'many';
}

export interface GameDoc {
  format: 'molen/game@1';
  name: string;
  kind: 'top-down' | 'platformer';
  look?: Look;
  layout?: Archetype | GameLayout;
  size?: 'small' | 'medium' | 'large';
  map?: string[];
  pieces: Record<string, GamePiece>;
  win: { collect?: 'all'; reach?: 'goal'; survive?: number };
  lose?: { lives: number };
  spawn?: { piece: string; every: number; max?: number }[];
  text?: { title?: string; win?: string; lose?: string };
}

const archetype = z
  .enum(['garden', 'maze', 'arena', 'level'])
  .describe('garden, maze or arena (top-down), or level (platformer).');
const sizeWord = z.enum(['small', 'medium', 'large']);

const pieceSchema = z.strictObject({
  role: z
    .enum(ROLES as [Role, ...Role[]])
    .describe('player, wall, pickup, goal, key, door or hazard.'),
  count: z.int().min(1).max(20).describe('How many the layout places (default 1).').optional(),
  figure: z
    .enum(FIGURE_PRESET_NAMES as [FigurePreset, ...FigurePreset[]])
    .describe('human.adult, human.child, human.elder, dog, cat, horse, deer, cow or sheep.')
    .optional(),
  shape: z.enum(['box', 'sphere', 'cylinder']).describe('box, sphere or cylinder.').optional(),
  color: colorField.describe('Color "#rrggbb".').optional(),
  speed: z.number().positive().max(20).describe('Meters per second.').optional(),
  move: z
    .enum(['still', 'patrol', 'chase', 'wander'])
    .describe('Hazards: still (default), patrol (back and forth), chase or wander.')
    .optional(),
  points: z.int().positive().describe('Pickups: points each (default 1).').optional(),
});

export const gameSchema: z.ZodType<GameDoc> = z.strictObject({
  format: z.literal('molen/game@1').describe("Always 'molen/game@1'."),
  name: z.string().min(1).describe('Title of the game.'),
  kind: z
    .enum(['top-down', 'platformer'])
    .describe('top-down (seen from above) or platformer (seen from the side).'),
  look: lookField.optional(),
  layout: z
    .union([
      archetype,
      z.strictObject({
        archetype,
        size: z
          .union([sizeWord, z.tuple([z.int(), z.int()])])
          .describe('small, medium (default), large, or [columns, rows].')
          .optional(),
        seed: z
          .union([z.string(), z.number()])
          .describe('Any word or number, for a different level with the same choices.')
          .optional(),
        hedges: z
          .enum(['few', 'some', 'many'])
          .describe('garden: few, some or many hedges.')
          .optional(),
        loops: z
          .enum(['none', 'few', 'many'])
          .describe('maze: none, few or many loops.')
          .optional(),
        corridors: z
          .enum(['narrow', 'wide'])
          .describe('maze: narrow or wide corridors.')
          .optional(),
        pillars: z
          .enum(['none', 'few', 'many'])
          .describe('arena: none, few or many pillars.')
          .optional(),
        gaps: z.enum(['few', 'some', 'many']).describe('level: few, some or many gaps.').optional(),
        hills: z
          .enum(['flat', 'rolling', 'steep'])
          .describe('level: flat, rolling or steep ground.')
          .optional(),
        ledges: z
          .enum(['none', 'some', 'many'])
          .describe('level: none, some or many ledges.')
          .optional(),
      }),
    ])
    .describe(
      'The level Molen draws: an archetype name, or an object that names one and adjusts it.',
    )
    .optional(),
  size: sizeWord.describe('small, medium (default) or large.').optional(),
  map: z
    .array(z.string())
    .min(3)
    .max(40)
    .describe('A level you draw instead: one character per cell, "." is empty floor.')
    .optional(),
  pieces: z.record(z.string(), pieceSchema).describe('One character each, with a role.'),
  win: z
    .strictObject({
      collect: z.literal('all').describe('Collect every pickup.').optional(),
      reach: z.literal('goal').describe('Touch the goal.').optional(),
      survive: z.number().positive().max(600).describe('Last this many seconds.').optional(),
    })
    .describe('How to win: collect, reach and/or survive.'),
  lose: z
    .strictObject({ lives: z.int().min(1).max(9).describe('Lives before the game is lost.') })
    .describe('How to lose.')
    .optional(),
  spawn: z
    .array(
      z.strictObject({
        piece: z.string().min(1).describe('The piece character to keep adding.'),
        every: z.number().positive().describe('Seconds between arrivals.'),
        max: z.int().positive().describe('Most at once (default 20).').optional(),
      }),
    )
    .describe('Pieces that keep arriving at the edges.')
    .optional(),
  text: z
    .strictObject({
      title: z.string().describe('Title shown at the start.').optional(),
      win: z.string().describe('Message when the player wins.').optional(),
      lose: z.string().describe('Message when the player loses.').optional(),
    })
    .describe('Words on screen.')
    .optional(),
});

const GAME_EXAMPLE: GameDoc = {
  format: 'molen/game@1',
  name: 'Coin Garden',
  kind: 'top-down',
  look: 'noon',
  layout: { archetype: 'garden', size: 'small', hedges: 'some' },
  pieces: {
    P: { role: 'player', figure: 'human.child', speed: 5 },
    o: { role: 'pickup', shape: 'sphere', color: '#ffd166', count: 5 },
    x: { role: 'hazard', figure: 'dog', move: 'patrol', speed: 2 },
  },
  win: { collect: 'all' },
  lose: { lives: 3 },
  text: { title: 'Coin Garden', win: 'You made it!', lose: 'Try again.' },
};

if (getSchema('game') === undefined) {
  registerSchema('game', gameSchema, {
    id: 'molen/game@1',
    title: 'Game',
    description:
      'A simple game as choices (pieces with roles, a layout archetype or a drawn map, how to win and lose) that @bendyline/molen-stage compiles into a data-only scene.',
    examples: [GAME_EXAMPLE as unknown as JsonValue],
    docsRef: 'guide/authoring-documents.md',
  });
}

const DEFAULT_COLOR: Readonly<Record<Role, string>> = {
  player: '#3a86ff',
  wall: '#6b705c',
  pickup: '#ffd166',
  hazard: '#e63946',
  goal: '#06d6a0',
  key: '#f1c40f',
  door: '#8b5a2b',
};

/** Trigger layers: the player's zone touches every role's; roles never touch each other. */
const LAYER: Readonly<Record<'player' | 'pickup' | 'hazard' | 'goal' | 'key', number>> = {
  player: 1,
  pickup: 2,
  hazard: 4,
  goal: 8,
  key: 16,
};

interface Cell {
  r: number;
  c: number;
  ch: string;
  piece: GamePiece;
}

interface Normalized {
  doc: GameDoc;
  map: string[];
  pieces: Record<string, GamePiece>;
  generated: boolean;
  warnings: ValidationIssue[];
}

function layoutOf(doc: GameDoc): LayoutSpec | undefined {
  if (doc.layout === undefined) return undefined;
  const spec: LayoutSpec =
    typeof doc.layout === 'string' ? { archetype: doc.layout } : { ...doc.layout };
  if (spec.size === undefined && doc.size !== undefined) spec.size = doc.size;
  return spec;
}

/** Validate, apply the layout, and check the map. Errors are ValidationIssues; warnings too. */
function normalize(
  input: unknown,
): { ok: true; n: Normalized } | { ok: false; issues: ValidationIssue[] } {
  const v = validateByKind('game', input);
  if (!v.ok) return { ok: false, issues: v.issues };
  const doc = v.value as GameDoc;
  const warnings: ValidationIssue[] = [];
  const fail = (
    path: string,
    code: string,
    message: string,
    hint?: string,
  ): { ok: false; issues: ValidationIssue[] } => ({
    ok: false,
    issues: [issue(path, code, message, hint)],
  });
  if (!doc.win.collect && !doc.win.reach && doc.win.survive === undefined) {
    return fail(
      '/win',
      'no_win',
      'say how to win: "collect": "all", "reach": "goal" and/or "survive": seconds.',
    );
  }
  for (const k of Object.keys(doc.pieces)) {
    if ([...k].length !== 1)
      return fail(
        `/pieces/${k}`,
        'piece_name',
        'a piece is named by one character, like "P" or "#".',
      );
    if (k === '.' || k === ' ')
      return fail(
        `/pieces/${k}`,
        'piece_name',
        '"." and " " are empty floor; pick another character.',
      );
  }
  if (!Object.values(doc.pieces).some((p) => p.role === 'player')) {
    return fail('/pieces', 'no_player', 'add a piece with "role": "player".');
  }
  let pieces = { ...doc.pieces };
  let map = doc.map;
  const spec = layoutOf(doc);
  if (map !== undefined && spec !== undefined) {
    return fail('/', 'layout_and_map', 'give either "layout" or a "map" you draw, not both.');
  }
  if (map === undefined && spec === undefined) {
    return fail(
      '/',
      'no_layout',
      'give either "layout" (and a "count" on pieces) or a "map" you draw.',
    );
  }
  if (spec !== undefined) {
    if ((spec.archetype === 'level') !== (doc.kind === 'platformer')) {
      return fail(
        '/layout',
        'layout_kind',
        doc.kind === 'platformer'
          ? 'a platformer uses the "level" layout.'
          : '"level" is for platformers; a top-down game uses "garden", "maze" or "arena".',
      );
    }
    if (!Object.values(pieces).some((p) => p.role === 'wall'))
      pieces = { ...pieces, '#': { role: 'wall' } };
    const ps = Object.values(pieces).find((p) => p.role === 'player')?.speed;
    if (doc.kind === 'platformer' && ps !== undefined && ps < MIN_RUNNER_SPEED) {
      warnings.push({
        path: '/pieces',
        code: 'runner_speed',
        message: `a platformer player runs at least ${MIN_RUNNER_SPEED} meters per second, so the jumps can be made; raised it to ${MIN_RUNNER_SPEED}.`,
        severity: 'notice',
      });
    }
    const drawn = generateLayout(doc.name, doc.kind, spec, pieces);
    if (drawn === null)
      return fail(
        '/layout',
        'layout_failed',
        'this level could not be drawn; try another size or fewer pieces.',
      );
    map = drawn;
  }
  return {
    ok: true,
    n: { doc, map: map as string[], pieces, generated: spec !== undefined, warnings },
  };
}

/** Check a map: unknown characters, one player, things to win with, and what the player can reach. */
function checkMap(n: Normalized): {
  cells: Cell[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  const { doc, map, pieces } = n;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const width = Math.max(...map.map((r) => r.length));
  const cells: Cell[] = [];
  const counts: Record<string, number> = Object.fromEntries(ROLES.map((r) => [r, 0]));
  map.forEach((row, r) => {
    [...row.padEnd(width, ' ')].forEach((ch, c) => {
      if (ch === '.' || ch === ' ' || (n.generated && ch === LEDGE)) return;
      const piece = pieces[ch];
      if (piece === undefined) {
        const near = nearest(ch, Object.keys(pieces));
        errors.push(
          issue(
            `/map/${r}`,
            'unknown_cell',
            `column ${c} is "${ch}", which no piece defines (pieces: ${Object.keys(pieces)
              .map((k) => JSON.stringify(k))
              .join(', ')}; "." is empty floor).`,
            near !== undefined ? `did you mean "${near}"?` : undefined,
          ),
        );
        return;
      }
      counts[piece.role] = (counts[piece.role] ?? 0) + 1;
      cells.push({ r, c, ch, piece });
    });
  });
  if (counts.player !== 1)
    errors.push(
      issue(
        '/map',
        'player_count',
        `there must be exactly one player cell; found ${counts.player}.`,
      ),
    );
  if (doc.win.collect && counts.pickup === 0)
    errors.push(
      issue(
        '/win/collect',
        'nothing_to_collect',
        'there is nothing to collect; add a pickup piece.',
      ),
    );
  if (doc.win.reach && counts.goal === 0)
    errors.push(issue('/win/reach', 'no_goal', 'there is no goal; add a goal piece.'));
  if ((counts.door ?? 0) > 0 && counts.key === 0)
    errors.push(
      issue('/map', 'door_without_key', 'a door needs a key piece somewhere on the map.'),
    );
  (doc.spawn ?? []).forEach((s, i) => {
    const piece = pieces[s.piece];
    if (piece === undefined)
      errors.push(issue(`/spawn/${i}/piece`, 'unknown_piece', `"${s.piece}" is not a piece.`));
    else if (piece.role !== 'hazard' && piece.role !== 'pickup') {
      errors.push(
        issue(
          `/spawn/${i}/piece`,
          'spawn_role',
          `only hazards and pickups can be spawned; "${s.piece}" is a ${piece.role}.`,
        ),
      );
    }
  });
  if (errors.length > 0) return { cells, errors, warnings };

  const R = map.length;
  const C = width;
  const charAt = (r: number, c: number): string => (map[r] as string)[c] ?? ' ';
  const isWall = (r: number, c: number): boolean => {
    if (r < 0 || r >= R || c < 0 || c >= C) return true;
    const role = pieces[charAt(r, c)]?.role;
    return role === 'wall' || role === 'door';
  };
  const player = cells.find((x) => x.piece.role === 'player') as Cell;
  const platformer = doc.kind === 'platformer';
  const reach = platformer
    ? platformReach(R, C, player, isWall, (r, c) => n.generated && charAt(r, c) === LEDGE)
    : gridReach(R, C, player, (r, c) => pieces[charAt(r, c)]?.role);
  for (const x of cells) {
    if (!['pickup', 'goal', 'key'].includes(x.piece.role)) continue;
    if (!reach.has(`${x.r},${x.c}`)) {
      errors.push(
        issue(
          `/map/${x.r}`,
          'unreachable',
          `the ${x.piece.role} at column ${x.c} cannot be reached from the player${platformer ? ' (too high, or too far to jump)' : ''}.`,
        ),
      );
    }
  }
  const hasPit =
    platformer && Array.from({ length: C }, (_, c) => c).some((c) => !isWall(R - 1, c));
  const canHurt =
    cells.some((x) => x.piece.role === 'hazard') ||
    (doc.spawn ?? []).some((s) => pieces[s.piece]?.role === 'hazard') ||
    hasPit;
  if (doc.lose !== undefined && !canHurt) {
    warnings.push({
      path: '/lose',
      code: 'cannot_lose',
      message: 'nothing can cost a life; add a hazard (or, in a platformer, a gap to fall into).',
      severity: 'notice',
    });
  }
  if (doc.lose === undefined && canHurt) {
    warnings.push({
      path: '/lose',
      code: 'no_lives',
      message:
        'hazards exist but "lose" is not set, so the player can never lose; add "lose": { "lives": 3 }.',
      severity: 'notice',
    });
  }
  return { cells, errors, warnings };
}

function gridReach(
  R: number,
  C: number,
  start: Cell,
  roleAt: (r: number, c: number) => string | undefined,
): Set<string> {
  // Doors open once a key is reachable: two passes.
  const passable = (r: number, c: number, doors: boolean): boolean => {
    if (r < 0 || r >= R || c < 0 || c >= C) return false;
    const role = roleAt(r, c);
    if (role === 'wall') return false;
    if (role === 'door') return doors;
    return true;
  };
  const flood = (doors: boolean): Set<string> => {
    const seen = new Set([`${start.r},${start.c}`]);
    const q: [number, number][] = [[start.r, start.c]];
    for (let head = 0; head < q.length; head++) {
      const [r, c] = q[head] as [number, number];
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = `${r + dr},${c + dc}`;
        if (!seen.has(k) && passable(r + dr, c + dc, doors)) {
          seen.add(k);
          q.push([r + dr, c + dc]);
        }
      }
    }
    return seen;
  };
  const first = flood(false);
  const keyReached = [...first].some((k) => {
    const [r, c] = k.split(',').map(Number) as [number, number];
    return roleAt(r, c) === 'key';
  });
  return keyReached ? flood(true) : first;
}

function platformReach(
  R: number,
  C: number,
  start: Cell,
  isWall: (r: number, c: number) => boolean,
  isLedge: (r: number, c: number) => boolean,
): Set<string> {
  // Standing spots: open cell with solid (or a ledge) directly below. Moves: walk, fall, jump up
  // one cell and across three.
  const solidBelow = (r: number, c: number): boolean =>
    r + 1 < R && (isWall(r + 1, c) || isLedge(r + 1, c));
  const open = (r: number, c: number): boolean =>
    r >= 0 && r < R && c >= 0 && c < C && !isWall(r, c);
  const land = (r0: number, c: number): [number, number] | null => {
    for (let r = r0; r < R && open(r, c); r++) if (solidBelow(r, c)) return [r, c];
    return null;
  };
  const s0 = land(start.r, start.c) ?? [start.r, start.c];
  const seen = new Set([`${s0[0]},${s0[1]}`]);
  const touched = new Set([`${start.r},${start.c}`]);
  const q: [number, number][] = [s0];
  for (let head = 0; head < q.length; head++) {
    const [r, c] = q[head] as [number, number];
    // Everything the body passes through while standing or jumping up to 2 cells counts as touched.
    for (let up = 0; up <= 2; up++)
      for (let dc = -3; dc <= 3; dc++) if (open(r - up, c + dc)) touched.add(`${r - up},${c + dc}`);
    const next: ([number, number] | null)[] = [];
    for (const dc of [-1, 1]) {
      if (open(r, c + dc)) next.push(land(r, c + dc));
      for (let up = 0; up <= 1; up++) {
        for (let dist = 1; dist <= 3; dist++) {
          const tr = r - up;
          const tc = c + dc * dist;
          if (!open(tr, tc) || !open(r - 1, c)) continue;
          let clear = true;
          for (let k = 1; k <= dist; k++)
            if (!open(r - 1 - (up ? 1 : 0), c + dc * k) && !open(r - 1, c + dc * k)) clear = false;
          if (clear) next.push(land(tr, tc));
        }
      }
    }
    for (const nx of next) {
      if (nx === null) continue;
      const k = `${nx[0]},${nx[1]}`;
      if (!seen.has(k)) {
        seen.add(k);
        q.push(nx);
      }
    }
  }
  return touched;
}

// --- scene building ---

const PLAYING: PlayCondition = { select: '#game.vars.status', op: 'eq', value: 'playing' };

function visual(piece: GamePiece, size: [number, number, number], role: Role): JsonObject {
  if (piece.figure !== undefined) return { kind: 'figure' };
  const ref = piece.shape ?? (role === 'pickup' ? 'sphere' : role === 'goal' ? 'cylinder' : 'box');
  return primitive(ref, size, piece.color ?? DEFAULT_COLOR[role]);
}

function figureOf(piece: GamePiece): JsonObject {
  if (piece.figure === undefined) return {};
  return {
    figure: {
      preset: piece.figure,
      ...(piece.color !== undefined ? { palette: { top: piece.color } } : {}),
    },
  };
}

interface Built {
  entities: { id: string; components: JsonObject }[];
  prefabs: Record<string, { components: JsonObject }>;
  start: [number, number, number];
  rules: RuleEntry[];
  camera: JsonObject;
  input: JsonObject;
}

function stopPlayer(platformer: boolean): PlayAction[] {
  return [
    { set: { target: '#player', component: 'controller', path: 'enabled', value: false } },
    platformer
      ? {
          set: {
            target: '#player',
            component: 'platformIntent',
            value: { move: 0, jump: false, jumpHeld: false },
          },
        }
      : { set: { target: '#player', component: 'kinematicBody', path: 'vel', value: [0, 0, 0] } },
  ];
}

/** The rules every compiled game shares: pickups, keys, hazards, winning and losing. */
function gameRules(
  n: Normalized,
  cells: Cell[],
  start: [number, number, number],
  platformer: boolean,
): RuleEntry[] {
  const { doc, pieces } = n;
  const lives = doc.lose?.lives;
  const has = (role: Role): boolean =>
    cells.some((x) => x.piece.role === role) ||
    (doc.spawn ?? []).some((s) => pieces[s.piece]?.role === role);
  const end = (status: 'won' | 'lost'): PlayAction[] => [
    { set: { target: '#game', component: 'vars', path: 'status', value: status } },
    ...stopPlayer(platformer),
    { emit: { event: status === 'won' ? 'win' : 'lose' } },
  ];
  const hurt: PlayAction[] = [
    ...(lives !== undefined
      ? [{ add: { target: '#game', component: 'vars', path: 'lives', value: -1 } } as PlayAction]
      : []),
    { place: { target: '#player', at: start } },
    { set: { target: '#game', component: 'vars', path: 'safe', value: true } },
    { timer: { target: '#game', ticks: 45, event: 'safe-over' } },
    { emit: { event: 'hit' } },
  ];
  const rules: RuleEntry[] = [];
  if (has('pickup')) {
    rules.push({
      id: 'pickup',
      when: { touch: ['#player', 'tag:pickup'] },
      if: [PLAYING],
      do: [
        { destroy: '$b' },
        {
          add: {
            target: '#game',
            component: 'vars',
            path: 'score',
            value: 1,
            from: '$b.vars.points',
          },
        },
        { emit: { event: 'pickup' } },
      ],
    });
  }
  if (has('key')) {
    rules.push({
      id: 'key',
      when: { touch: ['#player', 'tag:key'] },
      if: [PLAYING],
      do: [{ destroy: '$b' }, { destroy: 'tag:door' }, { emit: { event: 'key' } }],
    });
  }
  if (has('hazard')) {
    rules.push({
      id: 'hurt',
      when: { touch: ['#player', 'tag:hazard'] },
      if: [PLAYING, { select: '#game.vars.safe', op: 'eq', value: false }],
      do: hurt,
    });
  }
  if (platformer) {
    rules.push({
      id: 'fall',
      when: { becomes: { select: '#player.transform.pos[1]', op: 'lt', value: -3 } },
      if: [PLAYING],
      do: hurt,
    });
  }
  rules.push({
    id: 'safe',
    when: { event: 'safe-over' },
    do: [{ set: { target: '#game', component: 'vars', path: 'safe', value: false } }],
  });
  if (doc.win.reach) {
    rules.push({
      id: 'goal',
      when: { touch: ['#player', 'tag:goal'] },
      if: [
        PLAYING,
        ...(doc.win.collect
          ? [{ select: 'tag:pickup', op: 'count', value: 0 } as PlayCondition]
          : []),
      ],
      do: end('won'),
    });
  } else if (doc.win.collect) {
    rules.push({
      id: 'collected',
      when: { becomes: { select: 'tag:pickup', op: 'count', value: 0 } },
      if: [PLAYING],
      once: true,
      do: end('won'),
    });
  }
  if (doc.win.survive !== undefined) {
    rules.push({
      id: 'clock',
      when: { every: TICK_RATE },
      if: [PLAYING],
      do: [{ add: { target: '#game', component: 'vars', path: 'left', value: -1 } }],
    });
    rules.push({
      id: 'survived',
      when: { becomes: { select: '#game.vars.left', op: 'lte', value: 0 } },
      if: [PLAYING],
      once: true,
      do: end('won'),
    });
  }
  if (lives !== undefined) {
    rules.push({
      id: 'lost',
      when: { becomes: { select: '#game.vars.lives', op: 'lte', value: 0 } },
      if: [PLAYING],
      once: true,
      do: end('lost'),
    });
  }
  return rules;
}

const DIR_PAYLOAD = {
  type: 'object',
  properties: {
    dir: {
      type: 'array',
      items: { type: 'number', minimum: -1, maximum: 1 },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['dir'],
  additionalProperties: false,
};
const HELD_PAYLOAD = {
  type: 'object',
  properties: { held: { type: 'boolean' } },
  required: ['held'],
  additionalProperties: false,
};

function topDownScene(n: Normalized, cells: Cell[]): Built {
  const { doc, map, pieces } = n;
  const R = map.length;
  const C = Math.max(...map.map((r) => r.length));
  const CELL = 2;
  const X = (c: number): number => (c - (C - 1) / 2) * CELL;
  const Z = (r: number): number => (r - (R - 1) / 2) * CELL;
  const roleAt = (r: number, c: number): string | undefined =>
    pieces[(map[r] as string)[c] ?? ' ']?.role;
  const isWall = (r: number, c: number): boolean => {
    if (r < 0 || r >= R || c < 0 || c >= C) return true;
    const role = roleAt(r, c);
    return role === 'wall' || role === 'door';
  };
  const entities: Built['entities'] = [];
  entities.push({
    id: 'floor',
    components: {
      transform: { pos: [0, -0.05, 0] },
      renderable: primitive('box', [C * CELL, 0.1, R * CELL], '#b7c9a0'),
    },
  });
  entities.push({
    id: 'outside',
    components: {
      transform: { pos: [0, -0.2, 0] },
      renderable: primitive('box', [C * CELL * 4, 0.1, R * CELL * 4], '#5e6b55'),
    },
  });
  // walls: merge horizontal runs of the same character
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; ) {
      const ch = (map[r] as string)[c] ?? ' ';
      const p = pieces[ch];
      if (p?.role !== 'wall') {
        c++;
        continue;
      }
      let e = c;
      while (e + 1 < C && (map[r] as string)[e + 1] === ch) e++;
      const len = e - c + 1;
      entities.push({
        id: `wall-${r}-${c}`,
        components: {
          transform: { pos: [(X(c) + X(e)) / 2, 0.8, Z(r)] },
          collider: {
            shape: 'aabb',
            halfExtents: [(len * CELL) / 2, CELL / 2],
            layer: 1,
            mask: 1,
            isStatic: true,
          },
          renderable: primitive('box', [len * CELL, 1.6, CELL], p.color ?? DEFAULT_COLOR.wall),
        },
      });
      c = e + 1;
    }
  }
  const playerPiece = Object.values(pieces).find((p) => p.role === 'player') as GamePiece;
  const playerSpeed = playerPiece.speed ?? 5;
  // a chaser never outruns the player: at most 60% of the player's speed
  const chaseCap = 0.6 * playerSpeed;
  let start: [number, number, number] = [0, 0, 0];
  const counter: Record<string, number> = {};
  const nextId = (role: string): string => {
    counter[role] = (counter[role] ?? 0) + 1;
    return `${role}-${counter[role]}`;
  };
  const hazardBody = (piece: GamePiece, move: string): JsonObject => {
    const speed = Math.min(
      piece.speed ?? (move === 'chase' ? 3 : 2.5),
      move === 'chase' ? chaseCap : Number.POSITIVE_INFINITY,
    );
    return {
      collider: { shape: 'circle', radius: 0.5, layer: 4, mask: 1 },
      kinematicBody: { vel: [0, 0, 0], slide: true },
      mover: {
        mode: move,
        target: '#player',
        speed,
        ...(move === 'wander' ? { turnTicks: 60 } : {}),
      },
    };
  };
  for (const x of cells) {
    const { piece } = x;
    const role = piece.role;
    if (role === 'wall') continue;
    const pos: [number, number, number] = [X(x.c), 0, Z(x.r)];
    if (role === 'player') {
      start = [pos[0], piece.figure !== undefined ? 0 : 0.55, pos[2]];
      entities.push({
        id: 'player',
        components: {
          transform: { pos: start },
          collider: { shape: 'circle', radius: 0.6, layer: 2, mask: 1 },
          kinematicBody: { vel: [0, 0, 0], slide: true },
          controller: { move: 'move', speed: playerSpeed },
          trigger: {
            radius: 0.5,
            layer: LAYER.player,
            mask: LAYER.pickup | LAYER.hazard | LAYER.goal | LAYER.key,
          },
          tag: { name: 'player' },
          renderable: visual(piece, [1.1, 1.1, 1.1], role),
          ...figureOf(piece),
        },
      });
      continue;
    }
    const id = nextId(role);
    const size = (
      {
        pickup: [0.8, 0.8, 0.8],
        goal: [1.6, 0.3, 1.6],
        key: [0.5, 0.5, 1.0],
        door: [CELL, 1.6, CELL],
        hazard: [1.0, 1.0, 1.0],
      } as Record<string, [number, number, number]>
    )[role] as [number, number, number];
    const y =
      piece.figure !== undefined
        ? 0
        : role === 'door'
          ? 0.8
          : size[1] / 2 + (role === 'pickup' ? 0.2 : 0);
    const comps: JsonObject = {
      transform: { pos: [pos[0], y, pos[2]] },
      tag: { name: role },
      renderable: visual(piece, size, role),
      ...figureOf(piece),
    };
    if (role === 'door') {
      comps.collider = {
        shape: 'aabb',
        halfExtents: [CELL / 2, CELL / 2],
        layer: 1,
        mask: 1,
        isStatic: true,
      };
    } else if (role === 'goal') {
      comps.trigger = {
        shape: 'box',
        halfExtents: [0.8, 0.8],
        layer: LAYER.goal,
        mask: LAYER.player,
      };
    } else {
      const layer = LAYER[role as 'pickup' | 'key' | 'hazard'];
      comps.trigger = {
        radius: role === 'pickup' ? 0.4 : role === 'key' ? 0.35 : 0.45,
        layer,
        mask: LAYER.player,
      };
    }
    if (role === 'pickup' && piece.points !== undefined && piece.points !== 1)
      comps.vars = { points: piece.points };
    if (role === 'hazard') {
      const move = piece.move ?? 'still';
      if (move === 'chase' || move === 'wander') Object.assign(comps, hazardBody(piece, move));
      else if (move === 'patrol') {
        // along the longer open run through its cell
        let a = x.c;
        let b = x.c;
        let u = x.r;
        let d = x.r;
        while (!isWall(x.r, a - 1)) a--;
        while (!isWall(x.r, b + 1)) b++;
        while (!isWall(u - 1, x.c)) u--;
        while (!isWall(d + 1, x.c)) d++;
        const horizontal = b - a >= d - u;
        const points: [number, number, number][] = horizontal
          ? [
              [X(a), y, Z(x.r)],
              [X(b), y, Z(x.r)],
            ]
          : [
              [X(x.c), y, Z(u)],
              [X(x.c), y, Z(d)],
            ];
        comps.path = { points, speed: piece.speed ?? 2.5, loop: 'pingpong' };
      }
    }
    entities.push({ id, components: comps });
  }
  // Spawn spots: open cells on the outer ring of the open area.
  const spawnCells: [number, number, number][] = [];
  let open = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (isWall(r, c)) continue;
      open++;
      if (isWall(r - 1, c) || isWall(r + 1, c) || isWall(r, c - 1) || isWall(r, c + 1))
        spawnCells.push([X(c), 0.5, Z(r)]);
    }
  }
  // no more spawned hazards than the floor has room to dodge: one per 20 open cells, at least 3
  const room = Math.max(3, Math.floor(open / 20));
  const prefabs: Built['prefabs'] = {};
  const spawnRules: RuleEntry[] = [];
  (doc.spawn ?? []).forEach((s, i) => {
    const pc = pieces[s.piece] as GamePiece;
    const role = pc.role as 'hazard' | 'pickup';
    const name = `spawn-${i}`;
    const move = pc.move ?? 'chase';
    const comps: JsonObject = {
      transform: { pos: [0, pc.figure !== undefined ? 0 : 0.5, 0] },
      tag: { name: role },
      renderable: visual(pc, [1, 1, 1], role),
      ...figureOf(pc),
      trigger: { radius: role === 'pickup' ? 0.4 : 0.45, layer: LAYER[role], mask: LAYER.player },
      ...(role === 'hazard' && (move === 'chase' || move === 'wander') ? hazardBody(pc, move) : {}),
      ...(role === 'pickup' && pc.points !== undefined && pc.points !== 1
        ? { vars: { points: pc.points } }
        : {}),
    };
    prefabs[name] = { components: comps };
    const initial = cells.filter((x) => x.piece.role === role).length;
    const max = role === 'hazard' ? Math.min(s.max ?? 20, room) : (s.max ?? 20);
    spawnRules.push({
      id: name,
      when: { every: Math.max(1, Math.round(s.every * TICK_RATE)) },
      if: [PLAYING, { select: `tag:${role}`, op: 'count_lt', value: initial + max }],
      do: [
        {
          spawn: {
            prefab: name,
            pick: spawnCells.length > 0 ? spawnCells : [[0, 0.5, 0]],
            awayFrom: '#player',
            minDistance: 7,
          },
        },
      ],
    });
  });
  const viewHeight = Math.max(R * CELL, (C * CELL * 9) / 16) + 2;
  return {
    entities,
    prefabs,
    start,
    rules: [...gameRules(n, cells, start, false), ...spawnRules],
    camera: { mode: 'top-down-ortho', center: [0, 0], viewHeight },
    input: {
      bindings: {
        KeyW: 'up',
        ArrowUp: 'up',
        KeyS: 'down',
        ArrowDown: 'down',
        KeyA: 'left',
        ArrowLeft: 'left',
        KeyD: 'right',
        ArrowRight: 'right',
        KeyR: 'restart',
      },
      emit: [
        {
          kind: 'axis2d',
          xNeg: 'left',
          xPos: 'right',
          yNeg: 'up',
          yPos: 'down',
          command: 'move',
          field: 'dir',
        },
        { kind: 'press', action: 'restart', command: 'restart' },
      ],
    },
  };
}

function platformScene(n: Normalized, cells: Cell[]): Built {
  const { map, pieces } = n;
  const R = map.length;
  const C = Math.max(...map.map((r) => r.length));
  const CELL = PLATFORM_CELL;
  const X = (c: number): number => c * CELL;
  const Y = (r: number): number => (R - 1 - r) * CELL + CELL / 2;
  const roleAt = (r: number, c: number): string | undefined =>
    pieces[(map[r] as string)[c] ?? ' ']?.role;
  const isWall = (r: number, c: number): boolean => {
    if (r < 0 || r >= R || c < 0 || c >= C) return true;
    const role = roleAt(r, c);
    return role === 'wall' || role === 'door';
  };
  const entities: Built['entities'] = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; ) {
      const ch = (map[r] as string)[c] ?? ' ';
      const p = pieces[ch];
      const ledge = n.generated && ch === LEDGE;
      if (p?.role !== 'wall' && !ledge) {
        c++;
        continue;
      }
      let e = c;
      while (e + 1 < C && (map[r] as string)[e + 1] === ch) e++;
      const len = e - c + 1;
      entities.push({
        id: `${ledge ? 'ledge' : 'solid'}-${r}-${c}`,
        components: ledge
          ? {
              transform: { pos: [(X(c) + X(e)) / 2, Y(r) + CELL / 2 - 0.15, 0] },
              platformSolid: { halfExtents: [(len * CELL) / 2, 0.15], oneWay: true },
              renderable: primitive('box', [len * CELL, 0.3, 2], '#a1887f'),
            }
          : {
              transform: { pos: [(X(c) + X(e)) / 2, Y(r), 0] },
              platformSolid: { halfExtents: [(len * CELL) / 2, CELL / 2] },
              renderable: primitive('box', [len * CELL, CELL, 3], p?.color ?? '#8d6e63'),
            },
      });
      c = e + 1;
    }
  }
  let start: [number, number, number] = [0, 0, 0];
  const counter: Record<string, number> = {};
  const nextId = (role: string): string => {
    counter[role] = (counter[role] ?? 0) + 1;
    return `${role}-${counter[role]}`;
  };
  for (const x of cells) {
    const { piece } = x;
    const role = piece.role;
    if (role === 'wall') continue;
    const cx = X(x.c);
    const bottom = Y(x.r) - CELL / 2;
    if (role === 'player') {
      start = [cx, bottom + 0.66, 0];
      entities.push({
        id: 'player',
        components: {
          transform: { pos: start },
          platformBody: {
            halfExtents: [0.35, 0.65],
            speed: Math.max(MIN_RUNNER_SPEED, piece.speed ?? 7),
            jumpSpeed: 12,
            gravity: 28,
          },
          platformIntent: { move: 0, jumpHeld: false },
          controller: { move: 'move', jump: 'jump' },
          trigger: {
            shape: 'box',
            halfExtents: [0.35, 0.65],
            plane: 'xy',
            layer: LAYER.player,
            mask: LAYER.pickup | LAYER.hazard | LAYER.goal | LAYER.key,
          },
          tag: { name: 'player' },
          renderable: primitive(
            piece.shape ?? 'box',
            [0.7, 1.3, 0.7],
            piece.color ?? DEFAULT_COLOR.player,
          ),
        },
      });
      continue;
    }
    const id = nextId(role);
    let pos: [number, number, number] = [cx, Y(x.r), 0];
    let size: [number, number, number] = [0.6, 0.6, 0.6];
    let zone: JsonObject;
    const moving = role === 'hazard' && (piece.move ?? 'still') !== 'still';
    if (role === 'hazard' && !moving) {
      size = [CELL * 0.9, 0.5, 1.2];
      pos = [cx, bottom + 0.25, 0];
      zone = {
        shape: 'box',
        halfExtents: [CELL * 0.4, 0.25],
        plane: 'xy',
        layer: LAYER.hazard,
        mask: LAYER.player,
      };
    } else if (role === 'hazard') {
      size = [0.9, 0.9, 0.9];
      pos = [cx, bottom + 0.45, 0];
      zone = {
        shape: 'box',
        halfExtents: [0.4, 0.4],
        plane: 'xy',
        layer: LAYER.hazard,
        mask: LAYER.player,
      };
    } else if (role === 'goal') {
      size = [0.15, CELL * 1.6, 0.15];
      pos = [cx, bottom + CELL * 0.8, 0];
      entities.push({
        id: `${id}-cloth`,
        components: {
          transform: { pos: [cx + 0.45, bottom + CELL * 1.4, 0] },
          renderable: primitive('box', [0.9, 0.5, 0.05], piece.color ?? DEFAULT_COLOR.goal),
        },
      });
      zone = {
        shape: 'box',
        halfExtents: [0.4, CELL * 0.8],
        plane: 'xy',
        layer: LAYER.goal,
        mask: LAYER.player,
      };
    } else {
      zone = {
        radius: role === 'key' ? 0.35 : 0.4,
        plane: 'xy',
        layer: role === 'key' ? LAYER.key : LAYER.pickup,
        mask: LAYER.player,
      };
    }
    const comps: JsonObject = {
      transform: { pos },
      tag: { name: role },
      renderable:
        role === 'goal'
          ? primitive('cylinder', size, '#555555')
          : visual({ ...piece, figure: undefined }, size, role),
    };
    if (role === 'door') {
      comps.platformSolid = { halfExtents: [CELL / 2, CELL / 2] };
      comps.renderable = primitive('box', [CELL, CELL, 3], piece.color ?? DEFAULT_COLOR.door);
      comps.transform = { pos: [cx, Y(x.r), 0] };
    } else comps.trigger = zone;
    if (role === 'pickup' && piece.points !== undefined && piece.points !== 1)
      comps.vars = { points: piece.points };
    if (moving) {
      let a = x.c;
      let b = x.c;
      const standable = (c: number): boolean => !isWall(x.r, c) && isWall(x.r + 1, c);
      while (standable(a - 1)) a--;
      while (standable(b + 1)) b++;
      comps.path = {
        points: [
          [X(a), pos[1], 0],
          [X(b), pos[1], 0],
        ],
        speed: piece.speed ?? 2,
        loop: 'pingpong',
      };
    }
    entities.push({ id, components: comps });
  }
  return {
    entities,
    prefabs: {},
    start,
    rules: gameRules(n, cells, start, true),
    camera: {
      mode: 'follow',
      entity: 'player',
      offset: [0, 2.5, 16],
      lookOffset: [0, 1, 0],
      fov: 50,
    },
    input: {
      bindings: {
        KeyA: 'left',
        ArrowLeft: 'left',
        KeyD: 'right',
        ArrowRight: 'right',
        KeyW: 'up',
        ArrowUp: 'up',
        KeyS: 'down',
        ArrowDown: 'down',
        Space: 'jump',
        KeyR: 'restart',
      },
      emit: [
        {
          kind: 'axis2d',
          xNeg: 'left',
          xPos: 'right',
          yNeg: 'up',
          yPos: 'down',
          command: 'move',
          field: 'dir',
        },
        { kind: 'press', action: 'jump', command: 'jump', payload: { held: true } },
        { kind: 'release', action: 'jump', command: 'jump', payload: { held: false } },
        { kind: 'press', action: 'restart', command: 'restart' },
      ],
    },
  };
}

// --- public API ---

export interface GameInfo {
  /** The level as drawn (generated, or the document's own map). */
  map: string[];
  /** Pieces including any the layout added (a default wall). */
  pieces: Record<string, GamePiece>;
  /** The command a host maps to restarting the game (rebuild the world). */
  restartCommand: 'restart';
}

export type CompileGameResult =
  | { ok: true; scene: SceneManifest; warnings: ValidationIssue[]; info: GameInfo }
  | { ok: false; issues: ValidationIssue[]; formatted: string };

function label(doc: unknown): string {
  const name = (doc as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? `game "${name}"` : 'game';
}

/** Validate a game document and compile it into a data-only scene@3. */
export function compileGame(doc: unknown): CompileGameResult {
  const r = normalize(doc);
  if (!r.ok) return { ok: false, issues: r.issues, formatted: formatIssues(label(doc), r.issues) };
  const n = r.n;
  const checked = checkMap(n);
  if (checked.errors.length > 0) {
    return {
      ok: false,
      issues: checked.errors,
      formatted: formatIssues(label(doc), checked.errors),
    };
  }
  const platformer = n.doc.kind === 'platformer';
  const built = platformer ? platformScene(n, checked.cells) : topDownScene(n, checked.cells);
  const lives = n.doc.lose?.lives;
  const hasScore =
    checked.cells.some((x) => x.piece.role === 'pickup') ||
    (n.doc.spawn ?? []).some((s) => n.pieces[s.piece]?.role === 'pickup');
  const vars: JsonObject = {
    score: 0,
    status: 'playing',
    safe: false,
    ...(lives !== undefined ? { lives } : {}),
    ...(n.doc.win.survive !== undefined ? { left: Math.round(n.doc.win.survive) } : {}),
  };
  const again = 'Press R to play again';
  const hud = {
    items: [
      ...(hasScore ? [{ label: 'Score', value: '#game.vars.score' }] : []),
      ...(lives !== undefined ? [{ label: 'Lives', value: '#game.vars.lives' }] : []),
      ...(n.doc.win.survive !== undefined ? [{ label: 'Time', value: '#game.vars.left' }] : []),
    ],
    messages: [
      { when: { ...PLAYING, value: 'won' }, text: n.doc.text?.win ?? 'You win!', detail: again },
      { when: { ...PLAYING, value: 'lost' }, text: n.doc.text?.lose ?? 'Game over', detail: again },
    ],
    title: { text: n.doc.text?.title ?? n.doc.name, ticks: 75 },
  };
  const scene: SceneManifest = {
    format: 'molen/scene@3',
    name: slug(n.doc.name, 'game'),
    seed: n.doc.name,
    tickRate: TICK_RATE,
    lateCommands: 'rewrite',
    keyframeInterval: 60,
    prefabs: built.prefabs as SceneManifest['prefabs'],
    entities: [
      { id: 'env', components: environmentFor(n.doc.look) },
      { id: 'game', components: { vars, rules: { rules: built.rules } } },
      ...built.entities,
    ] as SceneManifest['entities'],
    scripts: [],
    commands: {
      move: {
        doc: 'Move direction [x, y]: x is right; y is down the screen (top-down) or ignored (platformer).',
        payload: DIR_PAYLOAD,
      },
      ...(platformer
        ? { jump: { doc: 'Jump button pressed or released.', payload: HELD_PAYLOAD } }
        : {}),
      restart: { doc: 'Start the game again (the host rebuilds the world).' },
    } as SceneManifest['commands'],
    components: {},
    camera: built.camera as unknown as SceneManifest['camera'],
    input: built.input as unknown as SceneManifest['input'],
    physics: { engine: platformer ? 'platformer' : 'kinematics' } as SceneManifest['physics'],
    hud,
  };
  return {
    ok: true,
    scene,
    warnings: [...n.warnings, ...checked.warnings],
    info: { map: n.map, pieces: n.pieces, restartCommand: 'restart' },
  };
}

/**
 * What a play test would find before playing: the document's issues (unknown map letters, no
 * player, an unreachable pickup in a drawn map), then notices (the game cannot be lost).
 */
export function lintGame(doc: unknown): ValidationIssue[] {
  const r = normalize(doc);
  if (!r.ok) return r.issues;
  const checked = checkMap(r.n);
  return [...checked.errors, ...r.n.warnings, ...checked.warnings];
}
