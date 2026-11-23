import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  color,
  courtFace,
  eaveBand,
  edges,
  fitAtAngle,
  panel,
  panels,
  positioned,
  post,
  rect,
  secondary,
  stairs,
  surfaces,
} from '../../shaolin_monastery/models/temple-architecture.mjs';
import site from '../site-controls.json' with { type: 'json' };

export { surfaces };
const axis = (site.planAngleDegrees * Math.PI) / 180;
const wall = rgb('b27e68'),
  trim = rgb('b1a68c'),
  tile = rgb('75837c');

function mainRoof(out, w, d, y, detail) {
  const rise = 4.51;
  const tiers = [
    [w * 0.5, d * 0.5, y, 0.78],
    [w * 0.431, d * 0.323, y + rise * 0.21, 0.24],
    [w * 0.355, d * 0.164, y + rise * 0.61, 0],
    [w * 0.355, 0.065, y + rise, 0],
  ];
  const ring = (x, z, h, tip) => [
    [-x, h + tip, -z],
    [-x, h, 0],
    [-x, h + tip, z],
    [0, h, z],
    [x, h + tip, z],
    [x, h, 0],
    [x, h + tip, -z],
    [0, h, -z],
  ];
  const steps = (detail ? tiers : [tiers[0], tiers[2], tiers[3]]).map((p) => ring(...p));
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1],
      b = steps[i];
    for (let j = 0; j < a.length; j++) {
      const k = (j + 1) % a.length,
        side = j < 2 || (j >= 4 && j < 6);
      const gable = side && i === steps.length - 1;
      const slot = gable ? 'wood' : 'roof',
        tint = gable ? color.oldTimber : tile;
      tri(out, slot, a[j], a[k], b[k], tint);
      tri(out, slot, a[j], b[k], b[j], tint);
    }
  }
  const eaves = steps[0];
  const underside = eaves.map(([x, y, z]) => [x, y - 0.1, z]);
  const ledge = eaves.map(([x, , z]) => [x * 0.868, y - 0.11, z * 0.883]);
  for (let j = 0; j < eaves.length; j++) {
    const k = (j + 1) % eaves.length;
    tri(out, 'roof', eaves[j], underside[j], underside[k], tile);
    tri(out, 'roof', eaves[j], underside[k], eaves[k], tile);
    tri(out, 'wood', underside[k], underside[j], ledge[j], color.oldTimber);
    tri(out, 'wood', underside[k], ledge[j], ledge[k], color.oldTimber);
  }
  const top = steps.at(-1);
  tri(out, 'roof', top[0], top[2], top[4], tile);
  tri(out, 'roof', top[0], top[4], top[6], tile);
  if (detail)
    beam(
      out,
      'roof',
      [-w * 0.367, y + rise + 0.05, 0],
      [w * 0.367, y + rise + 0.05, 0],
      0.224,
      0.19,
      tile,
    );
  if (detail >= 2)
    for (const s of [-1, 1]) {
      const c = [s * w * 0.363, 0];
      loft(
        out,
        'roof',
        [
          [rise, 0.29],
          [rise + 0.24, 0.215],
          [rise + 0.49, 0.11],
        ].map(([h, r]) => radialRing(y + h, r, r, 7, c)),
        tile,
      );
    }
}

function principal(out, b, detail) {
  // The photograph looks back toward the hall from the inner courtyard, along the local site axis.
  const { center, w, d, ring, a } = fitAtAngle(b.plan, Math.PI / 2);
  const m = positioned(out, a, [center[0], 0, center[1]]);
  const y = b.base + 0.51,
    floor = y + 0.84,
    eave = floor + 4.78,
    front = d * 0.5,
    back = -d * 0.5;
  const f = courtFace(0, front, w);
  extrude(m, 'stone', ring, b.foundation, floor, color.greyBrick);
  const right = w * 0.5 - 0.19,
    left = -right,
    half = 1.28;
  const facadeDepth = front - 0.15;
  extrude(m, 'wall', rect(left, -half, back + 0.16, facadeDepth), floor, eave, wall);
  extrude(m, 'wall', rect(half, right, back + 0.16, facadeDepth), floor, eave, wall);
  abox(m, 'wall', [-half, floor + 2.81, back + 0.16], [half, eave, facadeDepth], wall);
  abox(m, 'wall', [-half, floor, back + 0.15], [half, eave - 0.31, back + 0.36], wall);
  const inside = courtFace(0, front - 1.79, w);
  panel(
    m,
    'shade',
    inside,
    w * 0.5 - half,
    w * 0.5 + half,
    floor + 0.08,
    floor + 2.82,
    0.02,
    color.black,
  );
  mainRoof(m, w + 1.87, d + 1.41, eave, detail);
  stairs(m, f, w * 0.5, 4.11, y - 0.31, floor, 2.55, detail);
  if (!detail) return;
  for (const face of edges(rect(left, right, back + 0.17, front - 0.11)))
    eaveBand(m, face, eave, detail, { wood: color.oldTimber, paint: trim, bay: 1.51 });
  for (const s of [-1, 1]) {
    post(m, s * half, front - 0.09, floor, floor + 2.89, 0.112, detail, color.vermillion);
    post(m, s * (right - 0.09), front - 0.21, floor, eave - 0.23, 0.184, detail, color.oldTimber);
    const u = w * 0.5 + s * w * 0.291;
    fbox(m, 'stone', f, u - 0.194, u + 0.194, floor + 0.37, floor + 0.72, -0.25, 0.026, trim);
    if (detail >= 2) {
      panel(m, 'shade', f, u - 0.128, u + 0.128, floor + 0.433, floor + 0.65, 0.032, color.black);
      panel(m, 'wood', f, u - 0.019, u + 0.019, floor + 0.433, floor + 0.65, 0.045, trim);
    }
  }
  fbox(
    m,
    'wood',
    f,
    w * 0.5 - half - 0.12,
    w * 0.5 + half + 0.12,
    floor + 2.72,
    floor + 3.01,
    -0.19,
    0.12,
    color.vermillion,
  );
  const rear = courtFace(0, back + 0.22, w);
  panels(
    m,
    rear,
    w * 0.5 - 0.991,
    w * 0.5 + 0.991,
    floor + 0.19,
    floor + 2.42,
    detail,
    color.oldTimber,
  );
  if (detail >= 2) {
    fbox(
      m,
      'wood',
      f,
      w * 0.5 - 0.72,
      w * 0.5 + 0.72,
      floor + 3.17,
      floor + 3.56,
      -0.044,
      0.078,
      color.timber,
    );
    panel(
      m,
      'metal',
      f,
      w * 0.5 - 0.63,
      w * 0.5 + 0.63,
      floor + 3.49,
      floor + 3.511,
      0.084,
      color.gold,
    );
  }
}

const ranges = {
  1408938547: { height: 3.55, rise: 2.52, wall, highlight: true },
  1408938548: { height: 2.9, rise: 2.04, wall: color.ochre },
  1408938549: { height: 3.42, rise: 3.01, wall, highlight: true },
  1408938550: { height: 3.23, rise: 2.35, wall: color.quietRed },
};
function build(out, detail) {
  const m = positioned(out, axis);
  for (const b of site.buildingFootprints) {
    if (b.id === 1408938541) principal(m, b, detail);
    else secondary(m, b, detail, { ...ranges[b.id], tile });
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
