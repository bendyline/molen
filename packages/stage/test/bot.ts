// A headless player for compiled games, ported from the Phase 0 probe. It follows the stage
// contract: entity "player"; tags pickup, key, door, goal, hazard; commands move { dir } and
// jump { held }; events win, lose and hit. mode "win" plays to win; "lose" plays carelessly
// (walks into hazards, runs off ledges) to show the game can be lost.

import { installFigures } from '@bendyline/molen-figures/kernel';
import { componentHandle } from '@bendyline/molen-kernel';
import {
  applyKeyframeTo,
  buildDataWorld,
  takeKeyframe,
  type World,
} from '@bendyline/molen-kernel/data';
import type { JsonObject, SceneManifest } from '@bendyline/molen-schema';

const CELL = 0.5;
const TRANSFORM = componentHandle('transform');
const TAG = componentHandle('tag');
const COLLIDER = componentHandle('collider');
const KINEMATIC = componentHandle('kinematicBody');
const PLATFORM_BODY = componentHandle('platformBody');
const PLATFORM_SOLID = componentHandle('platformSolid');

export function build(scene: SceneManifest): World {
  return buildDataWorld(scene, { capabilities: [(w) => installFigures(w)] });
}

const ids = (w: World): string[] => [...w._internal().entities];
const posOf = (w: World, id: string): number[] | undefined =>
  (w.get(id, TRANSFORM) as { pos?: number[] } | undefined)?.pos;
const tagged = (w: World, name: string): string[] =>
  ids(w).filter((id) => (w.get(id, TAG) as { name?: string } | undefined)?.name === name);

export interface PlayResult {
  result: 'won' | 'lost' | 'timeout' | 'fault';
  ticks: number;
  events: Record<string, number>;
  error?: string;
}

export function playGame(
  scene: SceneManifest,
  { mode = 'win', maxTicks = 3600 }: { mode?: 'win' | 'lose'; maxTicks?: number } = {},
): PlayResult {
  const out: PlayResult = { result: 'timeout', ticks: 0, events: {} };
  const world = build(scene);
  let ended: 'win' | 'lose' | undefined;
  for (const ev of ['win', 'lose', 'hit', 'pickup', 'key']) {
    world.on(ev, () => {
      out.events[ev] = (out.events[ev] ?? 0) + 1;
      if (ev === 'win' || ev === 'lose') ended ??= ev;
    });
  }
  let seq = 0;
  const send = (type: string, payload: JsonObject): void => {
    world.submitCommand({
      kind: 'command',
      seq: seq++,
      source: 'local',
      tick: world.tick,
      type,
      payload,
    });
  };
  const platformer = scene.physics?.engine === 'platformer';
  const policy = platformer
    ? platformPolicy(world, send, mode)
    : topDownPolicy(world, send, mode, scene);
  try {
    for (let t = 0; t < maxTicks; t++) {
      policy(t);
      world.step();
      out.ticks = t + 1;
      if (ended !== undefined) break;
    }
  } catch (error) {
    return { ...out, result: 'fault', error: (error as Error).message };
  }
  out.result = ended === 'win' ? 'won' : ended === 'lose' ? 'lost' : 'timeout';
  return out;
}

// --- top-down ---

interface Grid {
  W: number;
  H: number;
  blocked: Uint8Array;
  cell: (x: number, z: number) => [number, number];
  center: (i: number, j: number) => [number, number];
}

function makeGrid(world: World, inflate: number): Grid {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const id of ids(world)) {
    const p = posOf(world, id);
    if (p === undefined || Math.abs(p[0] as number) > 200 || Math.abs(p[2] as number) > 200)
      continue;
    minX = Math.min(minX, p[0] as number);
    maxX = Math.max(maxX, p[0] as number);
    minZ = Math.min(minZ, p[2] as number);
    maxZ = Math.max(maxZ, p[2] as number);
  }
  minX -= 4;
  maxX += 4;
  minZ -= 4;
  maxZ += 4;
  const W = Math.ceil((maxX - minX) / CELL) + 1;
  const H = Math.ceil((maxZ - minZ) / CELL) + 1;
  const blocked = new Uint8Array(W * H);
  for (const id of ids(world)) {
    if (id === 'player') continue;
    const c = world.get(id, COLLIDER) as
      | { shape: string; radius?: number; halfExtents?: number[]; isStatic?: boolean }
      | undefined;
    if (c === undefined) continue;
    if (world.has(id, KINEMATIC) && c.isStatic !== true) continue;
    const p = posOf(world, id) as number[];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = minX + i * CELL;
        const z = minZ + j * CELL;
        const hit =
          c.shape === 'circle'
            ? Math.hypot(x - (p[0] as number), z - (p[2] as number)) < (c.radius ?? 0.5) + inflate
            : Math.abs(x - (p[0] as number)) < (c.halfExtents?.[0] ?? 0.5) + inflate &&
              Math.abs(z - (p[2] as number)) < (c.halfExtents?.[1] ?? 0.5) + inflate;
        if (hit) blocked[j * W + i] = 1;
      }
    }
  }
  return {
    W,
    H,
    blocked,
    cell: (x, z) => [Math.round((x - minX) / CELL), Math.round((z - minZ) / CELL)],
    center: (i, j) => [minX + i * CELL, minZ + j * CELL],
  };
}

function bfs(
  grid: Grid,
  from: [number, number],
  goals: [number, number][],
): [number, number][] | null {
  const { W, H, blocked } = grid;
  const prev = new Int32Array(W * H).fill(-1);
  const start = from[1] * W + from[0];
  const goalSet = new Set(goals.map(([i, j]) => j * W + i));
  const q = [start];
  prev[start] = start;
  for (let head = 0; head < q.length; head++) {
    const k = q[head] as number;
    if (goalSet.has(k)) {
      const path: [number, number][] = [];
      for (let c = k; c !== start; c = prev[c] as number) path.push([c % W, Math.floor(c / W)]);
      return path.reverse();
    }
    const i = k % W;
    const j = Math.floor(k / W);
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nk = nj * W + ni;
      if (prev[nk] !== -1 || blocked[nk]) continue;
      if (di !== 0 && dj !== 0 && (blocked[j * W + ni] || blocked[nj * W + i])) continue;
      prev[nk] = k;
      q.push(nk);
    }
  }
  return null;
}

function topDownPolicy(
  world: World,
  send: (type: string, payload: JsonObject) => void,
  mode: 'win' | 'lose',
  scene: SceneManifest,
): (t: number) => void {
  let grid: Grid | undefined;
  let scratch: World | undefined;
  let planned: [number, number] | null = null;
  let lastDir: [number, number] = [0, 0];
  let stuckRef: number[] | null = null;
  let wiggle = 0;
  const simulate = (dir: [number, number], ticks: number): number => {
    const s = scratch as World;
    applyKeyframeTo(s, takeKeyframe(world));
    const from = s.tick;
    let hit = -1;
    const off = s.on('hit', () => {
      if (hit < 0) hit = s.tick;
    });
    const off2 = s.on('lose', () => {
      if (hit < 0) hit = s.tick;
    });
    s.submitCommand({
      kind: 'command',
      seq: 1e6 + s.tick,
      source: 'local',
      tick: s.tick,
      type: 'move',
      payload: { dir },
    });
    let room = Number.POSITIVE_INFINITY;
    for (let i = 0; i < ticks && hit < 0; i++) {
      s.step();
      const p = posOf(s, 'player') as number[];
      for (const id of tagged(s, 'hazard')) {
        const h = posOf(s, id) as number[];
        room = Math.min(
          room,
          Math.hypot((h[0] as number) - (p[0] as number), (h[2] as number) - (p[2] as number)),
        );
      }
    }
    off();
    off2();
    return hit >= 0 ? -1000 + (hit - from) : Math.min(room, 10);
  };
  return (t) => {
    if (t % 3 !== 0) return;
    const p = posOf(world, 'player');
    if (p === undefined) return;
    if (t % 30 === 0 || grid === undefined) grid = makeGrid(world, 0.55);
    const g = grid;
    const hazards = tagged(world, 'hazard').map((id) => posOf(world, id) as number[]);
    let dir: [number, number] = [0, 0];
    let targets: number[][][] | null;
    if (mode === 'lose') targets = hazards.length > 0 ? [hazards] : null;
    else {
      const pick = (tag: string): number[][] =>
        tagged(world, tag).map((id) => posOf(world, id) as number[]);
      const groups = [pick('pickup'), pick('key'), pick('goal')].filter((x) => x.length > 0);
      targets = groups.length > 0 ? groups : null;
    }
    const from = g.cell(p[0] as number, p[2] as number);
    from[0] = Math.max(0, Math.min(g.W - 1, from[0]));
    from[1] = Math.max(0, Math.min(g.H - 1, from[1]));
    g.blocked[from[1] * g.W + from[0]] = 0;
    let safe = true;
    const findPath = (avoid: boolean): [number, number][] | null => {
      let saved: Uint8Array | undefined;
      if (avoid) {
        saved = g.blocked.slice();
        for (const h of hazards) {
          const [hi, hj] = g.cell(h[0] as number, h[2] as number);
          for (let dj = -4; dj <= 4; dj++) {
            for (let di = -4; di <= 4; di++) {
              const i = hi + di;
              const j = hj + dj;
              if (i >= 0 && j >= 0 && i < g.W && j < g.H && Math.hypot(di, dj) * CELL < 1.7)
                g.blocked[j * g.W + i] = 1;
            }
          }
        }
        g.blocked[from[1] * g.W + from[0]] = 0;
      }
      let found: [number, number][] | null = null;
      for (const group of targets ?? []) {
        const goals: [number, number][] = [];
        for (const tp of group) {
          const [gi, gj] = g.cell(tp[0] as number, tp[2] as number);
          for (let dj = -2; dj <= 2; dj++) {
            for (let di = -2; di <= 2; di++) {
              const i = gi + di;
              const j = gj + dj;
              if (
                i >= 0 &&
                j >= 0 &&
                i < g.W &&
                j < g.H &&
                !g.blocked[j * g.W + i] &&
                Math.hypot(di, dj) <= 1.6
              )
                goals.push([i, j]);
            }
          }
        }
        found = bfs(g, from, goals);
        if (found !== null) break;
      }
      if (saved !== undefined) g.blocked = saved;
      return found;
    };
    if (targets !== null) {
      let path: [number, number][] | null;
      if (mode === 'win' && hazards.length > 0) {
        path = findPath(true);
        if (path === null) {
          path = findPath(false);
          safe = false;
        }
      } else path = findPath(false);
      const near = hazards.some(
        (h) =>
          Math.hypot((h[0] as number) - (p[0] as number), (h[2] as number) - (p[2] as number)) <
          3.2,
      );
      if (!safe && near) {
        // no safe way through right now: back away from the nearest hazard and wait
        const h = [...hazards].sort(
          (a, b) =>
            Math.hypot((a[0] as number) - (p[0] as number), (a[2] as number) - (p[2] as number)) -
            Math.hypot((b[0] as number) - (p[0] as number), (b[2] as number) - (p[2] as number)),
        )[0] as number[];
        dir = [(p[0] as number) - (h[0] as number), (p[2] as number) - (h[2] as number)];
      } else if (path !== null && path.length > 0) {
        const w = path[Math.min(path.length - 1, 3)] as [number, number];
        const c = g.center(w[0], w[1]);
        dir = [c[0] - (p[0] as number), c[1] - (p[2] as number)];
      } else if (path !== null && targets[0]?.[0] !== undefined) {
        const tp = targets[0][0] as number[];
        dir = [(tp[0] as number) - (p[0] as number), (tp[2] as number) - (p[2] as number)];
      }
    }
    if (mode === 'win' && targets === null) {
      // survive: simulate sixteen headings ahead and keep the one that stays clear longest
      scratch ??= build(scene);
      if (t % 6 === 0 || planned === null) {
        let best = Number.NEGATIVE_INFINITY;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const d: [number, number] = [+Math.cos(a).toFixed(2), +Math.sin(a).toFixed(2)];
          const keep = planned !== null ? (planned[0] * d[0] + planned[1] * d[1]) * 0.3 : 0;
          const score = simulate(d, 45) + keep;
          if (score > best) {
            best = score;
            planned = d;
          }
        }
      }
      dir = planned as [number, number];
    }
    if (mode === 'win' && targets !== null && safe) {
      for (const h of hazards) {
        const dx = (p[0] as number) - (h[0] as number);
        const dz = (p[2] as number) - (h[2] as number);
        const d = Math.hypot(dx, dz);
        if (d < 2.2 && d > 0.01) {
          const wgt = 1.5 / (d * d);
          dir[0] += (dx / d) * wgt;
          dir[1] += (dz / d) * wgt;
        }
      }
    }
    if (t % 60 === 0) {
      if (
        stuckRef !== null &&
        Math.hypot(
          (p[0] as number) - (stuckRef[0] as number),
          (p[2] as number) - (stuckRef[2] as number),
        ) < 0.3 &&
        Math.hypot(...dir) > 0.1
      )
        wiggle = 20;
      stuckRef = p;
    }
    if (wiggle > 0) {
      wiggle -= 3;
      dir = [Math.cos(t * 0.7), Math.sin(t * 0.7)];
    }
    const l = Math.hypot(dir[0], dir[1]);
    const d: [number, number] =
      l > 0.05 ? [+(dir[0] / l).toFixed(2), +(dir[1] / l).toFixed(2)] : [0, 0];
    if (d[0] !== lastDir[0] || d[1] !== lastDir[1] || t % 30 === 0) {
      send('move', { dir: d });
      lastDir = d;
    }
  };
}

// --- platformer ---

function platformPolicy(
  world: World,
  send: (type: string, payload: JsonObject) => void,
  mode: 'win' | 'lose',
): (t: number) => void {
  let release = -1;
  let lastMove: number | null = null;
  let stuckRef: number | null = null;
  let stuckJump = false;
  return (t) => {
    const p = posOf(world, 'player');
    if (p === undefined) return;
    const body = world.get('player', PLATFORM_BODY) as
      | { grounded?: boolean; halfExtents?: number[] }
      | undefined;
    const solids: { x: number; y: number; hx: number; hy: number }[] = [];
    for (const id of ids(world)) {
      const s = world.get(id, PLATFORM_SOLID) as
        | { halfExtents: number[]; oneWay?: boolean }
        | undefined;
      if (s === undefined || s.oneWay === true) continue;
      const q = posOf(world, id) as number[];
      solids.push({
        x: q[0] as number,
        y: q[1] as number,
        hx: s.halfExtents[0] as number,
        hy: s.halfExtents[1] as number,
      });
    }
    const hazards = tagged(world, 'hazard').map((id) => posOf(world, id) as number[]);
    const pickups = tagged(world, 'pickup').map((id) => posOf(world, id) as number[]);
    const goal = tagged(world, 'goal').map((id) => posOf(world, id) as number[])[0];
    const px = p[0] as number;
    const py = p[1] as number;
    let tx: number;
    let ty = py;
    if (mode === 'lose') {
      tx = goal !== undefined ? (goal[0] as number) : px + 50;
    } else {
      const ahead = [...pickups].sort(
        (a, b) =>
          Math.abs((a[0] as number) - px) +
          Math.abs((a[1] as number) - py) -
          (Math.abs((b[0] as number) - px) + Math.abs((b[1] as number) - py)),
      )[0];
      const tgt = ahead ?? goal;
      tx = tgt !== undefined ? (tgt[0] as number) : px + 50;
      ty = tgt !== undefined ? (tgt[1] as number) : py;
    }
    const dir = Math.abs(tx - px) < 0.25 ? 0 : Math.sign(tx - px);
    if (dir !== lastMove || t % 30 === 0) {
      send('move', { dir: [dir, 0] });
      lastMove = dir;
    }
    if (release === t) send('jump', { held: false });
    const grounded = body?.grounded ?? true;
    const feet = py - (body?.halfExtents?.[1] ?? 0.65);
    const look = dir || 1;
    const wallAhead = solids.some(
      (s) =>
        Math.abs(s.x - (px + look * 0.9)) < s.hx + 0.3 &&
        s.y + s.hy > feet + 0.1 &&
        s.y - s.hy < py + 0.6,
    );
    const probeX = px + look * 0.9;
    const groundAhead = solids.some(
      (s) => Math.abs(s.x - probeX) < s.hx && s.y + s.hy <= feet + 0.05 && s.y + s.hy > feet - 3,
    );
    const hazardAhead = hazards.some(
      (h) =>
        ((h[0] as number) - px) * look > 0 &&
        Math.abs((h[0] as number) - px) < 2 &&
        Math.abs((h[1] as number) - py) < 1.3,
    );
    const targetAbove = Math.abs(tx - px) < 2 && ty > py + 1;
    if (t % 45 === 0) {
      stuckJump = stuckRef !== null && Math.abs(px - stuckRef) < 0.3 && dir !== 0;
      stuckRef = px;
    }
    const careful = mode !== 'lose';
    if (
      grounded &&
      release < t &&
      dir !== 0 &&
      (wallAhead || (careful && (!groundAhead || hazardAhead || targetAbove)) || stuckJump)
    ) {
      send('jump', { held: true });
      release = t + 14;
      stuckJump = false;
    }
  };
}
