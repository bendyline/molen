/**
 * A {@link TrackGuide} over polylines: the host hands it track centrelines in groups (one group
 * per streamed map tile, say) and track-guided vehicles walk them.
 *
 * Map data splits a railway into pieces: at tile edges (where neighbouring tiles' copies overlap
 * by a buffer), at switches (OSM splits ways at junction nodes, or a siding simply starts on the
 * main line), and across detail levels (a coarse tile's simplified copy under a fine tile's). The
 * walker continues onto whichever piece carries on from the end of the one it is on, treats
 * near-coincident copies as the same track, follows the highest `rank` (finest) copy where
 * several overlap, and offers a choice of route only where tracks really diverge.
 */
import { dmath as m } from './dmath';
import type { TrackAdvance, TrackGuide, TrackPose, TrackRoute } from './rail-vehicles';

/** One track centreline handed to {@link TrackNetwork.set}. */
export interface TrackLineInput {
  /** Points [x, z] in world meters, at least two. */
  points: readonly (readonly [number, number])[];
  /** Detail rank; where copies of a track overlap the highest is followed. Default 0. */
  rank?: number;
  /** Host data read back by {@link TrackNetwork.nearest} and {@link TrackNetwork.tagsAt}. */
  tags?: Readonly<Record<string, string>>;
}

interface Line {
  ref: string;
  group: string;
  xs: number[];
  zs: number[];
  /** Arc length at each point. */
  cum: number[];
  length: number;
  rank: number;
  tags: Readonly<Record<string, string>>;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  branches?: Branch[];
  branchVersion: number;
}
/** Another line starting (or ending) on this one's interior at `s`, heading `sense` into it. */
interface Branch {
  s: number;
  line: Line;
  atStart: boolean;
  /** Direction (x, z) from the junction into the branch. */
  dx: number;
  dz: number;
}
interface Projection {
  line: Line;
  s: number;
  x: number;
  z: number;
  distance: number;
  /** Unit tangent of the line at s, in its point order. */
  dx: number;
  dz: number;
}

/** A pose on the network, with the line it is on (see {@link TrackNetwork.advance}). */
export interface TrackNetworkPose extends TrackPose {
  ref?: string;
}

/** Lines farther than this from a pose are not under it, meters. */
const ON_TRACK = 3;
/** A line's end continues onto lines passing this close to it, meters. */
const JOIN = 1.75;
/** Branches start this close to the line they leave, meters. */
const BRANCH_JOIN = 1.2;
/** Cosine of the largest angle between a route and the way the train is heading. */
const ALIGN = m.cos((42 * m.PI) / 180);
/** Tracks this close apart (meters) this far on (meters) are copies of one track. */
const SAME_TRACK = 0.8;
const PROBE = 25;

function yawOf(dx: number, dz: number): number {
  return m.atan2(dx, dz);
}

export class TrackNetwork implements TrackGuide {
  private readonly groups = new Map<string, Line[]>();
  private readonly lines = new Map<string, Line>();
  private readonly cells = new Map<string, { line: Line; seg: number }[]>();
  private readonly ends = new Map<string, { line: Line; atStart: boolean }[]>();
  private version = 0;
  private sequence = 0;

  constructor(private readonly cell = 48) {}

  /** Lines currently held. */
  get size(): number {
    return this.lines.size;
  }

  /** Replace a group's lines (an empty list removes the group). */
  set(group: string, lines: readonly TrackLineInput[]): void {
    this.delete(group);
    const built: Line[] = [];
    for (const input of lines) {
      const xs: number[] = [],
        zs: number[] = [],
        cum: number[] = [];
      let length = 0;
      for (const [x, z] of input.points) {
        const last = xs.length - 1;
        if (last >= 0) {
          const step = m.hypot(x - (xs[last] as number), z - (zs[last] as number));
          if (step < 1e-3) continue;
          length += step;
        }
        xs.push(x);
        zs.push(z);
        cum.push(length);
      }
      if (xs.length < 2 || length < 0.5) continue;
      let minX = Infinity,
        minZ = Infinity,
        maxX = -Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < xs.length; i++) {
        minX = m.min(minX, xs[i] as number);
        maxX = m.max(maxX, xs[i] as number);
        minZ = m.min(minZ, zs[i] as number);
        maxZ = m.max(maxZ, zs[i] as number);
      }
      const line: Line = {
        ref: `${group}#${this.sequence++}`,
        group,
        xs,
        zs,
        cum,
        length,
        rank: input.rank ?? 0,
        tags: input.tags ?? {},
        minX,
        minZ,
        maxX,
        maxZ,
        branchVersion: -1,
      };
      built.push(line);
      this.lines.set(line.ref, line);
      for (let seg = 0; seg + 1 < xs.length; seg++)
        this.forCells(
          m.min(xs[seg] as number, xs[seg + 1] as number),
          m.min(zs[seg] as number, zs[seg + 1] as number),
          m.max(xs[seg] as number, xs[seg + 1] as number),
          m.max(zs[seg] as number, zs[seg + 1] as number),
          (key) => {
            const list = this.cells.get(key);
            if (list) list.push({ line, seg });
            else this.cells.set(key, [{ line, seg }]);
          },
        );
      for (const atStart of [true, false]) {
        const i = atStart ? 0 : xs.length - 1;
        const key = this.key(xs[i] as number, zs[i] as number);
        const list = this.ends.get(key);
        if (list) list.push({ line, atStart });
        else this.ends.set(key, [{ line, atStart }]);
      }
    }
    if (built.length) {
      this.groups.set(group, built);
      this.version++;
    }
  }

  /** Remove a group's lines. */
  delete(group: string): void {
    const lines = this.groups.get(group);
    if (!lines) return;
    this.groups.delete(group);
    const gone = new Set(lines);
    for (const line of lines) {
      this.lines.delete(line.ref);
      for (let seg = 0; seg + 1 < line.xs.length; seg++)
        this.forCells(
          m.min(line.xs[seg] as number, line.xs[seg + 1] as number),
          m.min(line.zs[seg] as number, line.zs[seg + 1] as number),
          m.max(line.xs[seg] as number, line.xs[seg + 1] as number),
          m.max(line.zs[seg] as number, line.zs[seg + 1] as number),
          (key) => {
            const list = this.cells.get(key);
            if (!list) return;
            const kept = list.filter((entry) => !gone.has(entry.line));
            if (kept.length) this.cells.set(key, kept);
            else this.cells.delete(key);
          },
        );
      for (const i of [0, line.xs.length - 1]) {
        const key = this.key(line.xs[i] as number, line.zs[i] as number);
        const list = this.ends.get(key);
        if (!list) continue;
        const kept = list.filter((entry) => !gone.has(entry.line));
        if (kept.length) this.ends.set(key, kept);
        else this.ends.delete(key);
      }
    }
    this.version++;
  }

  /** Remove everything. */
  clear(): void {
    for (const group of [...this.groups.keys()]) this.delete(group);
  }

  /** Whether a group is held. */
  has(group: string): boolean {
    return this.groups.has(group);
  }

  /**
   * The nearest track point within `radius` of (x, z), optionally only on lines whose tags pass
   * `accept`; the yaw runs along the line's point order.
   */
  nearest(
    x: number,
    z: number,
    radius: number,
    accept?: (tags: Readonly<Record<string, string>>) => boolean,
  ):
    | { pose: TrackNetworkPose; distance: number; tags: Readonly<Record<string, string>> }
    | undefined {
    let best: Projection | undefined;
    for (const p of this.project(x, z, radius)) {
      if (accept && !accept(p.line.tags)) continue;
      if (
        !best ||
        p.distance < best.distance - 0.25 ||
        (p.distance < best.distance + 0.25 && p.line.rank > best.line.rank)
      )
        best = p;
    }
    if (!best) return undefined;
    return {
      pose: { x: best.x, z: best.z, yaw: yawOf(best.dx, best.dz), ref: best.line.ref },
      distance: best.distance,
      tags: best.line.tags,
    };
  }

  /** Tags of the line under a pose (e.g. a track name), if it is on one. */
  tagsAt(pose: TrackNetworkPose): Readonly<Record<string, string>> | undefined {
    return this.locate(pose)?.line.tags;
  }

  snap(pose: TrackNetworkPose, radius = 4): TrackNetworkPose | undefined {
    const at = this.locate(pose, radius);
    if (!at) return undefined;
    const sense = at.dx * m.sin(pose.yaw) + at.dz * m.cos(pose.yaw) >= 0 ? 1 : -1;
    return { x: at.x, z: at.z, yaw: yawOf(at.dx * sense, at.dz * sense), ref: at.line.ref };
  }

  advance(pose: TrackNetworkPose, distance: number, prefer: TrackRoute): TrackAdvance | undefined {
    const at = this.locate(pose);
    if (!at) return undefined;
    const fx = m.sin(pose.yaw),
      fz = m.cos(pose.yaw);
    let line = at.line;
    let dir = at.dx * fx + at.dz * fz >= 0 ? 1 : -1;
    let s = at.s;
    let remaining = m.max(0, distance);
    let moved = 0;
    let junction = false;
    let diverged = false;
    let route = prefer;
    for (let guard = 0; guard < 64; guard++) {
      const end = dir > 0 ? line.length : 0;
      const reach = m.min(m.abs(end - s), remaining);
      // Facing branches between here and how far this piece gets us.
      let took = false;
      for (const branch of this.branchesOf(line)) {
        const ahead = (branch.s - s) * dir;
        if (ahead <= 1e-6 || ahead > reach) continue;
        const [tx, tz] = this.tangent(line, branch.s);
        const cos = (branch.dx * tx + branch.dz * tz) * dir;
        if (cos < ALIGN) continue;
        junction = true;
        const side = this.side(tx * dir, tz * dir, branch.dx, branch.dz);
        if (route !== 0 && side === route) {
          moved += ahead;
          remaining -= ahead;
          line = branch.line;
          s = branch.atStart ? 0 : line.length;
          dir = branch.atStart ? 1 : -1;
          diverged = true;
          route = 0;
          took = true;
          break;
        }
      }
      if (took) continue;
      if (remaining <= m.abs(end - s) + 1e-9) {
        s += dir * remaining;
        moved += remaining;
        remaining = 0;
        break;
      }
      // Off the end of this piece: carry on along whatever continues from here.
      moved += m.abs(end - s);
      remaining -= m.abs(end - s);
      s = end;
      const [tx, tz] = this.tangent(line, s);
      const next = this.continuation(line, s, tx * dir, tz * dir, route);
      if (!next) break;
      if (next.choice) {
        junction = true;
        if (next.diverged) diverged = true;
        route = 0;
      }
      line = next.line;
      s = next.s;
      dir = next.dir;
    }
    const [x, z] = this.point(line, s);
    const [tx, tz] = this.tangent(line, s);
    return {
      pose: { x, z, yaw: yawOf(tx * dir, tz * dir), ref: line.ref } as TrackNetworkPose,
      moved,
      junction,
      diverged,
    };
  }

  // ---- internals ----

  private key(x: number, z: number): string {
    return `${m.floor(x / this.cell)},${m.floor(z / this.cell)}`;
  }

  private forCells(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    visit: (key: string) => void,
  ): void {
    const x0 = m.floor(minX / this.cell),
      x1 = m.floor(maxX / this.cell),
      z0 = m.floor(minZ / this.cell),
      z1 = m.floor(maxZ / this.cell);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) visit(`${cx},${cz}`);
  }

  private point(line: Line, s: number): [number, number] {
    const i = this.segmentAt(line, s);
    const length = (line.cum[i + 1] as number) - (line.cum[i] as number);
    const f = length > 1e-9 ? (s - (line.cum[i] as number)) / length : 0;
    return [
      (line.xs[i] as number) + ((line.xs[i + 1] as number) - (line.xs[i] as number)) * f,
      (line.zs[i] as number) + ((line.zs[i + 1] as number) - (line.zs[i] as number)) * f,
    ];
  }

  private tangent(line: Line, s: number): [number, number] {
    const i = this.segmentAt(line, s);
    const dx = (line.xs[i + 1] as number) - (line.xs[i] as number),
      dz = (line.zs[i + 1] as number) - (line.zs[i] as number);
    const length = m.hypot(dx, dz) || 1;
    return [dx / length, dz / length];
  }

  private segmentAt(line: Line, s: number): number {
    let lo = 0,
      hi = line.xs.length - 2;
    if (s <= 0) return 0;
    if (s >= line.length) return hi;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((line.cum[mid] as number) <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** The closest point of each line within `radius`. */
  private project(x: number, z: number, radius: number): Projection[] {
    const best = new Map<Line, Projection>();
    this.forCells(x - radius, z - radius, x + radius, z + radius, (key) => {
      for (const { line, seg } of this.cells.get(key) ?? []) {
        const ax = line.xs[seg] as number,
          az = line.zs[seg] as number;
        const bx = line.xs[seg + 1] as number,
          bz = line.zs[seg + 1] as number;
        const dx = bx - ax,
          dz = bz - az;
        const length2 = dx * dx + dz * dz;
        const f = length2 > 1e-12 ? m.clamp(((x - ax) * dx + (z - az) * dz) / length2, 0, 1) : 0;
        const px = ax + dx * f,
          pz = az + dz * f;
        const distance = m.hypot(x - px, z - pz);
        if (distance > radius) continue;
        const previous = best.get(line);
        if (previous && previous.distance <= distance) continue;
        const length = m.sqrt(length2) || 1;
        best.set(line, {
          line,
          s: (line.cum[seg] as number) + f * length,
          x: px,
          z: pz,
          distance,
          dx: dx / length,
          dz: dz / length,
        });
      }
    });
    return [...best.values()].sort(
      (a, b) => a.distance - b.distance || (a.line.ref < b.line.ref ? -1 : 1),
    );
  }

  /**
   * The line a pose is on: its own line while it is still close (so a train that just took a
   * switch stays on the branch), else the closest line running its way, preferring a finer copy
   * of the same track.
   */
  private locate(pose: TrackNetworkPose, radius = ON_TRACK): Projection | undefined {
    const fx = m.sin(pose.yaw),
      fz = m.cos(pose.yaw);
    const found = this.project(pose.x, pose.z, radius).filter(
      (p) => m.abs(p.dx * fx + p.dz * fz) >= ALIGN,
    );
    if (!found.length) return undefined;
    const own = pose.ref !== undefined ? found.find((p) => p.line.ref === pose.ref) : undefined;
    const base = own && own.distance < 1 ? own : found[0];
    if (!base) return undefined;
    // A finer copy of the same track, nearly on top of it and parallel, takes over.
    let chosen = base;
    for (const p of found) {
      if (p.line.rank <= chosen.line.rank) continue;
      const parallel = m.abs(p.dx * base.dx + p.dz * base.dz);
      if (p.distance < base.distance + SAME_TRACK && parallel > 0.9976) chosen = p;
    }
    return chosen;
  }

  /** Which side of travel direction (tx, tz) a direction leaves to: -1 left, 1 right. */
  private side(tx: number, tz: number, dx: number, dz: number): TrackRoute {
    // Facing +Z, +X is on the left: left of (tx, tz) is (tz, -tx).
    return dx * tz - dz * tx >= 0 ? -1 : 1;
  }

  /** Lateral distance of a point from a line (its closest point), meters. */
  private offsetFrom(line: Line, x: number, z: number, radius: number): number {
    let best = Infinity;
    for (const p of this.project(x, z, radius)) if (p.line === line) best = p.distance;
    return best;
  }

  /** Point `d` meters into a line from one end. */
  private into(line: Line, atStart: boolean, d: number): [number, number] {
    return this.point(line, atStart ? m.min(d, line.length) : m.max(0, line.length - d));
  }

  /** Other lines (same rank) that start or end on this line's interior and leave it. */
  private branchesOf(line: Line): Branch[] {
    if (line.branchVersion === this.version && line.branches) return line.branches;
    const branches: Branch[] = [];
    const seen = new Set<string>();
    this.forCells(
      line.minX - BRANCH_JOIN,
      line.minZ - BRANCH_JOIN,
      line.maxX + BRANCH_JOIN,
      line.maxZ + BRANCH_JOIN,
      (key) => {
        for (const end of this.ends.get(key) ?? []) {
          const other = end.line;
          if (other === line || other.rank !== line.rank) continue;
          const id = `${other.ref}:${end.atStart}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const i = end.atStart ? 0 : other.xs.length - 1;
          const ex = other.xs[i] as number,
            ez = other.zs[i] as number;
          const p = this.project(ex, ez, BRANCH_JOIN).find((q) => q.line === line);
          // Its end on our interior (an end at our own end is a continuation, not a branch).
          if (!p || p.s < 1 || p.s > line.length - 1) continue;
          // It must really leave: a copy running on along us is the same track.
          const [qx, qz] = this.into(other, end.atStart, m.min(PROBE, other.length));
          if (this.offsetFrom(line, qx, qz, SAME_TRACK + 0.5) < SAME_TRACK) continue;
          const [nx, nz] = this.into(other, end.atStart, m.min(4, other.length));
          const length = m.hypot(nx - ex, nz - ez) || 1;
          branches.push({
            s: p.s,
            line: other,
            atStart: end.atStart,
            dx: (nx - ex) / length,
            dz: (nz - ez) / length,
          });
        }
      },
    );
    branches.sort((a, b) => a.s - b.s || (a.line.ref < b.line.ref ? -1 : 1));
    line.branches = branches;
    line.branchVersion = this.version;
    return branches;
  }

  /**
   * Where a train leaving `line` at its end (travelling tx, tz) carries on: the other pieces
   * passing near the end and running its way, copies of one track merged, finest first. With
   * more than one real route, `route` picks it.
   */
  private continuation(
    line: Line,
    s: number,
    tx: number,
    tz: number,
    route: TrackRoute,
  ): { line: Line; s: number; dir: number; choice: boolean; diverged: boolean } | undefined {
    const [ex, ez] = this.point(line, s);
    const options: { line: Line; s: number; dir: number; ahead: number; px: number; pz: number }[] =
      [];
    for (const p of this.project(ex, ez, JOIN)) {
      if (p.line === line) continue;
      const cos = p.dx * tx + p.dz * tz;
      if (m.abs(cos) < ALIGN) continue;
      const dir = cos >= 0 ? 1 : -1;
      const ahead = dir > 0 ? p.line.length - p.s : p.s;
      if (ahead < 0.5) continue;
      const [px, pz] = this.point(p.line, p.s + dir * m.min(PROBE, ahead));
      options.push({ line: p.line, s: p.s, dir, ahead, px, pz });
    }
    if (!options.length) return undefined;
    // The finest copies only.
    const top = options.reduce((rank, o) => m.max(rank, o.line.rank), -Infinity);
    const finest = options.filter((o) => o.line.rank === top);
    // Merge copies of one track (both still together a probe length on); keep the longest.
    const routes: typeof finest = [];
    for (const option of finest.sort((a, b) => b.ahead - a.ahead)) {
      const twin = routes.find(
        (r) =>
          m.hypot(r.px - option.px, r.pz - option.pz) < SAME_TRACK ||
          this.offsetFrom(r.line, option.px, option.pz, SAME_TRACK + 0.5) < SAME_TRACK,
      );
      if (!twin) routes.push(option);
    }
    // Straightest first (smallest lateral departure a probe length on).
    const lateral = (o: (typeof routes)[number]) => (o.px - ex) * tz - (o.pz - ez) * tx;
    routes.sort((a, b) => m.abs(lateral(a)) - m.abs(lateral(b)));
    let chosen = routes[0];
    if (routes.length > 1 && route !== 0) {
      // Left of travel is +lateral (see side()).
      const sorted = [...routes].sort((a, b) => lateral(b) - lateral(a));
      chosen = route < 0 ? sorted[0] : sorted[sorted.length - 1];
    }
    if (!chosen) return undefined;
    return {
      line: chosen.line,
      s: chosen.s,
      dir: chosen.dir,
      choice: routes.length > 1,
      diverged: chosen !== routes[0],
    };
  }
}
