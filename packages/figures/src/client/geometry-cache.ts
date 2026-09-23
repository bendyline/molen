/**
 * Refcounted figure geometry keyed by body content key: a crowd of identical NPCs shares one
 * `BufferGeometry` (and the kernel-side generation cost) while each entity keeps its own bones.
 */

import type * as THREE from 'three';
import { type FigureBody, figureBodyKey, generateFigureBody } from '../kernel/body';
import { deriveRig, type FigureRig } from '../kernel/rig';
import type { FigureTier } from '../kernel/skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from '../kernel/types';
import { figureGeometry } from './upload';

export interface CachedFigureGeometry {
  key: string;
  body: FigureBody;
  geometry: THREE.BufferGeometry;
}

interface Entry extends CachedFigureGeometry {
  refs: number;
}

export class FigureGeometryCache {
  private readonly entries = new Map<string, Entry>();
  private readonly rigs = new Map<string, FigureRig>();

  /** The rig of a descriptor (cached by descriptor key). */
  rigFor(descriptor: ResolvedFigureDescriptor): FigureRig {
    const key = figureBodyKey(descriptor, 0).split('|')[0] as string;
    let rig = this.rigs.get(key);
    if (rig === undefined) {
      rig = deriveRig(descriptor);
      this.rigs.set(key, rig);
    }
    return rig;
  }

  /** Acquire (generating on a miss) the geometry of a descriptor at a tier. */
  acquire(descriptor: ResolvedFigureDescriptor, tier: FigureTier): CachedFigureGeometry {
    const key = figureBodyKey(descriptor, tier);
    let entry = this.entries.get(key);
    if (entry === undefined) {
      const body = generateFigureBody(descriptor, tier, this.rigFor(descriptor));
      entry = { key, body, geometry: figureGeometry(body.buffers), refs: 0 };
      this.entries.set(key, entry);
    }
    entry.refs++;
    return entry;
  }

  release(key: string): void {
    const entry = this.entries.get(key);
    if (entry === undefined) return;
    entry.refs--;
    if (entry.refs <= 0) {
      entry.geometry.dispose();
      this.entries.delete(key);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  dispose(): void {
    for (const entry of this.entries.values()) entry.geometry.dispose();
    this.entries.clear();
    this.rigs.clear();
  }
}
