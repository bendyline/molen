// The "Replace building" test controls: walk up to a mapped building (or look at one from the
// air), and put a sample set of the host's own structures where it stood. It exercises map
// overrides as a host composing its own view wires them: one set, a wrapper on the tile
// renderers, the landmark index wrapped, and a binding that rebuilds the tiles under a change.

import type { AssetProvider } from '@bendyline/molen-client';
import { cameraForward, cameraPlanarForward } from '@bendyline/molen-client/navigation';
import {
  bindMapOverrideEntities,
  bindMapOverrides,
  type EarthDioramaSpec,
  type EarthOverride,
  type EarthVehicles,
  type EarthWorldgen,
  type EarthWorldgenContent,
  type MapOverrideBinding,
  type MapOverrideEntities,
} from '@bendyline/molen-earth/client';
import type {
  TerrainPyramidStream,
  TerrainPyramidTileLayer,
  TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import { webMercatorToWgs84, wgs84ToWebMercator } from '@bendyline/molen-terrain/kernel';
import { type WorldgenBuildingHit, withMapOverrides } from '@bendyline/molen-worldgen-earth/client';
import {
  createMapOverrideSet,
  type MapOverrideSet,
  withMapOverrideStructures,
} from '@bendyline/molen-worldgen-earth/kernel';
import { loadDiorama } from './load-diorama.js';
import { createOverrideAssets } from './override-model.js';
import {
  createOverrideSamples,
  type OverrideSample,
  type OverrideSamplePlace,
} from './override-samples.js';

/** Where the viewer is, as the controls need it. */
export interface OverrideViewer {
  /** The camera, world meters. */
  position: readonly [number, number, number];
  yaw: number;
  pitch: number;
  /** On foot and standing: the walker's feet. Undefined in the air. */
  feet?: { x: number; z: number };
  /** In a vehicle, an aircraft or under a parachute: nothing is replaced from there. */
  busy: boolean;
}

/** The running scene the controls act on, handed over once it exists. */
export interface OverrideScene {
  /** Why this scene cannot show overrides; the controls are then disabled with it as the reason. */
  unavailable?: string;
  /** The adaptive terrain stream whose tiles are built again under a change. */
  stream?: TerrainPyramidStream;
  layers: readonly TerrainPyramidTileLayer[];
  /** With a style pack: finds the building ahead. Without one, samples are placed by eye. */
  worldgen?: EarthWorldgen;
  vehicles: EarthVehicles;
  /** The scene director of the moment: the page makes a new one when living places are toggled. */
  dioramas: () => { add(spec: EarthDioramaSpec): void; remove(id: string): void };
  viewer: () => OverrideViewer;
  sampleHeight: (x: number, z: number) => number | undefined;
  /** Stand the walker at world X/Z; the walk loop then finds open ground there. */
  moveWalker: (x: number, z: number) => void;
  /** The map under a change is on screen: what the walker collides with is new. */
  onApplied: () => void;
  /** Show the layer buildings are drawn in. */
  showBuildings: () => void;
  focus: () => void;
}

export interface ExplorerOverrides {
  readonly set: MapOverrideSet<EarthOverride>;
  /** `content` without the landmarks an override clears, and with the models it places. */
  worldgenContent(content: EarthWorldgenContent): EarthWorldgenContent;
  /** `base`, also serving the sample's own model. */
  assets(base: AssetProvider): AssetProvider;
  /** A tile renderer that builds each tile as the overrides leave it. */
  wrap(renderer: TerrainSemanticTileRenderer): TerrainSemanticTileRenderer;
  attach(scene: OverrideScene): void;
  /** The N key and the Replace button. */
  replace(): void;
  /** The U key and the Undo button. */
  undo(): void;
  clear(): void;
  /**
   * A few times a second, never per frame: parks the vehicles whose ground has arrived, and when
   * the walker moved looks for the building ahead. Returns the walk prompt naming it, if any.
   */
  tick(): string | undefined;
  /** The page replaced its scene director: give the new one the overrides' scenes. */
  resyncScenes(): void;
  dispose(): void;
}

/** Meters the probe reaches ahead of a walker, and how near a building must be to it. */
const WALK_PROBE = 4;
const WALK_REACH = 12;
/** From the air the probe is where the view meets the ground; a building this near it counts. */
const AIR_REACH = 30;
/** Meters cleared around the building that is replaced. */
const PADDING = 3;

interface VehicleSpawn {
  id: string;
  type: string;
  latitude: number;
  longitude: number;
  heading: number;
  color?: string;
  livery?: string;
}

export function createExplorerOverrides(options: {
  params: URLSearchParams;
  /** cos(center latitude) factor of the terrain package: world X/Z per projected meter. */
  metersPerUnit: number;
}): ExplorerOverrides {
  const { metersPerUnit } = options;
  const set = createMapOverrideSet<EarthOverride>();
  const samples = createOverrideSamples({
    loadScene: (name, signal) => loadDiorama(name, signal),
  });
  /** Override ids in the order they were made, for Undo. */
  const order: string[] = [];
  let counter = 0;
  let startupNote: string | undefined;
  {
    // ?override=<sample>&overrideAt=<lat>,<lon>[&overrideHeading=<deg>]: there before the first
    // tile is built, so a capture needs no key press and does not depend on what has streamed.
    const requested = options.params.get('override');
    if (requested !== null) {
      const sample = samples.find((item) => item.key === requested);
      const at = (options.params.get('overrideAt') ?? '').split(',').map(Number);
      const degrees = Number(options.params.get('overrideHeading') ?? 0);
      if (sample === undefined)
        startupNote = `Unknown sample "${requested}": ${samples.map((item) => item.key).join(', ')}`;
      else if (at.length !== 2 || !at.every(Number.isFinite) || !Number.isFinite(degrees))
        startupNote = '?override also needs &overrideAt=<lat>,<lon>';
      else
        try {
          set.set(
            sample.build('url', {
              center: [at[1] as number, at[0] as number],
              heading: (degrees * Math.PI) / 180,
            }),
          );
          order.push('url');
          startupNote = `${sample.title} placed from the page address.`;
        } catch (error) {
          startupNote = (error as Error).message;
        }
      if (startupNote !== undefined && order.length === 0)
        console.warn(`[overrides] ${startupNote}`);
    }
  }

  const toGeo = (x: number, z: number): [number, number] =>
    webMercatorToWgs84(x / metersPerUnit, z / metersPerUnit);
  const toWorld = (longitude: number, latitude: number): [number, number] => {
    const [x, z] = wgs84ToWebMercator(longitude, latitude);
    return [x * metersPerUnit, z * metersPerUnit];
  };

  let scene: OverrideScene | undefined;
  let binding: MapOverrideBinding | undefined;
  let entities: MapOverrideEntities | undefined;
  let state: 'pending' | 'applied' = 'applied';
  let statusLine: HTMLElement | undefined;
  let attributes: HTMLElement | undefined;
  let picker: HTMLSelectElement | undefined;
  /** Said once the change now being applied is on screen. */
  let whenDone: string | undefined;
  const say = (text: string): void => {
    if (statusLine !== undefined && statusLine.textContent !== text) statusLine.textContent = text;
  };

  // Vehicles are parked once the ground under them is on screen, not when they are declared.
  const waiting = new Map<string, VehicleSpawn>();
  const parkVehicles = (): void => {
    if (scene === undefined || waiting.size === 0) return;
    for (const [id, spec] of waiting) {
      const [x, z] = toWorld(spec.longitude, spec.latitude);
      if (scene.stream !== undefined && !scene.stream.isAreaReady(x, z, 20)) continue;
      const y = scene.sampleHeight(x, z);
      if (y === undefined) continue;
      waiting.delete(id);
      try {
        // A compass heading, as the kernel's yaw.
        const yaw = Math.PI - spec.heading;
        const spawn = {
          id,
          retain: true,
          ...(spec.color !== undefined ? { color: spec.color } : {}),
          ...(spec.livery !== undefined ? { livery: spec.livery } : {}),
        };
        const placed =
          scene.vehicles.spawn(spec.type, [x, y, z], yaw, spawn) ??
          scene.vehicles.spawnNear(spec.type, x, z, yaw, { ...spawn, radius: 15 });
        if (placed === undefined) say(`No room to park ${id}.`);
      } catch (error) {
        say(`${id}: ${(error as Error).message}`);
      }
    }
  };

  /** The building a walker faces or a flyer looks at, and the point on the ground probed. */
  const probe = (
    viewer: OverrideViewer,
  ): { point: [number, number]; hits: WorldgenBuildingHit[] } | undefined => {
    if (scene === undefined) return undefined;
    let point: [number, number] | undefined;
    if (viewer.feet !== undefined) {
      const [dx, , dz] = cameraPlanarForward(viewer.yaw);
      point = [viewer.feet.x + dx * WALK_PROBE, viewer.feet.z + dz * WALK_PROBE];
    } else {
      // Where the view meets the ground: marched, as the ground is a height field.
      const [dx, dy, dz] = cameraForward(viewer.yaw, viewer.pitch);
      if (dy > -0.02) return undefined;
      for (let t = 5; t <= 5000; t += Math.max(5, t * 0.02)) {
        const x = viewer.position[0] + dx * t;
        const z = viewer.position[2] + dz * t;
        const ground = scene.sampleHeight(x, z);
        if (ground !== undefined && viewer.position[1] + dy * t <= ground) {
          point = [x, z];
          break;
        }
      }
    }
    if (point === undefined) return undefined;
    const reach = viewer.feet !== undefined ? WALK_REACH : AIR_REACH;
    return { point, hits: scene.worldgen?.buildingsNear(point[0], point[1], reach) ?? [] };
  };
  const nameOf = (hit: WorldgenBuildingHit): string =>
    hit.name ?? (hit.class !== undefined && hit.class !== 'building' ? hit.class : 'building');
  /** The nearest hit, and the ground it and the landmark standing on it cover. */
  const targetOf = (
    hits: readonly WorldgenBuildingHit[],
  ):
    | { hit: WorldgenBuildingHit; name: string; bounds: [number, number, number, number] }
    | undefined => {
    const hit = hits[0];
    if (hit === undefined) return undefined;
    const bounds: [number, number, number, number] = [...hit.bounds];
    let name = nameOf(hit);
    for (const other of hits) {
      if (other === hit || other.kind !== 'landmark') continue;
      if (
        other.bounds[0] > bounds[2] ||
        other.bounds[2] < bounds[0] ||
        other.bounds[1] > bounds[3] ||
        other.bounds[3] < bounds[1]
      )
        continue;
      // A landmark model on a mapped footprint is one thing to replace, under the landmark's name.
      bounds[0] = Math.min(bounds[0], other.bounds[0]);
      bounds[1] = Math.min(bounds[1], other.bounds[1]);
      bounds[2] = Math.max(bounds[2], other.bounds[2]);
      bounds[3] = Math.max(bounds[3], other.bounds[3]);
      if (hit.kind !== 'landmark') name = nameOf(other);
    }
    return { hit, name, bounds };
  };

  /** A point 1.5 m outside whichever building of these overrides stands around world X/Z. */
  const outside = (x: number, z: number, ids: readonly string[]): [number, number] | undefined => {
    for (const id of ids)
      for (const building of set.resolved(id)?.buildings ?? []) {
        const ring = building.ring.map(([px, pz]): [number, number] => [
          px * metersPerUnit,
          pz * metersPerUnit,
        ]);
        const inside = (qx: number, qz: number): boolean => {
          let within = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [ax, az] = ring[i] as [number, number];
            const [bx, bz] = ring[j] as [number, number];
            if (az > qz !== bz > qz && qx < ((bx - ax) * (qz - az)) / (bz - az) + ax)
              within = !within;
          }
          return within;
        };
        if (!inside(x, z)) continue;
        let best:
          | { point: [number, number]; normal: [number, number]; distance: number }
          | undefined;
        for (let i = 0; i < ring.length; i++) {
          const [ax, az] = ring[i] as [number, number];
          const [bx, bz] = ring[(i + 1) % ring.length] as [number, number];
          const length = Math.hypot(bx - ax, bz - az);
          if (length === 0) continue;
          const t = Math.max(
            0,
            Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (length * length)),
          );
          const point: [number, number] = [ax + t * (bx - ax), az + t * (bz - az)];
          const distance = Math.hypot(x - point[0], z - point[1]);
          if (best === undefined || distance < best.distance)
            best = { point, normal: [(bz - az) / length, -(bx - ax) / length], distance };
        }
        if (best === undefined) continue;
        const away = inside(
          best.point[0] + best.normal[0] * 0.05,
          best.point[1] + best.normal[1] * 0.05,
        )
          ? -1
          : 1;
        return [
          best.point[0] + best.normal[0] * away * 1.5,
          best.point[1] + best.normal[1] * away * 1.5,
        ];
      }
    return undefined;
  };

  /** What the walker last faced, so the map is read again only when it moved or the map changed. */
  let faced:
    | {
        x: number;
        z: number;
        yaw: number;
        revision: number;
        state: string;
        name?: string;
        id?: string;
      }
    | undefined;
  const writeAttributes = (): void => {
    if (attributes === undefined) return;
    const next = {
      overrides: String(set.list().length),
      overrideRevision: String(set.revision),
      overrideState: state,
      overrideTarget: faced?.id ?? '',
    };
    for (const [key, value] of Object.entries(next))
      if (attributes.dataset[key] !== value) attributes.dataset[key] = value;
  };

  const sampleOf = (): OverrideSample =>
    samples.find((item) => item.key === picker?.value) ?? (samples[0] as OverrideSample);

  const api: ExplorerOverrides = {
    set,
    worldgenContent: (content) => ({
      ...content,
      structures: withMapOverrideStructures(content.structures, set, {
        isCatalogAsset: (asset) => content.pack.assets[asset] !== undefined,
      }),
    }),
    assets: (base) => createOverrideAssets(base),
    wrap: (renderer) => withMapOverrides(renderer, set, { metersPerUnit }),
    attach(next) {
      scene = next;
      const fieldset = document.getElementById('override-controls') as HTMLFieldSetElement | null;
      picker =
        (document.getElementById('override-sample') as HTMLSelectElement | null) ?? undefined;
      statusLine = document.getElementById('override-status') ?? undefined;
      attributes = document.getElementById('navigation-status') ?? undefined;
      for (const item of samples) picker?.add(new Option(item.title, item.key));
      const requested = options.params.get('override');
      if (picker !== undefined && samples.some((item) => item.key === requested))
        picker.value = requested as string;
      writeAttributes();
      if (next.unavailable !== undefined) {
        if (fieldset !== null) fieldset.disabled = true;
        say(next.unavailable);
        return;
      }
      if (next.stream !== undefined)
        binding = bindMapOverrides(set, {
          stream: next.stream,
          metersPerUnit,
          layers: next.layers,
          ...(next.worldgen !== undefined ? { worldgen: next.worldgen } : {}),
          onChange: (change) => {
            state = change.state;
            if (change.state === 'applied') {
              next.onApplied();
              const { feet } = next.viewer();
              const clear = feet !== undefined ? outside(feet.x, feet.z, change.ids) : undefined;
              if (clear !== undefined) next.moveWalker(clear[0], clear[1]);
              if (whenDone !== undefined) say(whenDone);
              whenDone = undefined;
              // What stands ahead may be something else now.
              faced = undefined;
            }
            writeAttributes();
          },
          onError: (error) => say(`Map overrides: ${(error as Error).message}`),
        });
      // The scene still shows the old map from the moment the set changes until that is applied.
      set.subscribe(() => {
        if (binding !== undefined) state = 'pending';
        writeAttributes();
      });
      entities = bindMapOverrideEntities(
        set,
        {
          vehicles: {
            spawn(spec) {
              waiting.set(spec.id, spec);
              return spec.id;
            },
            remove(id) {
              waiting.delete(id);
              if (next.vehicles.world.exists(id)) next.vehicles.remove(id);
            },
          },
          dioramas: {
            add: (spec) => next.dioramas().add(spec),
            remove: (id) => next.dioramas().remove(id),
          },
        },
        {
          whenApplied: () => binding?.whenApplied() ?? Promise.resolve(),
          onError: (error, context) => say(`${context}: ${(error as Error).message}`),
        },
      );
      document.getElementById('override-replace')?.addEventListener('click', () => {
        api.replace();
        next.focus();
      });
      document.getElementById('override-undo')?.addEventListener('click', () => {
        api.undo();
        next.focus();
      });
      document.getElementById('override-clear')?.addEventListener('click', () => {
        api.clear();
        next.focus();
      });
      say(
        startupNote ??
          (next.worldgen !== undefined
            ? 'Walk up to a building, or look at one from the air: N replaces it, U undoes.'
            : 'No style pack: N places the sample ahead of you, U undoes.'),
      );
    },
    replace() {
      if (scene === undefined || scene.unavailable !== undefined) return;
      const viewer = scene.viewer();
      if (viewer.busy) {
        say('Step out first: buildings are replaced on foot or from the air.');
        return;
      }
      const sample = sampleOf();
      const found = probe(viewer);
      if (found === undefined) {
        say('Look down at the ground or a building, or walk up to one.');
        return;
      }
      const target = targetOf(found.hits);
      const replaced =
        target?.hit.override !== undefined ? set.get(target.hit.override) : undefined;
      let id: string;
      let place: OverrideSamplePlace;
      let what: string;
      if (replaced !== undefined && 'center' in replaced.area) {
        // One of ours: the next sample takes its place, on the same ground.
        id = replaced.id;
        place = {
          center: replaced.area.center,
          size: replaced.area.size,
          ...(replaced.area.heading !== undefined ? { heading: replaced.area.heading } : {}),
        };
        what = 'the last replacement';
      } else if (target !== undefined) {
        const [minX, minZ, maxX, maxZ] = target.bounds;
        const center = toGeo((minX + maxX) / 2, (minZ + maxZ) / 2);
        // World X/Z are true meters only at the package's center latitude.
        const scale = Math.cos((center[1] * Math.PI) / 180) / metersPerUnit;
        id = `replace-${++counter}`;
        place = {
          center,
          size: [(maxX - minX) * scale + PADDING * 2, (maxZ - minZ) * scale + PADDING * 2],
        };
        what = target.name;
      } else {
        // Nothing mapped in reach: the sample goes on the open ground ahead.
        let [x, z] = found.point;
        if (viewer.feet !== undefined) {
          const [dx, , dz] = cameraPlanarForward(viewer.yaw);
          const ahead = sample.extent[1] / 2 + 8 - WALK_PROBE;
          x += dx * ahead;
          z += dz * ahead;
        }
        id = `replace-${++counter}`;
        place = { center: toGeo(x, z) };
        what = 'open ground';
      }
      let built: EarthOverride;
      try {
        built = sample.build(id, place);
        set.set(built);
      } catch (error) {
        say((error as Error).message);
        return;
      }
      if (!order.includes(id)) order.push(id);
      scene.showBuildings();
      const people =
        (built.actors?.length ?? 0) > 0
          ? ' Its people are shown by the Earth View sample, not here.'
          : '';
      const done = `${sample.title} now stands in place of ${what}.${people}`;
      if (binding !== undefined) {
        whenDone = done;
        say(`Replacing ${what} with ${sample.title}…`);
      } else say(done);
    },
    undo() {
      if (scene === undefined || scene.unavailable !== undefined) return;
      if (scene.viewer().busy) {
        say('Step out first: buildings are replaced on foot or from the air.');
        return;
      }
      const id = order.pop();
      if (id === undefined) {
        say('Nothing to undo.');
        return;
      }
      set.delete(id);
      whenDone = undefined;
      say('Undone: the map is back as it was there.');
    },
    clear() {
      if (scene === undefined || scene.unavailable !== undefined) return;
      order.length = 0;
      set.replace([]);
      whenDone = undefined;
      say('Every replacement is gone.');
    },
    tick() {
      if (scene === undefined || scene.unavailable !== undefined) return undefined;
      parkVehicles();
      const viewer = scene.viewer();
      if (viewer.feet === undefined || viewer.busy || scene.worldgen === undefined) {
        if (faced !== undefined) {
          faced = undefined;
          writeAttributes();
        }
        return undefined;
      }
      const { x, z } = viewer.feet;
      if (
        faced === undefined ||
        faced.revision !== set.revision ||
        faced.state !== state ||
        Math.hypot(x - faced.x, z - faced.z) > 0.5 ||
        Math.abs(viewer.yaw - faced.yaw) > 0.1
      ) {
        const target = targetOf(probe(viewer)?.hits ?? []);
        faced = {
          x,
          z,
          yaw: viewer.yaw,
          revision: set.revision,
          state,
          ...(target !== undefined ? { name: target.name, id: target.hit.id } : {}),
        };
        writeAttributes();
      }
      return faced.name !== undefined ? `N replace ${faced.name}` : undefined;
    },
    resyncScenes() {
      entities?.resync('dioramas');
    },
    dispose() {
      binding?.dispose();
      entities?.dispose();
    },
  };
  return api;
}
