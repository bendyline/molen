import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [33.635197691647626, 13.547626120624546],
  heading: -3.0054182806199643,
  datum: 423.544849,
  crestElevation: 425.4,
  foundationElevation: 399.4,
  normalPool: 421.7,
  masonry: {
    span: [-300, 300],
    groups: 8,
    deepCount: 80,
    upperCount: 72,
    deepSill: 405.2,
    upperSill: 413.8,
  },
  rail: {
    featureId: 35185695478689,
    span: [-645.568278, 1133.448541],
  },
  embankment: [-1260, 1750],
  intakes: [
    {
      x: 914.649802,
      z: -34.668136,
      width: 62,
      bays: 4,
    },
    {
      x: 1076.289105,
      z: 4.473382,
      width: 69,
      bays: 4,
    },
  ],
};
const materials = {
  ashlar: { slot: 'wall', graph: 'stone_sandstone', rgb: [0.46, 0.315, 0.223] },
  darkStone: { slot: 'wall', graph: 'stone_sandstone', rgb: [0.36, 0.275, 0.202] },
  slope: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.5, 0.39, 0.28] },
  cap: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.53, 0.45, 0.36] },
  earth: { slot: 'foundation', graph: 'gravel', rgb: [0.36, 0.3, 0.22] },
  rail: { slot: 'trim', graph: 'metal_painted', rgb: [0.19, 0.172, 0.154] },
  gate: { slot: 'door', graph: 'metal_painted', rgb: [0.097, 0.111, 0.102] },
  crane: { slot: 'trim', graph: 'metal_painted', rgb: [0.38, 0.275, 0.18] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(materials).map(([k, { slot, graph }]) => [k, { slot, graph }]),
);
const { datum, crestElevation, foundationElevation, masonry, rail, embankment, intakes } = controls;
const [start, end] = masonry.span;
const y = (h) => h - datum,
  p = (x, h, z) => [x, y(h), z];
const levels = {
  skyline: { segments: 2, profile: false },
  district: { segments: 2, profile: true },
  street: { segments: 6, profile: true, rails: true },
  closeup: { segments: 10, profile: true, rails: true, sleepers: 2.8 },
  master: { segments: 12, profile: true, rails: true, sleepers: 1.3, details: true },
};
function face(out, m, ps, expected) {
  let n = normalFor(...ps);
  if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    ps = ps.toReversed();
    n = normalFor(...ps);
  }
  const add = ps.length === 3 ? out.addTriangle : out.addQuad;
  add.call(out, m, 'palette:#ffffff', ps, n, undefined, materials[m].rgb);
}
const q = (out, m, a, b, c, d, n) => face(out, m, [a, b, c, d], n);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, materials[m].rgb);
const lip = 413.8;
const front = (x, h, offset = 0) =>
  p(x, h, (h >= lip ? 5.3 : 5.3 + ((lip - h) / (lip - foundationElevation)) * 20.2) + offset);
function box(out, m, a, b, h, k, u, v) {
  q(out, m, p(a, h, u), p(b, h, u), p(b, k, u), p(a, k, u), [0, 0, -1]);
  q(out, m, p(a, h, v), p(b, h, v), p(b, k, v), p(a, k, v), [0, 0, 1]);
  q(out, m, p(a, h, u), p(a, h, v), p(a, k, v), p(a, k, u), [-1, 0, 0]);
  q(out, m, p(b, h, u), p(b, h, v), p(b, k, v), p(b, k, u), [1, 0, 0]);
  q(out, m, p(a, k, u), p(b, k, u), p(b, k, v), p(a, k, v), [0, 1, 0]);
  q(out, m, p(a, h, u), p(b, h, u), p(b, h, v), p(a, h, v), [0, -1, 0]);
}
function panel(out, m, a, b, h, k) {
  if (h < k) q(out, m, front(a, h), front(b, h), front(b, k), front(a, k), [0, 0, 1]);
}
function mouth(out, d, a, b, cap, sill, width, height, m) {
  const x = (a + b) / 2,
    l = x - width / 2,
    r = x + width / 2,
    shoulder = sill + height - width * 0.28;
  const head = Array.from({ length: d.segments + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / d.segments);
    return [x + (Math.cos(a) * width) / 2, shoulder + Math.sin(a) * width * 0.28];
  });
  const ring = [[l, sill], [r, sill], ...head.toReversed()];
  const depth = d.profile ? -2.8 : -0.08;
  if (!d.profile) {
    for (let i = 1; i < ring.length - 1; i++)
      face(
        out,
        'gate',
        [front(...ring[0], 0.055), front(...ring[i], 0.055), front(...ring[i + 1], 0.055)],
        [0, 0, 1],
      );
    return;
  }
  panel(out, m, a, l, sill, cap);
  panel(out, m, r, b, sill, cap);
  for (let i = 1; i < head.length; i++) {
    const [u, h] = head[i - 1],
      [v, k] = head[i];
    q(out, m, front(u, h), front(v, k), front(v, cap), front(u, cap), [0, 0, 1]);
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    q(out, 'darkStone', front(...a), front(...b), front(...b, depth), front(...a, depth), [
      -dy,
      dx,
      0,
    ]);
  }
  for (let i = 1; i < ring.length - 1; i++)
    face(
      out,
      'gate',
      [front(...ring[0], depth), front(...ring[i], depth), front(...ring[i + 1], depth)],
      [0, 0, 1],
    );
}
function masonryWall(out, d) {
  const step = (end - start) / masonry.deepCount,
    baysPerGroup = masonry.deepCount / masonry.groups;
  if (d.profile) {
    panel(out, 'slope', start, end, foundationElevation, masonry.deepSill);
    panel(out, 'ashlar', start, end, lip, masonry.upperSill + 0.08);
  } else {
    panel(out, 'slope', start, end, foundationElevation, lip);
    panel(out, 'ashlar', start, end, lip, crestElevation);
  }
  for (let i = 0; i < masonry.deepCount; i++) {
    const a = start + i * step,
      b = a + step;
    mouth(out, d, a, b, lip, masonry.deepSill, 2.65, 7.35, 'slope');
    if (i % baysPerGroup !== baysPerGroup - 1)
      mouth(out, d, a, b, crestElevation, masonry.upperSill + 0.08, 4.7, 5.5, 'ashlar');
    else if (d.profile) panel(out, 'darkStone', a, b, masonry.upperSill + 0.08, crestElevation);
    if (d.profile && i % baysPerGroup === baysPerGroup - 1) {
      q(
        out,
        'darkStone',
        front(b - 0.42, foundationElevation, 0.055),
        front(b - 0.04, foundationElevation, 0.055),
        front(b - 0.04, lip, 0.055),
        front(b - 0.42, lip, 0.055),
        [0, 0, 1],
      );
    }
  }
  q(
    out,
    'darkStone',
    p(start, foundationElevation, -9),
    p(end, foundationElevation, -9),
    p(end, crestElevation, -5.4),
    p(start, crestElevation, -5.4),
    [0, 0, -1],
  );
  q(
    out,
    'cap',
    p(start, crestElevation, -5.4),
    p(end, crestElevation, -5.4),
    front(end, crestElevation),
    front(start, crestElevation),
    [0, 1, 0],
  );
  for (const [x, s] of [
    [start, -1],
    [end, 1],
  ])
    q(
      out,
      'ashlar',
      p(x, foundationElevation, -9),
      front(x, foundationElevation),
      front(x, crestElevation),
      p(x, crestElevation, -5.4),
      [s, 0, 0],
    );
  q(
    out,
    'darkStone',
    p(start, foundationElevation, -9),
    p(end, foundationElevation, -9),
    front(end, foundationElevation),
    front(start, foundationElevation),
    [0, -1, 0],
  );
}
function fill(out, a, b, crestA, crestB, toeA, toeB) {
  q(
    out,
    'earth',
    p(a, toeA, -26),
    p(b, toeB, -26),
    p(b, crestB, -4.9),
    p(a, crestA, -4.9),
    [0, 1, -1],
  );
  q(out, 'earth', p(a, toeA, 26), p(b, toeB, 26), p(b, crestB, 4.9), p(a, crestA, 4.9), [0, 1, 1]);
  q(
    out,
    'cap',
    p(a, crestA, -4.9),
    p(b, crestB, -4.9),
    p(b, crestB, 4.9),
    p(a, crestA, 4.9),
    [0, 1, 0],
  );
}
function embankments(out) {
  fill(out, embankment[0], rail.span[0], 421.7, crestElevation, 412, 412.9);
  fill(out, rail.span[0], start, crestElevation, crestElevation, 412.9, 410.5);
  let a = end;
  for (const { x, width } of intakes) {
    const b = x - width / 2;
    fill(out, a, b, crestElevation, crestElevation, 409.5, 411.4);
    a = x + width / 2;
  }
  fill(out, a, rail.span[1], crestElevation, crestElevation, 411.8, 412.8);
  fill(out, rail.span[1], embankment[1], crestElevation, 423, 412.8, 418.5);
}
function canalWorks(out, d) {
  for (const { x, width, bays } of intakes) {
    const a = x - width / 2,
      b = x + width / 2,
      step = width / bays;
    box(out, 'ashlar', a, b, 423.3, crestElevation, -6.2, 5.8);
    for (let i = 0; i <= bays; i++) {
      const u = a + step * i;
      box(out, 'ashlar', u - 1.08, u + 1.08, 405, 423.45, -12, 17.5);
      if (i === bays) continue;
      const mid = u + step / 2;
      box(out, 'gate', u + 1.09, u + step - 1.09, 412, 420.1, -8, -7.55);
      if (d.rails) rod(out, 'crane', p(mid, 418.5, -7.4), p(mid, 424.4, -7.4), 0.2, 0.23);
    }
    for (const [u, v] of [
      [a - 4, a],
      [b, b + 4],
    ])
      box(out, 'darkStone', u, v, 407.2, 424.5, -18, 19);
  }
}
function deck(out, d) {
  const [a, b] = rail.span;
  const loft = (x, z, h) => p(x, crestElevation + h, z);
  for (const z of [-4.65, 4.65]) rod(out, 'cap', loft(a, z, 0.26), loft(b, z, 0.26), 0.25, 0.52);
  if (d.rails) {
    for (const z of [-0.72, 0.72])
      rod(out, 'rail', loft(a, z, 0.22), loft(b, z, 0.22), 0.096, 0.15);
    if (d.sleepers)
      for (let x = start + 0.64; x < end; x += d.sleepers)
        rod(out, 'rail', loft(x, -1.35, 0.09), loft(x, 1.35, 0.09), 0.19, 0.14);
  }
}
function gantry(out, d) {
  const x = -148,
    h = crestElevation,
    z = 0.45;
  box(out, 'crane', x - 5.3, x + 5.3, h + 6, h + 6.55, z - 3.3, z + 3.3);
  for (const a of [x - 4.2, x + 4.2])
    for (const b of [z - 2.48, z + 2.48])
      rod(out, 'crane', p(a, h + 0.3, b), p(a, h + 6, b), 0.39, 0.42);
  for (const b of [z - 2.48, z + 2.48])
    for (const s of [-1, 1])
      rod(out, 'crane', p(x + s * 4.2, h + 0.55, b), p(x - s * 4.2, h + 5.8, b), 0.21, 0.18);
  box(out, 'cap', x + 1.45, x + 4.65, h + 6.55, h + 9.5, z - 1.4, z + 1.65);
  if (d.profile) {
    for (const t of [-0.45, 0.45])
      rod(out, 'rail', p(x + t, h + 6.5, z + 0.7), p(x + t, h + 11.6, z + 4.2), 0.16, 0.23);
    rod(out, 'rail', p(x - 0.45, h + 11.6, z + 4.2), p(x + 0.45, h + 11.6, z + 4.2), 0.18, 0.18);
  }
  if (d.details) {
    for (const a of [x - 4.2, x + 4.2])
      for (const b of [z - 2.48, z + 2.48])
        box(out, 'rail', a - 0.65, a + 0.65, h + 0.1, h + 0.55, b - 0.37, b + 0.37);
    rod(out, 'rail', p(x, h + 11.6, z + 4.2), p(x, h + 7.1, z + 4.2), 0.025, 0.034);
  }
}
export function buildDamLevel(out, level) {
  const d = levels[level];
  if (!d) throw Error('Unknown Sennar Dam detail level: ' + level);
  masonryWall(out, d);
  embankments(out);
  canalWorks(out, d);
  deck(out, d);
  gantry(out, d);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
