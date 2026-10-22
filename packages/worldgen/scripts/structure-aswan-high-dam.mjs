/** Native curved rock-fill dam body and crest. Public-domain Qualla slope/terrace references. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ss/ssr/aswan_high_dam/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const rock = rgb('aaa38d'),
  earth = rgb('b6a489'),
  paving = rgb('b9b5a3'),
  asphalt = rgb('6d7169'),
  line = rgb('cbc6ad');
const surfaces = {
  rock: { slot: 'wall', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
  earth: { slot: 'trim', graph: 'gravel', roughness: 0.98, metallic: 0 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  road: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
};
const ref = 'palette:#ffffff';
function simplifyOpen(points, tolerance) {
  if (points.length < 3 || !tolerance) return points;
  const a = points[0],
    b = points.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = dx * dx + dz * dz;
  let max = 0,
    at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len)) : 0,
      v = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
    if (v > max) {
      max = v;
      at = i;
    }
  }
  return max > tolerance
    ? [
        ...simplifyOpen(points.slice(0, at + 1), tolerance).slice(0, -1),
        ...simplifyOpen(points.slice(at), tolerance),
      ]
    : [a, b];
}
function outlineFor(d) {
  const r = plan.outline,
    tol = [30, 10, 2, 0][d];
  if (!tol) return r;
  const first = r.reduce((a, p, i) => (p[0] < r[a][0] ? i : a), 0),
    rot = [...r.slice(first), ...r.slice(0, first)],
    opposite = rot.reduce((a, p, i) => (p[0] > rot[a][0] ? i : a), 0);
  return [
    ...simplifyOpen(rot.slice(0, opposite + 1), tol).slice(0, -1),
    ...simplifyOpen([...rot.slice(opposite), rot[0]], tol).slice(0, -1),
  ];
}
function offset(path, width) {
  const pairs = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      n = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [-(b[1] - a[1]) / n, (b[0] - a[0]) / n];
    return {
      p,
      normal,
      a: [p[0] + normal[0] * width, p[1] + normal[1] * width],
      b: [p[0] - normal[0] * width, p[1] - normal[1] * width],
    };
  });
  return { pairs, ring: [...pairs.map((p) => p.a), ...pairs.map((p) => p.b).reverse()] };
}
const full = plan.crest,
  segments = full.slice(1).map((p, i) => Math.hypot(p[0] - full[i][0], p[1] - full[i][1])),
  total = segments.reduce((a, b) => a + b, 0);
function closest(p) {
  let best = Infinity,
    along = 0,
    distance = 0;
  for (let i = 0; i < segments.length; i++) {
    const a = full[i],
      b = full[i + 1],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      t = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (segments[i] * segments[i])),
      ),
      dist = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
    if (dist < best) {
      best = dist;
      along = (distance + t * segments[i]) / total;
    }
    distance += segments[i];
  }
  return { along, distance: best };
}
const surfaceY = (p) => {
  const { along, distance } = closest(p),
    t = along - 0.5;
  const fall =
    distance <= 20
      ? 0
      : distance < 110
        ? ((distance - 20) * 32) / 90
        : distance <= 130
          ? 32
          : 32 + (distance - 130) * 0.28;
  return -Math.min(fall, 22 + 89 * Math.max(0, 1 - 4 * t * t));
};
// Clip each native outline triangle to regular cells before evaluating the cross-section.
// All vertices share one continuous height function; holes through the crest are unnecessary.
function clip(points, axis, edge, greater) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      ai = greater ? a[axis] >= edge : a[axis] <= edge,
      bi = greater ? b[axis] >= edge : b[axis] <= edge;
    if (ai) result.push(a);
    if (ai !== bi) {
      const t = (edge - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}
function triangle(out, slot, points, color, up = true) {
  let p = points;
  if (normalFor(...p)[1] > 0 !== up) p = [p[0], p[2], p[1]];
  out.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    color,
  );
}
function ribbon(out, slot, pairs, y, half, color) {
  for (let i = 0; i < pairs.length - 1; i++) {
    const a = pairs[i],
      b = pairs[i + 1],
      ps = [
        [a.p[0] + a.normal[0] * half, y, a.p[1] + a.normal[1] * half],
        [b.p[0] + b.normal[0] * half, y, b.p[1] + b.normal[1] * half],
        [b.p[0] - b.normal[0] * half, y, b.p[1] - b.normal[1] * half],
        [a.p[0] - a.normal[0] * half, y, a.p[1] - a.normal[1] * half],
      ];
    if (normalFor(...ps)[1] < 0) ps.reverse();
    quad(out, slot, ps, normalFor(...ps), color);
  }
}
function build(out, _frame, d = 3) {
  const outline = outlineFor(d),
    crest = simplifyOpen(full, [14, 5, 1, 0][d]),
    top = offset(crest, 20),
    terracePath = offset(full, 120)
      .pairs.filter((p) => Math.abs(p.p[0]) < 700)
      .map((p) => p.a),
    terrace =
      d > 0 && terracePath.length > 1
        ? offset(simplifyOpen(terracePath, d === 1 ? 10 : 1), 5)
        : undefined,
    n = outline.length,
    indices = earcut(outline.flat()),
    step = [500, 240, 120, 60][d];
  for (let i = 0; i < indices.length; i += 3) {
    const ps = indices.slice(i, i + 3).map((j) => outline[j]);
    const xmin = Math.floor(Math.min(...ps.map((p) => p[0])) / step) * step,
      xmax = Math.max(...ps.map((p) => p[0]));
    const zmin = Math.floor(Math.min(...ps.map((p) => p[1])) / step) * step,
      zmax = Math.max(...ps.map((p) => p[1]));
    for (let x = xmin; x < xmax; x += step)
      for (let z = zmin; z < zmax; z += step) {
        let poly = clip(ps, 0, x, true);
        poly = clip(poly, 0, x + step, false);
        poly = clip(poly, 1, z, true);
        poly = clip(poly, 1, z + step, false);
        for (let j = 1; j < poly.length - 1; j++) {
          const tri = [poly[0], poly[j], poly[j + 1]];
          const area =
            (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) -
            (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]);
          if (Math.abs(area) > 0.000001) {
            triangle(
              out,
              'rock',
              tri.map((p) => [p[0], surfaceY(p), p[1]]),
              rock,
            );
          }
        }
      }
  }
  // Close the embankment volume to the nominal foundation datum, including buried bank ends.
  for (let i = 0; i < n; i++) {
    const a = outline[i],
      b = outline[(i + 1) % n],
      ps = [
        [a[0], -112, a[1]],
        [b[0], -112, b[1]],
        [b[0], surfaceY(b), b[1]],
        [a[0], surfaceY(a), a[1]],
      ];
    quad(out, 'earth', ps, normalFor(...ps), earth);
  }
  for (let i = 0; i < indices.length; i += 3)
    triangle(
      out,
      'earth',
      indices.slice(i, i + 3).map((j) => [outline[j][0], -112, outline[j][1]]),
      earth,
      false,
    );
  ribbon(out, 'earth', top.pairs, 0, 20, earth);
  ribbon(out, 'road', top.pairs, 0.055, 5.8, asphalt);
  if (terrace) ribbon(out, 'earth', terrace.pairs, -32, 5, paving);
  for (const side of [-1, 1])
    for (let i = 0; i < top.pairs.length - 1; i++) {
      const a = top.pairs[i],
        b = top.pairs[i + 1],
        point = (p, y) => [
          p.p[0] + p.normal[0] * side * 18.4,
          y,
          p.p[1] + p.normal[1] * side * 18.4,
        ];
      beam(out, 'concrete', point(a, 0.48), point(b, 0.48), d === 0 ? 0.55 : 0.42, 0.8, paving);
    }
  if (d > 0) {
    for (let i = 0; i < top.pairs.length - 1; i++)
      for (const sign of [-1, 1]) {
        const a = top.pairs[i],
          b = top.pairs[i + 1];
        beam(
          out,
          'road',
          [a.p[0] + a.normal[0] * sign * 5.3, 0.075, a.p[1] + a.normal[1] * sign * 5.3],
          [b.p[0] + b.normal[0] * sign * 5.3, 0.075, b.p[1] + b.normal[1] * sign * 5.3],
          0.12,
          0.012,
          line,
        );
      }
  }
  if (d > 1) {
    let cumulative = 0;
    const spacing = d === 2 ? 35 : 18;
    for (let i = 0; i < full.length - 1; i++) {
      const a = full[i],
        b = full[i + 1],
        len = segments[i],
        normal = offset([a, b], 1).pairs[0].normal;
      for (
        let at = Math.ceil(cumulative / spacing) * spacing;
        at < cumulative + len;
        at += spacing
      ) {
        const t = (at - cumulative) / len,
          p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        for (const side of [-1, 1]) {
          const x = p[0] + normal[0] * side * 18.4,
            z = p[1] + normal[1] * side * 18.4;
          beam(out, 'concrete', [x, 0, z], [x, 1.1, z], 0.22, 0.22, paving);
        }
      }
      cumulative += len;
    }
  }
}
export const aswanHighDamSkyline = (out, frame) => build(out, frame, 0);
export const aswanHighDamDistrict = (out, frame) => build(out, frame, 1);
export const aswanHighDamStreet = (out, frame) => build(out, frame, 2);
export const aswanHighDamModel = {
  id: 'aswan_high_dam',
  key: 'aswan_high_dam',
  recipe: 'structure-aswan-high-dam.mjs',
  cell: 'ss/ssr',
  title: 'Aswan High Dam',
  category: 'dam',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native visible curved rock-fill High Dam body, broad stone/riprap slopes,40m crest, two-lane top road with pale physical parapets, and a lower downstream service terrace. Native746point outline and actual named crest road remain at their mapped scale. Detached electrical facilities, villages, friendship monument and reservoir/river landscape are separate from this dam asset.',
  camera: [1700, 1150, -2300],
  lookAt: [0, -35, -150],
  portableGroundY: -115,
  mediumFiContext: {
    scale: 13,
    groundY: -115,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'curved-riprap-face', position: [0, 380, -1550], lookAt: [0, -42, -190] },
    { name: 'crest-road-and-parapets', position: [60, 32, 80], lookAt: [0, 0, 0] },
    { name: 'downstream-service-terrace', position: [340, 95, -110], lookAt: [150, -30, -155] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundCutout: {
    outline: outlineFor(2),
    basis:
      'Native main-dam outline simplified within2m for the512vertex host limit, covered by the solid authored dam body. Removes duplicate terrain only under this physical embankment without changing source heights. Lake/river beyond native dam outline remains.',
  },
  groundContactBasis:
    'Original native crest-road arc midpoint and signed chord define the frame. Western near-bank crest-road point defines topY0. Preserved host terrain is sampled only for placement; cross-section and bed/wing contact are approximate. Below-dam flat inspection stage is not source-ground evidence.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-aswan-high-dam.mjs',
    level: 'skyline',
    export: 'aswanHighDamSkyline',
    errorMeters: 9,
    surfaces,
    authoredLevels: {
      district: { export: 'aswanHighDamDistrict', errorMeters: 3, surfaces },
      street: { export: 'aswanHighDamStreet', errorMeters: 0.8, surfaces },
    },
  },
  limitations: [
    'Primary Egyptian government text gives3830m total construction length,111m maximum foundation height,40m crest and520m main river section. Full native visible main-body polygon spans about2461m east-west and its named curved crest about2357m. Formal/hidden bank wings are not separately measured; native geometry is not stretched to the published total.',
    'The model retains the complete mapped visible main dam outline. A nominal cross-section tapers from maximum111m near the middle toward the banks; exact submerged core, irregular bank excavation, buried foundation and service-terrace elevation are approximate. It is not an engineering or flood-flow model.',
    'Two exact cleared Qualla public-domain Ijanderson977 originals control sloping riprap, lower service road and marker details. Colors, concealed faces and precise parapet/terrace arrangements remain medium-fi interpretations. No photograph, plaque/artwork or engineering diagram is used as a texture.',
    'Detached power station/substation and transmission towers, friendship monument, villages, Low Dam and water landscape are excluded. Native dam-only ground opening avoids duplicate earth surfaces; host reservoir level, source DEM and bank/submerged contact remain approximate.',
  ],
};
