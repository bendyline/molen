/**
 * `ambientCapability()`: the `buildWorld` hook that installs ambient life from a scene's
 * `ambient` block and returns the `molen.ambient` script namespace. Scenes without the block pay
 * nothing and have no `molen.ambient`.
 */

import type { World } from '@bendyline/molen-kernel/world';
import {
  type ComponentMap,
  deepMergeJson,
  type JsonObject,
  resolvePrefab,
  type SceneManifest,
  validateByKind,
} from '@bendyline/molen-schema';
import type { AmbientKind } from './components';
import type { TransportNetworkDocument } from './graph/doc';
import { type AmbientOptions, installAmbient } from './install';
import { ambientScriptApi } from './script-api';
import type { AmbientTemplate } from './templates';

export interface AmbientCapabilityOptions
  extends Omit<AmbientOptions, 'classes' | 'seed' | 'traffic'> {
  /** Networks for `ambient.network` paths, keyed by the path as written in the scene. */
  networks?: Readonly<Record<string, TransportNetworkDocument>>;
}

/** Build-world capability hook: `buildWorld(scene, setup, { capabilities: [ambientCapability()] })`. */
export function ambientCapability(
  opts: AmbientCapabilityOptions = {},
): (world: World, manifest: SceneManifest) => Record<string, object> | undefined {
  return (world, manifest) => {
    const block = manifest.ambient;
    if (block === undefined) return undefined;
    const templates: Partial<Record<AmbientKind, AmbientTemplate | null>> = { ...opts.templates };
    for (const [kind, prefab] of Object.entries(block.templates ?? {}) as [AmbientKind, string][]) {
      const components = resolvePrefab(manifest, prefab);
      templates[kind] = (agent) => {
        const base = cloneMap(components);
        const builtIn = opts.templates?.[kind];
        return builtIn
          ? (deepMergeJson(builtIn(agent) as JsonObject, base as JsonObject) as ComponentMap)
          : base;
      };
    }
    const density = block.density ?? {};
    const car = {
      ...(density.car !== undefined ? { perLaneKm: density.car } : {}),
      ...(block.radius !== undefined
        ? { far: block.radius, near: Math.min(block.radius * 0.2, 60) }
        : {}),
      ...(block.despawnRadius !== undefined
        ? { keep: block.despawnRadius }
        : block.radius !== undefined
          ? { keep: block.radius * 1.3 }
          : {}),
    };
    const handle = installAmbient(world, {
      ...opts,
      traffic: block.drivingSide ?? 'right',
      classes: block.classes ?? ['car'],
      seed: `${manifest.seed ?? 0}:${block.seedSalt ?? 'ambient'}`,
      templates,
      policy: {
        ...opts.policy,
        car: { ...opts.policy?.car, ...car },
        ...(density.pedestrian !== undefined
          ? { pedestrian: { perLaneKm: density.pedestrian } }
          : {}),
        ...(density.train !== undefined ? { train: { perLaneKm: density.train } } : {}),
        ...(density.aircraft !== undefined ? { aircraft: { max: density.aircraft } } : {}),
      },
    });
    const network = resolveNetwork(block.network, opts.networks);
    if (network !== undefined) handle.addDocument(network);
    if (block.observer !== undefined) handle.setObserver({ entity: block.observer });
    return { ambient: ambientScriptApi(handle) };
  };
}

function resolveNetwork(
  network: string | JsonObject | undefined,
  networks: Readonly<Record<string, TransportNetworkDocument>> | undefined,
): TransportNetworkDocument | undefined {
  if (network === undefined) return undefined;
  const doc = typeof network === 'string' ? networks?.[network] : network;
  if (doc === undefined)
    throw new Error(
      `ambient.network "${String(network)}" was not provided: load the document and pass it as networks["${String(network)}"]`,
    );
  const result = validateByKind('transport-network', doc);
  if (!result.ok) throw new Error(result.formatted);
  return result.value as TransportNetworkDocument;
}

function cloneMap(map: ComponentMap): ComponentMap {
  return JSON.parse(JSON.stringify(map)) as ComponentMap;
}
