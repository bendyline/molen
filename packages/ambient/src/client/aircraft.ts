/**
 * Aircraft overhead: content models (propellers or fans turning) when the host supplies them,
 * otherwise instanced proxies drawn by the vehicle batches.
 */

import { type AircraftVisual, createAircraftVisual } from '@bendyline/molen-client/aircraft';
import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Node names the aircraft visual moves or toggles; everything else on an ambient copy is still. */
function movingNodes(spec: AircraftSpec): Set<string> {
  const visual = spec.visual;
  return new Set([
    ...visual.rotors.map((binding) => binding.node),
    ...visual.gearNodes,
    ...visual.flaps.map((binding) => binding.node),
    ...visual.ailerons.map((binding) => binding.node),
    ...(visual.controlStick !== undefined ? [visual.controlStick.node] : []),
    ...(visual.collective !== undefined ? [visual.collective.node] : []),
  ]);
}

/**
 * An aircraft overhead is seen from hundreds of meters, so its hundreds of still parts (fuselage,
 * wings, canopy frame, cockpit) merge into one mesh per material: a copy costs a draw per
 * material plus its moving parts, instead of one per part (281 for the P-51). Moving parts keep
 * their nodes and bindings. The visual is built without the interior, which is never animated
 * overhead. Exported for tests.
 */
export function mergeStaticAircraftParts(model: THREE.Object3D, spec: AircraftSpec): void {
  const moving = movingNodes(spec);
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const groups = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[] }>();
  const merged: THREE.Mesh[] = [];
  const visit = (object: THREE.Object3D): void => {
    if (moving.has(object.name)) return;
    for (const child of [...object.children]) visit(child);
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || (mesh as THREE.SkinnedMesh).isSkinnedMesh)
      return;
    const source = mesh.geometry;
    if (source.morphAttributes.position !== undefined) return;
    // Float copies: quantized (KHR_mesh_quantization) attributes cannot hold transformed values.
    const geometry = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'color'] as const) {
      const attribute = source.getAttribute(name);
      if (attribute === undefined) continue;
      const copy = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++)
        for (let c = 0; c < attribute.itemSize; c++)
          copy[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      geometry.setAttribute(name, new THREE.BufferAttribute(copy, attribute.itemSize));
    }
    if (source.index !== null) geometry.setIndex(source.index.clone());
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toModel, mesh.matrixWorld));
    const key = `${mesh.material.uuid}|${[...Object.keys(geometry.attributes)].sort().join()}|${geometry.index !== null}`;
    const group = groups.get(key) ?? { material: mesh.material, parts: [] };
    group.parts.push(geometry);
    groups.set(key, group);
    mesh.removeFromParent();
  };
  visit(model);
  for (const { material, parts } of groups.values()) {
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (geometry === null) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `ambient-merged:${material.name}`;
    merged.push(mesh);
  }
  for (const mesh of merged) model.add(mesh);
}

export interface AmbientAircraftModels {
  load(type: string): Promise<THREE.Object3D | undefined>;
  /** The aircraft spec (rotor and gear bindings) of a type, if it is an aircraft type. */
  aircraft(type: string): AircraftSpec | undefined;
}

interface Active {
  visual: AircraftVisual;
  rotor: number;
}

const INPUT: AircraftInputData = {
  power: 0.8,
  pitch: 0,
  roll: 0,
  yaw: 0,
  brake: false,
  engine: true,
  gear: false,
  flaps: false,
} as AircraftInputData;

export class AmbientAircraft {
  private readonly active = new Map<string, Active>();
  private readonly loading = new Set<string>();
  private readonly missing = new Set<string>();
  private disposed = false;

  constructor(
    private readonly models: AmbientAircraftModels,
    private readonly parent: THREE.Object3D,
    private readonly prepare?: (object: THREE.Object3D) => Promise<void> | void,
  ) {}

  /** Whether a type draws as a model (otherwise the caller draws a proxy). */
  modelled(id: string): boolean {
    return this.active.has(id);
  }

  /** Keep models for live aircraft; returns ids that still need a proxy this frame. */
  sync(
    live: readonly {
      id: string;
      type: string;
      pos: readonly number[];
      rot: readonly number[];
      speed: number;
      descending: boolean;
    }[],
    dt: number,
  ): void {
    const seen = new Set<string>();
    for (const plane of live) {
      seen.add(plane.id);
      const entry = this.active.get(plane.id);
      if (entry === undefined) {
        if (!this.missing.has(plane.type) && !this.loading.has(plane.id))
          void this.load(plane.id, plane.type);
        continue;
      }
      entry.rotor = (entry.rotor + dt * 40) % (Math.PI * 2);
      const object = entry.visual.object;
      object.position.set(plane.pos[0] ?? 0, plane.pos[1] ?? 0, plane.pos[2] ?? 0);
      object.quaternion.set(
        plane.rot[0] ?? 0,
        plane.rot[1] ?? 0,
        plane.rot[2] ?? 0,
        plane.rot[3] ?? 1,
      );
      entry.visual.update(
        {
          rotorAngle: entry.rotor,
          airspeed: plane.speed,
          altitudeAGL: 500,
          yaw: 0,
          pitch: 0,
          roll: 0,
          rpm: 2400,
          verticalSpeed: 0,
        } as unknown as AircraftStateData,
        { ...INPUT, gear: plane.descending, flaps: plane.descending },
        plane.pos[1] ?? 0,
      );
    }
    for (const [id, entry] of this.active)
      if (!seen.has(id)) {
        entry.visual.object.removeFromParent();
        entry.visual.dispose();
        this.active.delete(id);
      }
  }

  private async load(id: string, type: string): Promise<void> {
    const spec = this.models.aircraft(type);
    if (spec === undefined) {
      this.missing.add(type);
      return;
    }
    this.loading.add(id);
    try {
      const model = await this.models.load(type);
      if (model === undefined) {
        this.missing.add(type);
        return;
      }
      if (this.disposed) return;
      mergeStaticAircraftParts(model, spec);
      const visual = createAircraftVisual(model, {
        ...spec,
        visual: { ...spec.visual, interior: undefined },
      });
      visual.object.traverse((object) => {
        object.userData.walkIgnore = true;
        (object as THREE.Mesh).castShadow = false;
      });
      this.parent.add(visual.object);
      await this.prepare?.(visual.object);
      if (this.disposed) {
        visual.dispose();
        return;
      }
      this.active.set(id, { visual, rotor: 0 });
    } catch {
      this.missing.add(type);
    } finally {
      this.loading.delete(id);
    }
  }

  get count(): number {
    return this.active.size;
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.active.values()) {
      entry.visual.object.removeFromParent();
      entry.visual.dispose();
    }
    this.active.clear();
  }
}
