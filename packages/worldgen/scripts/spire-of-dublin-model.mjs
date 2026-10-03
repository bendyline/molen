/** Original O'Connell Street Spire reconstruction; millimetre perforations are actual holes. */
import { loft, radialRing, smoothMeshNormals } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { face, triangle } from './heritage-tower-detail-mesh.mjs';

const tau = 2 * Math.PI,
  silver = [0.92, 0.925, 0.93];
const radius = (y) => 1.5 - ((1.5 - 0.075) * y) / 120;
const point = (a, y, offset = 0) => [
  (radius(y) + offset) * Math.cos(a),
  y,
  (radius(y) + offset) * Math.sin(a),
];
const pface = (out, slot, p, color = silver) => face(out, slot, p, color);

function cone(out, y0, y1, slot, segments = 256) {
  loft(
    out,
    slot,
    [
      radialRing(y0, radius(y0), radius(y0), segments),
      radialRing(y1, radius(y1), radius(y1), segments),
    ],
    silver,
    { cap: false },
  );
}

function pattern(out) {
  // Original vector islands following the photographed horizontal geological strata.
  // These are editable reconstruction marks, not a tracing of the architect's complete stencil.
  for (let row = 0; row < 43; row++)
    for (let item = 0; item < 10; item++) {
      const code = (row * 137 + item * 53) % 101;
      if (code < 26) continue;
      const y = 0.14 + row * 0.227 + 0.075 * Math.sin(row * 1.4 + item);
      const a = tau * (item / 10 + 0.031 * Math.sin(row * 1.23 + item * 1.7));
      const width = 0.045 + 0.4 * (code / 100),
        rise = 0.012 + (0.07 * ((code * 17) % 31)) / 31;
      const center = [a, y];
      const rim = Array.from({ length: 20 }, (_, i) => {
        const t = (-tau * i) / 20,
          ripple = 1 + 0.2 * Math.sin(i * 2.2 + row) + 0.17 * Math.cos(i * 3.1 + item);
        return [a + (width * Math.cos(t) * ripple) / radius(y), y + rise * Math.sin(t) * ripple];
      });
      for (let i = 0; i < rim.length; i++) {
        const uv = [center, rim[i], rim[(i + 1) % rim.length]];
        const lo = Math.min(...uv.map((p) => p[0])),
          hi = Math.max(...uv.map((p) => p[0]));
        // Clip each convex fan triangle into narrow angular strips before bending it.
        // A single broad triangle would chord through the cone and erase its own pattern.
        const clip = (polygon, edge, sign) => {
          const result = [];
          for (let j = 0; j < polygon.length; j++) {
            const p = polygon[j],
              q = polygon[(j + 1) % polygon.length];
            if ((p[0] - edge) * sign >= 0) result.push(p);
            if ((p[0] - edge) * sign < 0 !== (q[0] - edge) * sign < 0) {
              const t = (edge - p[0]) / (q[0] - p[0]);
              result.push([edge, p[1] + t * (q[1] - p[1])]);
            }
          }
          return result;
        };
        const steps = Math.ceil((hi - lo) / 0.015);
        for (let j = 0; j < steps; j++) {
          const vertices = clip(
            clip(uv, lo + ((hi - lo) * j) / steps, 1),
            lo + ((hi - lo) * (j + 1)) / steps,
            -1,
          );
          const unique = vertices.filter(
            (p, k) =>
              k === 0 || Math.hypot(p[0] - vertices[k - 1][0], p[1] - vertices[k - 1][1]) > 1e-9,
          );
          if (
            unique.length > 2 &&
            Math.hypot(unique[0][0] - unique.at(-1)[0], unique[0][1] - unique.at(-1)[1]) < 1e-9
          )
            unique.pop();
          const ps = unique.map((p) => point(p[0], p[1], 0.0008));
          for (let k = 1; k < ps.length - 1; k++)
            triangle(out, 'polished_stainless', [ps[0], ps[k], ps[k + 1]], silver);
        }
      }
    }
}

const perforationRows = 212;
const perforationCounts = Array.from({ length: perforationRows }, (_, j) =>
  Math.round((tau * radius(108 + ((j + 0.5) * 12) / perforationRows)) / 0.0169),
);
let remaining = 11884 - perforationCounts.reduce((s, n) => s + n, 0);
for (let j = 0; remaining !== 0; j = (j + 1) % perforationRows) {
  perforationCounts[j] += Math.sign(remaining);
  remaining -= Math.sign(remaining);
}

function perforatedTip(out, onlyRow = null) {
  // 11,884 holes in 212 rows. Row counts decrease with the cone circumference.
  // Exact stagger/spacing remains a reconstruction; diameter and total follow IMOA.
  const rows = perforationRows,
    counts = perforationCounts;
  const hole = 0.0075;
  for (let row = 0; row < rows; row++) {
    if (onlyRow !== null && row !== onlyRow) continue;
    const y0 = 108 + (row * 12) / rows,
      y1 = 108 + ((row + 1) * 12) / rows,
      y = (y0 + y1) / 2,
      n = counts[row];
    for (let i = 0; i < (onlyRow === null ? n : 1); i++) {
      const a = ((i + 0.5) * tau) / n,
        half = tau / (2 * n);
      // Include all rectangle corners so adjacent cells meet without unintended gaps.
      const angle = Math.atan2((y1 - y0) / 2, half * radius(y));
      const angles = [
        ...Array.from({ length: 12 }, (_, j) => (-tau * j) / 12),
        -angle,
        -Math.PI + angle,
        -Math.PI - angle,
        -tau + angle,
        -tau,
      ].sort((a, b) => b - a);
      for (let j = 0; j < angles.length - 1; j++) {
        const ring = (k, inner) => {
          const t = angles[k],
            dx = Math.cos(t),
            dy = Math.sin(t);
          const limit = Math.min(
            (half * radius(y)) / (Math.abs(dx) || 1e-10),
            (y1 - y0) / 2 / (Math.abs(dy) || 1e-10),
          );
          const r = inner ? hole : limit;
          return [a + (dx * r) / radius(y), y + dy * r];
        };
        const b0 = ring(j, false),
          b1 = ring(j + 1, false),
          h0 = ring(j, true),
          h1 = ring(j + 1, true);
        pface(out, 'beadblasted_stainless', [
          point(...b0),
          point(...b1),
          point(...h1),
          point(...h0),
        ]);
        pface(out, 'beadblasted_stainless', [
          point(...h0),
          point(...h1),
          point(...h1, -0.01),
          point(...h0, -0.01),
        ]);
        pface(out, 'beadblasted_stainless', [
          point(...h0, -0.01),
          point(...h1, -0.01),
          point(...b1, -0.01),
          point(...b0, -0.01),
        ]);
      }
    }
  }
  if (onlyRow !== null && onlyRow >= 0) return;
  // Internal pale diffuser remains visible behind the perforations. A timed emission treatment
  // belongs to the viewer light system; this static source represents the daylight condition.
  loft(
    out,
    'glass',
    [
      radialRing(108, radius(108) - 0.025, radius(108) - 0.025, 128),
      radialRing(119.98, radius(119.98) - 0.025, radius(119.98) - 0.025, 128),
    ],
    [0.82, 0.87, 0.92],
  );
  const top = radialRing(120, 0.075, 0.075, 128);
  for (let i = 0; i < 128; i++)
    triangle(out, 'beadblasted_stainless', [[0, 120, 0], top[i], top[(i + 1) % 128]], silver);
}

function base(out) {
  // Flush black-stone surround and concentric metal grating visible in architect photographs.
  loft(
    out,
    'marble',
    [radialRing(0, 4.05, 4.05, 256), radialRing(0.035, 4.05, 4.05, 256)],
    [0.1, 0.11, 0.115],
  );
  for (let ring = 0; ring < 57; ring++) {
    const r = 1.51 + ring * 0.04;
    for (let j = 0; j < 256; j++) {
      const a = (-tau * j) / 256,
        b = (-tau * (j + 1)) / 256;
      const p = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];
      pface(
        out,
        'stainless',
        [p(r, a, 0.046), p(r, b, 0.046), p(r + 0.018, b, 0.046), p(r + 0.018, a, 0.046)].reverse(),
      );
    }
  }
  // Eight removable bollards, with joint collars and subtly crowned caps.
  for (let i = 0; i < 8; i++) {
    const a = (tau * i) / 8,
      x = 3.9 * Math.cos(a),
      z = 3.9 * Math.sin(a);
    loft(
      out,
      'stainless',
      [
        [0.035, 0.105],
        [0.88, 0.105],
        [0.92, 0.092],
        [0.935, 0.03],
      ].map(([y, r]) => radialRing(y, r, r, 64, [x, z])),
      silver,
    );
    loft(
      out,
      'stainless',
      [radialRing(0.035, 0.12, 0.12, 64, [x, z]), radialRing(0.063, 0.12, 0.12, 64, [x, z])],
      silver,
    );
  }
}

export const spireOfDublin = {
  id: 'n0975_spire_of_dublin',
  planId: 'N0975',
  title: 'Spire of Dublin',
  category: 'monument',
  wikidata: 'Q1134365',
  authoringFile: 'spire-of-dublin-model.mjs',
  build(out) {
    base(out);
    cone(out, 0.045, 10, 'beadblasted_stainless');
    cone(out, 10, 108, 'beadblasted_stainless');
    pattern(out);
    perforatedTip(out);
  },
  encodeAssembly(encode, join) {
    const parts = [
      {
        name: 'spire-shaft-pattern-and-base',
        glb: encode((out) => {
          base(out);
          cone(out, 0.045, 10, 'beadblasted_stainless');
          cone(out, 10, 108, 'beadblasted_stainless');
          pattern(out);
          perforatedTip(out, -1);
        }, 'Spire exterior'),
        instances: [{}],
      },
    ];
    for (let row = 0; row < perforationRows; row++)
      parts.push({
        name: `perforation-row-${row}`,
        glb: encode((out) => perforatedTip(out, row), `Perforation row ${row}`),
        gpuInstances: true,
        instances: Array.from({ length: perforationCounts[row] }, (_, i) => ({
          angle: (-tau * i) / perforationCounts[row],
        })),
      });
    return join(parts, 'Molen original Spire of Dublin component assembly');
  },
  decorateMesh(mesh) {
    smoothMeshNormals(mesh, ['trim'], 8);
    compactAuthoredMesh(mesh);
  },
  size: [8.1, 120, 8.1],
  front:
    '+Z is the provisional southern approach; axial form is rotationally symmetric but the base pattern is not',
  origin: 'Spire centre at street pavement datum',
  brief:
    'Tapered 120 m stainless steel monument, separate reflective geological pattern islands, 11,884 actual tip perforations with plate reveals and internal diffuser, concentric base grating, dark stone surround and eight removable bollards. Reusable polished and bead-blasted material graphs supply the metal finishes.',
  facts: {
    heightMeters: 120,
    baseDiameterMeters: 3,
    tipDiameterMeters: 0.15,
    patternHeightMeters: 10,
    perforatedHeightMeters: 12,
    holes: 11884,
    holeDiameterMeters: 0.015,
    wallThicknessMeters: [0.035, 0.02, 0.01],
    steel: 'Type 316',
    fabricatedFrusta: 8,
  },
  refs: [
    'https://www.visitdublin.com/the-spire',
    'https://aqua-design.ie/case-studies/the-spire-dublin/',
    'https://www.imoa.info/molybdenum-uses/molybdenum-grade-stainless-steels/architecture/stainless-steel-spire-graces.php',
    'https://www.publicart.ie/fileadmin/user_upload/PDF_Folder/The_Spire_of_Dublin_-_Science_and_Technology_in_Action.pdf',
    'https://www.newsteelconstruction.com/wp/making-the-dublin-spire/',
    'https://www.openstreetmap.org/way/96578181',
  ],
  scaleBasis:
    'Dublin City Council and fabricator dimensions fix the 120 m cone, 3 m base and 150 mm tip. IMOA fixes 11,884 holes of 15 mm diameter over the upper 12 m. Surround/grating/bollards are scaled from the inspected architect photograph, not a site survey.',
  geographicProposal: {
    anchor: [-6.260254122, 53.349801149],
    heading: 0,
    source: 'https://www.openstreetmap.org/way/96578181',
    orientationConfidence: 'axis-only',
    evidence:
      'Exact-QID mapped spire polygon provides the centre. Published dimensions supersede the smaller mapped footprint and mapped 121.2 m height.',
    limitations:
      'A 2.2 m mapped footprint does not match the 3 m published base. Base-pattern azimuth, pavement contact, bollard locations and current streetscape require site review.',
  },
  limits: [
    'The unique base stencil is an original stratified reconstruction. Its complete individual island shapes and azimuth require a measured or photographic unwrap before maximum-fidelity approval.',
    'Exact frustum joints, hole row layout and stagger are unresolved. Hole count and diameter are faithful; the present explicit layout is reconstructed.',
    'Current night lighting, basal lighting, maintenance door and service hardware remain unfinished. The static pale diffuser represents daylight rather than an active beacon.',
    'Ground surround and bollards follow early architect photographs and require comparison with the present streetscape. No surrounding tram tracks or buildings are baked into the model.',
  ],
  previewCamera: { position: [34, 66, 170], lookAt: [0, 60, 0], fov: 42 },
  cameras: [
    { name: 'south-elevation', position: [0, 62, 184], lookAt: [0, 60, 0] },
    { name: 'base-pattern', position: [6, 5, 11], lookAt: [0, 4.7, 0] },
    { name: 'base-grating', position: [9, 7, 9], lookAt: [0, 0.4, 0] },
    { name: 'tip-perforations', position: [0.8, 117.2, 1.5], lookAt: [0, 117.2, 0] },
    { name: 'tip-profile', position: [6, 114, 17], lookAt: [0, 114, 0] },
    { name: 'street-upward', position: [7, 1.7, 12], lookAt: [0, 28, 0] },
    { name: 'far-spire', position: [110, 75, 260], lookAt: [0, 60, 0] },
  ],
};
