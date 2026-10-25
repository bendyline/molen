/** 'mosque_of_the_agas_topkapi_palace': Striped stone and brick mosque, pointed windows and shallow lead barrel roof. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildTopkapiAgas } from './topkapi-agas-geometry.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sx/sxk/mosque_of_the_agas_topkapi_palace/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source), 'utf8')),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    wall: linear('e0d4ba'),
    inner: linear('e0d4ba'),
    brick: linear('c19a7e'),
    roof: linear('89918f'),
    trim: linear('e5e0d3'),
    floor: linear('c6bfad'),
    dark: linear('4d5a59'),
    screen: linear('69716b'),
    wood: linear('9f8d76'),
    grid: linear('e8e4d8'),
    finial: linear('ada382'),
  };

function build(out, detail) {
  const rawEmit = (role, points, target) => {
    let ps = points.map((p) => p.map(Math.fround));
    const first = ps
      .slice(2)
      .map((p, i) => normalFor(ps[0], ps[i + 1], p))
      .find((n) => Math.hypot(...n) > 0.5);
    if (!first) return;
    if (first.reduce((n, v, k) => n + v * target[k], 0) < 0) ps = ps.toReversed();
    const tint =
        detail === 0 && role === 'wall'
          ? palette.wall.map((v, k) => v * 0.91 + palette.brick[k] * 0.09)
          : palette[role],
      color = detail === 0 ? tint.map((v, k) => v * (means[role]?.[k] ?? 1)) : tint;
    if (
      detail &&
      ps.length === 4 &&
      ['wall', 'brick', 'roof', 'tile'].includes(role) &&
      Math.hypot(...normalFor(ps[0], ps[1], ps[2])) > 0.5 &&
      Math.hypot(...normalFor(ps[0], ps[2], ps[3])) > 0.5
    ) {
      const nx = target[0] * r.xAxis[0] + target[2] * r.xAxis[1],
        nz = target[0] * r.zAxis[0] + target[2] * r.zAxis[1];
      out.addQuad(
        role,
        'metric:uv',
        ps,
        normalFor(...ps.slice(0, 3)),
        ps.map((p) => {
          const x = p[0] * r.xAxis[0] + p[2] * r.xAxis[1],
            z = p[0] * r.zAxis[0] + p[2] * r.zAxis[1];
          return Math.abs(target[1]) > 0.5
            ? [x * 1.5, z * 1.5]
            : [(Math.abs(nx) > Math.abs(nz) ? z : x) * 1.5, p[1] * 1.5];
        }),
        color,
      );
      return;
    }
    const metricUv = (p) => {
      const x = p[0] * r.xAxis[0] + p[2] * r.xAxis[1],
        z = p[0] * r.zAxis[0] + p[2] * r.zAxis[1],
        nx = target[0] * r.xAxis[0] + target[2] * r.xAxis[1],
        nz = target[0] * r.zAxis[0] + target[2] * r.zAxis[1];
      return Math.abs(target[1]) > 0.5
        ? [x * 1.5, z * 1.5]
        : [(Math.abs(nx) > Math.abs(nz) ? z : x) * 1.5, p[1] * 1.5];
    };
    for (let i = 1; i < ps.length - 1; i++) {
      const t = [ps[0], ps[i], ps[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        role,
        'palette:#ffffff',
        t,
        normalFor(...t),
        t.map((p) =>
          detail && ['wall', 'brick', 'roof'].includes(role)
            ? metricUv(p)
            : Math.abs(target[1]) > 0.5
              ? [p[0], p[2]]
              : Math.abs(target[0]) > Math.abs(target[2])
                ? [p[2], p[1]]
                : [p[0], p[1]],
        ),
        color,
      );
    }
  };

  const clip = (ps, Y, above) => {
    const out = [];
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length],
        A = above ? a[1] >= Y : a[1] <= Y,
        B = above ? b[1] >= Y : b[1] <= Y;
      if (A) out.push(a);
      if (A !== B) {
        const t = (Y - a[1]) / (b[1] - a[1]);
        out.push(a.map((v, k) => v + (b[k] - v) * t));
      }
    }
    return out;
  };
  const emit = (role, points, target) => {
    if (role !== 'wall' || Math.abs(target[1]) > 0.5) {
      rawEmit(role, points, target);
      return;
    }
    const lo = Math.min(...points.map((p) => p[1])),
      hi = Math.max(...points.map((p) => p[1])),
      step = [2.4, 1.4, 0.8, 0.6][detail],
      cuts = [lo, hi];
    for (let y = r.floorY + 0.42; y < 10.9; y += step)
      for (const q of [y, y + 0.085]) if (q > lo && q < hi) cuts.push(q);
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i],
        b = cuts[i + 1];
      if (b - a < 1e-7) continue;
      const ps = clip(clip(points, a, true), b, false);
      if (ps.length < 3) continue;
      const phase = ((a + b) / 2 - r.floorY - 0.42) % step;
      rawEmit(phase >= 0 && phase < 0.085 ? 'brick' : 'wall', ps, target);
    }
  };
  buildTopkapiAgas(emit, detail, r);
}
export const buildTopkapiAgasSkyline = (o) => build(o, 0),
  buildTopkapiAgasDistrict = (o) => build(o, 1),
  buildTopkapiAgasStreet = (o) => build(o, 2),
  buildTopkapiAgasCloseup = (o) => build(o, 3);
export const topkapiAgasStudy = {
  id: 'mosque_of_the_agas_topkapi_palace',
  key: 'agas',
  title: 'Mosque of the Agas, Topkapi Palace',
  category: 'mosque',
  wikidataId: 'Q133475725',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildTopkapiAgasCloseup,
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  reconstruction: r,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  scaleBasis: r.heightBasis,
  refs: [
    ...new Set(read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page)),
  ],
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map evidence ©OpenStreetMap contributors, ODbL-1.0. Ordinary photographs viewed only; no copied pixels, event artwork or inscriptions.',
  geometrySource: r.scope,
  sourceNotice: r.scope,
  importReason: r.scope,
  previewGround: scope.previewGround,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: r.terrainBasis,
  limitations: [r.scope, r.identityBasis, r.heightBasis, r.terrainBasis],
  camera: scope.camera,
  qaCameras: [],
};
