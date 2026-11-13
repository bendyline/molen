import * as tsl from 'three/tsl';
import type { Node, NodeBuilder, WebGPURenderer } from 'three/webgpu';
import { MeshStandardNodeMaterial, NodeMaterial } from 'three/webgpu';
import {
  type SnowCoverUniforms,
  snowCoverAmount,
  snowCoverFacing,
  snowSurfaceNode,
} from '../weather/snow-cover';

// Three r184–r186 internals: a node material's diffuse color, and a standard one's metalness and
// roughness (its `setupVariants`, which a physical material reaches through `super`).
interface LitNodeMaterial {
  lights: boolean;
  userData: Record<string, unknown>;
  metalnessNode: Node | null;
  roughnessNode: Node | null;
  setupDiffuseColor(this: LitNodeMaterial, builder: NodeBuilder): void;
  setupVariants(this: LitNodeMaterial, builder: NodeBuilder): void;
}
type F = Node<'float'>;

const patched = new WeakSet<object>();
const registered = new WeakMap<object, { snow: Node<'vec4'>; origin: Node<'vec2'> }>();

/**
 * Settle the weather's lying snow on every lit node material marked with `enableSnowCover`, as
 * the WebGL hook in weather/snow-cover.ts does. Call before the renderer builds its first lit
 * material.
 */
export function installWebGpuSnowCover(
  renderer: WebGPURenderer,
  uniforms: SnowCoverUniforms,
): void {
  // In the render group, as cloud shadows are: r184 copies an object-group uniform into a plain
  // material's buffer only when its object changes, so a static mesh would never see snow arrive.
  registered.set(renderer, {
    snow: tsl
      .uniform(uniforms.molenSnowCover.value)
      .setGroup(tsl.renderGroup) as unknown as Node<'vec4'>,
    origin: tsl
      .uniform(uniforms.molenSnowOrigin.value)
      .setGroup(tsl.renderGroup) as unknown as Node<'vec2'>,
  });
  const base = NodeMaterial.prototype as unknown as Partial<LitNodeMaterial>;
  const standard = MeshStandardNodeMaterial.prototype as unknown as Partial<LitNodeMaterial>;
  const { setupDiffuseColor } = base;
  const { setupVariants } = standard;
  if (typeof setupDiffuseColor !== 'function' || patched.has(base)) return;
  patched.add(base);
  // The dusting of the build in progress: color sets it, the surface setup that follows reads it.
  const dusting = tsl.property('float', 'molenSnow') as unknown as F & {
    assign(value: unknown): unknown;
  };
  const dusted = new WeakSet<NodeBuilder>();
  base.setupDiffuseColor = function (builder) {
    setupDiffuseColor.call(this, builder);
    const nodes = registered.get(builder.renderer);
    const amount = snowCoverAmount(this as never);
    if (nodes === undefined || amount === 0 || this.lights === false) return;
    // The shading normal, as the WebGL hook reads it (three resolves it on first use).
    const { cover, color } = snowSurfaceNode(
      tsl,
      tsl.positionWorld.xz.add(nodes.origin) as unknown as Node<'vec2'>,
      tsl.positionWorld.y as unknown as F,
      tsl.normalWorld.y as unknown as F,
      nodes.snow,
      amount,
      snowCoverFacing(this as never),
    );
    dusting.assign(cover);
    dusted.add(builder);
    tsl.diffuseColor.rgb.assign(tsl.mix(tsl.diffuseColor.rgb, color, dusting));
  };
  if (typeof setupVariants !== 'function') return;
  standard.setupVariants = function (builder) {
    if (!dusted.has(builder)) {
      setupVariants.call(this, builder);
      return;
    }
    // Snow is matte: it hides a metal roof's sheen, and with it the color metal reflects. Three
    // derives the specular color and the diffuse share from these two nodes.
    const { metalnessNode, roughnessNode } = this;
    const metalness = (metalnessNode ? tsl.float(metalnessNode as F) : tsl.materialMetalness) as F;
    const roughness = (roughnessNode ? tsl.float(roughnessNode as F) : tsl.materialRoughness) as F;
    this.metalnessNode = metalness.mul(dusting.oneMinus());
    this.roughnessNode = tsl.mix(roughness, 0.9, dusting);
    try {
      setupVariants.call(this, builder);
    } finally {
      this.metalnessNode = metalnessNode;
      this.roughnessNode = roughnessNode;
    }
  };
}
