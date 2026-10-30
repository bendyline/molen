import * as THREE from 'three';
import {
  abs,
  attribute,
  Break,
  cameraPosition,
  clamp,
  Discard,
  dot,
  exp,
  exp2,
  Fn,
  float,
  floor,
  fract,
  If,
  Loop,
  lightPosition,
  lightTargetPosition,
  log2,
  max,
  min,
  mix,
  normalize,
  positionWorld,
  pow,
  renderGroup,
  screenCoordinate,
  select,
  smoothstep,
  texture,
  texture3D,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  DirectionalLightNode,
  MeshBasicNodeMaterial,
  type Node,
  type NodeBuilder,
  type WebGPURenderer,
} from 'three/webgpu';
import type { CloudShadowUniforms } from '../weather/cloud-shadows';
import {
  CLOUD_MAX_LIGHT_STEPS,
  CLOUD_MAX_STEPS,
  type CloudTextures,
  type CloudUniforms,
  CLOUD_STEP_GROWTH as STEP_GROWTH,
} from '../weather/clouds';
import { CLOUD_WEATHER_SIZE } from '../weather/noise';

// The cloud deck and cloud shadows as TSL nodes: the same model as the GLSL in clouds.ts and
// cloud-shadows.ts, line for line, reading the same uniform objects. Kept behind the WebGPU
// driver import boundary; WebGL never loads the node runtime.

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;
type V4 = Node<'vec4'>;

/** WebGPU deck material reading `u` and `t` by reference. */
export function createWebGpuCloudMaterial(u: CloudUniforms, t: CloudTextures): THREE.Material {
  const slab = uniform(u.slab);
  const field = uniform(u.field);
  const weights = uniform(u.mix);
  const form = uniform(u.form);
  const erode = uniform(u.erode);
  const relief = uniform(u.relief);
  const shapeUv = uniform(u.shape);
  const detailUv = uniform(u.detail);
  const march = uniform(u.march);
  const sun = uniform(u.sun);
  const sunColor = uniform(u.sunColor);
  const ambientTop = uniform(u.ambientTop);
  const ambientBottom = uniform(u.ambientBottom);
  const phase = uniform(u.phase);
  const fog = uniform(u.fog);
  const fogColor = uniform(u.fogColor);

  const density = (detailed: boolean) =>
    Fn(([p, lod]: [V3, F]) => {
      const d = float(0).toVar();
      const h = p.y.sub(slab.x).mul(slab.z).toVar();
      If(h.greaterThan(0).and(h.lessThan(1)), () => {
        const uv = p.xz.mul(field.x).add(field.yz).toVar();
        const w = texture(t.weather, uv, lod).toVar() as unknown as V4;
        const strength = dot(w, weights).toVar();
        // Wider margins for coarse steps, which then see a cloud's average rather than its edge.
        const soft = erode.z.mul(lod.mul(0.6).add(1));
        // Field values above this are cloud; coverage 1 puts it below 0, closing the layer.
        const threshold = field.w.mul(soft.add(1)).oneMinus();
        // Each column's top: the height channel, lowered where the field is weak, so even a
        // closed layer is lumpy and lets more light through where it is thin.
        const hn = h
          .div(mix(form.x, 1, w.g).mul(relief.x.mul(strength.oneMinus()).oneMinus()))
          .toVar();
        If(hn.lessThan(1), () => {
          // Anvils: near the top of a storm cell the cloud spreads well beyond its tower.
          const spread = form.w.mul(smoothstep(0.55, 0.9, hn)).toVar();
          If(spread.greaterThan(0), () => {
            const wide = dot(texture(t.weather, uv, lod.add(relief.z)), weights).add(relief.w);
            strength.assign(mix(strength, max(strength, wide), spread));
          });
          // Clouds narrow toward their tops (domes, towers), but an anvil does not.
          const cover = clamp(
            strength.sub(threshold).sub(relief.y.mul(hn).mul(spread.oneMinus())).div(soft),
            0,
            1,
          );
          const profile = smoothstep(0, form.y, hn).mul(smoothstep(form.z, 1, hn).oneMinus());
          const body = cover.mul(mix(profile, 1, spread.mul(0.5))).toVar();
          If(body.greaterThan(0), () => {
            // Flat bases: the billows carve the sides and tops, and the underside only a little.
            const carve = erode.x
              .mul(mix(0.3, 1, smoothstep(0, 0.3, hn)))
              .mul(smoothstep(2, 4.5, lod).oneMinus())
              .toVar();
            const s = float(1).toVar();
            If(carve.greaterThan(0), () => {
              s.assign(mix(1, texture3D(t.shape, p.mul(shapeUv.x).add(shapeUv.yzw), 0).r, carve));
            });
            d.assign(
              clamp(s.sub(1).add(body).div(max(body, 0.001)), 0, 1).mul(body) as unknown as F,
            );
            if (detailed)
              If(erode.y.greaterThan(0).and(d.greaterThan(0)).and(lod.lessThan(2)), () => {
                const n = texture3D(t.detail, p.mul(detailUv.x).add(detailUv.yzw), 0).r.toVar();
                // Wispy below, billowed above.
                const wear = mix(n, n.oneMinus(), clamp(hn.mul(3), 0, 1))
                  .mul(erode.y)
                  .toVar();
                d.assign(clamp(d.sub(wear).div(wear.oneMinus()), 0, 1) as unknown as F);
              });
          });
        });
      });
      return d;
    });
  const full = density(true);
  const cheap = density(false);

  // Optical depth toward the light: doubling steps that together reach the edge of the layer
  // along the light, or sun.w meters if that is nearer.
  const lightDepth = Fn(([p, lod]: [V3, F]) => {
    const edge = select(sun.y.greaterThan(0), slab.y, slab.x);
    const reach = select(abs(sun.y).greaterThan(1e-4), min(sun.w, edge.sub(p.y).div(sun.y)), sun.w);
    const len = reach.div(exp2(march.y).sub(1)).toVar();
    const depth = float(0).toVar();
    const along = float(0).toVar();
    Loop(CLOUD_MAX_LIGHT_STEPS, ({ i }) => {
      If(float(i).greaterThanEqual(march.y), () => {
        Break();
      });
      const q = p.add(sun.xyz.mul(along.add(len.mul(0.5)))) as unknown as V3;
      depth.addAssign(cheap(q, lod).mul(len));
      along.addAssign(len);
      len.mulAssign(2);
    });
    return depth.mul(march.w);
  });

  const hg = (c: F, g: F): F => {
    const g2 = g.mul(g);
    return g2.oneMinus().div(pow(max(g2.add(1).sub(g.mul(c).mul(2)), 1e-4), 1.5)) as unknown as F;
  };

  const cloud = Fn(() => {
    const ro = cameraPosition;
    const toProxy = positionWorld.sub(ro).toVar();
    const t0 = toProxy.length().toVar();
    const rd = toProxy.div(t0).toVar() as unknown as V3;
    const range = attribute('cloudRange', 'vec2') as unknown as V2;
    const enter = float(0).toVar();
    const leave = float(1e9).toVar();
    If(abs(rd.y).greaterThan(1e-5), () => {
      const tb = slab.x.sub(ro.y).div(rd.y);
      const tt = slab.y.sub(ro.y).div(rd.y);
      enter.assign(max(min(tb, tt), 0));
      leave.assign(max(tb, tt));
    }).ElseIf(ro.y.lessThanEqual(slab.x).or(ro.y.greaterThanEqual(slab.y)), () => {
      leave.assign(-1);
    });
    const a = max(t0, enter).toVar();
    const b = min(min(leave, range.x), min(slab.w, a.add(march.z))).toVar();
    const steps = max(2, floor(march.x.mul(range.y).add(0.5))).toVar();
    const c = dot(rd, sun.xyz) as unknown as F;
    // Two lobes: a bright silver lining toward the light, a little back-scatter away from it.
    const lobes = mix(hg(c, phase.x), hg(c, phase.y), phase.z).toVar();
    // Interleaved gradient noise: a fixed per-pixel start offset that hides step banding.
    const jitter = fract(
      fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715))).mul(52.9829189),
    ).toVar();
    // Through the layer, steps grow geometrically, the last up to STEP_GROWTH times the first:
    // what shows of a cloud is its first optical depth, so the budget goes there. Along it (a
    // ray grazing the layer toward the horizon) the next cloud may be anywhere, so they stay
    // nearly even.
    const span = mix(STEP_GROWTH, 1.5, smoothstep(2, 8, b.sub(a).mul(slab.z))).toVar();
    const growth = pow(span, float(1).div(steps)).toVar();
    const offset = pow(growth, jitter);
    const first = b.sub(a).mul(growth.sub(1)).div(span.sub(1));
    const ds = first.mul(offset).toVar();
    const t = a.add(first.mul(offset.sub(1)).div(growth.sub(1))).toVar();
    const transmittance = float(1).toVar();
    const color = vec3(0).toVar();
    If(b.greaterThan(a), () => {
      Loop(CLOUD_MAX_STEPS, ({ i }) => {
        If(float(i).greaterThanEqual(steps).or(transmittance.lessThan(0.01)), () => {
          Break();
        });
        const p = ro.add(rd.mul(t)).toVar() as unknown as V3;
        const length = float(ds).toVar();
        t.addAssign(ds);
        ds.mulAssign(growth);
        const lod = clamp(log2(length.mul(field.x).mul(CLOUD_WEATHER_SIZE)), 0, 6).toVar();
        const d = full(p, lod).toVar();
        If(d.greaterThan(0), () => {
          const depth = lightDepth(p, lod).toVar();
          // Beer's law for light straight from the sun, and a diffusion term for light
          // scattered on through the cloud: even a thick deck is grey underneath, not black.
          const sunlight = exp(depth.negate())
            .mul(lobes)
            .add(float(0.3).div(depth.mul(0.08).add(1)));
          const h = p.y.sub(slab.x).mul(slab.z);
          const light = sunColor.mul(sunlight).add(mix(ambientBottom, ambientTop, h));
          const step = exp(d.mul(march.w).mul(length).negate()).toVar();
          color.addAssign(light.mul(transmittance.mul(step.oneMinus())));
          transmittance.mulAssign(step);
        });
      });
    });
    const opacity = transmittance.oneMinus().toVar();
    const alpha = opacity.mul(smoothstep(slab.w.mul(phase.w), slab.w, a).oneMinus()).toVar();
    Discard(alpha.lessThan(0.002));
    // Haze lies near the ground: a ray climbing to a cloud crosses less of it than its length.
    // Mixed in linear color, where three's node materials apply fog too.
    const hazeDepth = a.mul(mix(1, 0.35, smoothstep(0.05, 0.5, abs(rd.y))));
    const hazed = select(
      fog.w.lessThan(0.5),
      float(0),
      select(
        fog.w.lessThan(1.5),
        smoothstep(fog.x, fog.y, hazeDepth),
        exp(fog.z.mul(fog.z).mul(hazeDepth).mul(hazeDepth).negate()).oneMinus(),
      ),
    );
    return vec4(
      mix(color.div(max(opacity, 1e-4)), fogColor.xyz, hazed),
      alpha.mul(hazed.mul(fogColor.w).oneMinus()),
    );
  });

  const material = new MeshBasicNodeMaterial({
    name: 'molen:clouds',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  material.colorNode = cloud();
  // One pass: the front and back faces of a proxy are the same cloud.
  material.forceSinglePass = true;
  return material;
}

/**
 * Multiply every directional light by the cloud shadow, as the WebGL hook in cloud-shadows.ts
 * does. Call before the renderer builds its first lit material.
 */
export function installWebGpuCloudShadows(
  renderer: WebGPURenderer,
  uniforms: CloudShadowUniforms,
): void {
  const map = uniforms.molenCloudMap.value;
  // In the render group, as three's own light uniforms are: r184 copies an object-group uniform
  // into a plain material's buffer only when its object changes, so a static mesh would keep the
  // values of its first frame (shadows off) for good.
  const shadow = uniform(uniforms.molenCloudShadow.value).setGroup(renderGroup);
  const field = uniform(uniforms.molenCloudField.value).setGroup(renderGroup);
  const weights = uniform(uniforms.molenCloudMix.value).setGroup(renderGroup);
  const fit = uniform(uniforms.molenCloudFit.value).setGroup(renderGroup);
  const factor = (light: THREE.Light): F => {
    const toLight = normalize(lightPosition(light).sub(lightTargetPosition(light))).toVar();
    const world = positionWorld;
    const cast = mix(shadow.y, shadow.z, fit.z);
    const xz = world.xz.add(
      toLight.xz.mul(max(cast.sub(world.y), 0).div(max(toLight.y, 0.05))),
    ) as unknown as V2;
    const w = texture(map, xz.mul(field.x).add(field.yz), 0) as unknown as V4;
    const soft = fit.x;
    const cell = dot(w, weights).toVar();
    // A column is thinner, so lighter, where the field is weak.
    const cover = clamp(
      cell
        .add(field.w.mul(soft.add(1)))
        .sub(1)
        .div(soft),
      0,
      1,
    ).mul(fit.w.mul(cell.oneMinus()).oneMinus());
    // Above the layer there is nothing left to cast it; a light below the horizon casts none.
    const strength = select(
      toLight.y.greaterThan(0),
      shadow.x.mul(smoothstep(shadow.y, shadow.z, world.y).oneMinus()),
      float(0),
    );
    return mix(float(1), exp(cover.mul(fit.y).negate()), strength) as unknown as F;
  };
  class CloudShadowedLightNode extends DirectionalLightNode {
    override setupDirect(builder: NodeBuilder): { lightDirection: Node; lightColor: Node } {
      const direct = super.setupDirect(builder) as { lightDirection: Node; lightColor: Node };
      const light = this.light as THREE.Light;
      return { ...direct, lightColor: (direct.lightColor as V3).mul(factor(light)) };
    }
  }
  // A renderer without three's node library (a stand-in driver) simply has no cloud shadows.
  renderer.library?.lightNodes?.set(
    THREE.DirectionalLight,
    CloudShadowedLightNode as unknown as new (
      light: THREE.Light,
    ) => DirectionalLightNode,
  );
}
