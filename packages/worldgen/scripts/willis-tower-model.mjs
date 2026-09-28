/** Willis Tower: individual bundled tubes and current exterior architectural components. */

import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const black = [0.105, 0.115, 0.115],
  bronze = [0.24, 0.235, 0.21];
const silver = [0.77, 0.78, 0.77],
  concrete = [0.64, 0.63, 0.59];
const W = 22.86;
const anchor = [-87.635903, 41.878884],
  heading = 0.0176609603088965;
const evidence = JSON.parse(
  readFileSync(structureSourcePath('n0136_willis_tower', 'map-evidence.json'), 'utf8'),
);
const mapPlan = (id) => {
  const e = evidence.elements.find((e) => e.id === id);
  if (!e?.geometry) throw new Error(`Missing Willis mapped part ${id}`);
  const ps = e.geometry.slice(0, -1).map((p) => {
    const x = (p.lon - anchor[0]) * 111319.49 * Math.cos((anchor[1] * Math.PI) / 180),
      z = -(p.lat - anchor[1]) * 111319.49;
    return [
      Math.cos(heading) * x - Math.sin(heading) * z,
      Math.sin(heading) * x + Math.cos(heading) * z,
    ];
  });
  const area = ps.reduce((sum, p, i) => {
    const q = ps[(i + 1) % ps.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  return area > 0 ? ps.toReversed() : ps;
};
// World-oriented local frame: X east, Z south. Published 50/66/90/109-storey terminations.
const towers = [
  [-1, -1, 50],
  [0, -1, 90],
  [1, -1, 66],
  [-1, 0, 109],
  [0, 0, 109],
  [1, 0, 90],
  [-1, 1, 66],
  [0, 1, 90],
  [1, 1, 50],
];
const level = (floor) => {
  const stops = [
    [0, 0],
    [1, 9.4],
    [50, 200],
    [66, 260],
    [90, 355],
    [102, 412.3944],
    [109, 442.1],
  ];
  for (let i = 1; i < stops.length; i++)
    if (floor <= stops[i][0]) {
      const [a, y] = stops[i - 1],
        [b, h] = stops[i];
      return y + ((h - y) * (floor - a)) / (b - a);
    }
  throw new Error(`Invalid floor ${floor}`);
};
const mech = (floor) =>
  (floor >= 29 && floor <= 32) ||
  (floor >= 64 && floor <= 65) ||
  (floor >= 88 && floor <= 89) ||
  floor >= 104;
const face = (out, slot, points, color) => quad(out, slot, points, normalFor(...points), color);
function transformed(out, x, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const p = ([a, b, d]) => [x + c * a + s * d, b, z - s * a + c * d];
  const n = ([a, b, d]) => [c * a + s * d, b, -s * a + c * d];
  return {
    addQuad(slot, ref, ps, normal, uv, color) {
      out.addQuad(slot, ref, ps.map(p), n(normal), uv, color);
    },
    addTriangle(slot, ref, ps, normal, uv, color) {
      out.addTriangle(slot, ref, ps.map(p), n(normal), uv, color);
    },
    addConvexPolygon(slot, ref, ps, normal, uv, color) {
      out.addConvexPolygon(slot, ref, ps.map(p), n(normal), uv, color);
    },
  };
}
function facade(out, width, y0, y1, floor, glass = bronze) {
  // Recessed bronze panes separated by broad structural piers and fine window mullions.
  if (mech(floor)) {
    // Recess the opaque backing; a coplanar underlay z-fights with louvers at skyline range.
    box(out, 'metal', [-width / 2, y0, -1.4], [width / 2, y1, -1.2], black);
    for (const x of [-width / 2, width / 2 - 0.12])
      box(out, 'metal', [x, y0, -1.4], [x + 0.12, y1, 0.02], black);
  } else {
    box(out, 'metal', [-width / 2, y0, -0.22], [width / 2, y0 + 0.83, 0], black);
    box(out, 'metal', [-width / 2, y1 - 0.13, -0.22], [width / 2, y1, 0], black);
  }
  const bays = Math.round(width / (W / 10));
  for (let i = 0; i < bays; i++) {
    const a = -width / 2 + (i * width) / bays,
      b = a + width / bays;
    if (mech(floor)) {
      for (let y = y0 + 0.18; y < y1 - 0.09; y += 0.23)
        box(
          out,
          'metal',
          [a + 0.14, y, 0.018],
          [b - 0.14, Math.min(y + 0.065, y1), 0.16],
          [0.16, 0.17, 0.165],
        );
    } else {
      const variation = 0.91 + ((i * 7 + floor * 11) % 13) * 0.012;
      face(
        out,
        'glass',
        [
          [a, y0 + 0.83, 0.025],
          [b, y0 + 0.83, 0.025],
          [b, y1 - 0.13, 0.025],
          [a, y1 - 0.13, 0.025],
        ],
        glass.map((v) => v * variation),
      );
      box(out, 'metal', [a + 0.11, y0 + 0.77, 0.025], [b - 0.11, y0 + 0.84, 0.12], black);
    }
    const pier = i % 2 === 0 ? 0.24 : 0.095;
    box(out, 'metal', [a - pier / 2, y0, 0.015], [a + pier / 2, y1, 0.21], black);
  }
  box(out, 'metal', [width / 2 - 0.12, y0, 0.015], [width / 2, y1, 0.21], black);
  box(out, 'metal', [-width / 2, y0, 0.02], [width / 2, y0 + 0.18, 0.17], black);
}
function rooftop(out, x, z, h) {
  const r = transformed(out, x, z);
  box(r, 'metal', [-W / 2, h - 0.12, -W / 2], [W / 2, h, W / 2], [0.18, 0.19, 0.18]);
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const e = transformed(r, (Math.sin(a) * W) / 2, (Math.cos(a) * W) / 2, a);
    box(e, 'metal', [-W / 2, h, -0.2], [W / 2, h + 0.6, 0.05], black);
    for (let u = -W / 2 + 0.6; u < W / 2; u += 1.3)
      box(e, 'metal', [u, h + 0.6, -0.14], [u + 0.04, h + 0.87, -0.09], silver);
    box(e, 'metal', [-W / 2, h + 0.84, -0.15], [W / 2, h + 0.89, -0.08], silver);
  }
  for (const u of [-5.8, 5.8]) {
    box(r, 'metal', [u - 2.3, h, -3.3], [u + 2.3, h + 1.5, 3.3], [0.24, 0.25, 0.24]);
    for (let z = -2.9; z < 3; z += 0.45)
      box(r, 'metal', [u - 2.1, h + 1.51, z], [u + 2.1, h + 1.58, z + 0.07], silver);
  }
}
function antenna(out, x, z, tip) {
  box(out, 'metal', [x - 2, 442.1, z - 2], [x + 2, 446, z + 2], black);
  const base = 446,
    wide = 1.55,
    shoulder = 481;
  for (const [a, b] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    tube(
      out,
      'metal',
      [x + a * wide, base, z + b * wide],
      [x + a * 0.62, shoulder, z + b * 0.62],
      0.115,
      silver,
      12,
    );
  }
  for (let y = base; y < shoulder; y += 2.5) {
    const w = wide - ((wide - 0.62) * (y - base)) / (shoulder - base);
    for (const sign of [-1, 1]) {
      beam(
        out,
        'metal',
        [x - w, y, z + sign * w],
        [x + w, y + 2.5, z + sign * (w - 0.07)],
        0.065,
        0.065,
        silver,
      );
      beam(
        out,
        'metal',
        [x + sign * w, y, z - w],
        [x + sign * (w - 0.07), y + 2.5, z + w],
        0.065,
        0.065,
        silver,
      );
      tube(out, 'metal', [x - w, y, z + sign * w], [x + w, y, z + sign * w], 0.06, silver, 8);
      tube(out, 'metal', [x + sign * w, y, z - w], [x + sign * w, y, z + w], 0.06, silver, 8);
    }
  }
  tube(out, 'metal', [x, shoulder, z], [x, tip - 3, z], 0.53, [0.88, 0.89, 0.87], 32);
  tube(out, 'metal', [x, tip - 3, z], [x, tip, z], 0.17, silver, 20);
  for (let y = shoulder + 1; y < tip - 4; y += 1.55) {
    tube(out, 'metal', [x, y, z], [x, y + 0.1, z], 0.59, silver, 32);
    for (const s of [-1, 1])
      box(
        out,
        'metal',
        [x + s * 0.75 - 0.09, y, z - 0.1],
        [x + s * 0.75 + 0.09, y + 0.76, z + 0.1],
        silver,
      );
  }
  for (const y of [466, 489, tip - 7]) {
    sphere(out, 'glass', [x + 0.85, y, z], [0.15, 0.2, 0.15], [0.88, 0.2, 0.12], 12, 8);
  }
}
function cap(out, plan, y, slot, color) {
  for (const inds of ShapeUtils.triangulateShape(
    plan.map((p) => new Vector2(...p)),
    [],
  )) {
    let p = inds.map((i) => [plan[i][0], y, plan[i][1]]);
    if (normalFor(...p)[1] < 0) p = p.toReversed();
    out.addTriangle(
      slot,
      'palette:#ffffff',
      p,
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
}
function podium(out) {
  const parts = [
    1178212992, 1178212993, 1178212994, 1178212995, 1178212996, 1178212997, 1178212998, 1178212999,
    1178213001, 1178226263, 1178226264,
  ];
  for (const id of parts) {
    const e = evidence.elements.find((e) => e.id === id),
      h = Number(e.tags.height),
      plan = mapPlan(id);
    cap(
      out,
      plan,
      h,
      'concrete',
      e.tags['roof:colour'] === '#868456' ? [0.5, 0.53, 0.38] : concrete,
    );
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        width = Math.hypot(dx, dz);
      if (width < 0.01) continue;
      const f = transformed(out, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
      // Mapped polygons are clockwise in X/Z, so their front faces point outside.
      const n = Math.max(1, Math.ceil(width / 1.8));
      box(f, 'metal', [-width / 2, 0, -1.4], [width / 2, h, -1.2], black);
      const floors = Math.max(1, Math.round(h / 5));
      for (let k = 0; k < floors; k++)
        for (let j = 0; j < n; j++) {
          const x0 = -width / 2 + (j * width) / n,
            x1 = x0 + width / n;
          box(
            f,
            'glass',
            [x0 + 0.08, (k * h) / floors + 0.24, 0.015],
            [x1 - 0.08, ((k + 1) * h) / floors - 0.14, 0.04],
            [0.22, 0.32, 0.35],
          );
          box(
            f,
            'metal',
            [x0, (k * h) / floors, 0.04],
            [x0 + 0.065, ((k + 1) * h) / floors, 0.18],
            black,
          );
        }
      box(f, 'metal', [-width / 2, h - 0.22, -0.1], [width / 2, h + 0.12, 0.18], black);
      // Roof guard with individual posts rather than an opaque railing slab.
      for (let u = -width / 2 + 0.5; u < width / 2; u += 1.5)
        box(f, 'metal', [u, h, -0.18], [u + 0.045, h + 1.05, -0.13], black);
      box(f, 'metal', [-width / 2, h + 1, -0.19], [width / 2, h + 1.05, -0.12], black);
    }
  }
  // Current Novum hill skylight on the south roof: doubly curved rectangular glass shell.
  const point = (i, j) => {
    const u = -1 + (2 * i) / 12,
      v = -1 + (2 * j) / 14;
    return [0.3 + u * 11.43, 20.15 + 4.1 * (1 - u * u) * (1 - v * v), 48.6 + v * 12.954];
  };
  for (let j = 0; j < 14; j++)
    for (let i = 0; i < 12; i++) {
      const p = [point(i, j), point(i, j + 1), point(i + 1, j + 1), point(i + 1, j)];
      face(out, 'glass', p, [0.36, 0.49, 0.53]);
      beam(out, 'metal', p[0], p[1], 0.055, 0.09, silver);
      beam(out, 'metal', p[0], p[3], 0.055, 0.09, silver);
    }
  // Roof landscape beds and timber seating, all confined to the recorded south terrace.
  for (const [x, z, w, d] of [
    [-15, 62, 7, 2.6],
    [20, 64, 10, 3],
    [-44, 42, 3, 9],
    [-8, 30, 7, 2.4],
  ]) {
    box(
      out,
      'concrete',
      [x - w / 2, 20, z - d / 2],
      [x + w / 2, 20.55, z + d / 2],
      [0.57, 0.59, 0.56],
    );
    box(
      out,
      'foliage',
      [x - w / 2 + 0.15, 20.55, z - d / 2 + 0.15],
      [x + w / 2 - 0.15, 20.75, z + d / 2 - 0.15],
      [0.24, 0.34, 0.2],
    );
    for (let u = -w / 2 + 0.45; u < w / 2; u += 0.8)
      sphere(out, 'foliage', [x + u, 20.88, z], [0.4, 0.35, 0.6], [0.31, 0.39, 0.21], 10, 6);
    for (let u = -w / 2; u < w / 2; u += 0.14)
      box(
        out,
        'wood',
        [x + u, 20.57, z + d / 2 + 0.15],
        [x + u + 0.1, 20.65, z + d / 2 + 0.7],
        [0.48, 0.36, 0.24],
      );
  }
  // The mapped west entrance portico and small sidewalk canopies.
  for (const id of [
    1178212981, 1178212983, 1178212984, 1178212985, 1178212986, 1178212987, 1178212988, 1178212989,
    1178212990, 1178212991, 1178213002, 1178234330,
  ]) {
    const p = mapPlan(id),
      h = id === 1178212981 ? 18 : 4.2;
    cap(out, p, h, 'metal', black);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01) continue;
      beam(out, 'metal', [a[0], h, a[1]], [b[0], h, b[1]], 0.14, 0.2, black);
    }
  }
}
function buildWillis(out) {
  // Tower center is independent of the much larger Catalog podium; mapped center is set below.
  const t = transformed(out, 0, 0);
  for (const [ix, iz, floors] of towers) {
    const x = ix * W,
      z = iz * W,
      h = level(floors);
    for (const [dx, dz, a] of [
      [0, 1, 0],
      [1, 0, Math.PI / 2],
      [0, -1, Math.PI],
      [-1, 0, -Math.PI / 2],
    ]) {
      const neighbor = towers.find(([nx, nz]) => nx === ix + dx && nz === iz + dz);
      const start = neighbor ? neighbor[2] : 0;
      if (start >= floors) continue;
      const f = transformed(t, x + (dx * W) / 2, z + (dz * W) / 2, a);
      for (let floor = start + 1; floor <= floors; floor++)
        facade(f, W, level(floor - 1), level(floor), floor);
    }
    rooftop(t, x, z, h);
  }
  // The 2022 renovation added a fifth west-facing glass balcony (Clark/operator evidence).
  for (const z of [-9.144, -4.572, 0, 4.572, 9.144]) {
    const x = -1.5 * W - 1.31,
      y = 412.3944;
    const tint = [0.38, 0.52, 0.55];
    box(t, 'clear_glass', [x, y, z - 1.524], [-1.5 * W - 0.01, y + 0.075, z + 1.524], tint);
    box(t, 'clear_glass', [x, y + 3.0, z - 1.524], [-1.5 * W - 0.01, y + 3.048, z + 1.524], tint);
    box(t, 'clear_glass', [x, y, z - 1.524], [x + 0.038, y + 3.048, z + 1.524], tint);
    for (const s of [-1, 1])
      box(
        t,
        'clear_glass',
        [x, y, z + s * 1.524 - 0.019],
        [-1.5 * W, y + 3.048, z + s * 1.524 + 0.019],
        tint,
      );
    for (const yy of [y, y + 3.048])
      for (const zz of [z - 1.524, z + 1.524])
        tube(t, 'metal', [x, yy, zz], [-1.5 * W + 0.4, yy, zz], 0.045, silver, 8);
  }
  for (const x of [-W, 0]) {
    box(t, 'metal', [x - 4, 442.1, -6], [x + 4, 446, -0.7], black);
    for (let z = -5.7; z < -1; z += 0.35)
      box(t, 'metal', [x - 4.03, 443, z], [x + 4.03, 443.1, z + 0.08], silver);
  }
  antenna(t, -24.55, -0.1, 527.3);
  antenna(t, 2.25, 0, 527.3);
  for (const [x, z, h] of [
    [-W - 8, 5, 467],
    [-W + 7, -7, 460],
    [7, -5, 462],
    [8, 7, 453],
  ])
    tube(t, 'metal', [x, 442.1, z], [x, h, z], 0.12, silver, 16);
  podium(out);
}

export const willisStudies = [
  {
    id: 'N0136',
    key: 'willis_tower',
    wikidataId: 'Q29294',
    title: 'Willis Tower',
    build: buildWillis,
    visualBrief:
      'Nine correctly terminated 75-foot bundled tubes; bronze window bays, projecting black mullions, louvred mechanical storeys, setback parapets and roof equipment, west-facing Skydeck glass balconies, detailed broadcast masts and ancillary aerials. Current Catalog podium follows eleven mapped components, with glazed storefronts, the curved Novum hill skylight, entrance canopies and roof terrace fittings.',
    sourceFacts: {
      tubeWidthMeters: 22.86,
      roofMeters: 442.1,
      tipMeters: 527.3,
      setbackFloors: [50, 66, 90, 109],
      skydeckMeters: 412.3944,
      ledgeDepthMeters: 1.31,
      ledgeWidthMeters: 3.048,
      ledgeHeightMeters: 3.048,
      ledgeCount: 5,
    },
    nativeAxes: {
      up: '+Y',
      front: '−X west Skydeck side',
      origin: 'center of the nine-tube tower footprint at nominal street grade',
    },
    referencePages: [
      'https://www.som.com/projects/willis-tower-formerly-sears-tower/',
      'https://theskydeck.com/wp-content/uploads/2023/10/The-Hows-Whats-and-Wows-of-Willis-Tower-A-Guide-For-Teachers.pdf.pdf',
      'https://theskydeck.com/media-center/',
      'https://theskydeck.com/wp-content/uploads/2024/03/Skydeck-Chicago_Fact-Sheet_2024.pdf',
      'https://www.clarkconstruction.com/our-work/projects/willis-tower-renovations',
      'https://www.gensler.com/projects/willis-tower-repositioning',
      'https://novumstructures.com/eu/novum_projects/willis-tower/',
    ],
    referenceRights:
      'Original exterior geometry under repository license. Architect/operator images were inspected as references and are not embedded; published facts and dimensions inform the model. OSM mapped evidence is attributed to OpenStreetMap contributors, ODbL 1.0.',
    geographicProposal: {
      anchor,
      heading,
      status: 'preview-proposal',
      elevationMode: 'terrain-contact',
      source: 'https://www.openstreetmap.org/way/380868216',
      notes:
        'The eight mapped upper tube parts fix the separate tower center and prove the west/center upper tubes and opposite 50/66-floor corners. Eleven low mapped parts establish the current Catalog podium. The west-facing observation balconies resolve the square tower directional ambiguity. Published75-foot tube dimensions take precedence over the approximately2% larger mapped upper perimeter.',
    },
    limitations: [
      'Five west-facing balconies follow the operator2024 factsheet and Clark2022 construction record, replacing the original2009 four-box arrangement. Their even spacing across the75-foot west tube is reconstructed; published10-foot width/height and4.3-foot projection are retained.',
      'Mapped setbacks use200/260/355m before the published442.1m roof. Intermediate floor levels are reconstructed piecewise and include the published103rd-floor observation height. Current commercial signs and interior exhibits are omitted.',
      'The podium outline/heights and mast centers use detailed OSM building parts. Novum publishes the85×75-foot skylight; its curved rise, roof plantings, seats and storefront subdivisions are photo-fitted reconstructions rather than construction-survey detail.',
      'Broad floors and setbacks follow published tube termination levels. Individual floor elevations, facade mullion profiles and roof machinery are exterior reconstructions; no private construction drawings or interior spaces are included.',
    ],
    qaCameras: [
      { name: 'near-podium', position: [104, 68, 162], lookAt: [-3, 15, 35] },
      { name: 'near-facade', position: [-78, 160, 73], lookAt: [-24, 148, 23] },
      { name: 'near-mechanical', position: [92, 132, 58], lookAt: [22, 127, 11] },
      { name: 'near-skydeck', position: [-80, 416, 40], lookAt: [-34.4, 413.8, 0] },
      { name: 'near-antennas', position: [-100, 495, 135], lookAt: [-11, 479, 0] },
      { name: 'far-silhouette', position: [650, 335, 930], lookAt: [0, 260, 0] },
    ],
  },
];
