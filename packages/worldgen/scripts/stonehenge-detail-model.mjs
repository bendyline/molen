/** Original medium-fi interpretation of the surviving Stonehenge ensemble (N0946).
 * Layout controls are factual measurements read from EH's current-site plan; contours are
 * authored, not copied scan meshes. Missing uprights and lintels are never reconstructed.
 */
import { normalFor } from './authored-structure-mesh.mjs';
import { face, triangle } from './heritage-tower-detail-mesh.mjs';

const unit = 6.88;
const position = ([x, z]) => [(x - 475) / unit, (z - 655) / unit];
const sarsen = [0.85, 0.84, 0.76],
  blue = [0.66, 0.71, 0.72],
  grass = [0.25, 0.37, 0.11];
const uprightControls = [
  [501, 555],
  [522, 557],
  [544, 568],
  [564, 583],
  [578, 600],
  [587, 618],
  [593, 637],
  [595, 657],
  [592, 680],
  [583, 700],
  [573, 721],
  [519, 757],
  [499, 765],
  [400, 718],
  [393, 615],
  [403, 595],
  [420, 581],
];
const parts = [];
function add(
  id,
  point,
  width,
  depth,
  height,
  angle = 0,
  base = 0,
  kind = 'sarsen',
  condition = 'standing',
) {
  const [x, z] = position(point);
  parts.push({ id, x, z, width, depth, height, angle, base, kind, condition });
}
uprightControls.forEach((p, i) => {
  add(
    `outer-${i + 1}`,
    p,
    i === 12 ? 1.15 : 2.05,
    1.15,
    i === 12 ? 1.75 : 4.1 + (i % 3) * 0.13,
    Math.atan2(p[1] - 655, p[0] - 475) + Math.PI / 2,
  );
});
// Six surviving outer lintels. Open bays and the western missing sector remain open.
for (const [a, b] of [
  [0, 1],
  [2, 3],
  [4, 5],
  [7, 8],
  [9, 10],
  [14, 15],
]) {
  const p = parts[a],
    q = parts[b],
    dx = q.x - p.x,
    dz = q.z - p.z;
  parts.push({
    id: `outer-lintel-${a}-${b}`,
    x: (p.x + q.x) / 2,
    z: (p.z + q.z) / 2,
    width: Math.hypot(dx, dz) + 2.1,
    depth: 1.25,
    height: 0.76,
    base: 4.05,
    angle: Math.atan2(dz, dx),
    kind: 'sarsen',
    condition: 'lintel',
  });
}
// The three complete surviving inner trilithons; the two broken groups stay broken.
for (const [id, a, b, h] of [
  ['southeast', [528, 689], [543, 675], 6.05],
  ['south', [487, 715], [503, 706], 6.55],
  ['west', [432, 651], [442, 629], 6.05],
]) {
  const [x0, z0] = position(a),
    [x1, z1] = position(b),
    angle = Math.atan2(z1 - z0, x1 - x0);
  add(`${id}-a`, a, 1.95, 1.45, h, angle);
  add(`${id}-b`, b, 1.95, 1.45, h, angle);
  parts.push({
    id: `${id}-lintel`,
    x: (x0 + x1) / 2,
    z: (z0 + z1) / 2,
    width: Math.hypot(x1 - x0, z1 - z0) + 2.08,
    depth: 1.7,
    height: 0.82,
    base: h - 0.07,
    angle,
    kind: 'sarsen',
    condition: 'lintel',
  });
}
add('great-trilithon-upright', [440, 686], 2.2, 1.4, 7.1, -0.65);
add('broken-north-trilithon-upright', [481, 598], 1.9, 1.4, 6.05, -0.55);
for (const [p, w, d, h, a] of [
  [[444, 553], 4.4, 1.7, 0.65, -0.08],
  [[477, 554], 1.8, 1.3, 0.5, 0.2],
  [[489, 547], 1.4, 3.2, 0.55, 0.06],
  [[364, 651], 2.4, 2.8, 0.55, -0.04],
  [[365, 640], 1.4, 0.8, 0.28, 0.04],
  [[474, 617], 6.2, 2.7, 1.05, 0.78],
  [[487, 635], 3.3, 1.5, 0.9, -0.36],
  [[500, 630], 1.5, 1.6, 1, 0.35],
  [[514, 646], 1.5, 1.8, 0.65, -0.4],
  [[464, 656], 1.35, 6.2, 0.74, 0.3],
  [[463, 679], 2.3, 4.8, 1.32, 0.66],
  [[450, 704], 2.5, 5, 1.18, 0.6],
  [[433, 715], 1.6, 1.8, 0.6, -0.3],
  [[442, 733], 2.2, 6.2, 0.75, 0.45],
  [[477, 774], 2, 6.6, 1.1, -0.16],
  [[543, 753], 2, 1.3, 0.75, -0.25],
  [[552, 769], 2.9, 1.9, 0.85, 0.78],
  [[570, 751], 2, 2.2, 0.8, -0.5],
])
  add(
    `fallen-${parts.filter((p) => p.condition === 'fallen').length + 1}`,
    p,
    w,
    d,
    h,
    a,
    0,
    'sarsen',
    'fallen',
  );
// Exposed bluestones and stumps only; buried sockets and missing ancient stones are not
// raised into modern standing stones. Small fragments are grouped at their visible station.
for (const [p, w, d, h, a] of [
  [[442, 590], 0.55, 2.3, 0.23, -0.18],
  [[424, 614], 0.7, 0.62, 1.85, 0.2],
  [[401, 674], 0.7, 2.7, 0.24, 0.5],
  [[445, 716], 1.2, 0.8, 0.23, 0.65],
  [[452, 739], 0.7, 0.35, 0.18, 0.3],
  [[477, 746], 0.55, 1.85, 0.25, 0.06],
  [[500, 701], 0.55, 0.55, 1.25, 0],
  [[519, 697], 0.6, 0.5, 1.45, 0.2],
  [[530, 667], 0.55, 0.4, 1.5, 0.6],
  [[541, 663], 0.5, 0.4, 0.28, 0.7],
  [[565, 646], 1.7, 0.9, 0.32, 0.35],
  [[564, 639], 0.5, 2.2, 0.24, 0.7],
  [[555, 613], 0.55, 0.5, 2.0, -0.6],
  [[527, 600], 0.65, 0.42, 0.32, 0.2],
  [[523, 587], 0.6, 0.42, 0.24, 0.1],
  [[514, 582], 0.7, 0.4, 0.2, 0.5],
  [[491, 586], 0.65, 0.4, 0.26, 0.4],
  [[443, 626], 0.7, 1.25, 0.2, 0.65],
  [[444, 650], 0.6, 1.3, 0.23, 0.35],
  [[448, 664], 0.8, 0.6, 1.4, 0.15],
  [[447, 674], 0.75, 0.55, 1.25, -0.1],
  [[450, 682], 0.5, 0.4, 0.28, 0.2],
  [[456, 683], 0.55, 0.42, 0.36, 0.4],
  [[472, 692], 0.4, 1.5, 0.23, 0.5],
  [[483, 696], 0.45, 0.4, 0.21, 0.1],
  [[512, 684], 0.65, 0.55, 1.6, 0.4],
  [[501, 693], 0.65, 0.5, 1.35, 0.6],
  [[494, 651], 0.55, 0.4, 0.38, 0.3],
  [[490, 632], 0.65, 1.15, 0.25, 0.4],
])
  add(
    `bluestone-${parts.filter((p) => p.kind === 'blue').length + 1}`,
    p,
    w,
    d,
    h,
    a,
    0,
    'blue',
    h > 0.5 ? 'standing' : 'fallen',
  );
add('altar-stone', [477, 664], 1.0, 5.2, 0.19, -0.6, 0, 'blue', 'fallen');
add('heel-stone', [907, 316], 2.7, 2.2, 4.7, 0.1);
add('slaughter-stone', [729, 470], 1.4, 6.2, 0.55, 0.68, 0, 'sarsen', 'fallen');
add('station-91', [764, 796], 2.0, 1.25, 1.1, -0.4);
add('station-93', [235, 516], 1.35, 1.1, 0.82, 0.2);
export const stonehengeParts = parts;
export const stonehengeOutliers = ['heel-stone', 'slaughter-stone', 'station-91', 'station-93'];

function contour(part, sides, t) {
  const w = part.width / 2,
    d = part.depth / 2,
    b = Math.min(w, d) * 0.18;
  const corners =
    sides === 4
      ? [
          [-w, -d],
          [w, -d],
          [w, d],
          [-w, d],
        ]
      : [
          [-w + b, -d],
          [w - b, -d],
          [w, -d + b],
          [w, d - b],
          [w - b, d],
          [-w + b, d],
          [-w, d - b],
          [-w, -d + b],
        ];
  const seed = parts.indexOf(part) + 1;
  return corners.map(([x, z], i) => {
    const standing = part.condition === 'standing';
    const shoulder =
      part.id === 'heel-stone'
        ? 1 - 0.34 * t * t
        : standing
          ? 1 - (part.kind === 'blue' ? 0.17 : 0.035) * t
          : 0.85 + 0.12 * Math.sin(Math.PI * t);
    const asymmetry = 1 + 0.075 * Math.sin(seed * 2.3 + i * 1.67);
    const rough = Math.sin(seed * 2.1 + i * 1.73 + t * 2.4) * 0.018 * Math.sin(Math.PI * t);
    const h = part.height * t + 0.024 * Math.sin(seed * 1.1 + i * 1.3) * t;
    const notch =
      part.id === 'south-b' && x > 0
        ? 0.26 * Math.max(0, Math.sin(((t - 0.25) * Math.PI) / 0.65))
        : 0;
    const heelLean = part.id === 'heel-stone' ? 0.35 * t : 0;
    const xx = x * shoulder * asymmetry + rough - notch,
      zz = z * shoulder * asymmetry + rough * 0.6 - heelLean,
      c = Math.cos(part.angle),
      s = Math.sin(part.angle);
    return [part.x + xx * c - zz * s, part.base + h, part.z + xx * s + zz * c];
  });
}
function stone(out, part, mode) {
  const sides = mode === 'skyline' ? 4 : 8,
    levels = { skyline: 2, district: 3, street: 6, closeup: 14 }[mode],
    cuts = mode === 'closeup' ? 3 : 1;
  const color = part.kind === 'blue' ? blue : sarsen,
    slot = part.kind === 'blue' ? 'blue' : 'sarsen';
  const rings = Array.from({ length: levels }, (_, i) => contour(part, sides, i / (levels - 1)));
  for (let j = 0; j < levels - 1; j++)
    for (let i = 0; i < sides; i++)
      for (let k = 0; k < cuts; k++) {
        const lerp = (a, b, t) => a.map((v, c) => v + (b[c] - v) * t);
        const a = rings[j][i],
          b = rings[j][(i + 1) % sides],
          c = rings[j + 1][(i + 1) % sides],
          d = rings[j + 1][i];
        let ps = [
          lerp(a, b, k / cuts),
          lerp(a, b, (k + 1) / cuts),
          lerp(d, c, (k + 1) / cuts),
          lerp(d, c, k / cuts),
        ];
        const n = normalFor(...ps),
          center = ps[0].map((_, c) => ps.reduce((s, p) => s + p[c], 0) / 4);
        if (n[0] * (center[0] - part.x) + n[2] * (center[2] - part.z) < 0) ps = ps.reverse();
        // Rough successive contours make a mildly twisted quad. Each triangle needs
        // its own geometric normal rather than borrowing the first triangle's plane.
        triangle(out, slot, [ps[0], ps[1], ps[2]], color);
        triangle(out, slot, [ps[0], ps[2], ps[3]], color);
      }
  for (const [ring, up] of [
    [rings.at(-1), true],
    ...(mode === 'skyline' ? [] : [[rings[0], false]]),
  ]) {
    const ps = up ? [...ring].reverse() : ring;
    for (let i = 1; i < ps.length - 1; i++) triangle(out, slot, [ps[0], ps[i], ps[i + 1]], color);
  }
  if (['street', 'closeup'].includes(mode) && part.id === 'great-trilithon-upright') {
    const tenon = {
      ...part,
      id: 'exposed-tenon',
      width: 0.7,
      depth: 0.38,
      height: 0.19,
      base: part.height,
    };
    // This single exposed oval tenon is an authored joint profile, not a scan copy.
    stone(out, tenon, 'district');
  }
}
function earthworks(out, mode) {
  const steps = { skyline: 12, district: 32, street: 96, closeup: 192 }[mode];
  const radii = [
    [51.8, 0.03],
    [54.8, 0.66],
    [57.7, 0.02],
  ];
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI * 2) / steps,
      b = ((i + 1) * Math.PI * 2) / steps,
      t = (a + b) / 2;
    // Northeast and southern causeways; modern tracks are not part of this static stone asset.
    if ((t > 5.31 && t < 5.63) || (t > 1.37 && t < 1.52)) continue;
    for (let j = 0; j < radii.length - 1; j++) {
      const p = (r, h, t) => [r * Math.cos(t), h, r * Math.sin(t)];
      const [r0, y0] = radii[j],
        [r1, y1] = radii[j + 1];
      face(out, 'grass', [p(r0, y0, a), p(r0, y0, b), p(r1, y1, b), p(r1, y1, a)], grass);
    }
  }
}
function build(out, mode) {
  for (const p of parts) stone(out, p, mode);
  earthworks(out, mode);
}
export function buildStonehengeReviewed(out) {
  build(out, 'closeup');
}
export function buildStonehengeDistrict(out) {
  build(out, 'district');
}
export function buildStonehengeStreet(out) {
  build(out, 'street');
}
export function buildStonehengeCloseup(out) {
  build(out, 'closeup');
}
export function buildStonehengeSkyline(out) {
  const means = {
      sarsen: [0.790898, 0.790898, 0.790898],
      blue: [0.912974, 0.912974, 0.912974],
      grass: [1, 1, 1],
    },
    wrapped = {};
  for (const n of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    wrapped[n] = (slot, ref, ps, normal, uv, color) =>
      out[n](
        slot,
        ref,
        ps,
        normal,
        uv,
        color.map((v, i) => v * means[slot][i]),
      );
  build(wrapped, 'skyline');
}
