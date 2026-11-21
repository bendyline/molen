import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  wall: '847a69',
  lower: '787063',
  face: '9d8e77',
  coping: 'aa987e',
  stone: '746958',
  dark: '605b51',
  mosque: '77736b',
  mosqueTrim: '90877a',
  terrace: 'a0927c',
});
const surfaces = {
  wall: surface('wall', 'stone_limestone_raw', 0.94),
  face: surface('wall', 'stone_ashlar', 0.91),
  trim: surface('trim', 'stone_limestone_weathered', 0.9),
  roof: surface('roof', 'stone_limestone', 0.92),
  paving: surface('foundation', 'stone_ashlar', 0.94),
};
const up = [0, 1, 0],
  down = [0, -1, 0];

function segmentSamples(points, span, loop) {
  const route = loop ? closed(points) : points;
  const result = [];
  for (const [[ax, az], [bx, bz]] of pairs(route)) {
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 0.02) continue;
    const n = Math.max(1, Math.ceil(length / span));
    for (let i = 0; i < n; i++) result.push([mix(ax, bx, i / n), mix(az, bz, i / n)]);
  }
  result.push(route.at(-1));
  return result;
}

function section(points, index, loop, width) {
  const [x, z] = points[index];
  const last = points.length - 1;
  const previous = points[index - 1] ?? (loop ? points[last - 1] : points[0]);
  const next = points[index + 1] ?? (loop ? points[1] : points[last]);
  const flank = ([u, v], [a, b]) => {
    const d = Math.hypot(a - u, b - v);
    return d < 0.01 ? [0, 0] : [(b - v) / d, (u - a) / d];
  };
  const a = flank(previous, [x, z]),
    b = flank([x, z], next);
  const ux = a[0] + b[0],
    uz = a[1] + b[1];
  const divisor = Math.max(0.72, a[0] * ux + a[1] * uz, b[0] * ux + b[1] * uz);
  return [(ux * width * 0.5) / divisor, (uz * width * 0.5) / divisor];
}

function rampart(
  out,
  input,
  grade,
  lod,
  { height, width, loop = false, ruin = false, pond = false, detail = false },
) {
  const points = segmentSamples(input, [100, 46, 21, 12][lod], loop);
  const sections = points.map(([x, z], i) => {
    const [dx, dz] = section(points, i, loop, width);
    const p = [x + dx, z + dz],
      q = [x - dx, z - dz];
    const center = grade([x, z]);
    const local = Math.max(grade(p), grade(q), center);
    const weathering = ruin ? 0.62 + 0.35 * (0.5 + 0.5 * Math.cos(0.032 * x + 0.011 * z)) : 1;
    const y = local + height * weathering;
    return {
      p,
      q,
      y,
      x,
      z,
      dx,
      dz,
      lowerP: Math.min(grade(p) - 0.3, y - 0.36),
      lowerQ: Math.min(grade(q) - 0.3, y - 0.36),
    };
  });
  const slot = pond ? 'paving' : 'wall';
  for (const [a, b] of pairs(sections)) {
    const outer = edge(a.p, b.p).normal,
      inner = outer.map((v) => -v);
    const outerTint = ruin ? color.lower : color.wall;
    face(
      out,
      slot,
      [at(a.p, a.lowerP), at(b.p, b.lowerP), at(b.p, b.y), at(a.p, a.y)],
      outer,
      outerTint,
    );
    if (lod)
      face(
        out,
        slot,
        [at(a.q, a.lowerQ), at(b.q, b.lowerQ), at(b.q, b.y), at(a.q, a.y)],
        inner,
        outerTint,
      );
    face(
      out,
      pond ? 'paving' : 'trim',
      [at(a.p, a.y), at(a.q, a.y), at(b.q, b.y), at(b.p, b.y)],
      up,
      pond ? color.dark : color.coping,
    );
    if (!detail || lod < 2) continue;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 2.6) continue;
    const count = Math.max(1, Math.round(len / (lod === 2 ? 13 : 9)));
    const segmentWidth = len / count;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = mix(a.p[0], b.p[0], t),
        z = mix(a.p[1], b.p[1], t);
      const y = mix(a.y, b.y, t);
      const along = [b.x - a.x, b.z - a.z].map((v) => v / len);
      const foot = Math.min(0.74, segmentWidth * 0.23);
      const u = [x - along[0] * foot, y - 0.05, z - along[1] * foot];
      const v = [x + along[0] * foot, y - 0.05, z + along[1] * foot];
      beam(out, 'trim', u, v, 0.64, 0.63, color.face);
    }
  }
  if (!loop) {
    for (const [i, j] of [
      [0, 1],
      [sections.length - 1, sections.length - 2],
    ]) {
      const a = sections[i],
        b = sections[j],
        len = Math.hypot(a.x - b.x, a.z - b.z);
      const normal = [(a.x - b.x) / len, 0, (a.z - b.z) / len];
      face(
        out,
        slot,
        [at(a.p, a.lowerP), at(a.q, a.lowerQ), at(a.q, a.y), at(a.p, a.y)],
        normal,
        color.lower,
      );
    }
  }
}

function bastion(out, center, radius, height, grade, lod, pointed = false) {
  const sides = [6, 11, 15, 22][lod];
  const r = (y, m) => radialRing(y, radius * m, radius * m, sides, center);
  const top = grade(center) + height;
  const foot = Math.min(...r(0, 0.92).map(([x, , z]) => grade([x, z]))) - 0.45;
  if (!lod) {
    loft(out, 'wall', [r(foot, 1.02), r(top, 0.96)], color.wall);
    return;
  }
  loft(out, 'wall', [r(foot, 1.02), r(top - 0.9, 0.93)], color.wall, { cap: false });
  loft(out, 'face', [r(top - 0.9, 0.95), r(top - 0.65, 1), r(top, 0.98)], color.face);
  if (!lod || !pointed) return;
  const around = r(top - 0.05, 0.91).map(([x, , z]) => [x, z]);
  for (let k = 0; k < sides; k += lod > 1 ? 1 : 2) {
    const a = around[k],
      b = around[(k + 1) % sides],
      wall = edge(a, b, 1);
    const w = wall.length,
      u = w * 0.15,
      v = w * 0.85,
      t = (u + v) / 2;
    const low = top - 0.18,
      shoulder = top + 0.66;
    const front = [
      [u, low],
      [v, low],
      [v, shoulder],
      [t, top + 1.19],
      [u, shoulder],
    ];
    const back = front.map(([x, y]) => wall.p(x, y, -0.63));
    const outer = front.map(([x, y]) => wall.p(x, y, 0.32));
    face(out, 'trim', outer, wall.normal, color.coping);
    face(
      out,
      'trim',
      back,
      wall.normal.map((x) => -x),
      color.face,
    );
    for (let i = 0; i < 5; i++) {
      const j = (i + 1) % 5;
      const normal = i === 0 ? down : i === 1 || i === 4 ? [1, 0, 0] : up;
      face(out, 'trim', [back[i], back[j], outer[j], outer[i]], normal, color.face);
    }
  }
}

function archWall(out, wall, bays, floor, head, width, pier, depth, lod, material, tint) {
  const center = wall.length / 2;
  const bay = width + pier;
  let cursor = 0;
  for (let j = 0; j < bays; j++) {
    const u = center + (j - (bays - 1) / 2) * bay;
    const lower = u - width / 2,
      upper = u + width / 2;
    panel(out, material, wall, cursor, lower, floor, head, 0, tint);
    const spring = head - width * 0.66 - 0.55;
    const steps = [4, 6, 10, 14][lod];
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const t = (i - steps * 0.5) / (steps * 0.5);
      return [u + t * width * 0.5, spring + (1 - Math.pow(Math.abs(t), 1.62)) * width * 0.66];
    });
    for (const [[a, y], [b, h]] of pairs(points)) {
      face(
        out,
        material,
        [wall.p(a, y), wall.p(b, h), wall.p(b, head), wall.p(a, head)],
        wall.normal,
        tint,
      );
      face(
        out,
        'trim',
        [wall.p(a, y, depth), wall.p(b, h, depth), wall.p(b, h), wall.p(a, y)],
        down,
        color.mosqueTrim,
      );
      if (lod)
        face(
          out,
          'trim',
          [
            wall.p(a, y, 0.035),
            wall.p(b, h, 0.035),
            wall.p(b, h + 0.19, 0.035),
            wall.p(a, y + 0.19, 0.035),
          ],
          wall.normal,
          color.mosqueTrim,
        );
    }
    for (const x of [lower, upper]) {
      const sign = x === lower ? 1 : -1;
      const tangent = [-wall.normal[2] * sign, 0, wall.normal[0] * sign];
      face(
        out,
        material,
        [wall.p(x, floor, depth), wall.p(x, floor), wall.p(x, spring), wall.p(x, spring, depth)],
        tangent,
        tint,
      );
    }
    cursor = upper;
  }
  panel(out, material, wall, cursor, wall.length, floor, head, 0, tint);
}

function upperGate(out, d, grade, lod) {
  const [x, z] = d.gate,
    head = d.gateY + 8.3,
    floor = d.gateY - 0.41;
  const borderW = x - 3.4,
    borderE = x + 3.7,
    a = z - 7.6,
    b = z + 7.6;
  const w = edge([borderW, a], [borderW, b], -1),
    e = edge([borderE, b], [borderE, a], -1);
  archWall(out, w, 1, floor, head, 4.9, 1, -7.1, lod, 'face', color.face);
  archWall(out, e, 1, floor, head, 4.9, 1, -7.1, lod, 'face', color.wall);
  for (const v of [a, b - 3.1])
    block(out, 'wall', borderW - 0.01, floor - 0.6, v, 7.14, head - floor + 0.58, 3.12, color.wall);
  block(out, 'trim', borderW - 0.24, head - 0.04, a - 0.15, 7.62, 0.85, 15.48, color.coping);
  if (lod > 1) {
    for (let i = 0; i < 8; i++) {
      const xx = borderW - 2.95 + i * 0.39;
      const y = grade([xx, z]);
      const rise = Math.max(y + 0.06, floor + 0.28 + i * 0.08);
      block(
        out,
        'paving',
        xx,
        Math.min(y - 0.09, rise - 0.1),
        z - 2.16,
        0.42,
        Math.max(0.15, rise - y + 0.09),
        4.32,
        color.terrace,
      );
    }
  }
}

function minaret(out, center, floor, height, lod) {
  const n = [7, 10, 14, 18][lod],
    radius = 1.48;
  const r = (y, m) => radialRing(floor + y, radius * m, radius * m, n, center);
  if (!lod) {
    loft(out, 'face', [r(0, 1.25), r(height - 1.4, 0.75), r(height, 0.53)], color.mosque);
    return;
  }
  loft(out, 'face', [r(-0.21, 1.36), r(2.5, 1.08), r(height - 1.95, 0.72)], color.mosque, {
    cap: false,
  });
  for (const fraction of lod ? [0.36, 0.6, 0.83] : [0.6, 0.85]) {
    const h = height * fraction,
      f = 1.02 - fraction * 0.26;
    loft(
      out,
      'trim',
      [r(h - 0.42, f), r(h - 0.13, f + 0.22), r(h + 0.42, f + 0.22)],
      color.mosqueTrim,
    );
  }
  const top = height - 1.89;
  loft(
    out,
    'face',
    [r(top - 0.15, 0.91), r(top + 0.18, 0.87), r(height - 0.54, 0.76), r(height, 0.53)],
    color.mosqueTrim,
  );
  if (lod > 1) {
    const [x, z] = center;
    beam(
      out,
      'trim',
      [x, floor + height - 0.02, z],
      [x, floor + height + 0.55, z],
      0.095,
      0.095,
      color.dark,
    );
  }
}

function jamaMasjid(out, d, grade, lod) {
  const {
    center: [x, z],
    outerSize: [width, depth],
    hallWidth,
    estimatedMinaretHeight,
  } = d.mosque;
  const l = x - width / 2,
    r = x + width / 2,
    a = z - depth / 2,
    b = z + depth / 2;
  const line = l + hallWidth,
    outline = rect(l, a, r, b),
    y = Math.max(...outline.map(grade), grade([x, z])) + 0.14;
  const plinth = Math.min(...outline.map(grade), y) - 0.42;
  const h = y + 6.1;
  if (!lod) {
    block(out, 'face', l, plinth, a, hallWidth, h - plinth, depth, color.mosque);
    for (const v of [a + 1.7, b - 1.7])
      minaret(out, [line + 0.35, v], y, estimatedMinaretHeight, lod);
    return;
  }
  block(out, 'paving', l, plinth, a, width, y - plinth, depth, color.terrace);
  const front = edge([line, b], [line, a], 1);
  archWall(
    out,
    front,
    lod ? 9 : 5,
    y,
    h,
    lod ? 2.8 : 4.4,
    lod ? 1.71 : 3.07,
    -1.02,
    lod,
    'face',
    color.mosque,
  );
  for (const [s, t] of [
    [
      [l, a],
      [line, a],
    ],
    [
      [l, b],
      [l, a],
    ],
    [
      [line, b],
      [l, b],
    ],
  ]) {
    const wall = edge(s, t, 1);
    panel(out, 'face', wall, 0, wall.length, y, h, 0, color.mosque);
  }
  block(
    out,
    'roof',
    l - 0.12,
    h - 0.03,
    a - 0.11,
    hallWidth + 0.27,
    0.48,
    depth + 0.22,
    color.mosqueTrim,
  );
  for (const v of [a + 1.7, b - 1.7])
    minaret(out, [line + 0.35, v], y, estimatedMinaretHeight, lod);
  rampart(
    out,
    [
      [line, a],
      [r, a],
      [r, b - 11.8],
    ],
    () => y,
    lod,
    { height: 2.82, width: 0.67, ruin: true },
  );
  rampart(
    out,
    [
      [line, b],
      [r - 12.3, b],
    ],
    () => y,
    lod,
    { height: 2.82, width: 0.67, ruin: true },
  );
  const gate = edge([r - 11.9, b - 0.36], [r - 1.4, b - 0.36], -1);
  archWall(out, gate, 3, y, y + 4.2, 2.02, 0.69, -1.48, lod, 'face', color.mosque);
  block(out, 'roof', r - 11.98, y + 4.18, b - 1.88, 10.65, 0.29, 1.63, color.mosqueTrim);
}

function draw(out, lod, d, grade) {
  const main = d.outline;
  rampart(out, main, grade, lod, {
    height: d.upperWallHistoricalHeight,
    width: 3.7,
    loop: true,
    detail: true,
  });
  for (const [i, [key, points]] of Object.entries(d.lower).entries()) {
    const width = key.startsWith('kamargarh') ? 3.1 : 2.65;
    rampart(out, points, grade, lod, { height: 3.4 - 0.23 * i, width, ruin: true });
  }
  for (const i of d.turretIndices) {
    const key = i === d.southwestBastionIndex;
    bastion(out, main[i], key ? 9.25 : 6.5, key ? 9 : 5.4, grade, lod, key);
  }
  upperGate(out, d, grade, lod);
  if (lod > 1) {
    const trail = d.gatePath.slice(5);
    const edges = [-1, 1].map((side) =>
      trail.map(([x, z], i) => {
        const [dx, dz] = section(trail, i, false, 3.6);
        return [x + dx * side, z + dz * side];
      }),
    );
    for (const line of edges)
      rampart(out, line, grade, lod, { height: 0.79, width: 0.77, ruin: true });
  }
  jamaMasjid(out, d, grade, lod);
  if (!lod) return;
  for (const pond of d.ponds)
    rampart(out, pond, grade, lod, {
      height: 0.85,
      width: 0.94,
      loop: true,
      ruin: true,
      pond: true,
    });
  if (lod > 1)
    rampart(out, d.mappedSummitRemains, grade, lod, {
      height: 1.35,
      width: 1.26,
      loop: true,
      ruin: true,
    });
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Asirgarh Fort on its original Satpura ridge, with the stony upper walls, lower ruined approaches, reservoirs and the twin-minaret Jami Masjid.',
    camera: [-1620, 1070, 1245],
    lookAt: [-195, -18, 0],
    yaw: -0.74,
    sun: [-530, 780, 650],
    views: [
      {
        name: 'three-level-asirgarh-escarpment',
        position: [-1330, 630, 1035],
        lookAt: [-270, -60, 0],
      },
      {
        name: 'upper-gate-and-stepped-rampart',
        position: [-478, 10, 36],
        lookAt: [-391, -19, -51],
      },
      { name: 'jami-masjid-and-summit-rampart', position: [242, 126, -85], lookAt: [78, 2, -224] },
      { name: 'summit-reservoirs-and-walls', position: [542, 795, 412], lookAt: [45, -25, -9] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = asset;
export const model = { ...asset.model, category: 'fortification' };
