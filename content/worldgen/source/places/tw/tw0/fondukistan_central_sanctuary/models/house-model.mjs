/** Written archaeological court/niche controls; explicit estimated historical exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  earth: { slot: 'wall', graph: 'earth_adobe', roughness: 1, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  floor: { slot: 'foundation', graph: 'earth_rammed', roughness: 1, metallic: 0 },
};
const colors = { earth: rgb('baa17e'), plaster: rgb('d9c6a3'), floor: rgb('b49b77') };
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid sanctuary cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function prism(o, k, r, y0, y1) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const h = P.courtSize / 2,
  depth = (P.outerSize - P.courtSize) / 2;
function transform(side, [u, y, d]) {
  return side === 0
    ? [u, y, -h - d]
    : side === 1
      ? [h + d, y, u]
      : side === 2
        ? [u, y, h + d]
        : [-h - d, y, u];
}
function direction(side, [u, y, d]) {
  return side === 0 ? [u, y, -d] : side === 1 ? [d, y, u] : side === 2 ? [u, y, d] : [-d, y, u];
}
function wallBlock(o, side, k, u0, u1, d0, d1, y0, y1) {
  const b = new MeshBufferBuilder();
  prism(b, k, rect(u0, d0, u1, d1), y0, y1);
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ids = Array.from(m.indices.slice(i, i + 3)),
      ps = ids.map((j) => Array.from(m.positions.slice(j * 3, j * 3 + 3))),
      n = Array.from(m.normals.slice(ids[0] * 3, ids[0] * 3 + 3));
    face(
      o,
      k,
      ps.map((p) => transform(side, p)),
      direction(side, n),
    );
  }
}
function vault(o, side, u, width, segments) {
  const profile = Array.from({ length: segments + 1 }, (_, i) => {
    const a = Math.PI - (i * Math.PI) / segments;
    return [u + width * 0.5 * Math.cos(a), P.nicheSpring + width * 0.5 * Math.sin(a)];
  });
  profile.push([u + width / 2, P.wallTop], [u - width / 2, P.wallTop]);
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    const ps = [
      [a[0], a[1], 0],
      [b[0], b[1], 0],
      [b[0], b[1], P.nicheDepth],
      [a[0], a[1], P.nicheDepth],
    ];
    face(
      o,
      'plaster',
      ps.map((p) => transform(side, p)),
      direction(side, [b[1] - a[1], a[0] - b[0], 0]),
    );
  }
  for (const [d, sign] of [
    [0, -1],
    [P.nicheDepth, 1],
  ]) {
    const t = new MeshBufferBuilder();
    if (
      !t.addCap(
        'plaster',
        'palette:#ffffff',
        profile,
        [],
        () => d,
        [0, 1, 0],
        (p) => p,
        colors.plaster,
      )
    )
      throw Error('Invalid niche vault');
    const m = t.finalize();
    for (let i = 0; i < m.indices.length; i += 3) {
      const ps = Array.from(m.indices.slice(i, i + 3)).map((j) => [
        m.positions[j * 3],
        m.positions[j * 3 + 2],
        m.positions[j * 3 + 1],
      ]);
      face(
        o,
        'plaster',
        ps.map((p) => transform(side, p)),
        direction(side, [0, 0, sign]),
      );
    }
  }
}
function ring(radius, segments) {
  return Array.from({ length: segments }, (_, i) => [
    radius * Math.cos((i * Math.PI * 2) / segments),
    radius * Math.sin((i * Math.PI * 2) / segments),
  ]);
}
function stupa(o, lod) {
  const s = P.stupaBaseSize / 2;
  prism(o, 'plaster', rect(-s, -s, s, s), P.floor, 0.55);
  prism(o, 'plaster', rect(-0.75, -0.75, 0.75, 0.75), 0.55, 0.75);
  const segments = [8, 12, 20, 28][lod];
  prism(o, 'plaster', ring(0.6, segments), 0.75, 1.15);
  const steps = [2, 3, 5, 7][lod];
  let previous = { r: 0.6, y: 1.15 };
  for (let j = 1; j <= steps; j++) {
    const a = (j * Math.PI) / 2 / steps,
      next = { r: j === steps ? 0.12 : 0.6 * Math.cos(a), y: 1.15 + 0.6 * Math.sin(a) };
    for (let i = 0; i < segments; i++) {
      const a0 = (i * Math.PI * 2) / segments,
        a1 = ((i + 1) * Math.PI * 2) / segments;
      face(
        o,
        'plaster',
        [
          [previous.r * Math.cos(a0), previous.y, previous.r * Math.sin(a0)],
          [previous.r * Math.cos(a1), previous.y, previous.r * Math.sin(a1)],
          [next.r * Math.cos(a1), next.y, next.r * Math.sin(a1)],
          [next.r * Math.cos(a0), next.y, next.r * Math.sin(a0)],
        ],
        [Math.cos((a0 + a1) / 2), 1, Math.sin((a0 + a1) / 2)],
      );
    }
    previous = next;
  }
  cap(o, 'plaster', ring(0.12, segments), 1.75, 1);
  prism(o, 'plaster', rect(-0.22, -0.22, 0.22, 0.22), 1.7, P.stupaTop);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  prism(o, 'floor', P.nativeRing, P.foundationBottom, P.floor);
  let niches = 0,
    backs = 0,
    entry = 0,
    ledges = 0;
  const widths = [[1.1, 1.1, 1.1], P.eastNicheWidths, P.southNicheWidths, [1.1, 1.1, 1.1]];
  for (let side = 0; side < 4; side++) {
    const centres = side === 2 ? [-1.725, -0.8, 1.575] : [-1.55, 0, 1.55];
    const openings = widths[side].map((w, i) => ({ u: centres[i], w, kind: 'niche' }));
    if (side === 2) openings.push({ u: 0.3, w: P.southDoorWidth, kind: 'entry' });
    openings.sort((a, b) => a.u - b.u);
    const span = side % 2 === 0 ? P.outerSize / 2 : h;
    let cursor = -span;
    for (const a of openings) {
      const left = a.u - a.w / 2,
        right = a.u + a.w / 2;
      if (left < cursor - 0.00001) throw Error('Overlapping sanctuary openings');
      if (left > cursor) wallBlock(o, side, 'earth', cursor, left, 0, depth, P.floor, P.wallTop);
      if (a.kind === 'entry') {
        wallBlock(o, side, 'earth', left, right, 0, depth, P.doorTop, P.wallTop);
        entry++;
      } else {
        wallBlock(o, side, 'earth', left, right, P.nicheDepth, depth, P.floor, P.wallTop);
        wallBlock(o, side, 'plaster', left, right, 0, P.nicheDepth, P.floor, P.nicheFloor);
        vault(o, side, a.u, a.w, [4, 6, 10, 14][lod]);
        niches++;
        backs++;
        if (lod > 1) {
          wallBlock(
            o,
            side,
            'plaster',
            left,
            right,
            -0.04,
            0.14,
            P.nicheFloor,
            P.nicheFloor + 0.035,
          );
          ledges++;
        }
      }
      cursor = right;
    }
    if (cursor < span) wallBlock(o, side, 'earth', cursor, span, 0, depth, P.floor, P.wallTop);
  }
  stupa(o, lod);
  componentEvidence.push({
    lod,
    wholeCentralSanctuary: true,
    wholeSquareCourt: true,
    courtApproximateMeters: P.courtSize,
    actualVaultedNiches: niches,
    closedNicheBacks: backs,
    southOpenEntrances: entry,
    southDoorWidth: P.southDoorWidth,
    eastNicheWidths: [...P.eastNicheWidths],
    southNicheWidths: [...P.southNicheWidths],
    centralStupas: 1,
    originalRevealLedges: ledges,
    wholeClosedExteriorBacking: true,
    allAppearanceImagesUnused: true,
    bodyCoordinateSurveyed: false,
    footprintMeasured: false,
    heightMeasured: false,
    courtDimensionIsSurvey: false,
    unlocatedAnnexesNotRepresented: true,
    noInventedSculptureOrPainting: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tw/tw0/fondukistan_central_sanctuary',
  camera = [12, 12, 14],
  look = [0, 1.1, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: P.limitations.join(' '),
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['earth_adobe', 'plaster_lime', 'earth_rammed'],
  qaCameras: [
    {
      name: 'whole-open-court-twelve-vaulted-niches-and-central-stupa',
      position: camera,
      lookAt: look,
    },
    {
      name: 'opposite-complete-shell-and-open-south-entrance',
      position: [-12, 10, -14],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-sanctuary-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic historical structural interpretation under repository license, using factual written archaeological census and dimensions only. Every photograph, artwork, diagram and plan image unused. Source texts retain their original authorship; no image license is granted or inferred. Exact outer shell, vault/stupa sections, finish, body placement/facing and650CEappearance are original estimates. No current-world activation or claim of whole monastery coverage.',
};
