import { createParkedVehicleBatch } from '@bendyline/molen-client/vehicles';
import type { FontLibrary } from '@bendyline/molen-materials/text';
import type { VehiclePlacement } from '@bendyline/molen-schema';
/** Off-thread road topology, parking inference, terrain draping and fixture placement. */
import * as THREE from 'three';
import { Heightfield } from './heightfield';
import type { TerrainLandcoverWorker } from './landcover-worker';
import { TERRAIN_PAVEMENT } from './linear-features';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import type { TerrainRouteShieldLibrary } from './route-shields';
import {
  type TerrainSemanticTilePacket,
  terrainSemanticTileFromPacket,
  terrainSemanticTilePacket,
} from './semantic-packet';
import type { TerrainSemanticTile } from './semantic-types';
import {
  createTerrainSurfaceObject,
  disposeTerrainSurfaceObject,
  markTerrainSurfaceDetail,
  type TerrainSurfaceGenerator,
  type TerrainSurfaceStats,
} from './surface-client';
import type { SurfaceSign } from './surface-sign-mesh';
import { appendTerrainSignalLenses, type TerrainSignalHead } from './surface-signals';
import type { TerrainSurfaceOptions } from './surface-styles';
import { tagTerrainObject } from './tagged-objects';

export type TerrainSurfaceWorker = TerrainLandcoverWorker;

interface Request {
  id: number;
  /** The tile as the packet it arrived in (see terrainSemanticTilePacket), else the tile itself:
   * cloning a decoded town tile whole cost the main thread 5-10 ms. */
  packet?: TerrainSemanticTilePacket;
  tile?: TerrainSemanticTile;
  context: Omit<TerrainPyramidTileLayerContext, 'heightfield' | 'signal' | 'admission'>;
  ground: {
    samples: Float32Array;
    cols: number;
    rows: number;
    origin: [number, number];
    worldSize: [number, number];
    height: { min: number; max: number };
  };
  options: Omit<TerrainSurfaceOptions, 'fonts' | 'routeShields'>;
  /** Sent once per change, not per tile. Empty update clears the library. */
  fontUpdate?: { fonts?: FontLibrary };
  shieldUpdate?: { routeShields?: TerrainRouteShieldLibrary };
}

interface MeshData {
  name: string;
  castShadow: boolean;
  pavement?: boolean;
  positions?: Float32Array;
  normals?: Float32Array;
  colors?: Float32Array;
  surfaceDetail?: Float32Array;
  matrices?: Float32Array;
  instanceColors?: Float32Array;
  /** Precompute culling bounds off-thread; avoid walking large buffers on first render. */
  sphere: [number, number, number, number];
}

interface Result {
  id: number;
  meshes?: MeshData[];
  stats?: TerrainSurfaceStats;
  style?: string;
  inferredParkingAreas?: number;
  vehicles?: VehiclePlacement[];
  signalHeads?: TerrainSignalHead[];
  roadSigns?: SurfaceSign[];
  error?: string;
}

/** Install on a module worker. Three.js supplies CPU geometry utilities only; no WebGL is used. */
export function installTerrainSurfaceWorker(
  scope: Pick<TerrainSurfaceWorker, 'postMessage' | 'addEventListener'>,
): void {
  let fonts: FontLibrary | undefined;
  let routeShields: TerrainRouteShieldLibrary | undefined;
  scope.addEventListener('message', (event) => {
    const request = event.data as Request;
    let object: THREE.Group | undefined;
    try {
      if (request.fontUpdate) fonts = request.fontUpdate.fonts;
      if (request.shieldUpdate) routeShields = request.shieldUpdate.routeShields;
      const ground = request.ground;
      object = createTerrainSurfaceObject(
        request.packet
          ? terrainSemanticTileFromPacket(request.packet)
          : (request.tile as TerrainSemanticTile),
        {
          ...request.context,
          heightfield: new Heightfield(ground.samples, ground.cols, ground.rows, {
            ...ground,
            validated: true,
          }),
          signal: new AbortController().signal,
        },
        { ...request.options, fonts, routeShields },
        undefined,
        false,
      );
      const transfer: ArrayBuffer[] = [];
      const meshes = object.children
        .filter((child) => !child.name.startsWith('surface:signal-'))
        .map((child): MeshData => {
          const mesh = child as THREE.Mesh;
          const instances = mesh as THREE.InstancedMesh;
          let sphere: THREE.Sphere;
          const data: MeshData = {
            name: mesh.name,
            castShadow: mesh.castShadow,
            sphere: [0, 0, 0, 0],
          };
          if (instances.isInstancedMesh) {
            instances.computeBoundingSphere();
            sphere = instances.boundingSphere as THREE.Sphere;
            data.matrices = instances.instanceMatrix.array as Float32Array;
            data.instanceColors = instances.instanceColor?.array as Float32Array;
            transfer.push(data.matrices.buffer as ArrayBuffer);
            if (data.instanceColors) transfer.push(data.instanceColors.buffer as ArrayBuffer);
          } else {
            mesh.geometry.computeBoundingSphere();
            sphere = mesh.geometry.boundingSphere as THREE.Sphere;
            data.positions = mesh.geometry.getAttribute('position').array as Float32Array;
            data.normals = mesh.geometry.getAttribute('normal').array as Float32Array;
            data.colors = mesh.geometry.getAttribute('color').array as Float32Array;
            transfer.push(
              data.positions.buffer as ArrayBuffer,
              data.normals.buffer as ArrayBuffer,
              data.colors.buffer as ArrayBuffer,
            );
            const detail = mesh.geometry.getAttribute('surfaceDetail');
            if (detail) {
              data.surfaceDetail = detail.array as Float32Array;
              transfer.push(data.surfaceDetail.buffer as ArrayBuffer);
            }
            if (mesh.userData[TERRAIN_PAVEMENT] === true) data.pavement = true;
          }
          data.sphere = [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius];
          return data;
        });
      scope.postMessage(
        {
          id: request.id,
          meshes,
          stats: object.userData.surfaceStats as TerrainSurfaceStats,
          style: object.userData.surfaceStyle as string,
          inferredParkingAreas: object.userData.inferredParkingAreas as number,
          vehicles: object.userData.vehicles as VehiclePlacement[],
          signalHeads: object.userData.trafficSignalHeads as TerrainSignalHead[],
          roadSigns: object.userData.roadSigns as SurfaceSign[],
        } satisfies Result,
        transfer,
      );
    } catch (error) {
      scope.postMessage({ id: request.id, error: (error as Error).message } satisfies Result);
    } finally {
      if (object) disposeTerrainSurfaceObject(object);
    }
  });
}

/** One active job; queue cancellation drops stale work before copying or transferring heights. */
/**
 * Surface generation over several workers, each tile to the one with the fewest in flight. A
 * streamed tile's roads, markings and parked cars wait for its surface; one worker for a whole
 * view held a fast aircraft's buildings back by seconds.
 */
export function createTerrainSurfaceWorkerPool(
  workers: readonly TerrainSurfaceWorker[],
): TerrainSurfaceGenerator {
  if (workers.length === 0) throw new Error('A terrain surface worker pool needs a worker');
  const members = workers.map((worker) => ({
    bridge: createTerrainSurfaceWorkerBridge(worker),
    busy: 0,
  }));
  return {
    generate(tile, context, options) {
      let target = members[0] as (typeof members)[number];
      for (const member of members) if (member.busy < target.busy) target = member;
      target.busy++;
      return target.bridge.generate(tile, context, options).finally(() => {
        target.busy--;
      });
    },
    dispose(): void {
      for (const member of members) member.bridge.dispose();
    },
  };
}

export function createTerrainSurfaceWorkerBridge(
  worker: TerrainSurfaceWorker,
): TerrainSurfaceGenerator {
  interface Job {
    id: number;
    tile: TerrainSemanticTile;
    context: TerrainPyramidTileLayerContext;
    options: TerrainSurfaceOptions;
    resolve: (value: THREE.Group | undefined) => void;
    reject: (error: Error) => void;
    cleanup: () => void;
  }
  const queue: Job[] = [];
  let active: Job | undefined;
  let nextId = 1;
  let disposed = false;
  let failure: Error | undefined;
  let sentFonts: FontLibrary | undefined;
  let sentShields: TerrainRouteShieldLibrary | undefined;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  const fixtureMaterial = new THREE.MeshStandardMaterial({ roughness: 0.78 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const pump = (): void => {
    if (active || disposed || failure) return;
    while (queue.length) {
      const job = queue.shift() as Job;
      if (job.context.signal.aborted) {
        job.cleanup();
        job.resolve(undefined);
        continue;
      }
      const { heightfield, signal: _signal, admission: _admission, ...context } = job.context;
      const { fonts, routeShields, ...options } = job.options;
      const request: Request = {
        id: job.id,
        ...((packet) => (packet ? { packet } : { tile: job.tile }))(
          terrainSemanticTilePacket(job.tile),
        ),
        context,
        ground: {
          samples: heightfield.copySamples(),
          cols: heightfield.cols,
          rows: heightfield.rows,
          origin: heightfield.origin,
          worldSize: heightfield.worldSize,
          height: heightfield.heightRange,
        },
        options,
        ...(fonts !== sentFonts ? { fontUpdate: { fonts } } : {}),
        ...(routeShields !== sentShields ? { shieldUpdate: { routeShields } } : {}),
      };
      active = job;
      try {
        worker.postMessage(request, [request.ground.samples.buffer]);
        sentFonts = fonts;
        sentShields = routeShields;
        return;
      } catch (error) {
        active = undefined;
        job.cleanup();
        job.reject(error as Error);
      }
    }
  };
  const receive = (event: { data?: unknown }): void => {
    const result = event.data as Result;
    const job = active;
    if (!job || result.id !== job.id) return;
    active = undefined;
    job.cleanup();
    if (job.context.signal.aborted || disposed) job.resolve(undefined);
    else if (result.error) job.reject(new Error(result.error));
    else {
      // Building the group (and baking its parked cars) is admitted with the tile's other
      // main-thread work: results from several workers arrived together, unbudgeted.
      const admission = job.context.admission;
      if (admission === undefined) job.resolve(assemble(job, result));
      else
        admission
          .run(() => assemble(job, result), {
            signal: job.context.signal,
            label: 'surface-assembly',
          })
          .then(job.resolve, (error: Error) =>
            job.context.signal.aborted ? job.resolve(undefined) : job.reject(error),
          );
    }
    pump();
  };
  const assemble = (job: Job, result: Result): THREE.Group => {
    const group = new THREE.Group();
    group.name = 'semantic:surfaces';
    group.userData.shadowCaster = false;
    group.userData.surfaceStats = result.stats;
    group.userData.roadSigns = result.roadSigns ?? [];
    group.userData.surfaceStyle = result.style;
    group.userData.inferredParkingAreas = result.inferredParkingAreas;
    group.userData.vehicles = result.vehicles ?? [];
    if (result.vehicles?.length) tagTerrainObject('parked-vehicles', group);
    for (const data of result.meshes ?? []) {
      const sphere = new THREE.Sphere(
        new THREE.Vector3(data.sphere[0], data.sphere[1], data.sphere[2]),
        data.sphere[3],
      );
      let mesh: THREE.Mesh;
      if (data.matrices) {
        // Zero initial instances avoids allocating/initializing matrices we will replace.
        const instances = new THREE.InstancedMesh(box, fixtureMaterial, 0);
        instances.instanceMatrix = new THREE.InstancedBufferAttribute(data.matrices, 16);
        instances.count = data.matrices.length / 16;
        if (data.instanceColors)
          instances.instanceColor = new THREE.InstancedBufferAttribute(data.instanceColors, 3);
        instances.boundingSphere = sphere;
        instances.castShadow = true;
        instances.userData.terrainOwnedInstances = true;
        mesh = instances;
      } else {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(data.positions as Float32Array, 3),
        );
        geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals as Float32Array, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(data.colors as Float32Array, 3));
        if (data.surfaceDetail)
          geometry.setAttribute('surfaceDetail', new THREE.BufferAttribute(data.surfaceDetail, 4));
        geometry.boundingSphere = sphere;
        mesh = new THREE.Mesh(geometry, material);
        mesh.userData.terrainOwnedGeometry = true;
        if (data.pavement) mesh.userData[TERRAIN_PAVEMENT] = true;
      }
      mesh.name = data.name;
      mesh.castShadow = data.castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (result.vehicles?.length)
      group.add(createParkedVehicleBatch(result.vehicles, job.context.origin));
    appendTerrainSignalLenses(group, result.signalHeads ?? []);
    markTerrainSurfaceDetail(group);
    return group;
  };
  const fail = (event: { message?: string }): void => {
    failure = new Error(event.message ?? 'Terrain surface worker failed');
    for (const job of [...(active ? [active] : []), ...queue]) {
      job.cleanup();
      job.reject(failure);
    }
    active = undefined;
    queue.length = 0;
  };
  worker.addEventListener('message', receive);
  worker.addEventListener('error', fail);
  return {
    generate(tile, context, options) {
      if (failure) return Promise.reject(failure);
      if (disposed || context.signal.aborted) return Promise.resolve(undefined);
      return new Promise((resolve, reject) => {
        const abort = (): void => {
          const index = queue.indexOf(job);
          if (index !== -1) queue.splice(index, 1);
          job.cleanup();
          resolve(undefined);
        };
        const job: Job = {
          id: nextId++,
          tile,
          context,
          options,
          resolve,
          reject,
          cleanup: () => context.signal.removeEventListener('abort', abort),
        };
        context.signal.addEventListener('abort', abort, { once: true });
        queue.push(job);
        pump();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      worker.removeEventListener('message', receive);
      worker.removeEventListener('error', fail);
      worker.terminate();
      for (const job of [...(active ? [active] : []), ...queue]) {
        job.cleanup();
        job.resolve(undefined);
      }
      active = undefined;
      queue.length = 0;
      material.dispose();
      fixtureMaterial.dispose();
      box.dispose();
    },
  };
}
