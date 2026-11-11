/**
 * Trains in the world explorer: the railway network read from the feature tiles, train requests
 * from the panel buttons and `?train=` (freight, commuter, ride, light-rail), the engineer that
 * drives while the viewer rides, and the HUD line.
 */
import {
  EarthRailNetwork,
  type EarthTrainKind,
  EarthTrains,
  type EarthVehicles,
  isLightRailTrack,
} from '@bendyline/molen-earth/client';
import type { TypeLibrary } from '@bendyline/molen-kernel/content';

export const TRAIN_HELP =
  'W power · S brake, then reverse from a stand · Space brake · A/D take the left/right route at the next switch · V view · drag to look · E exit when stopped';
export const TRAIN_RIDE_HELP =
  'Riding · the engineer stops at stations and turns back at the end of the line · V view · drag to look · E exit when the train stands';

/** What a request puts the viewer on, and where. */
export type ExplorerTrainRequest = 'freight' | 'commuter' | 'ride' | 'light-rail';
const REQUESTS: Readonly<
  Record<ExplorerTrainRequest, { kind: EarthTrainKind; role: 'driver' | 'passenger' }>
> = {
  freight: { kind: 'freight', role: 'driver' },
  commuter: { kind: 'passenger', role: 'driver' },
  ride: { kind: 'passenger', role: 'passenger' },
  'light-rail': { kind: 'light-rail', role: 'driver' },
};
export function isTrainRequest(value: string | null | undefined): value is ExplorerTrainRequest {
  return value !== null && value !== undefined && Object.hasOwn(REQUESTS, value);
}

/** Seconds a request keeps looking for track while tiles stream in. */
const SEARCH_SECONDS = 60;

export class ExplorerTrains {
  /** Observe the human-features tiles with this (see `observeSemanticTiles`). */
  readonly rail: EarthRailNetwork = new EarthRailNetwork();
  private trains: EarthTrains | undefined;
  private vehicles: EarthVehicles | undefined;
  private pending: { request: ExplorerTrainRequest; since: number; next: number } | undefined;
  /** Why the last request did not put the viewer on a train. */
  message = '';

  /** `yard`: keep switchers working the yards near the camera (ambient life). */
  constructor(private readonly options: { yard?: boolean } = {}) {}

  attach(vehicles: EarthVehicles, types: TypeLibrary): void {
    this.vehicles = vehicles;
    this.trains = new EarthTrains({ vehicles, rail: this.rail, types });
  }

  /** Put the viewer on a train near the camera once the track there has streamed in. */
  request(request: ExplorerTrainRequest): void {
    this.message = 'Looking for a railway nearby…';
    this.pending = { request, since: performance.now(), next: 0 };
  }

  /** Whether track for a request lies within `radius` meters of X/Z (already streamed in). */
  hasTrack(request: ExplorerTrainRequest, x: number, z: number, radius = 3000): boolean {
    const light = REQUESTS[request].kind === 'light-rail';
    return (
      this.rail.network.nearest(x, z, radius, (tags) => isLightRailTrack(tags) === light) !==
      undefined
    );
  }

  get searching(): boolean {
    return this.pending !== undefined;
  }

  /**
   * Once a frame: try a pending request at the camera (kernel yaw), and let engineers drive.
   * Returns how the viewer boarded when a request just succeeded.
   */
  update(
    dt: number,
    now: number,
    position: readonly number[],
    yaw: number,
  ): 'driver' | 'passenger' | undefined {
    const trains = this.trains;
    if (!trains) return undefined;
    trains.update(dt);
    if (this.options.yard) trains.yard(position, { max: 2 });
    const pending = this.pending;
    if (!pending || now < pending.next) return undefined;
    pending.next = now + 1500;
    const { kind, role } = REQUESTS[pending.request];
    if (!trains.available(kind)) {
      this.message = 'This content has no rolling stock for that train';
      this.pending = undefined;
      return undefined;
    }
    const train = trains.spawn(kind, position[0] ?? 0, position[2] ?? 0, { yaw });
    if (!train) {
      this.message = trains.message;
      if ((now - pending.since) / 1000 > SEARCH_SECONDS) this.pending = undefined;
      return undefined;
    }
    this.pending = undefined;
    // One train at a time: the trains of earlier requests leave.
    for (const other of trains.list()) if (other !== train) trains.remove(other);
    if (!trains.board(train, role)) {
      this.message = trains.message;
      trains.remove(train);
      return undefined;
    }
    this.message = '';
    return role;
  }

  /**
   * The viewer just got into a vehicle on foot: aboard a train as a passenger, an engineer
   * takes the cab. Returns the help line for the seat, if it is a train's.
   */
  boarded(): string | undefined {
    const trains = this.trains;
    const vehicles = this.vehicles;
    const train = trains?.trainOf(vehicles?.mountedId);
    if (!trains || !vehicles || !train) return undefined;
    if (vehicles.ridingAsPassenger()) {
      trains.ride(train);
      return TRAIN_RIDE_HELP;
    }
    return TRAIN_HELP;
  }

  /** The HUD line while aboard a train. */
  status(): string | undefined {
    const status = this.trains?.status();
    if (!status) return undefined;
    const kmh = Math.abs(status.speed * 3.6).toFixed(0);
    const mph = Math.abs(status.speed * 2.23694).toFixed(0);
    const parts = [
      `${status.label} · ${status.consist} · ${status.tonnes.toLocaleString('en-US')} t`,
      `${kmh} km/h (${mph} mph)${status.speed < -0.1 ? ' reversing' : ''}`,
      ...(status.line ? [status.line] : []),
    ];
    if (status.passenger) {
      parts.push(
        status.dwell !== undefined
          ? `Standing · departs in ${Math.ceil(status.dwell)} s`
          : status.nextStop
            ? `Next stop${status.nextStop.name ? ` ${status.nextStop.name}` : ''} · ${(status.nextStop.distance / 1000).toFixed(1)} km`
            : 'Riding',
      );
    } else {
      parts.push(
        status.blocked
          ? 'Stopped against standing cars · S to back away'
          : status.ended
            ? 'End of track · S to back up'
            : `Next switch: ${status.route < 0 ? 'left' : status.route > 0 ? 'right' : 'straight'}`,
      );
    }
    return parts.join(' · ');
  }

  /** The train the viewer is aboard, for test probes. */
  current(): string | undefined {
    return this.trains?.trainOf(this.vehicles?.mountedId)?.id;
  }

  dispose(): void {
    this.trains?.dispose();
    this.rail.clear();
  }
}
