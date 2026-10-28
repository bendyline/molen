/** Deterministic apron parking and bounded residency; aircraft belong to the host's flight world. */
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import type { AircraftData } from '@bendyline/molen-schema';
import { pointInPolygon, type TerrainSemanticPoint } from '@bendyline/molen-terrain/kernel';
import { compassBearing, type EarthPlace, haversineDistance } from './airfields';
import type { EarthAirport, EarthAirportLayout, EarthAirports } from './airports';

export interface EarthAirportStand extends EarthPlace {
  id: string;
  airport: string;
  type: string;
  heading: number;
  /** Conservative clearance circle around the airframe, metres. */
  radius: number;
}

const fleets = {
  'general-aviation': ['cessna_172s', 'pa_28_180', 'cessna_182t', 'cirrus_sr22t', 'diamond_da42'],
  regional: ['atr_72_600', 'embraer_e175', 'dash_8_q400', 'cessna_208b', 'king_air_350i'],
  airline: ['boeing_737_800', 'airbus_a320neo', 'a220_300', 'embraer_e175'],
  mixed: [
    'cessna_172s',
    'citation_cj4',
    'king_air_350i',
    'boeing_737_800',
    'gulfstream_g650er',
    'cessna_182t',
  ],
} as const;

type Point = TerrainSemanticPoint;
function edgeDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
function ringDistance(p: Point, ring: Point[]): number {
  return Math.min(...ring.map((a, i) => edgeDistance(p, a, ring[(i + 1) % ring.length] as Point)));
}

/** Uses mapped apron polygons only. No guessed stands beside a runway or on unknown ground. */
export function planAirportApron(
  airport: EarthAirport,
  layout: EarthAirportLayout,
  types: TypeLibrary,
): EarthAirportStand[] {
  const origin: Point = [layout.bounds[0], layout.bounds[1]];
  const sx = 111_195 * Math.cos((origin[1] * Math.PI) / 180),
    sz = 111_195;
  const local = (p: Point): Point => [(p[0] - origin[0]) * sx, (p[1] - origin[1]) * sz];
  const geo = (p: Point): EarthPlace => ({
    longitude: origin[0] + p[0] / sx,
    latitude: origin[1] + p[1] / sz,
  });
  const runways = airport.runways.map((r) => ({ ...r, ends: r.ends.map(local) as [Point, Point] }));
  const longest = [...airport.runways].sort(
    (a, b) =>
      Math.hypot(...local(b.ends[0]).map((v, i) => v - (local(b.ends[1])[i] ?? 0))) -
      Math.hypot(...local(a.ends[0]).map((v, i) => v - (local(a.ends[1])[i] ?? 0))),
  )[0];
  if (!longest) return [];
  const length = haversineDistance(
    { longitude: longest.ends[0][0], latitude: longest.ends[0][1] },
    { longitude: longest.ends[1][0], latitude: longest.ends[1][1] },
  );
  const profile =
    layout.profile ??
    (airport.type === 'large_airport'
      ? 'airline'
      : airport.scheduledService
        ? 'regional'
        : 'general-aviation');
  const available = new Set(types.idsWith('aircraft'));
  const choices = fleets[profile].flatMap((kind) => {
    const type = `molen.entities.aircraft.${kind}`;
    if (!available.has(type) || !types.components(type).mountable) return [];
    const { spec } = types.component<AircraftData>(type, 'aircraft');
    // Fleet category alone does not guarantee a usable runway.
    if (length < Math.max(450, spec.length * 45)) return [];
    return [{ type, radius: Math.hypot(spec.span, spec.length) / 2 + 3 }];
  });
  if (!choices.length) return [];
  const heading = compassBearing(
    { longitude: longest.ends[0][0], latitude: longest.ends[0][1] },
    { longitude: longest.ends[1][0], latitude: longest.ends[1][1] },
  );
  const polygon = (p: { outer: Point[]; holes?: Point[][] }) => ({
    outer: p.outer.map(local),
    holes: p.holes?.map((h) => h.map(local)),
  });
  const buildings = layout.tile.buildings.flatMap((b) => b.polygons.map(polygon));
  const taxiways = layout.tile.transportation
    .filter((t) => /^(taxiway|taxilane)$/.test(t.subclass ?? t.class))
    .flatMap((t) => t.lines.map((line) => ({ line: line.map(local), width: t.width ?? 18 })));
  const stands: EarthAirportStand[] = [];
  const occupied: { p: Point; radius: number }[] = [];
  for (const apron of [...layout.tile.landcover]
    .filter((f) => f.class === 'apron')
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'))) {
    let count = 0;
    for (const [part, source] of apron.polygons.entries()) {
      const p = polygon(source);
      const minX = Math.min(...p.outer.map((v) => v[0])),
        maxX = Math.max(...p.outer.map((v) => v[0]));
      const minZ = Math.min(...p.outer.map((v) => v[1])),
        maxZ = Math.max(...p.outer.map((v) => v[1]));
      // Stable geographic grid, independent of tile cuts, camera, and residency order.
      for (let z = Math.ceil(minZ / 24) * 24; z < maxZ && count < 8; z += 24) {
        for (let x = Math.ceil(minX / 24) * 24; x < maxX && count < 8; x += 24) {
          const center: Point = [x, z];
          const choice = choices[(stands.length + Number(part)) % choices.length];
          if (!choice) continue;
          const radius = choice.radius;
          if (
            layout.activityZones?.some((zone) => {
              const c = local(zone.center);
              return Math.hypot(x - c[0], z - c[1]) < radius + zone.radius + 3;
            })
          )
            continue;
          if (
            !pointInPolygon(center, p) ||
            ringDistance(center, p.outer) < radius ||
            p.holes?.some((h) => ringDistance(center, h) < radius)
          )
            continue;
          if (
            buildings.some(
              (b) => pointInPolygon(center, b) || ringDistance(center, b.outer) < radius,
            )
          )
            continue;
          if (
            runways.some(
              (r) => edgeDistance(center, r.ends[0], r.ends[1]) < radius + r.width / 2 + 20,
            )
          )
            continue;
          if (
            taxiways.some((t) =>
              t.line
                .slice(1)
                .some(
                  (b, i) => edgeDistance(center, t.line[i] as Point, b) < radius + t.width / 2 + 4,
                ),
            )
          )
            continue;
          if (occupied.some((s) => Math.hypot(x - s.p[0], z - s.p[1]) < radius + s.radius + 5))
            continue;
          stands.push({
            id: `apron:${airport.id}:${apron.id}:${part}:${x}:${z}`,
            airport: airport.id,
            type: choice.type,
            ...geo(center),
            heading,
            radius,
          });
          occupied.push({ p: center, radius });
          count++;
        }
      }
    }
  }
  return stands;
}

export interface EarthAirportPopulationHost {
  /** False defers placement until supporting terrain is ready. */
  spawn(stand: EarthAirportStand): boolean | Promise<boolean>;
  remove(id: string): void;
  pose(id: string): (EarthPlace & { occupied: boolean; speed: number }) | undefined;
}

/** A taken aircraft remains the same host-owned entity and its original stand stays empty. */
export class EarthAirportPopulation {
  private readonly plans = new Map<string, Promise<EarthAirportStand[]>>();
  private readonly resident = new Map<string, EarthAirportStand>();
  private readonly claimed = new Set<string>();
  private readonly loading = new Set<string>();
  private nextUpdate = -Infinity;
  private generation = 0;
  private disposed = false;
  constructor(
    private readonly airports: EarthAirports,
    private readonly types: TypeLibrary,
    private readonly host: EarthAirportPopulationHost,
    private readonly onError: (error: unknown) => void = console.error,
  ) {}

  /** Call at boarding so even a brief visit transfers ownership before the next residency update. */
  claim(id: string): void {
    if (!this.resident.has(id)) return;
    this.claimed.add(id);
    this.resident.delete(id);
  }

  /** Call with geographic observer position. At most twelve parked aircraft within 1.8 km. */
  update(now: number, observer: EarthPlace): void {
    if (this.disposed || now < this.nextUpdate) return;
    this.nextUpdate = now + 1000;
    for (const [id, stand] of this.resident) {
      const pose = this.host.pose(id);
      if (pose && (pose.occupied || pose.speed > 1 || haversineDistance(pose, stand) > 8)) {
        this.claim(id);
      }
    }
    const generation = ++this.generation;
    const nearby = this.airports.layouts.filter(
      (l) =>
        haversineDistance(observer, {
          longitude: (l.bounds[0] + l.bounds[2]) / 2,
          latitude: (l.bounds[1] + l.bounds[3]) / 2,
        }) < 8000,
    );
    void Promise.all(
      nearby.map((layout) => {
        let plan = this.plans.get(layout.id);
        if (!plan) {
          plan = this.airports
            .at(
              (layout.bounds[1] + layout.bounds[3]) / 2,
              (layout.bounds[0] + layout.bounds[2]) / 2,
            )
            .then((records) => {
              const airport = records.find((a) => a.id === layout.id);
              return airport ? planAirportApron(airport, layout, this.types) : [];
            })
            .catch((error: unknown) => {
              this.plans.delete(layout.id);
              throw error;
            });
          this.plans.set(layout.id, plan);
        }
        return plan;
      }),
    )
      .then((plans) => {
        if (this.disposed || generation !== this.generation) return;
        const desired = plans
          .flat()
          .filter((s) => !this.claimed.has(s.id) && haversineDistance(observer, s) < 1800)
          .sort(
            (a, b) =>
              haversineDistance(observer, a) - haversineDistance(observer, b) ||
              a.id.localeCompare(b.id, 'en'),
          )
          .slice(0, 12);
        const ids = new Set(desired.map((s) => s.id));
        for (const [id, parked] of this.resident)
          if (!ids.has(id)) {
            const pose = this.host.pose(id);
            if (pose && (pose.occupied || pose.speed > 1 || haversineDistance(pose, parked) > 8))
              this.claim(id);
            else {
              this.host.remove(id);
              this.resident.delete(id);
            }
          }
        // Serialize heavy model admissions: terrain and an already boarded aircraft retain priority.
        if (this.loading.size) return;
        const stand = desired.find((s) => !this.resident.has(s.id));
        if (!stand) return;
        this.loading.add(stand.id);
        this.resident.set(stand.id, stand);
        void Promise.resolve()
          .then(() => this.host.spawn(stand))
          .then((placed) => {
            if (placed === false) this.resident.delete(stand.id);
            if (this.disposed || (!this.resident.has(stand.id) && !this.claimed.has(stand.id)))
              this.host.remove(stand.id);
          })
          .catch((error: unknown) => {
            this.resident.delete(stand.id);
            this.host.remove(stand.id);
            this.onError(error);
          })
          .finally(() => this.loading.delete(stand.id));
      })
      .catch(this.onError);
  }

  dispose(): void {
    this.disposed = true;
    for (const id of this.resident.keys()) this.host.remove(id);
    this.resident.clear();
  }
}
