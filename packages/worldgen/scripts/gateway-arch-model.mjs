/** Gateway Arch: NPS centroid equation, triangular shell, explicit window apertures and welds. */
import { normalFor, smoothMeshNormals } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { face, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const ft = 0.3048;
const A = 68.7672 * ft,
  C = 3.0022,
  L = 299.2239 * ft,
  H = 625.0925 * ft;
const silver = [0.91, 0.915, 0.92],
  seam = [0.73, 0.75, 0.77];
const windows = Array.from({ length: 16 }, (_, i) => (i - 7.5) * 1.16);
const windowHalfWidth = 0.6858 / 2,
  windowU = 0.57,
  windowHalfU = 0.1778 / (2 * 17 * ft);

export function gatewaySection(x) {
  const k = C / L,
    cosh = Math.cosh(k * x);
  const y = H - A * (cosh - 1),
    slope = -A * k * Math.sinh(k * x);
  const n = [-slope / Math.hypot(slope, 1), 1 / Math.hypot(slope, 1)];
  // Section area follows the same cosh weighting; crown and foot side lengths are 17/54 ft.
  const side = 17 * ft * Math.sqrt(cosh),
    d = side / (2 * Math.sqrt(3));
  const p = (radial, z) => [x + n[0] * radial, y + n[1] * radial, z];
  return { center: [x, y, 0], side, corners: [p(d, side / 2), p(-2 * d, 0), p(d, -side / 2)] };
}

function point(x, edge, u, depth = 0) {
  const section = gatewaySection(x),
    a = section.corners[edge],
    b = section.corners[(edge + 1) % 3];
  const p = a.map((v, i) => v + (b[i] - v) * u);
  if (depth) {
    const next = gatewaySection(x + 0.001),
      q = next.corners[edge];
    let n = normalFor(a, b, q);
    if (n.reduce((sum, v, i) => sum + v * (p[i] - section.center[i]), 0) < 0) n = n.map((v) => -v);
    return p.map((v, i) => v + n[i] * depth);
  }
  return p;
}

function clipped(points) {
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (a[1] >= 0) output.push(a);
    if (a[1] < 0 !== b[1] < 0) {
      const t = -a[1] / (b[1] - a[1]);
      output.push([a[0] + t * (b[0] - a[0]), 0, a[2] + t * (b[2] - a[2])]);
    }
  }
  return output;
}

function patch(out, slot, x0, x1, edge, u0, u1, color, depth = 0) {
  const p = clipped([
    point(x0, edge, u0, depth),
    point(x1, edge, u0, depth),
    point(x1, edge, u1, depth),
    point(x0, edge, u1, depth),
  ]);
  if (p.length < 3) return;
  const center = gatewaySection((x0 + x1) / 2).center;
  const n = normalFor(...p),
    mid = p[0].map((_, i) => p.reduce((s, q) => s + q[i], 0) / p.length);
  if (n.reduce((s, v, i) => s + v * (mid[i] - center[i]), 0) < 0) p.reverse();
  for (let i = 1; i < p.length - 1; i++) triangle(out, slot, [p[0], p[i], p[i + 1]], color);
}

function shell(out) {
  const extent = L + 0.18;
  const samples = [
    ...Array.from({ length: 1025 }, (_, i) => -extent + (2 * extent * i) / 1024),
    0,
    ...windows.flatMap((x) => [x - windowHalfWidth, x + windowHalfWidth]),
  ].sort((a, b) => a - b);
  const xs = samples.filter((x, i) => !i || x - samples[i - 1] > 1e-8);
  for (let edge = 0; edge < 3; edge++) {
    const uc = edge === 0 ? windowU : 1 - windowU;
    const us =
      edge === 2
        ? [0, 1 / 3, 2 / 3, 1]
        : [0, 1 / 3, uc - windowHalfU, uc + windowHalfU, 2 / 3, 1].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < us.length - 1; j++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          u = (us[j] + us[j + 1]) / 2;
        const opening =
          edge < 2 &&
          Math.abs(u - uc) < windowHalfU &&
          windows.some((c) => Math.abs(x - c) < windowHalfWidth);
        if (!opening) patch(out, 'stainless', xs[i], xs[i + 1], edge, us[j], us[j + 1], silver);
      }
  }
  // Glazed apertures have a true opening, four reveal faces and a recessed glass plane.
  for (const x of windows)
    for (const edge of [0, 1]) {
      const uc = edge === 0 ? windowU : 1 - windowU;
      const x0 = x - windowHalfWidth,
        x1 = x + windowHalfWidth,
        u0 = uc - windowHalfU,
        u1 = uc + windowHalfU;
      const coords = [
        [x0, u0],
        [x1, u0],
        [x1, u1],
        [x0, u1],
      ];
      for (let i = 0; i < 4; i++) {
        const a = coords[i],
          b = coords[(i + 1) % 4];
        const ps = [
          point(a[0], edge, a[1]),
          point(b[0], edge, b[1]),
          point(b[0], edge, b[1], -0.07),
          point(a[0], edge, a[1], -0.07),
        ];
        face(out, 'stainless', ps, silver);
        face(out, 'stainless', [...ps].reverse(), silver);
      }
      patch(out, 'glass', x0, x1, edge, u0, u1, [0.1, 0.15, 0.2], -0.065);
      patch(out, 'stainless', x0 - 0.016, x1 + 0.016, edge, u0 - 0.003, u0, silver, 0.003);
      patch(out, 'stainless', x0 - 0.016, x1 + 0.016, edge, u1, u1 + 0.003, silver, 0.003);
      patch(out, 'stainless', x0 - 0.016, x0, edge, u0, u1, silver, 0.003);
      patch(out, 'stainless', x1, x1 + 0.016, edge, u0, u1, silver, 0.003);
    }
  // Longitudinal shop joints: three plates across each face. Field station spacing is provisional.
  for (let edge = 0; edge < 3; edge++)
    for (const u of [1 / 3, 2 / 3])
      for (let i = 0; i < 1024; i++) {
        const x0 = -extent + (2 * extent * i) / 1024,
          x1 = -extent + (2 * extent * (i + 1)) / 1024;
        const half = 0.0025 / gatewaySection((x0 + x1) / 2).side;
        patch(out, 'stainless', x0, x1, edge, u - half, u + half, seam, 0.0015);
      }
  // Integrate arc length to place the 71 station lines on each half without distorted x spacing.
  const arc = [{ x: 0, s: 0 }];
  for (let i = 1; i <= 4096; i++) {
    const x = (extent * i) / 4096,
      a = gatewaySection(arc.at(-1).x).center,
      b = gatewaySection(x).center;
    arc.push({ x, s: arc.at(-1).s + Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  const total = arc.at(-1).s;
  for (let station = 1; station <= 71; station++) {
    const t = station / 71,
      target = total * (0.74 * t + 0.26 * t * t);
    const k = arc.findIndex((v) => v.s >= target),
      a = arc[Math.max(0, k - 1)],
      b = arc[Math.max(1, k)];
    const x = a.x + ((b.x - a.x) * (target - a.s)) / (b.s - a.s);
    for (const sign of [-1, 1])
      for (let edge = 0; edge < 3; edge++) {
        const half = 0.003 / Math.hypot(1, ((-A * C) / L) * Math.sinh((C * x) / L));
        for (let j = 0; j < 12; j++)
          patch(
            out,
            'stainless',
            sign * x - half,
            sign * x + half,
            edge,
            j / 12,
            (j + 1) / 12,
            seam,
            0.002,
          );
      }
  }
  // Closed level contact triangles; no underground visitor centre or outdated entrances are embedded.
  for (const sign of [-1, 1]) {
    const base = [];
    for (let corner = 0; corner < 3; corner++) {
      let lo = L - 1,
        hi = L + 1;
      for (let i = 0; i < 48; i++) {
        const x = (lo + hi) / 2;
        if (gatewaySection(x).corners[corner][1] > 0) lo = x;
        else hi = x;
      }
      const p = gatewaySection((sign * (lo + hi)) / 2).corners[corner];
      base.push([p[0], 0, p[2]]);
    }
    if (normalFor(...base)[1] > 0) base.reverse();
    triangle(out, 'stainless', base, silver);
  }
  // Low service hatch at the extrados crown, approximated from the HSR roof photographs.
  box(out, 'stainless', [-0.6, 191.986, -0.46], [0.6, 192.015, 0.46], silver);
  box(out, 'shadow', [-0.55, 192.016, -0.4], [0.55, 192.02, 0.4], [0.19, 0.21, 0.22]);
}

export const gatewayArch = {
  id: 'n0963_gateway_arch',
  planId: 'N0963',
  title: 'Gateway Arch',
  category: 'monument',
  wikidata: 'Q2027162',
  authoringFile: 'gateway-arch-model.mjs',
  build: shell,
  decorateMesh(mesh) {
    smoothMeshNormals(mesh, ['trim'], 12);
    compactAuthoredMesh(mesh);
  },
  size: [192.024, 192.024, 16.46],
  front: '+X is north and +Z is west; the two glazed elevations face east and west',
  origin: 'Ground-level midpoint between the two leg centroids',
  brief:
    'Weighted catenary shell with equilateral triangular sections, separate steel faces, longitudinal shop welds, field station welds, 32 recessed observation ports and crown service hatch. Entirely editable metric geometry with a shared brushed-stainless surface.',
  facts: {
    heightMeters: 192.024,
    widthMeters: 192.024,
    sectionSideMeters: [16.4592, 5.1816],
    centroidFormula: {
      A: 68.7672,
      C: 3.0022,
      L: 299.2239,
      H: 625.0925,
      units: 'feet',
      equation: 'height = H - A * (cosh(C*x/L)-1)',
    },
    windowCount: 32,
    windowSizeMeters: [0.6858, 0.1778],
    windowDimensionCaution:
      'NPS fact sheet says 27 inches wide; 2010 HSR says approximately 24 inches. The source uses the fact-sheet external width; clear opening/frame distinction is unresolved.',
    steel: 'Type 304, number 3 brushed finish',
    outerPlateMeters: 0.00635,
  },
  refs: [
    'https://home.nps.gov/jeff/planyourvisit/mathematical-equation.htm',
    'https://home.nps.gov/jeff/planyourvisit/gateway-arch-fact-sheet.htm',
    'https://www.nps.gov/jeff/planyourvisit/architecture.htm',
    'https://npshistory.com/publications/jeff/hsr-gateway-arch-v1.pdf',
    'https://www.nps.gov/jeff/planyourvisit/gateway-arch.htm',
  ],
  scaleBasis:
    'NPS published centroid equation and section dimensions. Surface reconstruction yields 192.024 m height and approximately 192.025 m width without independent scaling. Ground plane clips the sloped foot sections.',
  geographicProposal: {
    anchor: [-90.184972222, 38.624611111],
    heading: Math.PI / 2,
    source: 'https://www.nps.gov/jeff/planyourvisit/architecture.htm',
    orientationConfidence: 'axis-only',
    evidence:
      'NPS states a north-south leg axis; native +X is north. Anchor currently comes from the candidate identity.',
    limitations:
      'Precise leg coordinates, geographic origin and plaza datum require map/site verification. No automatic placement approved.',
  },
  limits: [
    'Centroid and envelope are dimensionally constrained; construction station positions, window station offsets and service hatch dimensions remain a reconstruction pending original drawing comparison.',
    'Current leg exit surrounds, ground apron and museum entrance are separate unfinished site features. Underground interior is not represented.',
    'Brushed stainless is shared; weld staining, local oil-canning and current cleaning condition require a photographic material pass.',
    'NPS sources differ on window width and count prefabricated segments differently; these discrepancies remain recorded rather than silently harmonized.',
  ],
  previewCamera: { position: [140, 110, 295], lookAt: [0, 96, 0], fov: 40 },
  cameras: [
    { name: 'west-elevation', position: [0, 100, 360], lookAt: [0, 96, 0] },
    { name: 'east-elevation', position: [0, 100, -360], lookAt: [0, 96, 0] },
    { name: 'north-foot', position: [116, 5, 27], lookAt: [89, 5, 0] },
    { name: 'south-foot', position: [-112, 7, -30], lookAt: [-89, 6, 0] },
    { name: 'crown-ports', position: [12, 192, 24], lookAt: [0, 189.4, 1.5] },
    { name: 'extrados', position: [20, 214, 21], lookAt: [0, 191, 0] },
    { name: 'intrados', position: [15, 165, 0], lookAt: [0, 190, 0] },
    { name: 'far-silhouette', position: [330, 230, 580], lookAt: [0, 94, 0] },
  ],
};
