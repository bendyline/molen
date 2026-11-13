/**
 * Map overrides in an Earth view: places where a host replaces the mapped world. The map edit
 * itself is `@bendyline/molen-worldgen-earth`'s; this is what a view adds around it: the tiles
 * are built again when the overrides change, and the people, vehicles and scene an override
 * brings come and go with it.
 */

import type { DioramaLoader } from '@bendyline/molen-dioramas/client';
import type { FigureData } from '@bendyline/molen-figures/client';
import type {
  TerrainPyramidStream,
  TerrainPyramidTileLayer,
} from '@bendyline/molen-terrain/client';
import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import type { WorldgenSemanticRenderers } from '@bendyline/molen-worldgen-earth/client';
import {
  type MapOverride,
  type MapOverridePoint,
  type MapOverrideSet,
  mapOverridePoint,
} from '@bendyline/molen-worldgen-earth/kernel';
import type { EarthActorSpec } from './actors';
import type { EarthDioramaSpec } from './dioramas';

/** A person or animal an override brings: an actor that comes and goes with it. */
export interface EarthOverrideActor {
  /** Unique among the override's actors; the actor's id is `<override id>/<id>`. */
  id: string;
  /** The body: a figure descriptor (`{ preset: 'human.adult' }`, `'dog'`, …) or `{ type }`. */
  figure: FigureData | { type: string };
  /** Where it stands, in the override's frame: meters from the area's center. */
  position: MapOverridePoint;
  /** Compass heading added to the area's, radians (default 0). */
  heading?: number;
  /**
   * What it does (default `idle`): stand, stroll the footways within `radius` meters of where it
   * stands, or walk to another point of the override. Change it later, to any behaviour, with
   * `view.actors.setBehaviour('<override id>/<id>', …)`.
   */
  behaviour?:
    | { kind: 'idle' }
    | { kind: 'wander'; radius?: number }
    | { kind: 'goTo'; to: MapOverridePoint; arriveWithin?: number };
  /** Offered to the interact key (E) within reach (default false). */
  interactable?: boolean;
}

/** A vehicle an override brings: an owned vehicle that comes and goes with it. */
export interface EarthOverrideVehicle {
  /** Unique among the override's vehicles; the vehicle's id is `<override id>/<id>`. */
  id: string;
  /** A car, boat or aircraft type from the content packs. */
  type: string;
  /** Where it is parked, in the override's frame: meters from the area's center. */
  position: MapOverridePoint;
  /** Compass heading of its nose added to the area's, radians (default 0). */
  heading?: number;
  /** Paint for a car (CSS color). */
  color?: string;
  /** A variant from the type's livery component. */
  livery?: string;
}

/** A scripted scene an override brings: a diorama standing on its rectangle. */
export interface EarthOverrideScene {
  /** Loads the scene manifest and its bounds; called only while the viewer is near. */
  load: DioramaLoader;
  /** Its origin in the override's frame (default the area's center). */
  position?: MapOverridePoint;
  /** Radians about +Y in the override's frame, as a diorama's `yaw` (default 0). */
  yaw?: number;
  /** Half-extents it stands on, meters (default half the override's rectangle). */
  groundFootprint?: [number, number];
  enterDistance?: number;
  exitDistance?: number;
  active?: (timeMs: number) => boolean;
}

/**
 * A place where the host replaces the mapped world: a rectangle to clear, the buildings, models
 * and props to stand there, and the people, vehicles and scene that come with them. Everything
 * is laid out in one frame: meters from the area's center, +x east and +z south, turned by the
 * area's heading.
 */
export interface EarthOverride extends MapOverride {
  /** People and animals, added as actors (see `EarthView.actors`). */
  actors?: readonly EarthOverrideActor[];
  /** Parked vehicles, added as owned vehicles (see `EarthView.vehicles`). */
  vehicles?: readonly EarthOverrideVehicle[];
  /** A scripted scene, registered as a diorama (see `EarthView.dioramas`). */
  scene?: EarthOverrideScene;
}

/** Host replacements of mapped places: see the "Overrides" section of the Earth view guide. */
export interface EarthOverrides {
  /** Add an override, or replace the one with its id. Throws, changing nothing, when it is invalid. */
  set(override: EarthOverride): void;
  /** Remove one, with the actors, vehicles and scene it brought; false when there was none. */
  remove(id: string): boolean;
  get(id: string): EarthOverride | undefined;
  list(): readonly EarthOverride[];
  /** Remove every override. */
  clear(): void;
  /** Bumped by every change. */
  readonly revision: number;
  /**
   * Resolves once every change made so far is on screen: until then the view goes on showing
   * what stood there before. It waits through a re-anchor of the view, and resolves when the new
   * frame stands (await `whenIdle()` too for its tiles to have streamed in); aborting rejects.
   */
  whenApplied(options?: { signal?: AbortSignal }): Promise<void>;
}

/** A mapped building or landmark at a place: see `EarthView.buildingAt`. */
export interface EarthBuildingHit {
  /** A footprint of the map (a host's own building included), or a placed landmark model. */
  kind: 'building' | 'landmark';
  /** The map feature's id, or the landmark placement's. */
  id: string;
  name?: string;
  /** What the map says it is (`school`, `warehouse`, `building`). */
  class?: string;
  /** Outer rings as `[longitude, latitude]` points, one per mapped piece. */
  outlines: [longitude: number, latitude: number][][];
  /** WGS84 `[west, south, east, north]`. */
  bounds: [west: number, south: number, east: number, north: number];
  /** Meters. */
  height?: number;
  levels?: number;
  /** Meters from the place asked about; 0 inside it. */
  distance: number;
  /** For a building an override placed: that override's id. */
  override?: string;
  /** For a landmark: where it is anchored, `[longitude, latitude]`. */
  anchor?: [longitude: number, latitude: number];
}

/** Map tiles within this many world units of a changed override are built again. */
export const MAP_OVERRIDE_REFRESH_MARGIN = 64;

/** A step of applying a change of overrides to the tiles on screen. */
export interface MapOverrideBindingChange {
  /** `pending` when the tiles are asked to build again; `applied` once they have. */
  state: 'pending' | 'applied';
  /** The overrides that changed. */
  ids: readonly string[];
  /** The set's revision this step answers. */
  revision: number;
  /** World X/Z rectangles `[minX, minZ, maxX, maxZ]` built again; empty when the map did not change. */
  bounds: readonly (readonly [number, number, number, number])[];
}

/** A set of map overrides bound to one terrain stream: see {@link bindMapOverrides}. */
export interface MapOverrideBinding {
  /** Resolves once every change made so far is on screen. */
  whenApplied(): Promise<void>;
  /** Changes not yet on screen. */
  readonly pending: number;
  dispose(): void;
}

/**
 * Keep a terrain stream's tiles in step with a set of map overrides: when the set changes, the
 * land cover and human-feature tiles around the change are built again from the edited map (the
 * layers' renderers must be wrapped by `withMapOverrides` over the same set). Changes made in
 * one task are applied together. The stream's metric frame is fixed for its life, so a view that
 * re-anchors binds each new stream afresh.
 */
export function bindMapOverrides<T extends MapOverride>(
  set: MapOverrideSet<T>,
  target: {
    stream: Pick<TerrainPyramidStream, 'refreshLayers'>;
    /** cos(center latitude) factor of the stream's terrain package. */
    metersPerUnit: number;
    /** The stream's layers; those of the `classification` and `human-feature` categories rebuild. */
    layers: readonly Pick<TerrainPyramidTileLayer, 'id' | 'category'>[];
    /** The worldgen renderers behind those layers, told which tiles are being replaced. */
    worldgen?: Pick<WorldgenSemanticRenderers, 'supersede'>;
    onChange?: (change: MapOverrideBindingChange) => void;
    onError?: (error: unknown) => void;
  },
): MapOverrideBinding {
  const layers = target.layers
    .filter((layer) => layer.category === 'classification' || layer.category === 'human-feature')
    .map((layer) => layer.id);
  interface Batch {
    ids: Set<string>;
    bounds: (readonly [number, number, number, number])[];
    tiles: boolean;
    revision: number;
    settle: () => void;
  }
  let batch: Batch | undefined;
  const outstanding = new Set<Promise<void>>();
  let disposed = false;
  const flush = (): void => {
    const current = batch;
    batch = undefined;
    if (current === undefined) return;
    const ids = [...current.ids];
    const rects =
      disposed || !current.tiles
        ? []
        : current.bounds.map(([west, south, east, north]) => {
            const [minX, minZ] = wgs84ToWorld(target.metersPerUnit, west, north);
            const [maxX, maxZ] = wgs84ToWorld(target.metersPerUnit, east, south);
            return [
              minX - MAP_OVERRIDE_REFRESH_MARGIN,
              minZ - MAP_OVERRIDE_REFRESH_MARGIN,
              maxX + MAP_OVERRIDE_REFRESH_MARGIN,
              maxZ + MAP_OVERRIDE_REFRESH_MARGIN,
            ] as const;
          });
    const notify = (state: 'pending' | 'applied'): void => {
      if (disposed) return;
      try {
        target.onChange?.({ state, ids, revision: current.revision, bounds: rects });
      } catch (error) {
        target.onError?.(error);
      }
    };
    notify('pending');
    let work: Promise<unknown> = Promise.resolve();
    if (rects.length > 0 && layers.length > 0) {
      try {
        // First: the replacements must be generated without what the outgoing tiles hold.
        for (const rect of rects) target.worldgen?.supersede(rect);
        work = Promise.all(
          rects.map((rect) => target.stream.refreshLayers({ bounds: rect, layers })),
        );
      } catch (error) {
        work = Promise.reject(error);
      }
    }
    void work
      .catch((error: unknown) => {
        if (!disposed) target.onError?.(error);
      })
      .then(() => {
        current.settle();
        notify('applied');
      });
  };
  const unsubscribe = set.subscribe((change) => {
    if (disposed) return;
    if (batch === undefined) {
      let settle!: () => void;
      const done = new Promise<void>((resolve) => {
        settle = resolve;
      });
      outstanding.add(done);
      void done.then(() => outstanding.delete(done));
      batch = { ids: new Set(), bounds: [], tiles: false, revision: change.revision, settle };
      queueMicrotask(flush);
    }
    for (const id of change.ids) batch.ids.add(id);
    batch.revision = change.revision;
    if (change.tiles) {
      batch.tiles = true;
      batch.bounds.push(...change.bounds);
    }
  });
  return {
    async whenApplied() {
      while (outstanding.size > 0) await Promise.all([...outstanding]);
    },
    get pending(): number {
      return outstanding.size;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      batch?.settle();
      batch = undefined;
    },
  };
}

/** Where the entities an override brings are added: each is optional, and its kind is skipped without it. */
export interface MapOverrideEntitySinks {
  actors?: { add(spec: EarthActorSpec): string; remove(id: string): void };
  vehicles?: {
    spawn(spec: {
      id: string;
      type: string;
      latitude: number;
      longitude: number;
      heading: number;
      color?: string;
      livery?: string;
    }): string;
    remove(id: string): void;
  };
  dioramas?: { add(spec: EarthDioramaSpec): void; remove(id: string): void };
}

/** The entities of a set of overrides, kept in step with it: see {@link bindMapOverrideEntities}. */
export interface MapOverrideEntities {
  /**
   * Add again everything of a kind (default every kind), for a sink that was emptied or replaced
   * behind this binding's back.
   */
  resync(kind?: 'actors' | 'vehicles' | 'dioramas'): void;
  /** Stop following the set. The entities stay: remove the overrides first to take them away. */
  dispose(): void;
}

/**
 * Give the overrides of a set their people, vehicles and scenes, and take them away again: an
 * actor, vehicle or diorama is added for each one an override declares, under the id
 * `<override id>/<its id>` (a scene: `<override id>/scene`), and removed with the override.
 * Setting an override again keeps the entities whose declaration did not change as they are (a
 * car that was driven off stays where it is), replaces the changed ones, and replaces them all
 * when the override's area moved or turned. A vehicle is added once the override's ground has
 * been rebuilt (`whenApplied`), so it is not parked against what stood there before.
 */
export function bindMapOverrideEntities<T extends EarthOverride>(
  set: MapOverrideSet<T>,
  sinks: MapOverrideEntitySinks,
  options: {
    /** Resolves when the ground of the changes so far has been rebuilt (default: at once). */
    whenApplied?: () => Promise<void>;
    onError?: (error: unknown, context: string) => void;
  } = {},
): MapOverrideEntities {
  type Kind = 'actors' | 'vehicles' | 'dioramas';
  interface Live {
    /** The frame the entities were laid out in: they are all replaced when it changes. */
    frame: string;
    /** Entity id to the declaration it was added from, per kind. */
    actors: Map<string, string>;
    vehicles: Map<string, string>;
    dioramas: Map<string, { key: string; load: DioramaLoader }>;
    /** Bumped by every change: a deferred addition from an older one is dropped. */
    token: number;
  }
  const live = new Map<string, Live>();
  let disposed = false;
  const attempt = (context: string, action: () => void): void => {
    try {
      action();
    } catch (error) {
      options.onError?.(error, context);
    }
  };
  const drop = (kind: Kind, id: string): void => {
    attempt(`override ${kind} ${id}`, () => {
      if (kind === 'actors') sinks.actors?.remove(id);
      else if (kind === 'vehicles') sinks.vehicles?.remove(id);
      else sinks.dioramas?.remove(id);
    });
  };
  const sync = (id: string, initial: boolean, only?: Kind): void => {
    const override = set.get(id);
    const resolved = set.resolved(id);
    const known = live.get(id);
    if (override === undefined || resolved === undefined) {
      if (known === undefined) return;
      live.delete(id);
      for (const kind of ['actors', 'vehicles', 'dioramas'] as const)
        for (const entity of known[kind].keys()) drop(kind, entity);
      return;
    }
    const frame = { center: [...resolved.center] as [number, number], heading: resolved.heading };
    const frameKey = JSON.stringify(frame);
    let state = known;
    if (state !== undefined && state.frame !== frameKey && only === undefined) {
      // Moved or turned: nothing stands where it was declared any more.
      for (const kind of ['actors', 'vehicles', 'dioramas'] as const)
        for (const entity of state[kind].keys()) drop(kind, entity);
      state = undefined;
    }
    if (state === undefined) {
      state = {
        frame: frameKey,
        actors: new Map(),
        vehicles: new Map(),
        dioramas: new Map(),
        token: 0,
      };
      live.set(id, state);
    }
    const current = state;
    // A pass over another kind alone leaves a vehicle addition that is still waiting in place.
    const token = only === undefined || only === 'vehicles' ? ++current.token : current.token;
    const place = (point: MapOverridePoint): { latitude: number; longitude: number } => {
      const [longitude, latitude] = mapOverridePoint(frame, point);
      return { latitude, longitude };
    };

    if (sinks.actors !== undefined && (only === undefined || only === 'actors')) {
      const wanted = new Map<string, EarthOverrideActor>(
        (override.actors ?? []).map((actor) => [`${id}/${actor.id}`, actor]),
      );
      for (const entity of [...current.actors.keys()])
        if (
          only === 'actors' ||
          JSON.stringify(wanted.get(entity)) !== current.actors.get(entity)
        ) {
          if (only !== 'actors') drop('actors', entity);
          current.actors.delete(entity);
        }
      for (const [entity, actor] of wanted) {
        if (current.actors.has(entity)) continue;
        attempt(`override actor ${entity}`, () => {
          const here = place(actor.position);
          const behaviour = actor.behaviour;
          sinks.actors?.add({
            id: entity,
            figure: actor.figure,
            ...here,
            heading: resolved.heading + (actor.heading ?? 0),
            ...(behaviour === undefined || behaviour.kind === 'idle'
              ? {}
              : behaviour.kind === 'wander'
                ? {
                    behaviour: {
                      kind: 'wander',
                      around: here,
                      ...(behaviour.radius !== undefined ? { radius: behaviour.radius } : {}),
                    },
                  }
                : {
                    behaviour: {
                      kind: 'goTo',
                      to: place(behaviour.to),
                      ...(behaviour.arriveWithin !== undefined
                        ? { arriveWithin: behaviour.arriveWithin }
                        : {}),
                    },
                  }),
            ...(actor.interactable !== undefined ? { interactable: actor.interactable } : {}),
          });
          current.actors.set(entity, JSON.stringify(actor));
        });
      }
    }

    if (sinks.vehicles !== undefined && (only === undefined || only === 'vehicles')) {
      const wanted = new Map<string, EarthOverrideVehicle>(
        (override.vehicles ?? []).map((vehicle) => [`${id}/${vehicle.id}`, vehicle]),
      );
      for (const entity of [...current.vehicles.keys()])
        if (
          only === 'vehicles' ||
          JSON.stringify(wanted.get(entity)) !== current.vehicles.get(entity)
        ) {
          if (only !== 'vehicles') drop('vehicles', entity);
          current.vehicles.delete(entity);
        }
      const add = (): void => {
        // The override changed again, or went, while its ground was being rebuilt.
        if (disposed || live.get(id) !== current || current.token !== token) return;
        for (const [entity, vehicle] of wanted) {
          if (current.vehicles.has(entity)) continue;
          attempt(`override vehicle ${entity}`, () => {
            sinks.vehicles?.spawn({
              id: entity,
              type: vehicle.type,
              ...place(vehicle.position),
              heading: resolved.heading + (vehicle.heading ?? 0),
              ...(vehicle.color !== undefined ? { color: vehicle.color } : {}),
              ...(vehicle.livery !== undefined ? { livery: vehicle.livery } : {}),
            });
            current.vehicles.set(entity, JSON.stringify(vehicle));
          });
        }
      };
      if (wanted.size > 0) {
        if (initial || options.whenApplied === undefined) add();
        else
          void options
            .whenApplied()
            .then(add, (error: unknown) => options.onError?.(error, `override ${id} vehicles`));
      }
    }

    if (sinks.dioramas !== undefined && (only === undefined || only === 'dioramas')) {
      const entity = `${id}/scene`;
      const scene = override.scene;
      // Its data as JSON (which leaves the functions out); the loader is compared by identity.
      const key = JSON.stringify(scene) ?? '';
      const had = current.dioramas.get(entity);
      if (
        had !== undefined &&
        (only === 'dioramas' || scene === undefined || had.key !== key || had.load !== scene.load)
      ) {
        if (only !== 'dioramas') drop('dioramas', entity);
        current.dioramas.delete(entity);
      }
      if (scene !== undefined && !current.dioramas.has(entity))
        attempt(`override scene ${entity}`, () => {
          sinks.dioramas?.add({
            id: entity,
            ...place(scene.position ?? [0, 0]),
            // A diorama's yaw turns the other way round from a compass heading.
            yaw: (scene.yaw ?? 0) - resolved.heading,
            groundFootprint: scene.groundFootprint ?? [resolved.half[0], resolved.half[1]],
            load: scene.load,
            ...(scene.enterDistance !== undefined ? { enterDistance: scene.enterDistance } : {}),
            ...(scene.exitDistance !== undefined ? { exitDistance: scene.exitDistance } : {}),
            ...(scene.active !== undefined ? { active: scene.active } : {}),
          });
          current.dioramas.set(entity, { key, load: scene.load });
        });
    }
  };
  for (const override of set.list()) sync(override.id, true);
  const unsubscribe = set.subscribe((change) => {
    if (disposed) return;
    for (const id of change.ids) sync(id, false);
  });
  return {
    resync(kind) {
      if (disposed) return;
      for (const kinds of kind === undefined
        ? (['actors', 'vehicles', 'dioramas'] as const)
        : [kind])
        for (const id of [...live.keys()]) sync(id, true, kinds);
    },
    dispose() {
      disposed = true;
      unsubscribe();
    },
  };
}
