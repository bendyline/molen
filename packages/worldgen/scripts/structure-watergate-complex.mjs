/** Original medium-fi coordinated Watergate exterior; plans from map controls, facade/roof forms from Qualla photos. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { B, c, landmarkSurfaces } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const framePath = new URL(
  '../../../content/worldgen/source/places/dq/dqc/watergate_complex/map-frame.json',
  import.meta.url,
);
const roles = {
  35184818078664: ['east-residence', 13],
  35184818078669: ['south-residence', 12],
  35184818078655: ['south-office', 11],
  35184818078660: ['hotel-and-north-office', 12],
  35184818078673: ['rounded-roof', 0],
  35184818078678: ['office-projection', 11],
  35184818078648: ['west-residence', 13],
};
function ringFor(points, tolerance = 0.03) {
  const original = points.filter(
    (p, i) => !i || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-7,
  );
  if (
    original.length > 1 &&
    Math.hypot(original[0][0] - original.at(-1)[0], original[0][1] - original.at(-1)[1]) < 1e-7
  )
    original.pop();
  const retained = original.map((_, i) => i);
  // Bound each replacement against the original arc, so repeated removals cannot
  // accumulate an outline error larger than the declared detail tolerance.
  function arcFits(start, end) {
    const a = original[start],
      b = original[end],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      lengthSquared = dx * dx + dz * dz;
    if (!lengthSquared) return false;
    for (let j = (start + 1) % original.length; j !== end; j = (j + 1) % original.length) {
      const p = original[j],
        t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSquared));
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) >= tolerance) return false;
    }
    return true;
  }
  let changed = true;
  while (changed && retained.length > 5) {
    changed = false;
    for (let i = 0; i < retained.length; i++) {
      if (
        arcFits(
          retained[(i + retained.length - 1) % retained.length],
          retained[(i + 1) % retained.length],
        )
      ) {
        retained.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  const r = retained.map((i) => original[i]);
  if (
    r.reduce(
      (sum, a, i) => sum + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
      0,
    ) < 0
  )
    r.reverse();
  return r;
}
function edges(r) {
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    return { a, b, dx, dz, len, nx: dz / len, nz: -dx / len };
  });
}
function face(o, slot, e, y0, y1, offset, color) {
  const { a, b, nx, nz } = e;
  quad(
    o,
    slot,
    [
      [a[0] + nx * offset, y0, a[1] + nz * offset],
      [b[0] + nx * offset, y0, b[1] + nz * offset],
      [b[0] + nx * offset, y1, b[1] + nz * offset],
      [a[0] + nx * offset, y1, a[1] + nz * offset],
    ],
    [nx, 0, nz],
    c[color],
  );
}
function prism(o, slot, r, y0, y1, color, roofColor = color) {
  for (const e of edges(r)) face(o, slot, e, y0, y1, 0, color);
  const indices = earcut(r.flat());
  for (const [y, normal, col] of [
    [y0, [0, -1, 0], color],
    [y1, [0, 1, 0], roofColor],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      if (y === y1) p.reverse();
      o.addTriangle(
        slot === 'glass' ? 'concrete' : slot,
        'palette:#ffffff',
        p,
        normal,
        p.map((q) => [q[0], q[2]]),
        c[col],
      );
    }
}
function roundPod(o, x, z, y, rx, rz, height, segments) {
  const ring = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [x + Math.cos(a) * rx, z + Math.sin(a) * rz];
  });
  prism(o, 'concrete', ring, y, y + height - 0.02, 'cream', 'roof');
  const inner = ring.map((p) => [x + (p[0] - x) * 0.84, z + (p[1] - z) * 0.84]);
  for (let i = 0; i < segments; i++)
    quad(
      o,
      'concrete',
      [
        [...ring[i].slice(0, 1), y + height, ring[i][1]],
        [ring[(i + 1) % segments][0], y + height, ring[(i + 1) % segments][1]],
        [inner[(i + 1) % segments][0], y + height, inner[(i + 1) % segments][1]],
        [inner[i][0], y + height, inner[i][1]],
      ],
      [0, 1, 0],
      c.cream,
    );
}
// Roof forms are individually positioned from the inspected aerial; service equipment is approximate.
const pods = [
  [-88, -135, 42, 5.8, 3.3],
  [-58, -111, 42, 5, 3.6],
  [32, -44, 41, 5, 3.4],
  [68, -9, 41, 5.2, 3.8],
  [88, 42, 41, 5.8, 3.8],
  [-32, 58, 38, 4.7, 4.2],
  [1, 46, 38, 5.6, 3.8],
  [32, 66, 38, 5, 3.7],
  [26, 119, 38, 6.1, 4.4],
  [14, 139, 38, 5.2, 3.9],
];
function complex(o, frame, detail) {
  const tolerance = detail === 0 ? 2.2 : detail === 1 ? 1.0 : detail === 2 ? 0.7 : 0.08;
  for (const f of frame.features) {
    const id = f.id.split('/')[1],
      role = roles[id];
    if (!role) {
      if (detail > 0)
        prism(o, 'concrete', ringFor(f.rings[0], detail === 1 ? 1.8 : 0.15), -6.8, 3.4, 'sand');
      continue;
    }
    const [name, floors] = role,
      r = ringFor(f.rings[0], tolerance),
      h = f.properties.height;
    if (name === 'rounded-roof') {
      prism(o, 'concrete', r, 38, h, 'cream', 'roof');
      continue;
    }
    prism(o, detail === 0 ? 'concrete' : 'glass', r, -6.8, h, 'dark', 'roof');
    const residential = name.includes('residence'),
      step = h / floors;
    for (const e of edges(r)) {
      const { a, b, nx, nz, len, dx, dz } = e;
      const hotel = name === 'hotel-and-north-office' && (a[1] + b[1]) / 2 > -65;
      const projecting = residential || hotel;
      const offset = detail < 2 ? 0.15 : residential ? 1.3 : hotel ? 0.7 : 0.22;
      const levels =
        detail === 0
          ? Array.from({ length: 6 }, (_, i) => Math.round(((i + 1) * floors) / 6))
          : Array.from({ length: floors }, (_, i) => i + 1);
      for (const floor of levels) {
        const y = floor * step,
          wide = !projecting || floor === floors || floor === 8;
        face(o, 'concrete', e, y - (detail === 0 ? 1.5 : wide ? 0.86 : 0.65), y, offset, 'cream');
        if (detail >= 2) {
          quad(
            o,
            'concrete',
            [
              [a[0], y, a[1]],
              [b[0], y, b[1]],
              [b[0] + nx * offset, y, b[1] + nz * offset],
              [a[0] + nx * offset, y, a[1] + nz * offset],
            ],
            [0, 1, 0],
            c.cream,
          );
          if (projecting && floor < floors && !wide) {
            face(o, 'concrete', e, y + 0.72, y + 0.8, offset, 'cream');
            if (detail === 3) {
              const bays = Math.max(1, Math.round(len / 1.65));
              for (let j = 0; j < bays; j++) {
                const t = (j + 0.5) / bays,
                  x = a[0] + dx * t + nx * offset,
                  z = a[1] + dz * t + nz * offset,
                  ux = (dx / len) * 0.07,
                  uz = (dz / len) * 0.07;
                const p = [
                  [x - ux, y + 0.05, z - uz],
                  [x + ux, y + 0.05, z + uz],
                  [x + ux, y + 0.72, z + uz],
                  [x - ux, y + 0.72, z - uz],
                ];
                quad(o, 'concrete', p, [nx, 0, nz], c.cream);
                quad(o, 'concrete', p.toReversed(), [-nx, 0, -nz], c.cream);
              }
            }
          }
        }
      }
      if (detail >= 2) {
        const bays = Math.max(1, Math.round(len / (detail === 2 ? 4.2 : 2.8)));
        for (let k = 0; k < bays; k++) {
          const t = (k + 0.5) / bays,
            x = a[0] + dx * t + nx * 0.05,
            z = a[1] + dz * t + nz * 0.05;
          beam(o, 'metal', [x, 0, z], [x, h, z], 0.12, 0.14, c.cream);
        }
        // A recessed lower level and regular supports keep the complex off a featureless base.
        face(o, 'concrete', e, -3.5, -3.15, Math.min(offset, 0.45), 'cream');
        face(o, 'concrete', e, -0.35, 0, Math.min(offset, 0.45), 'cream');
      }
      if (detail > 0) face(o, 'concrete', e, h, h + 0.65, 0, 'cream');
    }
    if (detail >= 2) {
      let placed = 0;
      for (const e of edges(r))
        if (e.len > 9 && placed++ % 3 === 0) {
          const x = (e.a[0] + e.b[0]) / 2 - e.nx * 3,
            z = (e.a[1] + e.b[1]) / 2 - e.nz * 3;
          B(o, 'concrete', x, h, z, 3.1, 1.6, 2.4, 'cream');
          B(o, 'metal', x, h + 1.6, z, 2.8, 0.18, 2.1, 'roof');
        }
    }
  }
  if (detail > 0)
    for (const [x, z, y, rx, rz] of pods)
      roundPod(o, x, z, y, rx, rz, 2.6, detail === 1 ? 8 : detail === 2 ? 12 : 20);
  if (detail >= 2) {
    // Low hotel arrival canopy and a curved courtyard arcade; these do not fill the landscaped court.
    const canopy = ringFor([
      [-68, -14],
      [-42, -37],
      [-35, -30],
      [-62, -7],
    ]);
    prism(o, 'concrete', canopy, 3.5, 4.1, 'cream');
    for (const [x, z] of [
      [-65, -12],
      [-55, -21],
      [-45, -30],
    ])
      B(o, 'concrete', x, -2, z, 0.45, 5.5, 0.45, 'cream');
    const inner = [],
      outer = [];
    for (let i = 0; i <= 18; i++) {
      const a = -Math.PI * 0.95 + (i / 18) * Math.PI * 1.0;
      inner.push([-7 + Math.cos(a) * 24, 20 + Math.sin(a) * 18]);
      outer.push([-7 + Math.cos(a) * 28, 20 + Math.sin(a) * 22]);
    }
    prism(o, 'concrete', ringFor([...inner, ...outer.reverse()]), 0.6, 1.2, 'cream');
    for (let i = 0; i < inner.length; i += 3)
      B(o, 'concrete', inner[i][0], -1.8, inner[i][1], 0.35, 2.4, 0.35, 'cream');
  }
}
export function watergate(o, frame) {
  complex(o, frame, 3);
}
export function watergateSkyline(o) {
  complex(o, JSON.parse(fs.readFileSync(framePath)), 0);
}
export function watergateDistrict(o) {
  complex(o, JSON.parse(fs.readFileSync(framePath)), 1);
}
export function watergateStreet(o) {
  complex(o, JSON.parse(fs.readFileSync(framePath)), 2);
}
export const watergateModel = {
  id: 'watergate_complex',
  recipe: 'structure-watergate-complex.mjs',
  key: 'watergate_complex',
  cell: 'dq/dqc',
  title: 'Watergate complex',
  brief:
    'Coordinated curved residential, hotel and office blocks with recessed strip glazing, projecting residential balconies and white balustrade rhythm, flush office spandrels, low courtyard connections and rounded rooftop service forms.',
  camera: [-250, 190, 285],
  mediumFiContext: { scale: 3.4 },
  build: watergate,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Central courtyard [0,0] defines the independent host datum; lower facade and foundation closures extend to -6.8 m across the sloping generalized site. Ground-floor and terrace levels are interpretations, not a measured accessibility model.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-watergate-complex.mjs',
    level: 'skyline',
    export: 'watergateSkyline',
    errorMeters: 2.2,
    authoredLevels: {
      district: {
        export: 'watergateDistrict',
        errorMeters: 1.3,
        surfaces: {
          ...landmarkSurfaces,
          glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
        },
      },
      street: {
        export: 'watergateStreet',
        errorMeters: 0.85,
        surfaces: {
          ...landmarkSurfaces,
          glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
        },
      },
    },
  },
  limitations: [
    'Original medium-fi exterior of the coordinated Watergate complex; mapped outlines and photographic proportions are generalized, not surveyed.',
    'The three residential blocks, hotel wing, adjoining northern office and southern office are differentiated. The rounded T-shaped mapped part is a rooftop form, not another tower. Former Howard Johnson hotel is excluded.',
    'Individual balconies, fine balustrades, service pods and roof equipment are interpretations from the selected aerial and street photographs. Not every bay, renovation or rooftop appliance is reproduced.',
    'Low podium, entry and court structures are approximate; landscaping, pools, interiors, exact stair/ramp connections and adjacent streets are outside scope.',
    'Coarse preserved host terrain controls ground contact; variable exposed foundation depth is not a surveyed basement elevation. References are inspected locally, not embedded or redistributed.',
  ],
};
