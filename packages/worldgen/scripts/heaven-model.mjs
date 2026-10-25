/** Temple of Heaven exterior source with approximate standard-map geographic integration. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildHeavenAltar, buildHeavenAltarRemote } from './heaven-altar-model.mjs';
import { buildHeavenNorth } from './heaven-north-model.mjs';
import { buildHeavenPalace } from './heaven-palace-model.mjs';
import { buildHeavenPrecinct } from './heaven-precinct-model.mjs';
import { buildHeavenServices } from './heaven-service-model.mjs';
import { buildHeavenSkylineSite as buildHeavenRemoteHalls } from './heaven-skyline-model.mjs';
import { buildHeavenVault } from './heaven-vault-model.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/wx/wx4/temple_of_heaven/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  rec = frame.reconstruction,
  scope = read('review-scope.json');
const fit = read('pmtiles-fit.json'),
  means = read('surface-means.json');
const palette = {
  stone: '#e1d9c7',
  wall: '#b25443',
  roof: '#4e6589',
  band: '#618b81',
  gold: '#cba550',
  dark: '#704349',
  gate: '#b65b49',
  brick: '#a5a39b',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
export function heavenGround(x, z) {
  const g = fit.grid,
    u = (x + fit.modelOrigin[0] - g.origin[0]) / g.stepMeters,
    v = (z + fit.modelOrigin[1] - g.origin[1]) / g.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  if (i < 0 || j < 0 || i >= g.width - 1 || j >= g.height - 1)
    throw Error('Temple grade outside retained grid');
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, detail) {
  return (slot, points, target, tint) => {
    let p = points.map((v) => v.map(Math.fround));
    const col = tint ?? colors[slot],
      color = detail === 0 ? col.map((v, k) => v * (means[slot]?.[k] ?? 1)) : col;
    for (let i = 1; i < p.length - 1; i++) {
      const n = normalFor(p[0], p[i], p[i + 1]);
      if (Math.hypot(...n) < 0.5) continue;
      if (target && n.reduce((s, v, k) => s + v * target[k], 0) < 0) p = p.toReversed();
      break;
    }
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-8
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
const radial = (angle, radius, y) => [
  Math.cos(angle) * radius,
  rec.floorY + y,
  Math.sin(angle) * radius,
];
function disk(face, slot, radius, y, count) {
  for (let i = 0; i < count; i++)
    face(
      slot,
      [
        [0, rec.floorY + y, 0],
        radial((i / count) * Math.PI * 2, radius, y),
        radial(((i + 1) / count) * Math.PI * 2, radius, y),
      ],
      [0, 1, 0],
    );
}
function lathe(face, slot, profile, count, { cap = true, center = [0, 0], tint } = {}) {
  const point = (a, r, y) => {
    const p = radial(a, r, y);
    return [p[0] + center[0], p[1], p[2] + center[1]];
  };
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2,
        b = ((i + 1) / count) * Math.PI * 2,
        lo = profile[j - 1],
        hi = profile[j];
      face(
        slot,
        [
          point(a, lo[1], lo[0]),
          point(b, lo[1], lo[0]),
          point(b, hi[1], hi[0]),
          point(a, hi[1], hi[0]),
        ],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        tint,
      );
    }
  if (cap) {
    const [y, r] = profile.at(-1);
    for (let i = 0; i < count; i++)
      face(
        slot,
        [
          [center[0], rec.floorY + y, center[1]],
          point((i / count) * Math.PI * 2, r, y),
          point(((i + 1) / count) * Math.PI * 2, r, y),
        ],
        [0, 1, 0],
        tint,
      );
  }
}
function panel(face, slot, angle, halfWidth, radius, bottom, top, tint) {
  const a = angle - halfWidth,
    b = angle + halfWidth;
  face(
    slot,
    [
      radial(a, radius, bottom),
      radial(b, radius, bottom),
      radial(b, radius, top),
      radial(a, radius, top),
    ],
    [Math.cos(angle), 0, Math.sin(angle)],
    tint,
  );
}
function terraces(face, d, n) {
  const tau = Math.PI * 2,
    aw = rec.stairHalfAngle;
  const angles = [
    ...new Set(
      [
        ...Array.from({ length: n }, (_, i) => (i / n) * tau),
        ...[0, 1, 2, 3].flatMap((i) => [(i * Math.PI) / 2 - aw, (i * Math.PI) / 2 + aw]),
      ].map((v) => (v + tau) % tau),
    ),
  ].toSorted((a, b) => a - b);
  for (const [ti, t] of rec.terraces.entries()) {
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i],
        b = angles[(i + 1) % angles.length] + (i === angles.length - 1 ? tau : 0),
        mid = (a + b) / 2;
      const gap = Math.abs(Math.atan2(Math.sin(mid * 4), Math.cos(mid * 4))) / 4 < aw;
      if (!gap) {
        face(
          'stone',
          [
            radial(a, t.outer, t.bottom),
            radial(b, t.outer, t.bottom),
            radial(b, t.outer, t.top),
            radial(a, t.outer, t.top),
          ],
          [Math.cos(mid), 0, Math.sin(mid)],
        );
        face(
          'stone',
          [
            radial(a, t.outer, t.top),
            radial(b, t.outer, t.top),
            radial(b, t.inner, t.top),
            radial(a, t.inner, t.top),
          ],
          [0, 1, 0],
        );
      }
    }
    const steps = d === 0 ? 1 : d === 1 ? 4 : 12;
    for (let side = 0; side < 4; side++) {
      const axis = (side * Math.PI) / 2,
        a = axis - aw,
        b = axis + aw,
        outer = t.outer + (ti === 0 ? 4 : 0);
      for (let i = 0; i < steps; i++) {
        const r0 = outer - ((outer - t.inner) * i) / steps,
          r1 = outer - ((outer - t.inner) * (i + 1)) / steps;
        const y0 = t.bottom + ((t.top - t.bottom) * i) / steps,
          y1 = t.bottom + ((t.top - t.bottom) * (i + 1)) / steps;
        if (d === 0)
          face(
            'stone',
            [radial(a, r0, y0), radial(b, r0, y0), radial(b, r1, y1), radial(a, r1, y1)],
            [0, 1, 0],
          );
        else {
          face(
            'stone',
            [radial(a, r0, y0), radial(b, r0, y0), radial(b, r0, y1), radial(a, r0, y1)],
            [Math.cos(axis), 0, Math.sin(axis)],
          );
          face(
            'stone',
            [radial(a, r0, y1), radial(b, r0, y1), radial(b, r1, y1), radial(a, r1, y1)],
            [0, 1, 0],
          );
        }
        for (const [angle, sign] of [
          [a, -1],
          [b, 1],
        ]) {
          const height = (r) => (d === 0 ? y0 + ((r0 - r) / (r0 - r1)) * (y1 - y0) : y1);
          const innerOuter = Math.min(r0, t.outer);
          if (innerOuter > r1 + 1e-7)
            face(
              'stone',
              [
                radial(angle, innerOuter, height(innerOuter)),
                radial(angle, r1, height(r1)),
                radial(angle, r1, t.top),
                radial(angle, innerOuter, t.top),
              ],
              [sign * Math.sin(angle), 0, -sign * Math.cos(angle)],
            );
          const extensionInner = Math.max(r1, t.outer);
          if (r0 > extensionInner + 1e-7) {
            const low = (r) => {
              const p = radial(angle, r, 0);
              return Math.min(heavenGround(p[0], p[2]) - 0.2 - rec.floorY, -0.2);
            };
            face(
              'stone',
              [
                radial(angle, r0, low(r0)),
                radial(angle, extensionInner, low(extensionInner)),
                radial(angle, extensionInner, height(extensionInner)),
                radial(angle, r0, height(r0)),
              ],
              [-sign * Math.sin(angle), 0, sign * Math.cos(angle)],
            );
          }
        }
      }
      if (ti === 0) {
        const p = radial(a, outer, 0),
          q = radial(b, outer, 0);
        face(
          'stone',
          [
            [p[0], Math.min(heavenGround(p[0], p[2]) - 0.2, p[1] - 0.2), p[2]],
            [q[0], Math.min(heavenGround(q[0], q[2]) - 0.2, q[1] - 0.2), q[2]],
            q,
            p,
          ],
          [Math.cos(axis), 0, Math.sin(axis)],
        );
      }
    }
    if (d > 0) {
      const railY = t.top + 0.88,
        r = t.outer - 0.5;
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i],
          b = angles[(i + 1) % angles.length] + (i === angles.length - 1 ? tau : 0),
          mid = (a + b) / 2;
        if (Math.abs(Math.atan2(Math.sin(mid * 4), Math.cos(mid * 4))) / 4 < aw + 0.01) continue;
        if (d === 1) {
          face(
            'stone',
            [radial(a, r, t.top), radial(b, r, t.top), radial(b, r, railY), radial(a, r, railY)],
            [Math.cos(mid), 0, Math.sin(mid)],
          );
          face(
            'stone',
            [
              radial(a, r - 0.24, t.top),
              radial(b, r - 0.24, t.top),
              radial(b, r - 0.24, railY),
              radial(a, r - 0.24, railY),
            ],
            [-Math.cos(mid), 0, -Math.sin(mid)],
          );
          face(
            'stone',
            [
              radial(a, r - 0.24, railY),
              radial(b, r - 0.24, railY),
              radial(b, r, railY),
              radial(a, r, railY),
            ],
            [0, 1, 0],
          );
        } else {
          for (const [y0, y1] of [
            [t.top + 0.15, t.top + 0.4],
            [railY - 0.16, railY],
          ]) {
            face(
              'stone',
              [radial(a, r, y0), radial(b, r, y0), radial(b, r, y1), radial(a, r, y1)],
              [Math.cos(mid), 0, Math.sin(mid)],
            );
            face(
              'stone',
              [
                radial(a, r - 0.24, y1),
                radial(b, r - 0.24, y1),
                radial(b, r, y1),
                radial(a, r, y1),
              ],
              [0, 1, 0],
            );
            face(
              'stone',
              [
                radial(a, r - 0.24, y0),
                radial(b, r - 0.24, y0),
                radial(b, r - 0.24, y1),
                radial(a, r - 0.24, y1),
              ],
              [-Math.cos(mid), 0, -Math.sin(mid)],
            );
            face(
              'stone',
              [
                radial(a, r - 0.24, y0),
                radial(b, r - 0.24, y0),
                radial(b, r, y0),
                radial(a, r, y0),
              ],
              [0, -1, 0],
            );
          }
          const count = d === 2 ? 1 : 2;
          for (let j = 0; j < count; j++) {
            const q = a + ((b - a) * j) / count;
            lathe(
              face,
              'stone',
              [
                [t.top, 0.22],
                [railY + 0.18, 0.22],
                [railY + 0.3, 0.14],
              ],
              d === 2 ? 4 : 6,
              { center: [Math.cos(q) * (r - 0.1), Math.sin(q) * (r - 0.1)] },
            );
          }
        }
      }
    }
  }
  disk(face, 'stone', 30, 6, n);
  // A low variable skirt meets the coarse local terrain rather than floating on the low side.
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = angles[(i + 1) % angles.length] + (i === angles.length - 1 ? tau : 0);
    const p = radial(a, 48, 0),
      q = radial(b, 48, 0);
    face(
      'stone',
      [
        [p[0], Math.min(heavenGround(p[0], p[2]) - 0.2, rec.floorY - 0.2), p[2]],
        [q[0], Math.min(heavenGround(q[0], q[2]) - 0.2, rec.floorY - 0.2), q[2]],
        q,
        p,
      ],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
  }
}
function hall(face, d, n) {
  const r = rec.bodyRadius;
  lathe(
    face,
    'wall',
    [
      [6, r],
      [13.4, r],
    ],
    n,
    { cap: d > 1 },
  );
  lathe(
    face,
    'band',
    [
      [12.0, r + 0.05],
      [13.4, r + 0.05],
    ],
    n,
    { cap: d > 1 },
  );
  lathe(
    face,
    'wall',
    [
      [17.6, 12.3],
      [21.3, 12.3],
    ],
    n,
    { cap: d > 1 },
  );
  lathe(
    face,
    'band',
    [
      [18.1, 12.36],
      [21.1, 12.36],
    ],
    n,
    { cap: d > 1 },
  );
  lathe(
    face,
    'wall',
    [
      [24.7, 9.9],
      [27.0, 9.9],
    ],
    n,
    { cap: d > 1 },
  );
  lathe(
    face,
    'band',
    [
      [25.0, 9.95],
      [26.9, 9.95],
    ],
    n,
    { cap: d > 1 },
  );
  const profiles = [
    [
      [13.3, 18.0],
      [13.55, 17.1],
      [14.0, 15.8],
      [15.3, 13.6],
      [17.7, 12.3],
    ],
    [
      [21.1, 15.2],
      [21.35, 14.5],
      [21.9, 13.0],
      [23.0, 11.4],
      [24.8, 9.9],
    ],
    [
      [26.9, 11.9],
      [27.2, 11.0],
      [28.0, 9.3],
      [30.0, 6.1],
      [33.0, 2.8],
      [35.6, 1.0],
    ],
  ];
  for (const [index, profile] of profiles.entries()) {
    const rows =
      d === 0 ? [profile[0], profile[Math.floor(profile.length / 2)], profile.at(-1)] : profile;
    lathe(face, 'roof', rows, n);
    lathe(
      face,
      'band',
      [
        [profile[0][0] - 0.38, profile[0][1] * 0.985],
        [profile[0][0], profile[0][1]],
      ],
      n,
      { cap: false },
    );
    const inner = [r, 12.3, 9.9][index],
      outer = profile[0][1] * 0.985,
      y = profile[0][0] - 0.38;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2;
      face(
        'band',
        [radial(a, inner, y), radial(b, inner, y), radial(b, outer, y), radial(a, outer, y)],
        [0, -1, 0],
      );
    }
  }
  lathe(
    face,
    'roof',
    [
      [35.5, 1.05],
      [35.9, 1.05],
      [36.1, 0.7],
    ],
    n,
  );
  lathe(
    face,
    'gold',
    [
      [36.0, 0.65],
      [36.25, 0.85],
      [36.5, 0.65],
      [37.35, 0.82],
      [37.8, 0.55],
      [38, 0.08],
    ],
    d === 0 ? 6 : Math.min(n, 16),
  );
  const bays = d === 0 ? 8 : d === 1 ? 12 : 24;
  for (let i = 0; i < bays; i++) {
    const a = (i / bays) * Math.PI * 2;
    panel(face, 'dark', a, d === 0 ? 0.16 : 0.082, r + 0.07, 6.3, 10.7);
    if (d >= 1) {
      panel(face, 'gold', a, 0.084, r + 0.1, 10.8, 11.05);
      panel(face, 'band', a, 0.084, r + 0.1, 11.15, 11.7);
      panel(face, 'gold', a, 0.045, r + 0.12, 12.3, 12.8);
      if (d >= 2) {
        const ca = a + Math.PI / bays;
        lathe(
          face,
          'wall',
          [
            [6.1, 0.28],
            [12.0, 0.28],
          ],
          d === 2 ? 6 : 8,
          { center: [Math.cos(ca) * r, Math.sin(ca) * r] },
        );
        for (const u of [-0.032, 0.032]) panel(face, 'gold', a + u, 0.0035, r + 0.11, 6.5, 10.4);
      }
    }
  }
  if (d >= 1)
    for (const [radius, bottom, top] of [
      [12.4, 18.4, 20.7],
      [10.0, 25.2, 26.7],
    ])
      for (let i = 0; i < (d === 1 ? 12 : 24); i++) {
        const a = (i / (d === 1 ? 12 : 24)) * Math.PI * 2;
        panel(face, 'gold', a, 0.038, radius, bottom, top);
        panel(face, 'band', a, 0.03, radius + 0.03, bottom + 0.22, top - 0.22);
      }
  // Original plain blue plaque and border; historical lettering/artwork is deliberately absent.
  const plaqueY = 26.0,
    plaqueRadius = 11.7;
  if (d > 0) {
    panel(face, 'gold', Math.PI / 2, 0.11, plaqueRadius, plaqueY - 1.4, plaqueY + 1.6);
    panel(face, 'roof', Math.PI / 2, 0.083, plaqueRadius + 0.03, plaqueY - 1.15, plaqueY + 1.35);
  }
}
function build(out, d) {
  const face = writer(out, d),
    n = [8, 8, 24, 48, 64][d];
  if (d === 0) {
    groundPatches(face);
    buildHeavenRemoteHalls(face, 6);
    buildHeavenAltarRemote(face, 6, false);
    buildHeavenPalace(face, 0);
    buildHeavenServices(face, 0);
    buildHeavenPrecinct(face, 0);
    return;
  }
  if (d === 1) {
    groundPatches(face);
    buildHeavenRemoteHalls(face, 12);
    buildHeavenAltarRemote(face, 7);
    buildHeavenPalace(face, 1);
    buildHeavenServices(face, 1);
    buildHeavenPrecinct(face, 1);
    return;
  }
  terraces(face, d, d === 2 ? 24 : 48);
  hall(face, d, n);
  buildHeavenNorth(face, d === 2 ? 1 : d);
  buildHeavenVault(face, d === 2 ? 1 : d);
  buildHeavenAltar(face, d === 2 ? 1 : d);
  buildHeavenPalace(face, d === 2 ? 1 : d);
  buildHeavenServices(face, d);
  buildHeavenPrecinct(face, d);
}
/** Match the ground openings across remote and detailed levels without filling park gaps. */
function groundPatches(face) {
  for (const [role, center, radius, y] of [
    ['stone', [0, 0], 48, rec.floorY - 0.02],
    ['brick', rec.vault.center, rec.vault.echoWall.radius - 0.45, rec.vault.floorY],
  ])
    face(
      role,
      Array.from({ length: 24 }, (_, i) => [
        center[0] + Math.cos((i * Math.PI) / 12) * radius,
        y,
        center[1] + Math.sin((i * Math.PI) / 12) * radius,
      ]),
      [0, 1, 0],
    );
}
export const buildHeavenSkyline = (o) => build(o, 0),
  buildHeavenDistrict = (o) => build(o, 1),
  buildHeavenStreet = (o) => build(o, 2),
  buildHeavenCloseup = (o) => build(o, 3);
export const heavenStudy = {
  id: 'temple_of_heaven',
  key: 'temple_of_heaven',
  title: 'Temple of Heaven',
  category: 'temple',
  wikidataId: 'Q125445',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    mainBuildingHeight: rec.mainControl.properties.height,
    horizontalBasis: rec.identityBasis,
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Seven existing shared256² graphs across nine roles,merged into eight near materials including one flat local ground/water surface. Linear tints,metric UVs,no embedded images or unique atlas. Original coarse decoration;no copied inscriptions or historic artwork.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.scope,
    rec.identityBasis,
    rec.heightBasis,
    rec.terrainBasis,
    'Approximate exterior reconstruction from standard map/DEM and ordinary pictures. Gate forms, wall routes, floor grades and exact facing are visualization estimates. Interiors, fine ornaments and unverified southern wall links are omitted. Physical-device/full-city performance remains pending.',
  ],
  camera: scope.camera,
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-stage-${reviewLod}`,
    ...scope.camera,
    reviewLod,
  })),
  qaCameras: [
    { name: 'south-entry-and-stairs', position: [0, 20, 72], lookAt: [0, 13, 0], fov: 48 },
    { name: 'triple-eaves-and-finial', position: [28, 25, 36], lookAt: [0, 24, 0], fov: 48 },
    { name: 'marble-terrace-stairs', position: [30, 11, 55], lookAt: [0, 3, 32], fov: 48 },
    { name: 'painted-bay-rhythm', position: [15, 11, 20], lookAt: [4, 10, 10], fov: 48 },
    { name: 'west-stair-and-rails', position: [-64, 17, 15], lookAt: [-30, 4, 0], fov: 48 },
    { name: 'terrace-plan', position: [0, 150, 0.1], lookAt: [0, 0, 0], fov: 48 },
  ].map((camera) => ({
    ...camera,
    position: camera.position.map((v, i) => (i === 1 ? v + rec.floorY - 0.15 : v)),
    lookAt: camera.lookAt.map((v, i) => (i === 1 ? v + rec.floorY - 0.15 : v)),
  })),
};
