/** Independent Emirates tower exteriors from NORR's published plans/sections. */
import { beam, beamPath, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  mappedCap,
  mappedSolid,
  grid as originalGrid,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube, tubePath } from './structure-mesh.mjs';

const S = 55.5,
  H = (S * Math.sqrt(3)) / 2,
  rear = -H / 3,
  tip = (H * 2) / 3;
const plan = [
  [tip, 0],
  [rear, -S / 2],
  [rear, S / 2],
];
const silver = [0.72, 0.75, 0.75],
  dark = [0.055, 0.075, 0.083],
  glazing = [0.32, 0.43, 0.47],
  copper = [0.46, 0.32, 0.23];
const point = (p, y) => [p[0], y, p[1]];
function edges(ring) {
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return {
      a,
      b,
      len,
      at: (u, y, d = 0) => [
        a[0] + (b[0] - a[0]) * u - ((b[1] - a[1]) / len) * d,
        y,
        a[1] + (b[1] - a[1]) * u + ((b[0] - a[0]) / len) * d,
      ],
    };
  });
}
function quad(out, at, u0, u1, y0, y1, slot = 'metal', color = silver, d = 0) {
  if (u1 - u0 < 1e-7 || y1 - y0 < 0.01) return;
  face(out, slot, [at(u0, y0, d), at(u1, y0, d), at(u1, y1, d), at(u0, y1, d)], color);
}
function panels(out, at, u0, u1, y0, y1, _width, slot = 'metal', color = silver) {
  // Continuous cladding removes repeated 2cm joint beams; shared metal supplies the surface.
  quad(out, at, u0, u1, y0, y1, slot, color);
}
function grid(out, p, color, dx, dy, frame, frameColor, slot) {
  originalGrid(
    out,
    p,
    color,
    dx * out.detail.gridScale,
    dy * out.detail.gridScale,
    out.detail.frames ? frame : 0,
    frameColor,
    slot,
  );
}

function panes(out, at, u0, u1, y0, y1, _width, color = glazing) {
  grid(
    out,
    [at(u0, y0), at(u1, y0), at(u1, y1), at(u0, y1)],
    color,
    out.detail.panePitch,
    out.detail.paneRowPitch,
    0.045,
    silver,
    'metal',
  );
}
function ribbonFacade(out, edge, bottom, top, pitch) {
  const { at, len } = edge,
    l = 4.2 / len,
    r = 1 - 3.0 / len;
  panels(out, at, 0, l, bottom, top, len);
  panels(out, at, r, 1, bottom, top, len);
  for (let y = bottom; y < top - 0.1; y += pitch * out.detail.floorStep) {
    const end = Math.min(top, y + pitch * out.detail.floorStep),
      sill = Math.min(end, y + 1.3);
    panels(out, at, l, r, y, sill, len);
    if (end - sill > 0.05) {
      panes(out, (u, v) => at(u, v, -0.12), l, r, sill, end, len);
      face(
        out,
        'metal',
        [at(l, sill), at(r, sill), at(r, sill, -0.12), at(l, sill, -0.12)],
        silver,
      );
      face(out, 'metal', [at(l, end, -0.12), at(r, end, -0.12), at(r, end), at(l, end)], silver);
      if (out.detail.frames)
        for (const u of [l, r])
          beam(out, 'metal', at(u, sill, -0.08), at(u, end, -0.08), 0.055, 0.07, silver);
      if (out.detail.sills)
        beam(out, 'metal', at(l, sill, 0.065), at(r, sill, 0.065), 0.1, 0.18, silver);
    }
  }
}
function cylinderFrameStrips(out, at, t0, t1, sides, y0, y1, radius, width, pitch) {
  const halfAngle = width / radius;
  for (let k = 0; k <= sides; k++) {
    const t = t0 + (k * (t1 - t0)) / sides;
    face(
      out,
      'metal',
      [
        at(t - halfAngle, y0, 0.025),
        at(t + halfAngle, y0, 0.025),
        at(t + halfAngle, y1, 0.025),
        at(t - halfAngle, y1, 0.025),
      ],
      silver,
    );
  }
  if (pitch > 0)
    for (let y = y0; y <= y1 + 0.001; y += pitch)
      for (let k = 0; k < sides; k++) {
        const a = t0 + (k * (t1 - t0)) / sides,
          b = t0 + ((k + 1) * (t1 - t0)) / sides;
        face(
          out,
          'metal',
          [
            at(a, y - width, 0.025),
            at(b, y - width, 0.025),
            at(b, y + width, 0.025),
            at(a, y + width, 0.025),
          ],
          silver,
        );
      }
}
function curvedFace(out, y0, y1, pitch, color = glazing) {
  // The broad outer facade is an actual bowed curtain wall within a metal frame.
  const radius = 29.7,
    center = rear + 24.2,
    spread = Math.asin(17.8 / radius),
    steps = out.detail.curveSides;
  const at = (t, y, lift = 0) => [
    center - (radius + lift) * Math.cos(t),
    y,
    (radius + lift) * Math.sin(t),
  ];
  const cap = [
    [rear, -17.8],
    ...Array.from({ length: steps + 1 }, (_, i) => {
      const [x, _y, z] = at(-spread + (i * 2 * spread) / steps, y0);
      return [x, z];
    }),
    [rear, 17.8],
  ];
  mappedCap(out, 'metal', cap, y0, silver, [], true);
  mappedCap(out, 'metal', cap, y1, silver);
  for (let y = y0; y < y1 - 0.05; y += pitch * out.detail.floorStep) {
    const hi = Math.min(y1, y + pitch * out.detail.floorStep);
    for (let k = 0; k < steps; k++) {
      const a = -spread + (k * 2 * spread) / steps,
        b = -spread + ((k + 1) * 2 * spread) / steps;
      grid(
        out,
        [at(a, y), at(b, y), at(b, hi), at(a, hi)],
        color,
        2,
        hi - y,
        out.detail.mergeCurveFrames ? 0 : 0.065,
        silver,
        'metal',
      );
    }
  }
  if (out.detail.mergeCurveFrames)
    cylinderFrameStrips(out, at, -spread, spread, steps, y0, y1, radius, 0.065, pitch);
  const e = edges(plan)[1];
  for (const [a, b] of [
    [0, (S / 2 - 17.8) / S],
    [(S / 2 + 17.8) / S, 1],
  ])
    panels(out, e.at, a, b, y0, y1, S);
  for (const sign of [-1, 1]) {
    const a = e.at((S / 2 + sign * 17.8) / S, y0),
      b = at(sign * spread, y0);
    face(out, 'metal', [a, b, [b[0], y1, b[2]], [a[0], y1, a[2]]], silver);
  }
}
function drum(out, height) {
  const r = 17.0,
    sides = out.detail.drumSides;
  for (let j = 0; j < out.detail.drumFloors; j++) {
    const y0 = (j * height) / out.detail.drumFloors,
      y1 = ((j + 1) * height) / out.detail.drumFloors;
    const a = radialRing(y0, r, r, sides),
      b = radialRing(y1, r, r, sides);
    for (let i = 0; i < sides; i++)
      grid(
        out,
        [a[i], a[(i + 1) % sides], b[(i + 1) % sides], b[i]],
        [0.25, 0.36, 0.39],
        2,
        y1 - y0,
        out.detail.mergeDrumFrames ? 0 : 0.07,
        silver,
        'metal',
      );
    if (out.detail.drumBands)
      loft(
        out,
        'metal',
        [
          radialRing(y1 - 0.18, r + 0.15, r + 0.15, sides),
          radialRing(y1, r + 0.15, r + 0.15, sides),
        ],
        silver,
        { cap: false },
      );
  }
  if (out.detail.mergeDrumFrames) {
    const at = (t, y, lift = 0) => [(r + lift) * Math.cos(t), y, (r + lift) * Math.sin(t)];
    cylinderFrameStrips(out, at, 0, Math.PI * 2, sides, 0, height, r, 0.07, 0);
  }
  mappedCap(
    out,
    'foundation',
    radialRing(0, r, r, sides).map(([x, _y, z]) => [x, z]),
    0,
    [0.38, 0.39, 0.39],
    [],
    true,
  );
  // Three full-depth triangular supports are open around the smaller drum.
  for (let i = 0; i < 3; i++) {
    const a = plan[i],
      prev = plan[(i + 2) % 3],
      next = plan[(i + 1) % 3];
    const p = [
      a,
      [a[0] + (next[0] - a[0]) * 0.16, a[1] + (next[1] - a[1]) * 0.16],
      [a[0] + (prev[0] - a[0]) * 0.16, a[1] + (prev[1] - a[1]) * 0.16],
    ];
    mappedSolid(out, 'metal', p, 0.5, height + 1.7, silver);
    mappedSolid(out, 'stone', p, 0, 0.5, [0.18, 0.2, 0.21]);
  }
  mappedCap(out, 'metal', plan, height, silver, [], true);
}
function beacon(out, bottom, top) {
  const sides = out.detail.beaconSides;
  const center = tip - 5.6,
    r = 4.7;
  const a = radialRing(bottom, r, r, sides, [center, 0]),
    b = radialRing(top, r, r, sides, [center, 0]);
  for (let i = 0; i < sides; i++) {
    face(out, 'glass', [a[i], a[(i + 1) % sides], b[(i + 1) % sides], b[i]], copper);
    if (out.detail.beaconFrames && i % 4 === 0) tube(out, 'metal', a[i], b[i], 0.035, silver, 6);
  }
  if (out.detail.beaconFrames)
    for (let y = bottom; y < top; y += 1.3) {
      const ring = radialRing(y, r + 0.015, r + 0.015, sides, [center, 0]);
      tubePath(out, 'metal', ring.slice(0, sides), 0.025, silver, 4, true);
    }
  loft(
    out,
    'metal',
    [
      radialRing(top, r + 0.18, r + 0.18, sides, [center, 0]),
      radialRing(top + 0.45, r + 0.18, r + 0.18, sides, [center, 0]),
    ],
    silver,
  );
}
function crown(out, bodyTop, low, high, height) {
  const cut = tip - 10,
    w = ((tip - cut) * S) / (2 * H),
    upperPlan = [
      [cut, -w],
      [rear, -S / 2],
      [rear, S / 2],
      [cut, w],
    ];
  beacon(out, bodyTop, low);
  // The recessed beacon meets a closed ledge below and the gable soffit above.
  mappedCap(out, 'metal', plan, bodyTop, silver);
  mappedCap(out, 'metal', plan, low, silver, [], true);
  const es = edges(upperPlan);
  for (let i = 0; i < es.length; i++) {
    const { at, len } = es[i];
    if (i === 3) {
      panels(out, at, 0, 1, bodyTop, low, len);
      continue;
    }
    panels(out, at, 0, 1, bodyTop, bodyTop + 2.2, len);
    panels(out, at, 0, 1, low - 2, low, len);
    if (i === 1) {
      curvedFace(out, bodyTop + 2.2, low - 2, 2, copper);
      continue;
    }
    const count = 5,
      start = 0.29,
      end = 0.76,
      pitch = (end - start) / count;
    let u = 0;
    for (let k = 0; k < count; k++) {
      const l = start + k * pitch,
        r = l + pitch * 0.47;
      panels(out, at, u, l, bodyTop + 2.2, low - 2, len);
      panes(out, (a, y) => at(a, y, -0.18), l, r, bodyTop + 2.2, low - 2, len, [0.22, 0.33, 0.36]);
      u = r;
      if (out.detail.slitFrames)
        for (const v of [l, r])
          beam(out, 'metal', at(v, bodyTop + 2.2), at(v, low - 2), 0.1, 0.12, silver);
    }
    panels(out, at, u, 1, bodyTop + 2.2, low - 2, len);
  }
  // Two solid cladded triangular gables flank a genuine sloped glass roof.
  const roofY = (x) => low + ((x - rear) / H) * (high - low);
  for (const edge of [edges(plan)[0], edges(plan)[2]]) {
    const { at } = edge,
      n = 1;
    for (let i = 0; i < n; i++) {
      const a = i / n,
        b = (i + 1) / n,
        ta = roofY(at(a, 0)[0]),
        tb = roofY(at(b, 0)[0]);
      if (Math.max(ta, tb) - low < 0.02) continue;
      const y = low;
      if (Math.min(ta, tb) - y < 0.02)
        tri(out, 'metal', [at(a, y), at(b, y), at(ta > tb ? a : b, Math.max(ta, tb))], silver);
      else face(out, 'metal', [at(a, y), at(b, y), at(b, tb), at(a, ta)], silver);
    }
    if (out.detail.louvres)
      for (let y = high - 26; y < high - 17; y += 1.5) {
        const nearTip = edge.a[0] > edge.b[0] ? [0.06, 0.29] : [0.71, 0.94];
        const cuts = nearTip.map((u) => edge.at(u, y, 0.08));
        if (cuts.every((p) => roofY(p[0]) > y + 0.5))
          beam(out, 'metal', cuts[0], cuts[1], 0.55, 0.3, dark);
      }
  }
  const q = plan.map((p) => point(p, roofY(p[0])));
  tri(out, 'glass', q, [0.27, 0.37, 0.38]);
  // Subdivide the triangular roof into physical diamond-grid framing and glass panes.
  if (out.detail.roofDivisions > 0)
    for (let j = 0; j <= out.detail.roofDivisions; j++) {
      const t = j / out.detail.roofDivisions,
        x = rear + H * t,
        z = ((1 - t) * S) / 2,
        y = roofY(x) + 0.1;
      if (z > 0.1) beam(out, 'metal', [x, y, -z], [x, y, z], 0.14, 0.17, silver);
      if (j < out.detail.roofDivisions) {
        for (const sign of [-1, 1]) {
          const start = [rear, low + 0.1, ((sign * S) / 2) * (1 - 2 * t)],
            end = [rear + H * (1 - t), roofY(rear + H * (1 - t)) + 0.1, ((-sign * S) / 2) * t];
          if (Math.hypot(...start.map((v, k) => v - end[k])) > 0.2)
            beam(out, 'metal', start, end, 0.11, 0.14, silver);
        }
      }
    }
  beamPath(out, 'metal', q.slice(0, 3), 0.5, 0.65, silver, true);
  // Rectangular two-stage pinnacle with a solid lower plate and narrow upper fin.
  const x = tip - 0.3;
  box(out, 'metal', [x - 0.48, high - 5, -0.48], [x + 0.48, height - 22, 0.48], silver);
  box(
    out,
    'stainless',
    [x - 0.22, height - 22, -0.22],
    [x + 0.22, height, 0.22],
    [0.61, 0.66, 0.68],
  );
  if (out.detail.mastJoints)
    for (let y = high + 1; y < height - 22; y += 1.4)
      beam(out, 'metal', [x - 0.51, y, -0.5], [x + 0.51, y, 0.5], 0.04, 0.04, [0.45, 0.5, 0.51]);
  if (out.detail.maintenance)
    for (let k = 0; k < 3; k++) {
      const xx = rear + 8 + k * 9,
        zz = -S / 2 + 8 + k * 5;
      tube(out, 'metal', [xx, roofY(xx) + 0.4, zz], [xx + 3, roofY(xx) + 3.2, zz], 0.15, silver, 8);
    }
}
function entrance(out, isHotel) {
  if (!out.detail.entry) return;
  const roof = [
    [rear - 1, 6.8, -12],
    [rear - 1, 6.8, 12],
    [rear - 18, 5.3, 0],
  ];
  tri(out, 'glass', roof, [0.27, 0.38, 0.41]);
  tri(out, 'glass', roof.toReversed(), [0.27, 0.38, 0.41]);
  beamPath(out, 'metal', roof.slice(0, 3), 0.35, 0.4, silver, true);
  for (let i = 1; i < out.detail.canopyDivisions; i++) {
    const t = i / out.detail.canopyDivisions;
    beam(
      out,
      'metal',
      [rear - 1 - 17 * t, 6.8 - 1.5 * t, -12 * (1 - t)],
      [rear - 1 - 17 * t, 6.8 - 1.5 * t, 12 * (1 - t)],
      0.09,
      0.1,
      silver,
    );
  }
  for (const z of [-9, 9])
    tube(out, 'stainless', [rear - 4.8, 0, z], [rear - 4.8, 6.46, z], 0.16, silver, 12);
  for (const z of [-5, 0, 5]) {
    const r = 1.25,
      cx = rear - 1.5;
    const a = radialRing(0.1, r, r, out.detail.doorSides, [cx, z]),
      b = radialRing(3.25, r, r, out.detail.doorSides, [cx, z]);
    for (let i = 0; i < out.detail.doorSides; i++)
      grid(
        out,
        [a[i], a[(i + 1) % out.detail.doorSides], b[(i + 1) % out.detail.doorSides], b[i]],
        [0.29, 0.39, 0.41],
        1,
        1,
        0.045,
        silver,
        'metal',
      );
    loft(
      out,
      'metal',
      [
        radialRing(3.25, r + 0.12, r + 0.12, out.detail.doorSides, [cx, z]),
        radialRing(3.6, r + 0.12, r + 0.12, out.detail.doorSides, [cx, z]),
      ],
      silver,
    );
  }
  // Small tower-owned arrival apron only; the shared retail complex is not duplicated.
  const apron = [
    [rear - 21, -16],
    [rear - 21, 16],
    [rear + 2, 23],
    [rear + 2, -23],
  ];
  mappedSolid(out, 'stone', apron, 0, 0.12, [0.29, 0.29, 0.28]);
  if (isHotel) {
    for (const sign of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const z = sign * (12.5 + i * 0.46);
        box(
          out,
          'stone',
          [rear - 15, 0.12, z - 0.18],
          [rear - 3, 0.25 + (0.6 - i * 0.06), z + 0.18],
          [0.28, 0.29, 0.28],
        );
      }
  }
}
function buildNative(out, _mapped, hotel = false) {
  const bottom = hotel ? 31.8 : 38.5,
    bodyTop = hotel ? 176 : 218.5,
    low = hotel ? 215 : 253,
    high = hotel ? 263.3 : 301,
    height = hotel ? 309 : 355;
  drum(out, bottom);
  const e = edges(plan);
  ribbonFacade(out, e[0], bottom, bodyTop, hotel ? 3.6 : 4.5);
  ribbonFacade(out, e[2], bottom, bodyTop, hotel ? 3.6 : 4.5);
  curvedFace(out, bottom, bodyTop, hotel ? 3.6 : 4.5);
  for (const [a, b] of [
    [bottom, bottom + 1.4],
    [bodyTop - 1.6, bodyTop],
  ]) {
    for (const edge of e) panels(out, edge.at, 0, 1, a, b, edge.len);
  }
  crown(out, bodyTop, low, high, height);
  entrance(out, hotel);
}

const settings = {
  skyline: {
    floorStep: 5,
    frames: false,
    sills: false,
    gridScale: 4,
    panePitch: 12,
    paneRowPitch: 50,
    curveSides: 6,
    drumSides: 12,
    drumFloors: 1,
    drumBands: false,
    beaconSides: 8,
    beaconFrames: false,
    slitFrames: false,
    louvres: false,
    roofDivisions: 0,
    mastJoints: false,
    maintenance: false,
    entry: false,
  },
  district: {
    floorStep: 3,
    frames: false,
    sills: false,
    gridScale: 2,
    panePitch: 5.6,
    paneRowPitch: 12,
    curveSides: 12,
    drumSides: 24,
    drumFloors: 4,
    drumBands: true,
    beaconSides: 16,
    beaconFrames: false,
    slitFrames: false,
    louvres: true,
    roofDivisions: 4,
    mastJoints: false,
    maintenance: false,
    entry: true,
    canopyDivisions: 4,
    doorSides: 12,
  },
  street: {
    floorStep: 1,
    frames: true,
    mergeCurveFrames: true,
    mergeDrumFrames: true,
    sills: true,
    gridScale: 2,
    panePitch: 2.84,
    paneRowPitch: 4.5,
    curveSides: 20,
    drumSides: 48,
    drumFloors: 8,
    drumBands: true,
    beaconSides: 32,
    beaconFrames: false,
    slitFrames: true,
    louvres: true,
    roofDivisions: 8,
    mastJoints: false,
    maintenance: true,
    entry: true,
    canopyDivisions: 6,
    doorSides: 20,
  },
  closeup: {
    floorStep: 1,
    frames: true,
    sills: true,
    gridScale: 1,
    panePitch: 1.42,
    paneRowPitch: 4.5,
    curveSides: 30,
    drumSides: 90,
    drumFloors: 8,
    drumBands: true,
    beaconSides: 64,
    beaconFrames: true,
    slitFrames: true,
    louvres: true,
    roofDivisions: 24,
    mastJoints: false,
    maintenance: true,
    entry: true,
    canopyDivisions: 12,
    doorSides: 40,
  },
};
function build(out, name) {
  const means = {
    metal: [0.81896, 0.822889, 0.822889],
    stainless: [0.81896, 0.822889, 0.822889],
    foundation: [0.701109, 0.701109, 0.701109],
    stone: [0.701109, 0.701109, 0.701109],
  };
  const target = {
    detail: settings[name],
    ...Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (slot, r, p, n, uv, c) =>
          name === 'skyline'
            ? out[k](
                'silhouette',
                'palette:#ffffff',
                p,
                n,
                uv,
                means[slot] ? c.map((v, i) => v * means[slot][i]) : c,
              )
            : out[k](slot, r, p, n, uv, c),
      ]),
    ),
  };
  buildNative(target, null, false);
}
export const buildEmiratesOfficeReviewedMaster = (out) => build(out, 'closeup');
export const buildEmiratesOfficeSkyline = (out) => build(out, 'skyline');
export const buildEmiratesOfficeDistrict = (out) => build(out, 'district');
export const buildEmiratesOfficeStreet = (out) => build(out, 'street');
export const buildEmiratesOfficeCloseup = (out) => build(out, 'closeup');
