import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  pairs,
  palette,
  panel,
  planarMid,
  shell,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  churchModel,
  crossAt,
  halfway,
  plinth,
} from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const c = palette({
  plaster: 'e5ddca',
  band: 'ece2cb',
  stone: 'ada493',
  brick: 'b77958',
  roof: 'ad664f',
  cap: '9e5d47',
  iron: '475044',
});

function innerWall([a, b], against) {
  const w = edge(a, b);
  const mid = halfway([a, b]),
    out = halfway(against);
  return w.normal[0] * (mid[0] - out[0]) + w.normal[2] * (mid[1] - out[1]) > 0 ? w : edge(a, b, -1);
}

function pier(out, w, low, high, bottom, top, width, color) {
  const q = (u, y, d) => w.p(u, y, d);
  const corners = [
    q(low, bottom, 0),
    q(high, bottom, 0),
    q(high, bottom, -width),
    q(low, bottom, -width),
  ];
  const tops = [q(low, top, 0), q(high, top, 0), q(high, top, -width), q(low, top, -width)];
  const toward = [w.normal[2], 0, -w.normal[0]];
  for (const [i, n] of [
    [0, w.normal],
    [1, toward],
    [2, w.normal.map((v) => -v)],
    [3, toward.map((v) => -v)],
  ]) {
    const j = (i + 1) % 4;
    face(out, 'plaster', [corners[i], corners[j], tops[j], tops[i]], n, color);
  }
}

function bays(out, lod, w, count, floor, eave) {
  const step = w.length / count,
    spring = floor + 1.87,
    rise = 1.02;
  const width = step * 0.7,
    offsets = [4, 6, 8, 12][lod];
  const u0 = (i) => i * step;
  for (let i = 0; i < count; i++) {
    const mid = u0(i) + step / 2;
    const first = mid - width / 2;
    const end = mid + width / 2;
    if (lod > 0) pier(out, w, u0(i), first, floor, eave, 0.48, c.plaster);
    else panel(out, 'plaster', w, u0(i), first, floor, eave, 0, c.plaster);
    const q = (j) => {
      const t = (j * Math.PI) / offsets;
      return [mid - (Math.cos(t) * width) / 2, spring + Math.sin(t) * rise];
    };
    for (let j = 0; j < offsets; j++) {
      const [a, y] = q(j),
        [b, z] = q(j + 1);
      face(out, 'plaster', [w.p(a, y), w.p(b, z), w.p(b, eave), w.p(a, eave)], w.normal, c.plaster);
      if (lod > 0) {
        const inner = w.normal.map((v, k) => (k === 1 ? -1 : v * 0.15));
        face(
          out,
          'plaster',
          [w.p(a, y), w.p(a, y, -0.48), w.p(b, z, -0.48), w.p(b, z)],
          inner,
          c.plaster,
        );
        if (lod > 1)
          face(
            out,
            'plaster',
            [w.p(a, y, 0.05), w.p(b, z, 0.05), w.p(b, z + 0.125, 0.05), w.p(a, y + 0.125, 0.05)],
            w.normal,
            c.band,
          );
      }
    }
    if (lod > 0) pier(out, w, end, u0(i + 1), floor, eave, 0.48, c.plaster);
    else panel(out, 'plaster', w, end, u0(i + 1), floor, eave, 0, c.plaster);
  }
  if (lod > 0) panel(out, 'plaster', w, 0, w.length, eave - 0.28, eave, 0.075, c.band);
}

function westGate(out, lod, w, floor, eave) {
  const u = w.length * 0.49;
  const radius = 1.28,
    spring = floor + 2.32,
    top = eave + 1.34;
  for (const [a, b] of [
    [u - 2.21, u - radius],
    [u + radius, u + 2.21],
  ])
    panel(out, 'plaster', w, a, b, floor + 0.03, eave + 0.23, 0.055, c.plaster);
  for (let i = 0; i < 6; i++) {
    const q = (j) => {
      const t = (j * Math.PI) / 6;
      return [u - Math.cos(t) * radius, spring + Math.sin(t) * 0.9];
    };
    const [a, y] = q(i),
      [b, z] = q(i + 1);
    face(
      out,
      'plaster',
      [w.p(a, y, 0.057), w.p(b, z, 0.057), w.p(b, eave + 0.23, 0.057), w.p(a, eave + 0.23, 0.057)],
      w.normal,
      c.plaster,
    );
  }
  face(
    out,
    'plaster',
    [w.p(u - 2.24, eave + 0.16, 0.075), w.p(u + 2.24, eave + 0.16, 0.075), w.p(u, top, 0.075)],
    w.normal,
    c.plaster,
  );
  panel(out, 'plaster', w, u - 2.24, u + 2.24, eave, eave + 0.21, 0.11, c.band);
  if (lod > 1)
    for (const x of [u - 1.95, u + 1.6])
      panel(out, 'plaster', w, x, x + 0.36, floor + 0.28, eave - 0.14, 0.17, c.band);
  crossAt(out, w.p(u, top - 0.05, 0.17), 0.76, 0.53, c.iron);
}

function run(out, lod, run, floor, eave, rise) {
  const { inner, outer } = run;
  const [a, b] = inner,
    [c0, d] = outer;
  const m = halfway([a, c0]),
    n = halfway([b, d]);
  const w = innerWall(inner, outer);
  const outside = innerWall(outer, inner);
  face(
    out,
    'tile',
    [at(a, eave), at(b, eave), at(n, eave + rise), at(m, eave + rise)],
    [0, 1, 0],
    c.roof,
  );
  face(
    out,
    'tile',
    [at(m, eave + rise), at(n, eave + rise), at(d, eave), at(c0, eave)],
    [0, 1, 0],
    c.roof,
  );
  for (const triplet of [
    [a, c0, m],
    [d, b, n],
  ])
    face(
      out,
      'brick',
      [at(triplet[0], eave), at(triplet[1], eave), at(triplet[2], eave + rise)],
      w.normal,
      c.brick,
    );
  const lo = floor - 0.26;
  const western = run.name === 'west';
  const gate = outside.length * 0.49;
  const ranges = western
    ? [
        [0, gate - 1.28],
        [gate + 1.28, outside.length],
      ]
    : [[0, outside.length]];
  const inside = {
    normal: outside.normal.map((value) => -value),
    p: (u, y, d = 0) => outside.p(u, y, -d),
  };
  for (const [left, right] of ranges) {
    panel(out, 'brick', outside, left, right, lo, eave, 0, c.brick);
    panel(out, 'plaster', inside, left, right, lo, eave, 0.24, c.plaster);
  }
  if (western) westGate(out, lod, outside, floor, eave);
  if (lod > 0) panel(out, 'plaster', outside, 0, outside.length, eave - 0.24, eave, 0.08, c.band);
  bays(out, lod, w, run.bays, floor, eave);
  cap(out, 'stone', [a, b, d, c0], floor + 0.012, c.stone);
}

function cornerChapel(out, lod, outline, floor, eave, grade) {
  plinth(out, outline, floor, grade, c.stone);
  shell(out, outline, () => floor, eave, { wall: 'plaster', color: c.plaster });
  const center = planarMid(outline);
  for (const [a, b] of pairs(closed(outline))) {
    face(out, 'tile', [at(a, eave), at(b, eave), at(center, eave + 2.68)], [0, 1, 0], c.cap);
    if (lod > 1) {
      const wall = edge(a, b, areaSign(outline));
      panel(out, 'plaster', wall, 0, wall.length, eave - 0.19, eave, 0.045, c.band);
    }
  }
  crossAt(out, at(center, eave + 2.66), 0.6, 0.42, c.iron);
}

function draw(out, lod, { runs, chapelettes, floor, wallHeight, roofRise }, grade) {
  const eave = floor + wallHeight;
  for (const r of runs) run(out, lod, r, floor, eave, roofRise);
  for (const outline of chapelettes) cornerChapel(out, lod, outline, floor, eave, grade);
}

const asset = churchModel(
  import.meta.url,
  {
    slots: ['plaster', 'brick', 'stone', 'tile', 'metal'],
    scale: 0.82,
    yaw: -0.68,
    camera: [-83, 64, 73],
    lookAt: [0, 1.6, 0],
    sun: [-360, 465, 280],
    brief:
      'Four runs of pale inward-facing Baroque arches enclose the Tytuvėnai churchyard. Red clay tile roofs, the west portal and polygonal corner chapels carry the exterior silhouette.',
    views: [
      { name: 'tile-roofed-gallery-around-the-court', position: [29, 75, 34], lookAt: [0, 2, 0] },
      { name: 'open-arches-and-recessed-paving', position: [-3, 5, -3], lookAt: [-13, 2, -26] },
      { name: 'west-portal-and-corner-chapel', position: [-55, 8, 32], lookAt: [-27, 2.8, 11] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;
