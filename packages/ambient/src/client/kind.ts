/**
 * The `ambient-vehicle` renderable kind for Worker hosts (`ClientOptions.kinds`): each agent is a
 * proxy mesh sized from its mirrored `ambientAgent` and painted its colour. The backend places
 * and interpolates the object; the handle only follows dimension, colour and tunnel changes.
 * (Main-thread hosts use `createAmbientRenderer`, which instances proxies instead.)
 */

import type { KindContext, KindHandle, Renderable, RenderableKind } from '@bendyline/molen-client';
import type { EntityId, JsonObject } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { AmbientAgentData } from '../kernel/components';
import { proxyGeometry, proxyHeight, proxyShapeFor } from './proxies';

export interface AmbientVehicleKindOptions {
  /** Body heights by type id (default: from the shape). */
  heights?: Readonly<Record<string, number>>;
}

class VehicleHandle implements KindHandle {
  readonly object: THREE.Group = new THREE.Group();
  private mesh: THREE.Mesh | undefined;
  private agentRef: JsonObject | undefined;
  private shapeKey = '';

  constructor(
    private readonly id: EntityId,
    private readonly ctx: KindContext,
    private readonly material: (color: string) => THREE.Material,
    private readonly options: AmbientVehicleKindOptions,
  ) {
    this.refresh();
  }

  private refresh(): void {
    const agent = this.ctx.mirror?.peek(this.id, 'ambientAgent') as AmbientAgentData | undefined;
    if (agent === this.agentRef) return;
    this.agentRef = agent;
    if (agent === undefined) return;
    this.object.visible = agent.hidden !== true;
    const shape = proxyShapeFor(agent.kind, agent.length);
    const height =
      this.options.heights?.[agent.type] ??
      proxyHeight(shape, agent.length, agent.width, agent.type);
    const key = `${shape}:${agent.length}:${agent.width}:${height}:${agent.color ?? ''}`;
    if (key === this.shapeKey) return;
    this.shapeKey = key;
    this.mesh?.removeFromParent();
    this.mesh = new THREE.Mesh(
      proxyGeometry(shape, { length: agent.length, width: agent.width, height }),
      this.material(agent.color ?? '#d8d8d4'),
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.walkIgnore = true;
    this.object.add(this.mesh);
  }

  update(_renderable: Renderable): void {
    this.refresh();
  }

  setTick(): void {
    this.refresh();
  }

  dispose(): void {
    this.mesh?.removeFromParent();
  }
}

/** The `ambient-vehicle` renderable kind (proxy meshes) for Worker-hosted scenes. */
export function ambientVehicleKind(options: AmbientVehicleKindOptions = {}): RenderableKind {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string): THREE.Material => {
    let m = materials.get(color);
    if (m === undefined) {
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color,
        roughness: 0.55,
        metalness: 0.12,
      });
      materials.set(color, m);
    }
    return m;
  };
  return {
    kind: 'ambient-vehicle',
    identity: (renderable) => renderable.ref ?? '',
    create: (id, _renderable, ctx) => new VehicleHandle(id, ctx, material, options),
    dispose: () => {
      for (const m of materials.values()) m.dispose();
      materials.clear();
    },
  };
}
