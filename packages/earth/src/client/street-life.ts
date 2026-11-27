/**
 * Street life as events, not beds: horns, sirens, a motorcycle going by, a bus pulling away, a
 * dog, thunder in a storm. Each kind has a rate per minute that depends on how traffic behaves in
 * the country (the horn rates below differ a hundredfold between Delhi and Tokyo), the local hour,
 * how near a street the listener is, and the weather. Road beds therefore carry no horns, and the
 * same Bengaluru recording no longer honks in Japan.
 *
 * Choices are a hash of the seed, the place and the second, never `Math.random`, so a replayed
 * run hears the same street. Sounds an older pack lacks are skipped silently.
 */
import { type AudioLayer, unitRandom } from '@bendyline/molen-client/audio';
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';

export type SirenStyle = 'north-america' | 'europe' | 'japan';

export interface TrafficCulture {
  id: string;
  /** Horn blasts heard per minute beside a busy street at the daily peak. */
  horns: number;
  /** Motorcycles and scooters going by per minute at the peak. */
  motorbikes: number;
  /** Siren passes per minute in a city at the peak (heard from some distance). */
  sirens: number;
  siren: SirenStyle;
  /** Share of horns that are scooter or rickshaw horns rather than car horns. */
  smallHorns: number;
}

type Box = [number, number, number, number];

/**
 * Ordered: the first box that holds a place wins, so the small specific ones come first. Rates
 * are authored estimates of how often each is heard, not measurements; they set the character of
 * a place (constant horns in Delhi and Cairo, scooter swarms in Hanoi, near silence in Tokyo).
 */
const CULTURES: { boxes: Box[]; culture: TrafficCulture }[] = [
  {
    boxes: [[129, 30, 146.5, 46]],
    culture: {
      id: 'japan',
      horns: 0.15,
      motorbikes: 0.5,
      sirens: 0.1,
      siren: 'japan',
      smallHorns: 0.1,
    },
  },
  {
    boxes: [[124.5, 33, 131, 39]],
    culture: {
      id: 'korea',
      horns: 1.5,
      motorbikes: 1.2,
      sirens: 0.1,
      siren: 'north-america',
      smallHorns: 0.3,
    },
  },
  {
    boxes: [[119.5, 21.8, 122.2, 25.5]],
    culture: {
      id: 'taiwan',
      horns: 2,
      motorbikes: 6,
      sirens: 0.1,
      siren: 'north-america',
      smallHorns: 0.6,
    },
  },
  {
    boxes: [[60, 5, 97.5, 37.5]],
    culture: {
      id: 'south-asia',
      horns: 16,
      motorbikes: 5,
      sirens: 0.06,
      siren: 'north-america',
      smallHorns: 0.55,
    },
  },
  {
    boxes: [[97.5, 18, 135, 54]],
    culture: {
      id: 'china',
      horns: 3,
      motorbikes: 3,
      sirens: 0.08,
      siren: 'north-america',
      smallHorns: 0.4,
    },
  },
  {
    boxes: [[92, -11, 141, 24]],
    culture: {
      id: 'southeast-asia',
      horns: 6,
      motorbikes: 8,
      sirens: 0.06,
      siren: 'north-america',
      smallHorns: 0.6,
    },
  },
  {
    boxes: [[24.5, 21.5, 37, 32]],
    culture: {
      id: 'egypt',
      horns: 12,
      motorbikes: 2,
      sirens: 0.06,
      siren: 'europe',
      smallHorns: 0.3,
    },
  },
  {
    boxes: [[34, 12, 63, 42]],
    culture: {
      id: 'middle-east',
      horns: 5,
      motorbikes: 1,
      sirens: 0.08,
      siren: 'europe',
      smallHorns: 0.2,
    },
  },
  {
    boxes: [[-18, 4, 16, 18]],
    culture: {
      id: 'west-africa',
      horns: 9,
      motorbikes: 5,
      sirens: 0.04,
      siren: 'europe',
      smallHorns: 0.5,
    },
  },
  {
    boxes: [[-20, -36, 52, 37]],
    culture: {
      id: 'africa',
      horns: 4,
      motorbikes: 2,
      sirens: 0.05,
      siren: 'europe',
      smallHorns: 0.3,
    },
  },
  {
    boxes: [
      [4, 54.5, 32, 71],
      [-25, 63, -13, 67],
    ],
    culture: {
      id: 'nordic',
      horns: 0.25,
      motorbikes: 0.3,
      sirens: 0.06,
      siren: 'europe',
      smallHorns: 0,
    },
  },
  {
    boxes: [[-10, 35, 30, 45.5]],
    culture: {
      id: 'southern-europe',
      horns: 2.5,
      motorbikes: 2.5,
      sirens: 0.12,
      siren: 'europe',
      smallHorns: 0.25,
    },
  },
  {
    boxes: [[-25, 35, 45, 72]],
    culture: {
      id: 'europe',
      horns: 0.8,
      motorbikes: 0.8,
      sirens: 0.12,
      siren: 'europe',
      smallHorns: 0.1,
    },
  },
  {
    boxes: [[110, -48, 179, -10]],
    culture: {
      id: 'oceania',
      horns: 0.5,
      motorbikes: 0.5,
      sirens: 0.08,
      siren: 'north-america',
      smallHorns: 0,
    },
  },
  {
    // The US and Canada, north of the Mexican border (roughly) and the Florida Straits.
    boxes: [
      [-170, 31.8, -50, 72],
      [-97.4, 24.4, -60, 31.8],
      [-118, 32.5, -97.4, 31.8],
    ],
    culture: {
      id: 'north-america',
      horns: 0.8,
      motorbikes: 0.5,
      sirens: 0.15,
      siren: 'north-america',
      smallHorns: 0,
    },
  },
  {
    boxes: [[-120, -56, -30, 32.5]],
    culture: {
      id: 'latin-america',
      horns: 4,
      motorbikes: 3,
      sirens: 0.1,
      siren: 'north-america',
      smallHorns: 0.3,
    },
  },
];

const ELSEWHERE: TrafficCulture = {
  id: 'elsewhere',
  horns: 1.5,
  motorbikes: 1,
  sirens: 0.08,
  siren: 'north-america',
  smallHorns: 0.2,
};

/** The traffic culture at a place. */
export function trafficCulture(
  latitude: number | undefined,
  longitude: number | undefined,
): TrafficCulture {
  if (latitude === undefined || longitude === undefined) return ELSEWHERE;
  for (const { boxes, culture } of CULTURES)
    if (
      boxes.some(([w, s, e, n]) => latitude >= s && latitude < n && longitude >= w && longitude < e)
    )
      return culture;
  return ELSEWHERE;
}

/** Traffic by local hour, 0..1: a morning and an evening peak, a trough before dawn. */
export function trafficByHour(hour: number): number {
  const points: [number, number][] = [
    [0, 0.3],
    [3, 0.12],
    [5, 0.25],
    [7, 0.85],
    [8.5, 1],
    [11, 0.8],
    [13, 0.85],
    [17, 1],
    [19, 0.8],
    [21, 0.55],
    [23, 0.35],
    [24, 0.3],
  ];
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i] as [number, number];
    if (h <= x1) {
      const [x0, y0] = points[i - 1] as [number, number];
      return y0 + ((y1 - y0) * (h - x0)) / (x1 - x0);
    }
  }
  return 0.3;
}

export interface StreetLifeFrame {
  nowMs: number;
  position: readonly [number, number, number];
  latitude?: number;
  longitude?: number;
  /** Local solar hour 0..24. */
  hour: number;
  streetDistance: number;
  heightAboveGround?: number;
  /** Cumulonimbus overhead: thunder. */
  storm: boolean;
  rain: number;
  world?: World;
}

const AmbientAgent = componentHandle('ambientAgent');
const near = (d: number, full: number, none: number): number =>
  d <= full ? 1 : d >= none ? 0 : 1 - (d - full) / (none - full);

/** The street's events for the Earth soundscape; call `update` each frame. */
export class StreetLife {
  private bucket: number | undefined;
  private readonly pending: {
    atMs: number;
    sound: string;
    position: [number, number, number];
    gain: number;
  }[] = [];
  /** The last place a culture was looked up, a few hundred meters wide. */
  private placeKey = '';
  /** A level-crossing bell ringing for an approaching train. */
  private crossing: { handle: string; train: string; startedAt: number } | undefined;
  private culture: TrafficCulture = ELSEWHERE;
  constructor(
    private readonly layer: AudioLayer,
    private readonly sounds: ReadonlySet<string>,
    private readonly seed: string | number = 'molen-street',
  ) {}

  get trafficCulture(): TrafficCulture {
    return this.culture;
  }

  update(f: StreetLifeFrame): void {
    const key = `${(f.latitude ?? 0).toFixed(2)}:${(f.longitude ?? 0).toFixed(2)}`;
    if (key !== this.placeKey) {
      this.placeKey = key;
      this.culture = trafficCulture(f.latitude, f.longitude);
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i] as (typeof this.pending)[number];
      if (p.atMs > f.nowMs) continue;
      this.pending.splice(i, 1);
      this.fire(p.sound, p.position, p.gain);
    }
    const second = Math.floor(f.nowMs / 1000);
    // After a pause or a stall, do not fire every missed second at once.
    const from = this.bucket === undefined || second - this.bucket > 3 ? second : this.bucket + 1;
    this.bucket = second;
    for (let b = from; b <= second; b++) this.second(b, f);
    this.levelCrossing(f);
  }

  clear(): void {
    this.pending.length = 0;
    this.bucket = undefined;
    if (this.crossing) this.layer.stop(this.crossing.handle, 0.3);
    this.crossing = undefined;
  }

  /** The horn style of the country's trains: `us` (long air horns) or `eu`. */
  get railHorn(): 'us' | 'eu' {
    return this.culture.id === 'north-america' ? 'us' : 'eu';
  }

  /**
   * A train closing on a street the listener stands by sets off the crossing bell, rung by the
   * country's kind of crossing, until the train has gone. An approximation: the map gives no level
   * crossings, so a train approaching within 80 m of someone at a street stands in for one.
   */
  private levelCrossing(f: StreetLifeFrame): void {
    const atStreet = f.streetDistance < 25 && (f.heightAboveGround ?? 0) < 10;
    let train: { id: string; d: number; closing: number } | undefined;
    if (f.world)
      for (const [id, agent, t] of f.world.query(AmbientAgent, Transform)) {
        if (agent.kind !== 'train' || agent.consist !== undefined || agent.state !== 'move')
          continue;
        const d = Math.hypot(t.pos[0] - f.position[0], t.pos[2] - f.position[2]);
        if (d > 220 || (train && d >= train.d)) continue;
        const heading = t.rot ? 2 * Math.atan2(t.rot[1], t.rot[3]) : 0;
        const toListener = Math.atan2(f.position[0] - t.pos[0], f.position[2] - t.pos[2]);
        const closing = Math.cos(toListener - heading) * Math.abs(Number(agent.speed) || 0);
        train = { id, d, closing };
      }
    if (this.crossing) {
      const gone = !train || train.id !== this.crossing.train || train.d > 200;
      if (gone || f.nowMs - this.crossing.startedAt > 45_000) {
        this.layer.stop(this.crossing.handle, 0.8);
        this.crossing = undefined;
      }
      return;
    }
    if (!atStreet || !train || train.d > 80 || train.closing < 3) return;
    const sound =
      this.culture.id === 'north-america'
        ? 'world.rail-crossing.north-america.457125'
        : this.culture.id === 'japan'
          ? 'world.rail-crossing.japan.872621'
          : 'world.rail-crossing.europe.574678';
    if (!this.sounds.has(sound)) return;
    const ground = f.position[1] - Math.max(0, f.heightAboveGround ?? 1.7);
    this.crossing = {
      handle: this.layer.play(sound, {
        position: [f.position[0] + 8, ground + 3, f.position[2]],
        loop: true,
        gain: 0.8,
        outside: true,
      }),
      train: train.id,
      startedAt: f.nowMs,
    };
  }

  private fire(sound: string, position: readonly number[], gain: number): void {
    if (!this.sounds.has(sound)) return;
    this.layer.play(sound, {
      position: [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0],
      gain,
      outside: true,
    });
  }

  private roll(kind: string, b: number, perMinute: number): boolean {
    return perMinute > 0 && unitRandom(this.seed, kind, b, this.placeKey) < perMinute / 60;
  }

  /** A point `min`..`max` m from the listener in a hashed direction, at street level. */
  private around(
    f: StreetLifeFrame,
    kind: string,
    b: number,
    min: number,
    max: number,
  ): [number, number, number] {
    const angle = unitRandom(this.seed, kind, 'angle', b) * 2 * Math.PI;
    const r = min + (max - min) * unitRandom(this.seed, kind, 'range', b);
    const ground = f.position[1] - Math.max(0, f.heightAboveGround ?? 1.7);
    return [f.position[0] + Math.cos(angle) * r, ground + 1, f.position[2] + Math.sin(angle) * r];
  }

  /** A moving car near the listener, or a point near the street when none is loaded. */
  private car(f: StreetLifeFrame, b: number): [number, number, number] {
    const cars: [number, number, number][] = [];
    if (f.world)
      for (const [, agent, t] of f.world.query(AmbientAgent, Transform)) {
        if (agent.kind !== 'car' || agent.state === 'idle') continue;
        if (Math.hypot(t.pos[0] - f.position[0], t.pos[2] - f.position[2]) > 120) continue;
        cars.push([t.pos[0], t.pos[1] + 0.8, t.pos[2]]);
        if (cars.length >= 8) break;
      }
    if (cars.length > 0)
      return cars[Math.floor(unitRandom(this.seed, 'car', b) * cars.length)] as [
        number,
        number,
        number,
      ];
    return this.around(
      f,
      'horn',
      b,
      Math.max(12, f.streetDistance),
      Math.max(40, f.streetDistance + 60),
    );
  }

  private second(b: number, f: StreetLifeFrame): void {
    const c = this.culture;
    const high = f.heightAboveGround ?? 0;
    const groundFactor = near(high, 25, 150);
    const traffic = trafficByHour(f.hour);
    const street = near(f.streetDistance, 25, 150) * groundFactor;
    const town = near(f.streetDistance, 60, 400) * groundFactor;
    if (street > 0 && this.roll('horn', b, c.horns * traffic * street)) {
      const small = unitRandom(this.seed, 'horn-kind', b) < c.smallHorns;
      const truck = !small && unitRandom(this.seed, 'horn-truck', b) < 0.12;
      const sound = small ? 'street.horn.scooter' : truck ? 'street.horn.truck' : 'street.horn.car';
      const pos = this.car(f, b);
      this.fire(sound, pos, 0.55 + 0.35 * unitRandom(this.seed, 'horn-gain', b));
      // Where horns are a language, one is often answered.
      if (c.horns > 4 && unitRandom(this.seed, 'horn-reply', b) < 0.35)
        this.pending.push({
          atMs: (b + 0.4 + 0.5 * unitRandom(this.seed, 'horn-delay', b)) * 1000,
          sound: small ? 'street.horn.car' : 'street.horn.scooter',
          position: this.car(f, b + 7919),
          gain: 0.5,
        });
    }
    if (street > 0 && this.roll('motorbike', b, c.motorbikes * traffic * street))
      this.fire(
        'street.motorcycle-pass',
        this.around(f, 'motorbike', b, Math.max(8, f.streetDistance), 50),
        0.7,
      );
    if (street > 0 && this.roll('bus', b, 0.3 * traffic * near(f.streetDistance, 15, 60)))
      this.fire('street.bus-pull-away', this.around(f, 'bus', b, 15, 45), 0.6);
    if (town > 0 && this.roll('siren', b, c.sirens * Math.sqrt(traffic) * town))
      this.fire(`street.siren.${c.siren}`, this.around(f, 'siren', b, 120, 420), 0.9);
    // Dogs bark in suburbs and villages, more by day and evening than deep in the night.
    const dogHours = f.hour >= 6.5 && f.hour < 22 ? 1 : 0.25;
    if (
      town > 0 &&
      this.roll('dog', b, 0.5 * dogHours * near(f.streetDistance, 40, 200) * (1 - f.rain))
    ) {
      const at = this.around(f, 'dog', b, 40, 150);
      const barks = 1 + Math.floor(unitRandom(this.seed, 'dog-count', b) * 3);
      for (let i = 0; i < barks; i++)
        this.pending.push({
          atMs: (b + i * (0.7 + 0.5 * unitRandom(this.seed, 'dog-gap', b, i))) * 1000,
          sound: 'street.dog',
          position: at,
          gain: 0.45,
        });
    }
    // Crows by day in towns where the pack has their local species.
    const crow =
      c.id === 'north-america'
        ? 'street.crow.america'
        : c.id === 'japan'
          ? 'street.crow.japan'
          : undefined;
    if (crow && f.hour >= 6 && f.hour < 19 && this.roll('crow', b, 0.7 * town * (1 - f.rain))) {
      const at = this.around(f, 'crow', b, 15, 80);
      this.fire(crow, [at[0], at[1] + 8, at[2]], 0.55);
    }
    if (f.storm && this.roll('thunder', b, 1.4)) {
      const far = unitRandom(this.seed, 'thunder-far', b);
      const sound =
        this.sounds.has('ambience.thunder.storm') && unitRandom(this.seed, 'thunder-kind', b) < 0.7
          ? 'ambience.thunder.storm'
          : 'ambience.thunder';
      this.fire(sound, this.around(f, 'thunder', b, 400 + far * 2500, 600 + far * 3000), 1);
    }
  }
}
