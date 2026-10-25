/** Static photo-directed anatomy for trevi_fountain. Uses the public figures kernel, no runtime actors. */
import './install-deterministic-math.mjs';
import {
  evaluatePose,
  generateFigureBody,
  poseModelSpace,
  resolveFigureDescriptor,
  rigBindModel,
} from '../../figures/dist/kernel.mjs';
import { quatFromEuler, quatRotateVec3 } from '../../kernel/dist/determinism.mjs';
import { simplifyStaticSculpture } from '../../tooling/scripts/static-sculpture-lod.mjs';

const cache = new Map(),
  state = { mode: 'custom', speed: 0, strideRate: 0, phaseAt: 0, phaseAtTick: 0, modeAtTick: 0 };
// Bake skinned public geometry to a deterministic static marble mesh. No rig is emitted.
function staticSkin(body, pose, k, offsetY, headAxis, exclude = []) {
  const buf = body.buffers,
    model = poseModelSpace(pose);
  const vertex = (i) => {
    const p = Array.from(buf.positions.subarray(i * 3, i * 3 + 3)),
      out = [0, 0, 0];
    for (let n = 0; n < 4; n++) {
      const j = buf.joints[i * 4 + n],
        w = buf.weights[i * 4 + n];
      if (!w) continue;
      const m = body.inverseBind.subarray(j * 16, j * 16 + 16),
        a = [
          m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
          m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
          m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
        ],
        q = j * 7,
        r = quatRotateVec3(Array.from(model.subarray(q + 3, q + 7)), a);
      for (let t = 0; t < 3; t++) out[t] += w * (r[t] + model[q + t]);
    }
    return [out[0] * k, out[1] * k + offsetY, out[2] * k];
  };
  const vertices = Array.from({ length: buf.vertexCount }, (_, i) => vertex(i)),
    triangles = [];
  // Static export uses glTF front faces. Orient closed body surfaces away from the bind skeleton.
  const bind = rigBindModel(body.rig),
    segments = [];
  for (let j = 1; j < body.rig.joints.length; j++) {
    const parent = body.rig.joints[j].parent;
    if (parent >= 0)
      segments.push([
        Array.from(bind.subarray(parent * 7, parent * 7 + 3)),
        Array.from(bind.subarray(j * 7, j * 7 + 3)),
      ]);
  }
  const hj = body.rig.index.head * 7,
    hp = Array.from(bind.subarray(hj, hj + 3));
  segments.push([hp, hp.map((v, i) => v + headAxis[i])]);
  const outward = (ids) => {
    const p = ids.map((i) => Array.from(buf.positions.subarray(i * 3, i * 3 + 3))),
      c = [0, 1, 2].map((k) => (p[0][k] + p[1][k] + p[2][k]) / 3);
    let near,
      dist = Infinity;
    for (const [a, b] of segments) {
      const axis = b.map((v, i) => v - a[i]),
        length = axis.reduce((s, x) => s + x * x, 0),
        t = length
          ? Math.max(0, Math.min(1, axis.reduce((s, x, i) => s + x * (c[i] - a[i]), 0) / length))
          : 0,
        q = a.map((v, i) => v + t * axis[i]),
        dd = q.reduce((s, x, i) => s + (x - c[i]) * (x - c[i]), 0);
      if (dd < dist) {
        dist = dd;
        near = q;
      }
    }
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]),
      n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return n.reduce((s, x, i) => s + x * (c[i] - near[i]), 0) >= 0;
  };
  for (const g of buf.groups) {
    if (exclude.includes(g.region)) continue;
    for (let i = g.start; i < g.start + g.count; i += 3) {
      const ids = Array.from(buf.indices.subarray(i, i + 3));
      if (!outward(ids)) [ids[1], ids[2]] = [ids[2], ids[1]];
      triangles.push(ids.map((j) => vertices[j]));
    }
  }
  return {
    triangles,
    joints: Object.fromEntries(
      Object.entries(body.rig.index).map(([name, j]) => [
        name,
        [model[j * 7] * k, model[j * 7 + 1] * k + offsetY, model[j * 7 + 2] * k],
      ]),
    ),
  };
}
function baked(d, kind) {
  const key = `${d}:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const female = ['health', 'abundance'].includes(kind),
    crouch = ['triton', 'angel', 'angel-horn'].includes(kind),
    H = 3.6;
  const descriptor = resolveFigureDescriptor({
      preset: 'human.adult',
      height: H,
      build: female ? -0.15 : 0.12,
      features: {
        hair: 'none',
        hands: d === 3 ? 'fingers' : 'mitten',
        sleeves: 'none',
        legs: 'shorts',
      },
      proportions: {
        headScale: 0.83,
        shoulderWidth: female ? 0.96 : 1.1,
        hipWidth: female ? 1.06 : 0.94,
      },
      seed: 'trevi_fountain',
    }),
    body = generateFigureBody(descriptor, d === 3 ? 0 : 1),
    ik = {
      'hand.l': female ? [0.68, 2.15, 0.48] : [0.7, 2.05, 0.45],
      'hand.r': female ? [-0.65, 2.35, 0.4] : [-0.7, 2.1, 0.4],
    };
  if (kind === 'health') ik['hand.l'] = [0.75, 3.03, 0.3];
  if (kind === 'abundance') ik['hand.r'] = [-0.25, 2.05, 0.5];
  if (crouch) {
    ik['hand.r'] = [-1.1, 3.45, 0.2];
    ik['hand.l'] = [1.05, 2.1, 0.55];
  }
  if (kind === 'angel-horn') {
    ik['hand.l'] = [1.05, 2.7, 0.7];
    ik['hand.r'] = [-0.25, 2.7, 0.6];
  }
  if (kind === 'ocean') {
    ik['hand.l'] = [0.85, 1.85, 0.45];
    ik['hand.r'] = [-0.85, 1.95, 0.4];
    ik['foot.l'] = [0.44, 0.3, 0.72];
    ik['foot.r'] = [-0.3, 0, 0.05];
  }
  const overrides = {
    chest: quatFromEuler(
      0,
      kind === 'ocean' ? -0.15 : kind === 'triton' ? 0.12 : 0,
      kind === 'ocean' ? -0.07 : 0,
    ),
    head: quatFromEuler(0, kind === 'ocean' ? 0.12 : kind === 'health' ? -0.12 : 0, 0),
  };
  if (crouch) {
    overrides['upperLeg.l'] = quatFromEuler(-1.15, 0, -0.25);
    overrides['upperLeg.r'] = quatFromEuler(-1.1, 0, 0.3);
    overrides['lowerLeg.l'] = quatFromEuler(1.6, 0, 0);
    overrides['lowerLeg.r'] = quatFromEuler(1.65, 0, 0);
  }
  const pose = evaluatePose(body.rig, state, 0, {
      tickRate: 60,
      ik,
      overrides,
      ...(crouch ? { anchor: 'pelvis' } : {}),
    }),
    model = poseModelSpace(pose),
    k = 4.3 / H;
  const geometry = staticSkin(
    body,
    pose,
    4.3 / H,
    crouch ? 1.1 : 0,
    [0, body.rig.metrics.headLen, 0],
    ['eyes', 'brow', 'hair'],
  );
  const j = body.rig.index.head * 7,
    center = quatRotateVec3(Array.from(model.subarray(j + 3, j + 7)), [
      0,
      body.rig.metrics.headLen * 0.5,
      0,
    ]).map((v, i) => (v + model[j + i]) * k + (i === 1 && crouch ? 1.1 : 0));
  const result = { ...geometry, head: center, headWidth: body.rig.metrics.headWidth * k, kind };
  if (d === 2) result.triangles = simplifyStaticSculpture(result.triangles, 380, 0.08);
  cache.set(key, result);
  return result;
}
export function treviHumanAnatomy(out, d, kind, color, triangle) {
  const b = baked(d, kind);
  for (const p of b.triangles) triangle(out, 'sculpture', p, color);
  return b;
}

/** Distinct calm/fierce rearing poses, shortened hind body buried in the photographed rockwork. */
export function treviHorseAnatomy(out, d, fierce, color, triangle) {
  const key = `horse:${d}:${fierce}`;
  if (!cache.has(key)) {
    const body = generateFigureBody(
      resolveFigureDescriptor({
        preset: 'horse',
        height: 1.55,
        build: 0.12,
        proportions: { bodyLength: 1.25, headScale: 1.25, earSize: 0.75, neckLength: 0.8 },
        features: { mane: true, tail: 'none' },
        seed: 'trevi_fountain',
      }),
      d === 3 ? 0 : 1,
    );
    const bind = rigBindModel(body.rig),
      positions = body.buffers.positions;
    const head = Array.from(bind.subarray(body.rig.index.head * 7, body.rig.index.head * 7 + 3));
    const neck = Array.from(bind.subarray(body.rig.index.neck * 7, body.rig.index.neck * 7 + 3));
    const axis = head.map((v, i) => v - neck[i]),
      length = axis.reduce((s, v) => s + v * v, 0);
    for (let i = 0; i < body.buffers.vertexCount; i++) {
      const p = Array.from(positions.subarray(i * 3, i * 3 + 3));
      let neckWeight = 0,
        headWeight = 0;
      for (let j = 0; j < 4; j++) {
        const name = body.rig.joints[body.buffers.joints[i * 4 + j]].name,
          w = body.buffers.weights[i * 4 + j];
        if (name === 'neck') neckWeight += w;
        if (name === 'head') headWeight += w;
      }
      const t = Math.max(
          0,
          Math.min(1, axis.reduce((s, v, k) => s + v * (p[k] - neck[k]), 0) / length),
        ),
        center = neck.map((v, k) => v + t * axis[k]),
        factor = 1 + 1.2 * neckWeight + 0.25 * headWeight;
      // Cross section only: retain bone lengths, the rearing poses and head/muzzle proportions.
      positions[i * 3] = p[0] * (1.4 + 0.6 * neckWeight);
      for (const k of [1, 2]) positions[i * 3 + k] = center[k] + (p[k] - center[k]) * factor;
    }
    const pose = evaluatePose(body.rig, state, 0, {
      tickRate: 60,
      overrides: {
        root: quatFromEuler(fierce ? -0.87 : -0.72, fierce ? -0.22 : 0.15, 0),
        neck: quatFromEuler(fierce ? -0.22 : 0.12, fierce ? 0.25 : -0.08, 0),
        head: quatFromEuler(fierce ? -0.1 : 0.24, fierce ? 0.35 : 0, 0),
        'upperLeg.fl': quatFromEuler(-1.1, 0, -0.2),
        'lowerLeg.fl': quatFromEuler(1.7, 0, 0),
        'upperLeg.fr': quatFromEuler(fierce ? -1.45 : -0.8, 0, 0.15),
        'lowerLeg.fr': quatFromEuler(1.5, 0, 0),
        'upperLeg.hl': quatFromEuler(0.2, 0, -0.08),
        'upperLeg.hr': quatFromEuler(-0.1, 0, 0.08),
      },
    });
    const m = body.rig.metrics,
      hp = m.headPitch;
    const b = staticSkin(body, pose, 1, 0, [
      0,
      -Math.sin(hp) * (m.headLen + m.snoutLen),
      Math.cos(hp) * (m.headLen + m.snoutLen),
    ]);
    const y = Math.min(...b.triangles.flat().map((p) => p[1]));
    // The old local frame has rear haunches in rock and the forequarters above them.
    for (const p of new Set(b.triangles.flat())) p[1] -= y;
    for (const p of Object.values(b.joints)) p[1] -= y;
    // Keep the enlarged neck and rearing limbs within 4 cm; the human figures use less
    // of the street budget so both horses can retain this silhouette.
    if (d === 2) b.triangles = simplifyStaticSculpture(b.triangles, 1000, 0.04);
    cache.set(key, b);
  }
  const b = cache.get(key);
  for (const p of b.triangles) triangle(out, 'sculpture', p, color);
  return b;
}
