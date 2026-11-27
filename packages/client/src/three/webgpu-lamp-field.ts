import * as THREE from 'three';
import {
  BRDF_Lambert,
  Break,
  diffuseColor,
  dot,
  Fn,
  float,
  floor,
  If,
  int,
  inverseSqrt,
  ivec2,
  Loop,
  max,
  min,
  normalWorld,
  positionWorld,
  renderGroup,
  smoothstep,
  sqrt,
  textureLoad,
  uniform,
  uniformArray,
  vec3,
} from 'three/tsl';
import { LightingNode, type Node, type NodeBuilder, type WebGPURenderer } from 'three/webgpu';
import {
  LAMP_FIELD_CELL_TEXELS,
  LAMP_FIELD_CELLS,
  LAMP_FIELD_MAX_BEAMS,
  LAMP_FIELD_WIDTH,
  type LampField,
} from './lamp-field';

// The lamp field (three/lamp-field.ts) as a TSL lighting node: the same model as its GLSL, line
// for line, reading the same uniform objects and texture. A light object in the scene stands for
// the field, so every lit node material's lights include it; it carries no color of its own.
// Kept behind the WebGPU driver import boundary; WebGL never loads the node runtime.

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;
type V4 = Node<'vec4'>;

/** The scene's stand-in for the lamp field: found by type, not drawn, never shadowed. */
class LampFieldLight extends THREE.Light {
  readonly isLampFieldLight = true;
  constructor() {
    super(0xffffff, 1);
    this.name = 'molen:lamp-field';
    this.castShadow = false;
  }
}

const installed = new WeakMap<object, LampFieldLight>();

/**
 * Light every lit node material `renderer` builds from now on with `field`'s lamps and beams, as
 * the WebGL hook in three/lamp-field.ts does. Call before the renderer builds its first lit
 * material; `scene` is the one it draws.
 */
export function installWebGpuLampField(
  renderer: WebGPURenderer,
  field: LampField,
  scene: THREE.Scene,
): void {
  if (installed.has(renderer)) return;
  const u = field.uniforms;
  // In the render group, as cloud shadows are: r184 copies an object-group uniform into a plain
  // material's buffer only when its object changes.
  const anchor = uniform(u.molenLampAnchor.value).setGroup(renderGroup) as unknown as V4;
  const grid = uniform(u.molenLampGrid.value).setGroup(renderGroup) as unknown as V4;
  const view = uniform(u.molenLampView.value).setGroup(renderGroup) as unknown as V4;
  const fade = uniform(u.molenLampFade.value).setGroup(renderGroup) as unknown as V4;
  const color = uniform(u.molenLampColor.value).setGroup(renderGroup) as unknown as V3;
  const beamColor = uniform(u.molenLampBeamColor.value).setGroup(renderGroup) as unknown as V4;
  const beams = uniformArray(u.molenLampBeams.value, 'vec4').setGroup(renderGroup) as unknown as {
    element(index: unknown): V4;
  };
  const data = u.molenLampData.value;
  const falloff = (distanceSquared: F, reach: F): F => {
    const ratio = distanceSquared.div(reach.mul(reach));
    const window = ratio.mul(ratio).oneMinus().clamp(0, 1);
    return window.mul(window).div(max(distanceSquared, 0.01)) as F;
  };
  const light = Fn(() => {
    const total = vec3(0).toVar();
    const local = positionWorld.sub(anchor.xyz).toVar();
    const normal = normalWorld;
    If(anchor.w.greaterThan(0), () => {
      const cellAt = floor(local.xz.sub(grid.xy).div(grid.z)).toVar();
      If(
        cellAt.x
          .greaterThanEqual(0)
          .and(cellAt.y.greaterThanEqual(0))
          .and(cellAt.x.lessThan(LAMP_FIELD_CELLS))
          .and(cellAt.y.lessThan(LAMP_FIELD_CELLS)),
        () => {
          const cell = ivec2(cellAt).toVar();
          const lamps = float(0).toVar();
          Loop(LAMP_FIELD_CELL_TEXELS, ({ i: t }: { i: Node<'int'> }) => {
            const slots = textureLoad(
              data,
              ivec2(cell.x.mul(LAMP_FIELD_CELL_TEXELS).add(t), cell.y),
            ).toVar() as unknown as V4 & { element(index: unknown): F & Node<'float'> };
            If(slots.x.lessThan(0), () => {
              Break();
            });
            Loop(4, ({ i: s }: { i: Node<'int'> }) => {
              const index = slots.element(s) as F;
              If(index.lessThan(0), () => {
                Break();
              });
              const i = (int as (value: unknown) => Node<'int'>)(index).toVar();
              const lamp = textureLoad(
                data,
                ivec2(i.mod(LAMP_FIELD_WIDTH), i.div(LAMP_FIELD_WIDTH).add(LAMP_FIELD_CELLS)),
              ).toVar() as unknown as V4;
              const toLamp = lamp.xyz.sub(local).toVar();
              const distanceSquared = dot(toLamp, toLamp).toVar();
              const fromEye = lamp.xz.sub(view.xy) as V2;
              const fromFocus = lamp.xz.sub(view.zw).mul(fade.z) as V2;
              const away = sqrt(min(dot(fromEye, fromEye), dot(fromFocus, fromFocus)));
              const facing = max(dot(normal, toLamp), 0).mul(
                inverseSqrt(max(distanceSquared, 0.0001)),
              );
              lamps.addAssign(
                lamp.w
                  .mul(facing)
                  .mul(falloff(distanceSquared as unknown as F, grid.w))
                  .mul(smoothstep(fade.x, fade.y, away).oneMinus()),
              );
            });
          });
          total.addAssign(color.mul(lamps).mul(anchor.w));
        },
      );
    });
    const glow = float(0).toVar();
    Loop(LAMP_FIELD_MAX_BEAMS, ({ i: b }: { i: Node<'int'> }) => {
      const beam = beams.element(b.mul(2)).toVar() as V4;
      If(beam.w.lessThanEqual(0), () => {
        Break();
      });
      const toLamp = beam.xyz.sub(local).toVar();
      const distanceSquared = dot(toLamp, toLamp).toVar();
      If(distanceSquared.lessThan(beamColor.w.mul(beamColor.w)), () => {
        const axis = beams.element(b.mul(2).add(1));
        const inverse = inverseSqrt(max(distanceSquared, 0.0001)).toVar();
        // three's spot cone with a full penumbra: smoothstep( cos( angle ), 1, cos( off axis ) ).
        const cone = smoothstep(axis.w, 1, dot(toLamp, axis.xyz).negate().mul(inverse));
        const facing = max(dot(normal, toLamp), 0).mul(inverse);
        glow.addAssign(
          beam.w
            .mul(cone)
            .mul(facing)
            .mul(falloff(distanceSquared as unknown as F, beamColor.w)),
        );
      });
    });
    return total.add(beamColor.xyz.mul(glow));
  });
  class LampFieldNode extends LightingNode {
    constructor(readonly light: THREE.Light | null = null) {
      super();
    }
    override getHash(): string {
      return 'molen-lamp-field';
    }
    override setup(builder: NodeBuilder): undefined {
      const reflected = (
        builder as unknown as { context: { reflectedLight?: { directDiffuse: V3 } } }
      ).context.reflectedLight;
      if (reflected === undefined) return undefined;
      const lambert = (BRDF_Lambert as unknown as (inputs: { diffuseColor: unknown }) => V3)({
        diffuseColor: (diffuseColor as unknown as V4).rgb,
      });
      (reflected.directDiffuse as V3 & { addAssign(value: unknown): unknown }).addAssign(
        (light() as unknown as V3).mul(lambert),
      );
      return undefined;
    }
  }
  // A renderer without three's node library (a stand-in driver) simply has no lamp field.
  const lightNodes = (renderer as unknown as { library?: { lightNodes?: Map<unknown, unknown> } })
    .library?.lightNodes;
  if (lightNodes === undefined) return;
  lightNodes.set(LampFieldLight, LampFieldNode);
  const stand = new LampFieldLight();
  installed.set(renderer, stand);
  scene.add(stand);
}
