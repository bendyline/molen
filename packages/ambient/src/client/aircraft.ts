/**
 * Aircraft overhead: content models (propellers or fans turning) when the host supplies them,
 * otherwise instanced proxies drawn by the vehicle batches.
 */

import { type AircraftVisual, createAircraftVisual } from '@bendyline/molen-client/aircraft';
import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import type * as THREE from 'three';

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
      const visual = createAircraftVisual(model, spec);
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
