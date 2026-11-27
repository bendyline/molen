/**
 * Pleasure and work boats under way on open water near the camera: speedboats, sailboats, fishing
 * boats and the odd tug, wandering lakes, bays and sounds the map draws as water polygons with no
 * route on them (the ambient kernel's vessels keep to mapped ferry routes).
 *
 * Each boat holds a heading and steers by looking ahead along it through the clearance field the
 * harbor tiles keep (meters to the nearest shore, dock, building or moored boat): an open way ahead
 * lets it drift, a closed one turns it toward the nearest open bearing, and a boat with nowhere to
 * go slows and comes about. Boats appear on open water out of the camera's way, leave when it is
 * far behind, and keep clear of one another.
 *
 * Related: harbors.ts (tiles, drawing), harbor-moorings.ts.
 */

/** What the water is like at a point: its surface height and the open water around it. */
export interface HarborWaterSample {
  height: number;
  /** Meters to the nearest shore, dock, building or moored boat (0 off the water). */
  clearance: number;
}

/** Undefined where no harbor tile is known (treated as closed). */
export type HarborWaterSampler = (x: number, z: number) => HarborWaterSample | undefined;

export interface HarborCruisingKind {
  id: string;
  length: number;
  width: number;
  /** Cruising speed, m/s. */
  cruise: number;
  /** Fastest turn under way, rad/s. */
  turnRate: number;
  /** Open water it keeps around itself, meters. */
  clearance: number;
  weight: number;
  /** Heels under sail and shows its sails. */
  sails: boolean;
  /** Bow lifts at speed (planing hull). */
  planing: boolean;
  paints: readonly string[];
}

export interface HarborCruisingBoat {
  readonly id: number;
  readonly kind: HarborCruisingKind;
  x: number;
  y: number;
  z: number;
  /** Heading of the bow (0 faces +Z). */
  yaw: number;
  speed: number;
  /** Turn being made, rad/s (positive to port in X/Z): banks a planing hull. */
  turn: number;
  readonly paint?: string;
  /** 0..1, for bobbing out of step. */
  readonly phase: number;
  /** Heel to starboard (+1) or port (-1) under sail. */
  readonly tack: number;
  desired: number;
  target: number;
  wander: number;
  steerIn: number;
  stuck: number;
  lost: number;
}

export interface HarborCruisingBudget {
  /** Boats under way at once. */
  count: number;
  /** Spawn between these distances from the camera, meters. */
  near: number;
  far: number;
  /** Leave beyond this distance. */
  keep: number;
}

/** A small seeded generator (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
/** Bearings tried, nearest first, when the way ahead is closed. */
const OFFSETS = [0.35, 0.7, 1.05, 1.4, 1.75, 2.1, 2.5, 2.9];

export class HarborCruising {
  readonly boats: HarborCruisingBoat[] = [];
  private readonly next: () => number;
  private spawnIn = 0;
  private serial = 0;

  constructor(
    private readonly kinds: readonly HarborCruisingKind[],
    seed = 0x5eab0a7,
  ) {
    this.next = random(seed);
  }

  /** Remove every boat (ambient life off, a new place). */
  clear(): void {
    this.boats.length = 0;
  }

  /** Whether the way from (x, z) along `yaw` is open for `distance` meters. */
  open(
    sample: HarborWaterSampler,
    x: number,
    z: number,
    yaw: number,
    distance: number,
    clearance: number,
  ): boolean {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const step = Math.max(6, clearance * 0.6);
    for (let d = step; d <= distance + 1e-6; d += step) {
      const s = sample(x + fx * d, z + fz * d);
      if (s === undefined || s.clearance < clearance) return false;
    }
    return true;
  }

  step(
    dt: number,
    camera: readonly [number, number, number],
    sample: HarborWaterSampler,
    budget: HarborCruisingBudget,
  ): void {
    if (dt <= 0) return;
    const boats = this.boats;
    for (let i = boats.length - 1; i >= 0; i--) {
      const boat = boats[i] as HarborCruisingBoat;
      this.steer(boat, dt, sample);
      const far = Math.hypot(boat.x - camera[0], boat.z - camera[2]) > budget.keep;
      if (far || boat.stuck > 8 || boat.lost > 4) boats.splice(i, 1);
    }
    while (boats.length > budget.count) boats.pop();
    this.spawnIn -= dt;
    if (boats.length < budget.count && this.spawnIn <= 0) {
      this.spawnIn = 0.35;
      this.spawn(camera, sample, budget);
    }
  }

  private spawn(
    camera: readonly [number, number, number],
    sample: HarborWaterSampler,
    budget: HarborCruisingBudget,
  ): void {
    const kind = this.pickKind();
    if (kind === undefined) return;
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = this.next() * Math.PI * 2;
      // Uniform over the ring's area, so the far water is not left emptier than the near.
      const r = Math.sqrt(
        budget.near * budget.near +
          this.next() * (budget.far * budget.far - budget.near * budget.near),
      );
      const x = camera[0] + Math.sin(angle) * r;
      const z = camera[2] + Math.cos(angle) * r;
      const here = sample(x, z);
      if (here === undefined || here.clearance < kind.clearance * 1.6) continue;
      if (this.boats.some((b) => Math.hypot(b.x - x, b.z - z) < 60 + b.kind.length + kind.length))
        continue;
      const start = this.next() * Math.PI * 2;
      let yaw: number | undefined;
      for (let k = 0; k < 8 && yaw === undefined; k++) {
        const candidate = start + (k * Math.PI) / 4;
        if (this.open(sample, x, z, candidate, 60, kind.clearance)) yaw = candidate;
      }
      if (yaw === undefined) continue;
      const paint =
        kind.paints.length > 0
          ? kind.paints[Math.floor(this.next() * kind.paints.length) % kind.paints.length]
          : undefined;
      const speed = kind.cruise * (0.75 + this.next() * 0.35);
      this.boats.push({
        id: ++this.serial,
        kind,
        x,
        y: here.height,
        z,
        yaw,
        speed,
        turn: 0,
        ...(paint !== undefined ? { paint } : {}),
        phase: this.next(),
        tack: this.next() < 0.5 ? -1 : 1,
        desired: yaw,
        target: speed,
        wander: 0,
        steerIn: this.next() * 0.4,
        stuck: 0,
        lost: 0,
      });
      return;
    }
  }

  private pickKind(): HarborCruisingKind | undefined {
    const total = this.kinds.reduce((sum, k) => sum + k.weight, 0);
    let left = this.next() * total;
    for (const kind of this.kinds) {
      left -= kind.weight;
      if (left < 0) return kind;
    }
    return this.kinds.at(-1);
  }

  private steer(boat: HarborCruisingBoat, dt: number, sample: HarborWaterSampler): void {
    const kind = boat.kind;
    boat.steerIn -= dt;
    if (boat.steerIn <= 0) {
      boat.steerIn = 0.4 + this.next() * 0.25;
      const ahead = Math.max(40, Math.min(160, boat.speed * 10 + kind.length * 2));
      boat.wander = Math.max(-0.6, Math.min(0.6, boat.wander + (this.next() - 0.5) * 0.25));
      const cruise = kind.cruise * (0.85 + 0.15 * Math.sin(boat.phase * 9));
      if (this.open(sample, boat.x, boat.z, boat.yaw, ahead, kind.clearance)) {
        boat.desired = boat.yaw + boat.wander * 0.5;
        boat.target = cruise;
        boat.stuck = Math.max(0, boat.stuck - 1);
      } else {
        // Turn toward the nearest open bearing, favoring the side it was drifting to.
        const side = boat.wander >= 0 ? 1 : -1;
        let found: number | undefined;
        for (const offset of OFFSETS) {
          for (const sign of [side, -side]) {
            const yaw = boat.yaw + offset * sign;
            if (this.open(sample, boat.x, boat.z, yaw, ahead * 0.7, kind.clearance)) {
              found = yaw;
              break;
            }
          }
          if (found !== undefined) break;
        }
        if (found !== undefined) {
          boat.desired = found;
          boat.target = cruise * 0.7;
        } else {
          boat.desired = boat.yaw + Math.PI * side;
          boat.target = cruise * 0.25;
          boat.stuck += 0.5;
        }
      }
      // Give way to the boats ahead.
      const fx = Math.sin(boat.yaw);
      const fz = Math.cos(boat.yaw);
      for (const other of this.boats) {
        if (other === boat) continue;
        const dx = other.x - boat.x;
        const dz = other.z - boat.z;
        const forward = dx * fx + dz * fz;
        const lateral = dx * fz - dz * fx;
        const room = (kind.length + other.kind.length) * 2 + 20;
        if (forward > 0 && forward < room * 2 && Math.abs(lateral) < room * 0.6) {
          boat.desired += lateral > 0 ? -0.5 : 0.5;
          boat.target = Math.min(boat.target, other.speed * 0.9);
        }
      }
    }
    const delta = wrap(boat.desired - boat.yaw);
    const rate = kind.turnRate * Math.min(1, 0.35 + boat.speed / Math.max(0.1, kind.cruise));
    const turn = Math.max(-rate * dt, Math.min(rate * dt, delta));
    boat.yaw = wrap(boat.yaw + turn);
    boat.turn += (turn / dt - boat.turn) * Math.min(1, dt * 2);
    const sharp = Math.min(1, Math.abs(delta) / 1.4);
    const target = boat.target * (1 - 0.45 * sharp);
    const accel = Math.max(0.25, kind.cruise / 7) * dt;
    boat.speed += Math.max(-accel * 1.6, Math.min(accel, target - boat.speed));
    const nx = boat.x + Math.sin(boat.yaw) * boat.speed * dt;
    const nz = boat.z + Math.cos(boat.yaw) * boat.speed * dt;
    const here = sample(nx, nz);
    if (here === undefined) {
      boat.lost += dt;
      return;
    }
    boat.lost = 0;
    if (here.clearance < Math.max(kind.width, 3)) {
      // Too close to the bank: hold position and come about.
      boat.speed *= 0.5;
      boat.stuck += dt;
      boat.desired = boat.yaw + Math.PI;
      return;
    }
    boat.x = nx;
    boat.z = nz;
    boat.y = here.height;
  }
}
