// Generated levels: a game names a layout archetype, optionally customized, and how many of each
// piece; code draws a map the player can finish. Deterministic from the game's name and seed.
//
// What each archetype had to learn from real answers (specs/authoring-layer.md):
// - a maze has loops so a patrolling guard never blocks the only route, guards start off the
//   main route, the key lies far from the door, and the door is the only way to the goal;
// - a platformer's gaps are as wide as this runner can jump, the ground never changes height
//   beside a gap, spike traps sit on level ground, and a runner is never slower than 4 m/s;
// - every piece asked for is placed, or the level is drawn again from another seed.

export type Archetype = 'garden' | 'maze' | 'arena' | 'level';
export type LayoutSize = 'small' | 'medium' | 'large' | [number, number];
export type Amount3 = 'few' | 'some' | 'many';

export interface LayoutSpec {
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

export interface LayoutPiece {
  role: string;
  count?: number;
  speed?: number;
  move?: string;
}

const SIZES = {
  'top-down': { small: [11, 9], medium: [15, 11], large: [19, 13] },
  platformer: { small: [26, 8], medium: [38, 8], large: [50, 8] },
} as const;

/** Column and row bounds for a custom `[columns, rows]` size. */
export const SIZE_LIMITS: Readonly<
  Record<'top-down' | 'platformer', { cols: [number, number]; rows: [number, number] }>
> = {
  'top-down': { cols: [7, 41], rows: [7, 31] },
  platformer: { cols: [16, 90], rows: [6, 14] },
};

/** Internal map character for a one-way ledge in a generated level. */
export const LEDGE = '=';

type Rand = () => number;

function rng(seedText: string): Rand {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RC = [number, number];
const key = (r: number, c: number): string => `${r},${c}`;
const DIRS: readonly RC[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function bfs(grid: string[][], start: RC, passable: (ch: string) => boolean): Map<string, number> {
  const dist = new Map<string, number>([[key(start[0], start[1]), 0]]);
  const q: RC[] = [start];
  for (let head = 0; head < q.length; head++) {
    const [r, c] = q[head] as RC;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= grid.length || nc < 0 || nc >= (grid[0] as string[]).length) continue;
      if (dist.has(key(nr, nc)) || !passable((grid[nr] as string[])[nc] as string)) continue;
      dist.set(key(nr, nc), (dist.get(key(r, c)) as number) + 1);
      q.push([nr, nc]);
    }
  }
  return dist;
}

interface Want {
  ch: string;
  piece: LayoutPiece;
  n: number;
}

function wanted(pieces: Record<string, LayoutPiece>): Record<string, Want[]> {
  const out: Record<string, Want[]> = {};
  for (const [ch, p] of Object.entries(pieces)) {
    const list = out[p.role] ?? [];
    list.push({ ch, piece: p, n: p.role === 'player' ? 1 : (p.count ?? 1) });
    out[p.role] = list;
  }
  return out;
}

function dims(kind: 'top-down' | 'platformer', size: LayoutSize | undefined): [number, number] {
  if (Array.isArray(size)) {
    const lim = SIZE_LIMITS[kind];
    const cols = Math.min(lim.cols[1], Math.max(lim.cols[0], Math.round(size[0])));
    const rows = Math.min(lim.rows[1], Math.max(lim.rows[0], Math.round(size[1])));
    return [cols, rows];
  }
  const s = SIZES[kind][size ?? 'medium'];
  return [s[0], s[1]];
}

// --- top-down ---

/** A perfect maze over odd coordinates (1..h-2 x 1..w-2), corridors one cell wide. */
function carveMaze(h: number, w: number, rand: Rand): string[][] {
  const g = Array.from({ length: h }, () => Array.from({ length: w }, () => '#'));
  const stack: RC[] = [[1, 1]];
  (g[1] as string[])[1] = '.';
  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1] as RC;
    const next = (
      [
        [0, 2],
        [0, -2],
        [2, 0],
        [-2, 0],
      ] as RC[]
    )
      .map(([dr, dc]): [number, number, number, number] => [r + dr, c + dc, r + dr / 2, c + dc / 2])
      .filter(
        ([nr, nc]) =>
          nr > 0 && nc > 0 && nr < h - 1 && nc < w - 1 && (g[nr] as string[])[nc] === '#',
      );
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const [nr, nc, mr, mc] = next[Math.floor(rand() * next.length)] as [
      number,
      number,
      number,
      number,
    ];
    (g[mr] as string[])[mc] = '.';
    (g[nr] as string[])[nc] = '.';
    stack.push([nr, nc]);
  }
  return g;
}

function topDown(
  spec: LayoutSpec,
  pieces: Record<string, LayoutPiece>,
  rand: Rand,
): string[] | null {
  const [W, H] = dims('top-down', spec.size);
  const W2 = W % 2 === 1 ? W : W + 1;
  const H2 = H % 2 === 1 ? H : H + 1;
  let g: string[][] = Array.from({ length: H2 }, (_, r) =>
    Array.from({ length: W2 }, (_, c) =>
      r === 0 || c === 0 || r === H2 - 1 || c === W2 - 1 ? '#' : '.',
    ),
  );
  const open = (ch: string): boolean => ch !== '#';
  const want = wanted(pieces);
  const wallCh = want.wall?.[0]?.ch ?? '#';
  let start: RC = [1, 1];
  if (spec.archetype === 'maze') {
    if (spec.corridors === 'wide') {
      // a maze on a coarser grid, each corridor two cells wide and each wall one
      const w = Math.max(5, 2 * Math.floor((W2 - 1) / 3) + 1);
      const h = Math.max(5, 2 * Math.floor((H2 - 1) / 3) + 1);
      const small = carveMaze(h, w, rand);
      const span = (i: number): number => (i % 2 === 1 ? 2 : 1);
      const rows: number[] = [];
      for (let i = 0; i < h; i++) for (let k = 0; k < span(i); k++) rows.push(i);
      const cols: number[] = [];
      for (let j = 0; j < w; j++) for (let k = 0; k < span(j); k++) cols.push(j);
      g = rows.map((i) => cols.map((j) => (small[i] as string[])[j] as string));
    } else {
      g = carveMaze(H2, W2, rand);
    }
    // open walls between corridors, so there is more than one way past a guard
    const area = g.length * (g[0] as string[]).length;
    const loops =
      spec.loops === 'none'
        ? 0
        : spec.loops === 'many'
          ? Math.round(area / 25)
          : Math.max(2, Math.round(area / 60));
    for (let i = 0, tries = 0; i < loops && tries < 600; tries++) {
      const r = 1 + Math.floor(rand() * (g.length - 2));
      const c = 1 + Math.floor(rand() * ((g[0] as string[]).length - 2));
      const row = g[r] as string[];
      if (row[c] !== '#') continue;
      const horiz =
        row[c - 1] === '.' &&
        row[c + 1] === '.' &&
        (g[r - 1] as string[])[c] === '#' &&
        (g[r + 1] as string[])[c] === '#';
      const vert =
        (g[r - 1] as string[])[c] === '.' &&
        (g[r + 1] as string[])[c] === '.' &&
        row[c - 1] === '#' &&
        row[c + 1] === '#';
      if (!horiz && !vert) continue;
      row[c] = '.';
      i++;
    }
  } else if (spec.archetype === 'arena') {
    start = [Math.floor(H2 / 2), Math.floor(W2 / 2)];
    const pillars: RC[] =
      spec.pillars === 'none'
        ? []
        : spec.pillars === 'many'
          ? (() => {
              const out: RC[] = [];
              for (let r = 2; r < H2 - 2; r += 3)
                for (let c = 3; c < W2 - 3; c += 3) out.push([r, c]);
              return out;
            })()
          : [
              [2, 3],
              [2, W2 - 4],
              [H2 - 3, 3],
              [H2 - 3, W2 - 4],
            ];
    for (const [r, c] of pillars) {
      if (Math.abs(r - start[0]) + Math.abs(c - start[1]) <= 1) continue;
      (g[r] as string[])[c] = '#';
    }
  } else {
    // garden: short hedges that never cut the floor in two
    const per = spec.hedges === 'few' ? 40 : spec.hedges === 'many' ? 14 : 22;
    const hedges = Math.round((W2 * H2) / per);
    for (let i = 0, tries = 0; i < hedges && tries < 300; tries++) {
      const r = 2 + Math.floor(rand() * (H2 - 4));
      const c = 2 + Math.floor(rand() * (W2 - 4));
      const len = 2 + Math.floor(rand() * 3);
      const horiz = rand() < 0.5;
      const cells = Array.from(
        { length: len },
        (_, k): RC => (horiz ? [r, c + k] : [r + k, c]),
      ).filter(([a, b]) => a > 1 && b > 1 && a < H2 - 2 && b < W2 - 2);
      if (cells.some(([a, b]) => a === start[0] && b === start[1])) continue;
      for (const [a, b] of cells) (g[a] as string[])[b] = '#';
      const floor = g.flat().filter(open).length;
      if (bfs(g, start, open).size !== floor) {
        for (const [a, b] of cells) (g[a] as string[])[b] = '.';
        continue;
      }
      i++;
    }
  }
  const rows = g.length;
  const cols = (g[0] as string[]).length;
  const at = (r: number, c: number): string => (g[r] as string[])[c] as string;
  const take = (r: number, c: number, ch: string): void => {
    (g[r] as string[])[c] = ch;
  };
  const roleOf = (ch: string): string | undefined => pieces[ch]?.role;
  take(start[0], start[1], want.player?.[0]?.ch ?? 'P');
  const free = (): { rc: RC; dist: number }[] => {
    const d = bfs(g, start, (ch) => ch !== '#' && roleOf(ch) !== 'door');
    return [...d.entries()]
      .map(([k, dist]) => ({ rc: k.split(',').map(Number) as RC, dist }))
      .filter(({ rc }) => at(rc[0], rc[1]) === '.');
  };
  // goal, then a door in front of it, then the key somewhere the door does not guard
  let doorAt: RC | null = null;
  for (const { ch } of want.goal ?? []) {
    const f = free().sort((a, b) => b.dist - a.dist)[0];
    if (f === undefined) break;
    take(f.rc[0], f.rc[1], ch);
    const doorPiece = want.door?.[0];
    if (doorPiece !== undefined) {
      // wall all the goal's open neighbors but the one on the shortest path; that one is the door
      const d = bfs(g, start, (x) => x !== '#');
      const [gr, gc] = f.rc;
      const nb = DIRS.map(([dr, dc]): RC => [gr + dr, gc + dc]).filter(
        ([r, c]) => at(r, c) !== '#' && d.has(key(r, c)),
      );
      nb.sort((a, b) => (d.get(key(a[0], a[1])) as number) - (d.get(key(b[0], b[1])) as number));
      const door = nb[0];
      if (door === undefined) return null;
      for (const [r, c] of nb.slice(1)) if (at(r, c) === '.') take(r, c, '#');
      take(door[0], door[1], doorPiece.ch);
      doorAt = door;
      // the door must be the only way in
      const shut = bfs(g, start, (x) => x !== '#' && roleOf(x) !== 'door');
      if (shut.has(key(gr, gc))) return null;
    }
  }
  // the key goes far from the start and far from the door it opens
  const fromDoor =
    doorAt !== null
      ? bfs(g, doorAt, (x) => x !== '#' && !['goal', 'door'].includes(roleOf(x) ?? ''))
      : null;
  for (const { ch } of want.key ?? []) {
    const score = (x: { rc: RC; dist: number }): number =>
      Math.min(x.dist, fromDoor?.get(key(x.rc[0], x.rc[1])) ?? x.dist);
    const f = free().sort((a, b) => score(b) - score(a))[0];
    if (f !== undefined) take(f.rc[0], f.rc[1], ch);
  }
  // pickups spread out: each one as far as possible from what is already placed
  const placed: RC[] = [start];
  const spread = (rc: RC): number =>
    Math.min(...placed.map((p) => Math.abs(p[0] - rc[0]) + Math.abs(p[1] - rc[1])));
  for (const { ch, n } of want.pickup ?? []) {
    for (let i = 0; i < n; i++) {
      const f = free().filter((x) => x.dist >= 2);
      if (f.length === 0) break;
      f.sort((a, b) => spread(b.rc) - spread(a.rc));
      const best = f[0] as { rc: RC };
      take(best.rc[0], best.rc[1], ch);
      placed.push(best.rc);
    }
  }
  // the routes to everything the player must reach; maze guards start off them
  const route = new Set<string>();
  const targets: RC[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++)
      if (['key', 'door', 'pickup', 'goal'].includes(roleOf(at(r, c)) ?? '')) targets.push([r, c]);
  }
  for (const t of targets) {
    const d = bfs(g, t, (x) => x !== '#');
    let cur: RC = start;
    for (let k = 0; k < 2000 && (d.get(key(cur[0], cur[1])) ?? 0) > 0; k++) {
      route.add(key(cur[0], cur[1]));
      const nb = DIRS.map(([dr, dc]): RC => [cur[0] + dr, cur[1] + dc]).filter((q) =>
        d.has(key(q[0], q[1])),
      );
      nb.sort((a, b) => (d.get(key(a[0], a[1])) as number) - (d.get(key(b[0], b[1])) as number));
      const step = nb[0];
      if (step === undefined) break;
      cur = step;
    }
  }
  for (const { ch, piece, n } of want.hazard ?? []) {
    for (let i = 0; i < n; i++) {
      let f = free().filter((x) => x.dist >= 4);
      if (spec.archetype === 'maze') {
        const off = f.filter((x) => !route.has(key(x.rc[0], x.rc[1])));
        if (off.length > 0) f = off;
      }
      if (piece.move === 'patrol') {
        const run = ([r, c]: RC): number => {
          let a = 0;
          for (let k = 1; at(r, c + k) === '.'; k++) a++;
          for (let k = 1; at(r, c - k) === '.'; k++) a++;
          return a;
        };
        const long = f.filter((x) => run(x.rc) >= 3);
        if (long.length > 0) f = long;
      }
      if (f.length === 0) break;
      const pick = f[Math.floor(rand() * f.length)] as { rc: RC };
      take(pick.rc[0], pick.rc[1], ch);
    }
  }
  if (wallCh !== '#')
    for (const row of g) for (let c = 0; c < row.length; c++) if (row[c] === '#') row[c] = wallCh;
  return g.map((row) => row.join(''));
}

// --- platformer ---

/** The airborne time and jump of a compiled runner: jump 12 m/s, gravity 28, cells 1.5 m. */
export const PLATFORM_CELL = 1.5;
export const MIN_RUNNER_SPEED = 4;

function level(spec: LayoutSpec, pieces: Record<string, LayoutPiece>, rand: Rand): string[] {
  const [W, H] = dims('platformer', spec.size);
  const want = wanted(pieces);
  const wallCh = want.wall?.[0]?.ch ?? '#';
  const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  // ground height per column (rows of solid from the bottom); 0 means a gap
  const ground = Array.from({ length: W }, () => 0);
  const maxH =
    spec.hills === 'flat' ? 1 : spec.hills === 'steep' ? Math.min(4, H - 4) : Math.min(3, H - 4);
  const pGap = spec.gaps === 'few' ? 0.18 : spec.gaps === 'many' ? 0.5 : 0.35;
  const pUp = spec.hills === 'steep' ? 0.3 : spec.hills === 'flat' ? 0 : 0.2;
  const pDown = spec.hills === 'steep' ? 0.3 : spec.hills === 'flat' ? 0 : 0.15;
  let c = 0;
  let h = 1;
  for (; c < 4; c++) ground[c] = h;
  const spikeSpots: number[] = [];
  // the widest gap this runner can clear (airborne about 0.86 s)
  const speed = Math.max(MIN_RUNNER_SPEED, want.player?.[0]?.piece.speed ?? 7);
  const maxGap = speed * 0.86 >= 2 * PLATFORM_CELL + 1.2 ? 2 : 1;
  let afterGap = false;
  while (c < W - 4) {
    const roll = rand();
    // the ground never changes height on either side of a gap
    if (roll < pGap && !afterGap) {
      c += 1 + Math.floor(rand() * maxGap);
      afterGap = true;
    } else if (roll < pGap + pUp && h < maxH) {
      h++;
      afterGap = false;
    } else if (roll < pGap + pUp + pDown && h > 1) {
      h--;
      afterGap = false;
    } else afterGap = false;
    const run = 4 + Math.floor(rand() * 4);
    for (let k = 0; k < run && c < W - 4; k++, c++) ground[c] = h;
    if (run >= 5) spikeSpots.push(c - Math.ceil(run / 2));
  }
  for (; c < W; c++) ground[c] = h;
  for (let col = 0; col < W; col++)
    for (let k = 0; k < (ground[col] as number); k++) (g[H - 1 - k] as string[])[col] = wallCh;
  const top = (col: number): number => H - 1 - (ground[col] as number);
  (g[top(1)] as string[])[1] = want.player?.[0]?.ch ?? 'P';
  for (const { ch } of want.goal ?? []) (g[top(W - 2)] as string[])[W - 2] = ch;
  // a spike sits mid-run, with level ground on both sides
  const okSpike = (col: number): boolean =>
    col > 4 &&
    col < W - 5 &&
    (ground[col] as number) > 0 &&
    [-1, 1, -2, 2, -3, 3].every((d) => ground[col + d] === ground[col]);
  const spots = [...new Set(spikeSpots)].filter(okSpike);
  for (let col = 5; col < W - 5 && spots.length < 8; col++) {
    if (okSpike(col) && !spots.includes(col) && spots.every((s) => Math.abs(s - col) > 4))
      spots.push(col);
  }
  for (const { ch, n } of want.hazard ?? []) {
    for (let i = 0; i < n && spots.length > 0; i++) {
      const col = spots.splice(Math.floor(rand() * spots.length), 1)[0] as number;
      (g[top(col)] as string[])[col] = ch;
    }
  }
  // ledges: one-way platforms one cell up over level stretches, reachable by a jump
  const ledgeRuns = spec.ledges === 'many' ? 4 : spec.ledges === 'some' ? 2 : 0;
  const ledgeCols = new Set<number>();
  for (let i = 0, tries = 0; i < ledgeRuns && tries < 60; tries++) {
    const col = 4 + Math.floor(rand() * (W - 10));
    const span = [col, col + 1, col + 2];
    const lvl = ground[col] as number;
    if (
      lvl === 0 ||
      !span.every(
        (k) => ground[k] === lvl && (g[top(k)] as string[])[k] === '.' && !ledgeCols.has(k),
      )
    )
      continue;
    for (const k of span) {
      (g[top(k) - 1] as string[])[k] = LEDGE;
      ledgeCols.add(k);
    }
    i++;
  }
  // pickups float one cell above the ground (or a ledge), on level stretches
  const free: number[] = [];
  for (let col = 3; col < W - 3; col++) {
    const lvl = ground[col] as number;
    if (
      lvl > 0 &&
      (g[top(col)] as string[])[col] === '.' &&
      ground[col - 1] === lvl &&
      ground[col + 1] === lvl
    )
      free.push(col);
  }
  for (const { ch, n } of want.pickup ?? []) {
    for (let i = 0; i < n && free.length > 0; i++) {
      const col = free.splice(
        Math.floor(((i + 0.5) / n) * free.length) % free.length,
        1,
      )[0] as number;
      const row = ledgeCols.has(col) ? top(col) - 2 : top(col) - 1;
      (g[row] as string[])[col] = ch;
    }
  }
  for (const { ch } of want.key ?? []) {
    const col = Math.floor(W / 2);
    if ((ground[col] as number) > 0) (g[top(col) - 1] as string[])[col] = ch;
  }
  return g.map((row) => row.join(''));
}

/** How many of each piece a map actually holds. */
function shortfall(map: string[], pieces: Record<string, LayoutPiece>): boolean {
  const text = map.join('');
  return Object.entries(pieces).some(
    ([ch, p]) =>
      p.role !== 'player' && p.role !== 'wall' && text.split(ch).length - 1 < (p.count ?? 1),
  );
}

/**
 * A map for a game that names a layout instead of drawing one. Tries up to eight seeds until
 * every piece asked for is placed (the last try keeps what fit). Null if nothing could be drawn.
 */
export function generateLayout(
  name: string,
  kind: 'top-down' | 'platformer',
  spec: LayoutSpec,
  pieces: Record<string, LayoutPiece>,
): string[] | null {
  let last: string[] | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rand = rng(`${name}#${spec.seed ?? ''}#${attempt}`);
    const map = kind === 'platformer' ? level(spec, pieces, rand) : topDown(spec, pieces, rand);
    if (map === null) continue;
    last = map;
    if (!shortfall(map, pieces)) return map;
  }
  return last;
}
