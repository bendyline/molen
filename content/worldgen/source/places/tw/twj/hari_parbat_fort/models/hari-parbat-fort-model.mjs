import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  foundation: surface('foundation', 'stone', 0.92),
  walls: surface('wall', 'stone', 0.89),
  ashlar: surface('trim', 'stone_ashlar', 0.84),
  crown: surface('roof', 'stone_limestone_raw', 0.89),
};
const C = palette({
  masonry: 'a58b70',
  light: 'aa977d',
  ochre: 'ae9172',
  base: '8f7d66',
  inner: '9f8e77',
  joint: '8b7866',
  cap: 'baa287',
  faint: 'a58d73',
});
const roundedBastions = [
  { start: 10, end: 21, add: 9.1 },
  { start: 25, end: 43, add: 12.1 },
  { start: 46, end: 62, add: 10.1 },
  { start: 66, end: 72, add: 8.5 },
  { start: 83, end: 94, add: 9.9 },
];

function wallCrown(outline, grade, rise) {
  const grades = outline.map(grade);
  const crowns = grades.map((y, i) => {
    const a = grades[(i + grades.length - 1) % grades.length];
    const b = grades[(i + 1) % grades.length];
    return Math.max(y + rise * 0.66, 0.18 * a + 0.64 * y + 0.18 * b + rise);
  });
  for (const { start, end, add } of roundedBastions) {
    const sample = grades.slice(start, end + 1);
    const average = sample.reduce((sum, y) => sum + y, 0) / sample.length;
    const y = Math.max(average + add, Math.max(...sample) + 4.75);
    for (let i = start; i <= end; i++) crowns[i] = y;
  }
  return crowns;
}

function inset(outline, winding, width) {
  return outline.map((p, i) => {
    const left = edge(outline[(i + outline.length - 1) % outline.length], p, winding).normal;
    const right = edge(p, outline[(i + 1) % outline.length], winding).normal;
    const dx = left[0] + right[0],
      dz = left[2] + right[2];
    const k = width / Math.max(1.04, 1 + left[0] * right[0] + left[2] * right[2]);
    return [p[0] - dx * k, p[1] - dz * k];
  });
}

function wallSegment(out, side, outer, inner, floor, crown, lod, index, rampart) {
  const [a, b] = outer,
    [ia, ib] = inner,
    [y0, y1] = floor,
    [h0, h1] = crown;
  const band = lod === 0 ? 0.5 : 0.72;
  face(
    out,
    'foundation',
    [at(a, y0), at(b, y1), at(b, mix(y1, h1, 0.28)), at(a, mix(y0, h0, 0.28))],
    side.normal,
    C.base,
  );
  face(
    out,
    'walls',
    [at(a, mix(y0, h0, 0.28)), at(b, mix(y1, h1, 0.28)), at(b, h1 - band), at(a, h0 - band)],
    side.normal,
    rampart ? C.ochre : index % 5 === 0 ? C.light : C.masonry,
  );
  face(
    out,
    'ashlar',
    [at(a, h0 - band), at(b, h1 - band), at(b, h1), at(a, h0)],
    side.normal,
    C.cap,
  );
  const reverse = side.normal.map((k) => -k);
  face(out, 'walls', [at(ia, y0), at(ib, y1), at(ib, h1), at(ia, h0)], reverse, C.inner);
  face(out, 'crown', [at(a, h0), at(b, h1), at(ib, h1), at(ia, h0)], up, C.cap);
  if (lod < 2 || side.length < 3.7) return;
  const N = lod === 3 ? 3 : 1;
  for (let i = 0; i < N; i++) {
    const f = 0.42 + (i + 1) * 0.12;
    const y = mix(y0, h0, f);
    const h = mix(y1, h1, f);
    face(
      out,
      'walls',
      [
        side.p(0, y, 0.031),
        side.p(side.length, h, 0.031),
        side.p(side.length, h + 0.095, 0.031),
        side.p(0, y + 0.095, 0.031),
      ],
      side.normal,
      C.faint,
    );
  }
  if (lod === 3 && side.length > 11.5) {
    const n = Math.floor(side.length / 4.7);
    for (let i = 1; i < n; i++) {
      const u = (i * side.length) / n;
      const y = mix(y0, y1, i / n);
      const h = mix(h0, h1, i / n);
      if (i % 2 === 0) {
        panel(
          out,
          'walls',
          side,
          u - 0.046,
          u + 0.046,
          mix(y, h, 0.56),
          mix(y, h, 0.72),
          0.032,
          C.faint,
        );
      }
    }
  }
}

function draw(out, lod, controls, grade) {
  const { outline, nominalCurtainWidth, nominalCurtainHeight } = controls;
  const heights = wallCrown(outline, grade, nominalCurtainHeight);
  const selected = outline
    .map((_, i) => i)
    .filter(
      (i) =>
        lod > 0 ||
        !roundedBastions.some(({ start, end }) => i > start && i < end && (i - start) % 3 !== 0),
    );
  const exposed = selected.map((i) => outline[i]);
  const winding = areaSign(exposed);
  const inner = inset(exposed, winding, nominalCurtainWidth);
  const points = [...exposed, exposed[0]];
  for (const [i, [a, b]] of pairs(points).entries()) {
    const j = (i + 1) % exposed.length;
    const region = selected[i];
    const rampart = roundedBastions.some(({ start, end }) => region >= start && region < end);
    const w = edge(a, b, winding);
    const resolution = [17, 10, 7, 5][lod];
    const count = Math.ceil(w.length / resolution);
    const innerSegment = (t) => mixPoint(inner[i], inner[j], t);
    const outerSegment = (t) => mixPoint(a, b, t);
    for (let k = 0; k < count; k++) {
      const t = [k / count, (k + 1) / count];
      const outerWall = t.map(outerSegment);
      const innerWall = t.map(innerSegment);
      const basement = t.map(
        (v) => Math.min(grade(outerSegment(v)), grade(innerSegment(v))) - 0.58,
      );
      const crown = t.map((v) =>
        Math.max(
          mix(heights[region], heights[selected[j]], v),
          grade(outerSegment(v)) + 2.45,
          grade(innerSegment(v)) + 1.58,
        ),
      );
      wallSegment(
        out,
        edge(...outerWall, winding),
        outerWall,
        innerWall,
        basement,
        crown,
        lod,
        i,
        rampart,
      );
    }
    if (lod < 2 || !rampart || w.length < 1.25) continue;
    const crownY = heights[region];
    const offset = w.length * 0.25;
    trimBlock(
      out,
      'ashlar',
      w,
      offset,
      w.length - offset,
      crownY - 0.07,
      crownY + (lod === 3 ? 0.38 : 0.29),
      -0.39,
      0.014,
      C.cap,
    );
  }
}

function mixPoint(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t)];
}

const fort = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [227, 101, 147],
    lookAt: [-16, -5, 6],
    sun: [450, 570, 225],
    yaw: 0.97,
    brief:
      'The historic stone fortress along the summit of Hari Parbat, with terraced curtain walls and rounded bastions in their mapped positions.',
    views: [
      {
        name: 'dal-lake-side-curtain-and-turrets',
        position: [196, 32, 29],
        lookAt: [-25, -3, -4],
      },
      {
        name: 'hilltop-perimeter-and-open-interior',
        position: [32, 150, 43],
        lookAt: [-18, -5, 5],
      },
      {
        name: 'rounded-north-bastion-on-original-slope',
        position: [66, 17, -167],
        lookAt: [27, -4, -101],
      },
      {
        name: 'south-bastion-and-stepped-curtain',
        position: [-104, 18, 167],
        lookAt: [-50, -4, 98],
      },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = fort;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...fort.model,
  category: 'fortification',
  embeddedCanonicalGraphs: fort.model.embeddedCanonicalGraphs.filter(Boolean),
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.91,
    basis:
      'The mapped summit fort replaces the procedural building so the actual rampart silhouette and open hilltop remain visible.',
  },
};
