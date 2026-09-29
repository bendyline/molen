import type { EngineEvent, EntityId, JsonObject } from '@bendyline/molen-schema';
import type { AudioEntitySource } from './types';

/** The slice of a Worker-linked `MolenClient` the audio layer reads. */
export interface AudioClientLike {
  readonly tick: number | undefined;
  entities(): EntityId[];
  get(id: EntityId, component: string): JsonObject | undefined;
  onEvent(type: string, cb: (event: EngineEvent, tick: number) => void): () => void;
}

/**
 * Entity source over a kernel-linked client. Reads are memoized per mirrored tick, because
 * `client.get` returns a detached copy and the mirror only changes when a new tick arrives.
 */
export function entitySourceFromClient(
  client: AudioClientLike,
  opts: { tickRate?: number } = {},
): AudioEntitySource {
  let memoTick: number | undefined = Number.NaN;
  const rows = new Map<string, [EntityId, JsonObject][]>();
  const reads = new Map<string, JsonObject | undefined>();
  const fresh = (): void => {
    if (client.tick !== memoTick) {
      memoTick = client.tick;
      rows.clear();
      reads.clear();
    }
  };
  const get = (id: EntityId, component: string): JsonObject | undefined => {
    fresh();
    const key = `${id}\u0000${component}`;
    if (!reads.has(key)) reads.set(key, client.get(id, component));
    return reads.get(key);
  };
  return {
    get tick() {
      return client.tick;
    },
    ...(opts.tickRate !== undefined ? { tickRate: opts.tickRate } : {}),
    each(component) {
      fresh();
      let list = rows.get(component);
      if (!list) {
        list = [];
        for (const id of client.entities()) {
          const data = get(id, component);
          if (data !== undefined) list.push([id, data]);
        }
        rows.set(component, list);
      }
      return list;
    },
    get,
    onEvent: (cb) => client.onEvent('*', cb),
  };
}

/** The slice of a main-thread kernel `World` the audio layer reads (structural, no import). */
export interface AudioWorldLike {
  readonly tick: number;
  readonly tickRate: number;
  query(component: { readonly name: string }): Iterable<[EntityId, ...JsonObject[]]>;
  get(id: EntityId, component: { readonly name: string }): unknown;
  on(type: string, handler: (event: EngineEvent, ctx: { tick: number }) => void): () => void;
}

/** Entity source over a main-thread `World` (EarthVehicles, headless tooling). */
export function entitySourceFromWorld(world: AudioWorldLike): AudioEntitySource {
  const handles = new Map<string, { readonly name: string }>();
  const handle = (name: string): { readonly name: string } => {
    let h = handles.get(name);
    if (!h) {
      h = { name };
      handles.set(name, h);
    }
    return h;
  };
  return {
    get tick() {
      return world.tick;
    },
    get tickRate() {
      return world.tickRate;
    },
    *each(component) {
      for (const [id, data] of world.query(handle(component))) yield [id, data as JsonObject];
    },
    get: (id, component) => world.get(id, handle(component)) as JsonObject | undefined,
    onEvent: (cb) => world.on('*', (event, ctx) => cb(event, ctx.tick)),
  };
}
