/** Standard, unstretched C-130J. USAF rescue drawing and Lockheed flight-station layout.
 * Forebody crown and window block traced from the Lockheed pocket guide side and plan views and
 * checked against the ZH883 side photograph; the old crown ran up to 0.7 m low and left the
 * flight deck 1.5 m too far aft.
 * Meter geometry, +Y up, +Z nose, +X pilot left. Reference stations remain approximate.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  ellipsoid,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';

/** Forward travel of the whole flight deck from the stations it was first authored at. */
const deckShift = 1.5;
export const c130Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 1.89,
  cy: 2.83,
  ry: 2.07,
  cabinZ: deckShift + 10.55,
  cabinWidth: 2.5,
  eye: [0.55, 3.97, deckShift + 10.55],
  panelZ: deckShift + 11.42,
  floor: 2.72,
});
const rectangle = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
function hingedWing(root, name, stations, material, bindings, source, scale) {
  const a = stations[0],
    b = stations.at(-1),
    mount = group(root, `${name}-mount`, [a[0], a[1], a[2]]),
    g = group(mount, name);
  mount.quaternion.setFromUnitVectors(
    new T.Vector3(1, 0, 0),
    new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(),
  );
  const inv = new T.Matrix4()
      .compose(mount.position, mount.quaternion, new T.Vector3(1, 1, 1))
      .invert(),
    temp = new T.Group(),
    d = detailKit(temp, name);
  wing(d, stations, material);
  d.finish();
  for (const n of [...temp.children]) {
    n.traverse((mesh) => {
      if (mesh.isMesh) mesh.geometry.applyMatrix4(inv);
    });
    g.add(n);
  }
  bindings.push({ node: g.name, source, property: 'rotation', axis: 'x', scale });
  return g;
}
/** The forebody is a smooth moulding; share area-weighted normals between coincident vertices. */
function smoothNormals(mesh) {
  const g = mesh.geometry,
    p = g.getAttribute('position'),
    n = g.getAttribute('normal'),
    index = g.index,
    key = (i) =>
      `${Math.round(p.getX(i) * 2e3)},${Math.round(p.getY(i) * 2e3)},${Math.round(p.getZ(i) * 2e3)}`,
    sums = new Map(),
    a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(p, ids[0]);
    b.fromBufferAttribute(p, ids[1]).sub(a);
    c.fromBufferAttribute(p, ids[2]).sub(a);
    b.cross(c);
    for (const id of ids) {
      const sum = sums.get(key(id)) ?? [0, 0, 0];
      sum[0] += b.x;
      sum[1] += b.y;
      sum[2] += b.z;
      sums.set(key(id), sum);
    }
  }
  for (let i = 0; i < n.count; i++) {
    const [x, y, z] = sums.get(key(i)) ?? [n.getX(i), n.getY(i), n.getZ(i)],
      length = Math.sqrt(x * x + y * y + z * z);
    if (length > 0) n.setXYZ(i, x / length, y / length, z / length);
  }
}
export function buildC130J(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('C130J-airframe', '#929d9b', { side: T.DoubleSide }),
    dark = mat('C130J-trim', '#263136', { side: T.DoubleSide }),
    metal = mat('C130J-alloy', '#9aa9ae', { metalness: 0.7 }),
    rubber = mat('C130J-tire', '#192024'),
    seam = mat('C130J-seam', '#596b6c'),
    glass = mat('C130J-glazing', '#a5c7cf', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'C130J-exterior'),
    noseKit = detailKit(root, 'C130J-forebody'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  // Blunt lower radome, steep windscreen slope, constant cargo barrel, upswept ramp and tail cone.
  // Forward of 10.65 m: pocket guide p20 side crown and belly, and plan half width. The plan was
  // fitted to a 3.78 m barrel; the barrel is now 4.12 m (CC0 3-view), so it scales by 2.06 / 1.89.
  const plan = 2.06 / 1.89;
  const sections = [
    ...[
      [14.895, 0.04, 2.05, 2.25],
      [14.8, 0.25, 1.81, 2.46],
      [14.65, 0.4, 1.63, 2.65],
      [14.39, 0.54, 1.49, 2.78],
      [14.16, 0.66, 1.39, 2.86],
      [13.93, 0.77, 1.3, 2.92],
      [13.65, 0.91, 1.19, 3.03],
      [13.47, 0.99, 1.13, 3.27],
      [13.24, 1.09, 1.05, 3.57],
      [13.0, 1.2, 0.97, 3.88],
      [12.77, 1.31, 0.9, 4.12],
      [12.41, 1.45, 0.86, 4.4],
      [12.19, 1.53, 0.8, 4.56],
      [11.84, 1.65, 0.77, 4.7],
      [11.36, 1.76, 0.77, 4.83],
      [10.65, 1.84, 0.76, 4.86],
    ].map(([z, w, b, t]) => [z, w * plan, b, t]),
    [9.25, 2.06, 0.76, 4.86],
    [7.4, 2.06, 0.76, 4.86],
    [4.6, 2.06, 0.76, 4.86],
    [1.5, 2.06, 0.76, 4.86],
    [-2.2, 2.06, 0.76, 4.86],
    [-3.6, 2.05, 1.12, 4.87],
    [-5.4, 2.02, 1.82, 4.93],
    [-7.5, 1.9, 2.73, 5.04],
    [-9.8, 1.65, 3.72, 5.1],
    [-12.3, 1.12, 4.16, 5.1],
    [-14.5, 0.55, 4.45, 4.88],
    [-14.895, 0.2, 4.58, 4.72],
  ];
  const rings = sections.map(([z, w, b, t]) => {
    const h = t - b;
    return {
      z,
      points: [
        [0, t],
        [0.58 * w, t - 0.025 * h],
        [0.9 * w, t - 0.115 * h],
        [w, t - 0.28 * h],
        [w, b + 0.25 * h],
        [0.86 * w, b + 0.06 * h],
        [0.5 * w, b],
        [0, b - 0.008 * h],
        [-0.5 * w, b],
        [-0.86 * w, b + 0.06 * h],
        [-w, b + 0.25 * h],
        [-w, t - 0.28 * h],
        [-0.9 * w, t - 0.115 * h],
        [-0.58 * w, t - 0.025 * h],
      ],
    };
  });
  const noseEnd = sections.findIndex(([z]) => z === 10.65);
  loft(d, rings, paint, { skip: (i) => i < noseEnd });
  // Smooth forebody over the same sections: the sides stay flat between a super-elliptic crown
  // (exponent 2.7 fits the ring corners above) and belly (3.4), and it relaxes onto those rings
  // by 10.65 m so the barrel meets it vertex for vertex.
  const section = (z, k) => {
    for (let i = 0; i < noseEnd; i++)
      if (z <= sections[i][0] && z >= sections[i + 1][0]) {
        const t = (sections[i][0] - z) / (sections[i][0] - sections[i + 1][0]);
        return sections[i][k] * (1 - t) + sections[i + 1][k] * t;
      }
    return sections[noseEnd][k];
  };
  const crownBase = (z) => section(z, 3) - 0.28 * (section(z, 3) - section(z, 2));
  const crownHeight = (z) => 0.28 * (section(z, 3) - section(z, 2));
  /** Half width of the skin at a height on the upper body. */
  const skinX = (z, y) => {
    const v = (y - crownBase(z)) / crownHeight(z);
    if (v <= 0) return section(z, 1);
    return section(z, 1) * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, v), 2.7)), 1 / 2.7);
  };
  /** Height of the crown skin at a lateral offset. */
  const skinY = (z, x) =>
    crownBase(z) +
    crownHeight(z) *
      Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, x / section(z, 1)), 2.7)), 1 / 2.7);
  // Window block from the guide and the photograph: a level sill, a row divider and a level top
  // ending at one aft post. The glass columns bend onto these lines at every station.
  const sillY = 3.5,
    dividerY = 4.08,
    topY = 4.32,
    frontZ = 12.75,
    midZ = 12.35,
    aftZ = 11.95,
    tipZ = 13.3;
  const upperAngle = (z, y) => {
    const v = Math.max(0, Math.min(1, (y - crownBase(z)) / crownHeight(z)));
    return Math.acos(Math.pow(v, 2.7 / 2));
  };
  const cornerAngles = rings[noseEnd].points.slice(1, 3).map(([, y]) => {
    const [, , b, t] = sections[noseEnd],
      base = t - 0.28 * (t - b);
    return Math.acos(Math.pow((y - base) / (0.28 * (t - b)), 2.7 / 2));
  });
  const upperColumns = (z, zone) => {
    if (zone === 'plain') {
      const stops = [0, ...cornerAngles, Math.PI / 2];
      return Array.from({ length: 13 }, (_, k) => {
        const m = Math.min(2, Math.floor(k / 4));
        return stops[m] + ((stops[m + 1] - stops[m]) * (k - m * 4)) / 4;
      });
    }
    const crown =
        zone === 'front' ? 0 : Math.max(upperAngle(z, topY), upperAngle(z, skinY(z, 0.75))),
      divider = Math.max(crown, upperAngle(z, dividerY)),
      sill = Math.max(divider, upperAngle(z, sillY)),
      stops = [0, crown, divider, sill, Math.PI / 2],
      out = [];
    [2, 2, 3, 5].forEach((count, part) => {
      for (let k = 0; k < count; k++)
        out.push(stops[part] + ((stops[part + 1] - stops[part]) * k) / count);
    });
    out.push(Math.PI / 2);
    return out;
  };
  const ringPoints = (z, zone) => {
    const w = section(z, 1),
      b = section(z, 2),
      t = section(z, 3),
      h = t - b,
      facet = Math.min(1, Math.max(0, (11.6 - z) / (11.6 - 10.65))),
      side = b + 0.25 * h,
      corners = [
        [0, t],
        [0.58 * w, t - 0.025 * h],
        [0.9 * w, t - 0.115 * h],
        [w, t - 0.28 * h],
      ],
      belly = [
        [w, side],
        [0.86 * w, b + 0.06 * h],
        [0.5 * w, b],
        [0, b - 0.008 * h],
      ],
      out = upperColumns(z, zone).map((a, k) => {
        const x = w * Math.pow(Math.sin(a), 2 / 2.7),
          y = crownBase(z) + crownHeight(z) * Math.pow(Math.cos(a), 2 / 2.7);
        if (facet === 0 || zone !== 'plain') return [x, y];
        const m = Math.min(2, Math.floor(k / 4)),
          f = (k - m * 4) / 4,
          cx = corners[m][0] + (corners[m + 1][0] - corners[m][0]) * f,
          cy = corners[m][1] + (corners[m + 1][1] - corners[m][1]) * f;
        return [x + (cx - x) * facet, y + (cy - y) * facet];
      });
    for (let k = 0; k <= 6; k++) {
      const a = (k * Math.PI) / 12,
        x = w * Math.pow(Math.cos(a), 2 / 3.4),
        y = side - 0.25 * h * Math.pow(Math.sin(a), 2 / 3.4),
        m = Math.min(2, Math.floor(k / 2)),
        f = (k - m * 2) / 2,
        cx = belly[m][0] + (belly[m + 1][0] - belly[m][0]) * f,
        cy = belly[m][1] + (belly[m + 1][1] - belly[m][1]) * f;
      out.push([x + (cx - x) * facet, y + (cy - y) * facet]);
    }
    return out;
  };
  const noseStations = [
    ...[...new Set([...sections.slice(0, noseEnd).map((q) => q[0]), 13.3, 13.15, 12.95, 12.85])]
      .filter((z) => z > frontZ)
      .sort((a, b) => b - a)
      .map((z) => [z, 'front']),
    [frontZ, 'front'],
    [frontZ, 'side'],
    [12.55, 'side'],
    [midZ, 'side'],
    [12.15, 'side'],
    [aftZ, 'side'],
    [aftZ, 'plain'],
    [11.84, 'plain'],
    [11.6, 'plain'],
    [11.36, 'plain'],
    [11, 'plain'],
    [10.65, 'plain'],
  ].map(([z, zone]) => ({ z, zone, points: ringPoints(z, zone) }));
  const shell = new Map();
  const facet = (material, a, b, c, centre) => {
    const pa = new T.Vector3(...a),
      n = new T.Vector3(...b).sub(pa).cross(new T.Vector3(...c).sub(pa));
    if (n.lengthSq() < 1e-14) return;
    const out = (a[0] + b[0] + c[0]) * n.x + (a[1] + b[1] + c[1] - 3 * centre) * n.y;
    const list = shell.get(material) ?? [];
    list.push(...(out >= 0 ? [...a, ...b, ...c] : [...a, ...c, ...b]));
    shell.set(material, list);
  };
  for (const sign of [-1, 1])
    for (let i = 0; i < noseStations.length - 1; i++) {
      const fore = noseStations[i],
        aft = noseStations[i + 1];
      if (fore.z === aft.z) continue;
      const mid = (fore.z + aft.z) / 2,
        centre = (section(mid, 2) + section(mid, 3)) / 2,
        lit = fore.zone !== 'plain' && aft.zone !== 'plain';
      for (let k = 0; k < fore.points.length - 1; k++) {
        const at = (ring, c) => [sign * ring.points[c][0], ring.points[c][1], ring.z],
          material = lit && k >= 2 && k < 7 ? glass : paint,
          a = at(fore, k),
          b = at(aft, k),
          c = at(aft, k + 1),
          e = at(fore, k + 1);
        facet(material, a, b, c, centre);
        facet(material, a, c, e, centre);
      }
    }
  for (const [material, list] of shell) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(list, 3));
    geometry.computeVertexNormals();
    noseKit.add(geometry, material);
  }
  noseKit.finish();
  // Frames stand on the skin: posts, sills, the row divider and the top rail of the side windows.
  const frame = (points) => outline(d, points, 0.022, dark, false);
  const span = (from, to, count, at) =>
    Array.from({ length: count + 1 }, (_, i) => at(from + ((to - from) * i) / count));
  for (const side of [-1, 1]) {
    const onCrown = (x, z) => [side * x, skinY(z, x) + 0.004, z],
      atLevel = (y) => (z) => [side * (skinX(z, y) + 0.004), y, z],
      topRail = (z) => {
        const y = Math.min(topY, skinY(z, 0.75));
        return [side * (skinX(z, y) + 0.004), y, z];
      };
    // The front sill runs out from the centre at a level height, so it is sampled across the nose.
    const sillStation = (x) => {
      let low = frontZ,
        high = tipZ + 0.1;
      for (let i = 0; i < 24; i++) {
        const middle = (low + high) / 2;
        if (skinY(middle, x) > sillY) low = middle;
        else high = middle;
      }
      return low;
    };
    frame(
      span(0, skinX(frontZ, sillY), 8, (x) => {
        const z = sillStation(x);
        return [side * x, skinY(z, x) + 0.004, z];
      }),
    );
    frame(span(frontZ, aftZ, 4, atLevel(sillY)));
    frame(span(frontZ, aftZ, 4, atLevel(dividerY)));
    frame(span(frontZ, aftZ, 4, topRail));
    // Header across the front panes, then the posts of the centre and flanking panes.
    frame(span(0, skinX(frontZ, sillY), 6, (x) => [side * x, skinY(frontZ, x) + 0.004, frontZ]));
    for (const x of [0.28, 0.8]) {
      let fore = frontZ;
      while (skinY(fore + 0.01, x) > sillY && fore < tipZ) fore += 0.01;
      frame(span(fore, frontZ, 4, (z) => onCrown(x, z)));
    }
    for (const z of [midZ, aftZ]) frame([topRail(z), atLevel(dividerY)(z), atLevel(sillY)(z)]);
    // Wipers on the flanking panes and the two pitot masts on the cheek, as photographed.
    d.rod(onCrown(0.74, 13.0), onCrown(0.74, 12.82), 0.011, dark);
    for (const y of [2.02, 2.36]) {
      const root = [side * section(12.85, 1), y, 12.85];
      d.rod(root, [root[0] + side * 0.1, y + 0.03, 13.12], 0.013, metal);
    }
  }
  // Selected seams and fasteners follow the actual faceted shell.
  // Radome joint, carried on the skin itself.
  for (const sign of [-1, 1])
    outline(
      d,
      ringPoints(13.68, 'plain').map(([x, y]) => [
        sign * x * 1.004,
        (section(13.68, 2) + section(13.68, 3)) / 2 +
          (y - (section(13.68, 2) + section(13.68, 3)) / 2) * 1.004,
        13.68,
      ]),
      0.006,
      seam,
      false,
    );
  for (const i of rings.flatMap(({ z }, k) => (z <= 9.3 && z > -12.4 ? [k] : []))) {
    const pts = rings[i].points.map(([x, y]) => [x * 1.002, 2.83 + (y - 2.83) * 1.002, rings[i].z]);
    outline(d, pts, 0.006, seam);
    for (let j = 0; j < pts.length; j++)
      for (let k = 1; k < 5; k++) {
        const a = pts[j],
          b = pts[(j + 1) % pts.length];
        d.add(
          new T.SphereGeometry(0.007, 5, 3),
          metal,
          a.map((v, c) => v + ((b[c] - v) * k) / 5),
        );
      }
  }
  for (const side of [-1, 1]) {
    for (const [zz, h, w, yy] of [
      [9.05, 1.65, 0.75, 1.75],
      [-2.6, 1.85, 0.9, 1.95],
    ]) {
      const x = side * 2.065,
        pts = [
          [x, yy - h / 2, zz - w / 2],
          [x, yy + h / 2, zz - w / 2],
          [x, yy + h / 2, zz + w / 2],
          [x, yy - h / 2, zz + w / 2],
        ];
      outline(d, pts, 0.014, seam);
      d.rod([x + side * 0.015, yy, zz + 0.17], [x + side * 0.015, yy, zz + 0.34], 0.016, metal);
    }
    for (const zz of [8.9, 7.45, 6.05, -2.3]) {
      const x = side * 2.065,
        y = 2.46;
      d.add(new T.CircleGeometry(0.12, 20).rotateY((side * Math.PI) / 2), dark, [x, y, zz]);
      d.ring(0.128, 0.012, [x, y, zz], metal, 'x');
    }
    // Main-gear sponsons: tall, flat-sided pods from 0.9 to 2.35m (CC0 3-view front and side).
    const sp = [
      [5.6, 0.06, 1.75, 0.1],
      [5.0, 0.3, 1.66, 0.52],
      [3.9, 0.47, 1.63, 0.72],
      [0.1, 0.48, 1.63, 0.73],
      [-1.6, 0.4, 1.66, 0.62],
      [-2.6, 0.05, 1.75, 0.12],
    ].map(([zz, rx, cy, ry]) => ({
      z: zz,
      points: Array.from({ length: 16 }, (_, j) => {
        const s = Math.sin((j * Math.PI) / 8),
          c = Math.cos((j * Math.PI) / 8);
        return [
          side * 2.07 + Math.sign(s) * Math.pow(Math.abs(s), 0.6) * rx,
          cy + Math.sign(c) * Math.pow(Math.abs(c), 0.6) * ry,
        ];
      }),
    }));
    loft(d, sp, paint);
    d.box([0.03, 0.3, 0.58], [side * 2.55, 1.68, 3.65], dark);
    for (let j = 0; j < 7; j++)
      d.rod(
        [side * 2.57, 1.56 + j * 0.035, 3.4],
        [side * 2.57, 1.56 + j * 0.035, 3.9],
        0.008,
        metal,
      );
  }
  const station = (x) => {
      const t = Math.max(0, (x - 9.6) / (20.205 - 9.6));
      return [x, 4.82 - 0.012 * x, 3.47 - 0.15 * t, -1.42 + 2.25 * t, 0.36 - (0.25 * x) / 20.205];
    },
    split = (a, b, f) => a + (b - a) * f;
  for (const side of [-1, 1]) {
    wing(
      d,
      [0.8, 9.6, 20.205].map((x) => {
        const [xx, y, le, te, h] = station(x);
        return [side * xx, y, le, split(le, te, 0.73), h];
      }),
      paint,
    );
    wing(
      d,
      [0.8, 9.6, 20.205].map((x) => {
        const [xx, y, le, , h] = station(x);
        return [side * xx, y + 0.006, le, le - 0.19, h * 0.36];
      }),
      dark,
    );
    for (const [label, x0, x1, source, scale] of [
      ['flap', 1.92, 13, 'flapPosition', -0.62 * side],
      ['aileron', 13.06, 19.9, 'rollInput', -0.3],
    ]) {
      const pts = [x0, x1].map((x) => {
        const [xx, y, le, te, h] = station(x);
        return [side * xx, y, split(le, te, 0.73), te, h * 0.28];
      });
      hingedWing(root, `C130J-${label}-${side}`, pts, paint, bindings, source, scale);
    }
    wing(
      d,
      [
        [side * 19.9, 4.58, 2.65, 0.77, 0.04],
        [side * 20.205, 4.577, 3.32, 0.83, 0.02],
      ],
      paint,
    );
    const surf = (x, f) => {
      const [xx, y, le, te, h] = station(x),
        q = f < 0.25 ? f / 0.25 : f < 0.75 ? 1 - (f - 0.25) * 0.96 : 0.52 * (1 - (f - 0.75) / 0.25);
      return [side * xx, y + h * q + 0.009, split(le, split(le, te, 0.73), f)];
    };
    for (const f of [0.25, 0.7]) {
      for (const [a, b] of [
        [2, 9.6],
        [9.6, 20],
      ])
        d.rod(surf(a, f), surf(b, f), 0.006, seam);
      for (let x = 2; x < 20; x += 0.26)
        d.add(new T.SphereGeometry(0.006, 5, 3), metal, surf(x, f));
    }
    for (const x of [3.1, 6.8, 9.6, 12.8, 16.8, 19.3])
      outline(d, [surf(x, 0.25), surf(x, 0.7)], 0.006, seam, false);
    ellipsoid(d, [side * 20.15, 4.63, 2.15], [0.06, 0.05, 0.12], side > 0 ? d.red : d.green, 10);
    for (const x of [14.4, 17.4, 19.5]) {
      const st = station(x);
      d.rod([side * x, st[1], st[3]], [side * x, st[1], st[3] - 0.3], 0.006, dark);
    }
    wing(
      d,
      [
        [side * 0.1, 4.77, -8.95, -13.05, 0.22],
        [side * 8.025, 4.77, -11.0, -12.15, 0.08],
      ],
      paint,
    );
    hingedWing(
      root,
      `C130J-elevator-${side}`,
      [
        [side * 0.1, 4.77, -13.05, -14.35, 0.055],
        [side * 8.025, 4.77, -12.15, -12.55, 0.025],
      ],
      paint,
      bindings,
      'pitchInput',
      side * 0.35,
    );
  }
  const fin = [
    [0, 4.86, -2.8],
    [0, 5.85, -7.85],
    [0, 6.4, -8.39],
    [0, 11.6, -11.09],
    [0, 11.84, -11.4],
    [0, 11.84, -12.46],
    [0, 4.72, -12.46],
  ];
  const thick = (p) => (p[1] > 10 ? 0.08 : 0.16);
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * thick(p), p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length],
      n = new T.Vector3(0, b[2] - a[2], a[1] - b[1]);
    quad(
      d,
      [-thick(a), a[1], a[2]],
      [-thick(b), b[1], b[2]],
      [thick(b), b[1], b[2]],
      [thick(a), a[1], a[2]],
      paint,
      n.toArray(),
    );
  }
  // Vertical hinge line; rudder chord tapers from 1.58m at the tail cone to 0.31m at the cap.
  const rg = group(root, 'C130J-rudder', [0, 4.72, -12.46]);
  const rd = detailKit(rg, rg.name),
    len = 7.12;
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.08, 0, 0],
        [side * 0.035, len, 0],
        [side * 0.035, len, -0.31],
        [side * 0.08, 0.1, -1.58],
      ],
      paint,
      [side, 0, 0],
    );
  quad(
    rd,
    [-0.08, 0.1, -1.58],
    [-0.035, len, -0.31],
    [0.035, len, -0.31],
    [0.08, 0.1, -1.58],
    paint,
    [0, 0, -1],
  );
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.44,
  });
  // Four J-model nacelles and independently driven six-blade propellers, 13ft 6in diameter.
  for (const [i, x] of [10.22, 5.15, -5.15, -10.22].entries()) {
    const id = `engine-${i + 1}`,
      cy = Math.abs(x) > 6 ? 4.085 : 3.89;
    // Narrow, deep AE2100 nacelles (front view of the CC0 3-view: 0.95m wide, 1.6m deep with the
    // intake below the spinner), staying deep under the wing before tucking up behind mid-chord.
    const nr = [
      [6.12, 0.42, cy - 0.12, 0.58],
      [5.75, 0.49, cy - 0.15, 0.78],
      [4.9, 0.5, cy - 0.14, 0.82],
      [3.3, 0.49, cy - 0.06, 0.78],
      [2.2, 0.45, cy + 0.06, 0.64],
      [1.1, 0.34, cy + 0.2, 0.42],
      [0.3, 0.16, cy + 0.28, 0.18],
    ].map(([z, rx, y, ry]) => ({
      z,
      points: Array.from({ length: 20 }, (_, j) => [
        x + Math.sin((j * Math.PI) / 10) * rx,
        y + Math.cos((j * Math.PI) / 10) * ry,
      ]),
    }));
    loft(d, nr, paint, { caps: false });
    d.add(new T.CircleGeometry(0.255, 24), dark, [x, cy - 0.5, 6.0]);
    d.ring(0.27, 0.028, [x, cy - 0.5, 6.02], metal);
    d.add(new T.CircleGeometry(0.15, 24).rotateY(Math.PI), dark, [x, cy + 0.28, 0.32]);
    d.ring(0.16, 0.022, [x, cy + 0.28, 0.3], metal);
    for (const [z, rx, y, ry] of [
      [5.6, 0.5, cy - 0.15, 0.8],
      [4.5, 0.51, cy - 0.13, 0.83],
      [3.2, 0.5, cy - 0.05, 0.79],
    ])
      outline(
        d,
        Array.from({ length: 20 }, (_, j) => [
          x + Math.sin((j * Math.PI) / 10) * rx,
          y + Math.cos((j * Math.PI) / 10) * ry,
          z,
        ]),
        0.009,
        seam,
      );
    const pg = group(root, `C130J-propeller-${i + 1}`, [x, cy, 6.2]),
      pd = detailKit(pg, pg.name);
    ellipsoid(pd, [0, 0, 0.22], [0.34, 0.34, 0.5], paint, 20);
    for (let j = 0; j < 6; j++) {
      const bg = group(pg, `C130J-blade-${i + 1}-${j}`);
      bg.rotation.z = (j * Math.PI) / 3;
      const bd = detailKit(bg, bg.name),
        shape = [
          [-0.1, 0.23, 0],
          [-0.16, 0.6, 0.02],
          [-0.2, 1.24, 0.06],
          [-0.06, 1.78, 0.09],
          [0.17, 2.055, 0.11],
          [0.32, 1.98, 0.12],
          [0.23, 1.56, 0.1],
          [0.12, 0.94, 0.06],
          [0.1, 0.26, 0],
        ];
      sheet(bd, shape, dark, [0, 0, 1]);
      sheet(
        bd,
        shape.map(([xx, yy, zz]) => [xx, yy, zz - 0.035]),
        dark,
        [0, 0, -1],
      );
      for (let k = 0; k < shape.length; k++) {
        const a = shape[k],
          b = shape[(k + 1) % shape.length];
        quad(bd, a, b, [b[0], b[1], b[2] - 0.035], [a[0], a[1], a[2] - 0.035], dark, [
          b[1] - a[1],
          a[0] - b[0],
          0,
        ]);
      }
      bd.finish();
    }
    pd.finish();
    rotors.push({ node: pg.name, axis: 'z', multiplier: 1, engine: id });
    enginePoints.push({ id, position: [x, cy, 5.6] });
  }
  const wheel = (dd, x, y, z, r, w) => {
    dd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), rubber, [x, y, z]);
    for (const side of [-1, 1]) {
      dd.add(new T.CylinderGeometry(r * 0.56, r * 0.56, 0.022, 20).rotateZ(Math.PI / 2), metal, [
        x + side * (w / 2 + 0.008),
        y,
        z,
      ]);
      dd.ring(r * 0.8, 0.012, [x + side * (w / 2 + 0.014), y, z], dark, 'x');
    }
  };
  for (const side of [-1, 1])
    for (const [ax, zz] of [
      [0, 2.403],
      [1, 0.879],
    ]) {
      const g = group(root, `C130J-main-gear-${side}-${ax}`, [side * 2.172, 0, zz]),
        dd = detailKit(g, g.name);
      wheel(dd, 0, 0.6, 0, 0.6, 0.39);
      dd.rod([0, 0.6, 0], [0, 1.75, 0], 0.067, metal);
      dd.rod([0, 1.08, 0], [side * -0.22, 1.55, 0.18], 0.045, metal);
      dd.box([0.035, 0.58, 1.21], [side * 0.23, 1.15, 0.03], paint);
      dd.finish();
      bindings.push(
        { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -1.1, offset: 1.1 },
        { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
      );
    }
  const ng = group(root, 'C130J-nose-gear', [0, 0, 11.395]),
    nd = detailKit(ng, ng.name);
  for (const side of [-1, 1]) {
    wheel(nd, side * 0.24, 0.445, 0, 0.445, 0.22);
    nd.rod([side * 0.13, 0.445, 0], [side * 0.1, 0.9, 0.08], 0.035, metal);
    nd.box([0.025, 0.18, 1.1], [side * 0.37, 0.86, -0.18], paint);
  }
  nd.rod([0, 0.7, 0], [0, 1.55, -0.18], 0.055, metal);
  nd.rod([0, 1.1, -0.12], [0, 1.3, -0.85], 0.04, metal);
  nd.finish();
  bindings.push(
    { node: ng.name, source: 'gear', property: 'position', axis: 'y', scale: -1, offset: 1 },
    { node: ng.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
  );
  for (const side of [-1, 1])
    outline(
      d,
      [
        [side * 1.62, 1.86, -5.2],
        [side * 1.52, 2.87, -7.5],
        [side * 1.32, 3.8, -9.8],
      ],
      0.018,
      seam,
      false,
    );
  d.rod([-1.62, 1.72, -5.2], [1.62, 1.72, -5.2], 0.02, metal);
  for (const [z, y] of [
    [7.5, 4.86],
    [0.3, 4.86],
    [-6.1, 4.97],
  ])
    sheet(
      d,
      [
        [-0.035, y, z + 0.35],
        [-0.035, y + 0.42, z - 0.1],
        [-0.035, y, z - 0.4],
      ],
      dark,
      [-1, 0, 0],
    );
  ellipsoid(d, [0, 4.92, 3.9], [0.11, 0.08, 0.14], d.red, 10);
  ellipsoid(d, [0, 0.72, 3.9], [0.1, 0.06, 0.12], d.red, 10);
  d.finish();
  // The flight-station rear bulkhead follows the crown at its station instead of a square sheet.
  const bz = 8.6,
    bi = rings.findIndex((r) => r.z < bz),
    bt = (rings[bi - 1].z - bz) / (rings[bi - 1].z - rings[bi].z),
    bring = rings[bi - 1].points.map((q, j) =>
      q.map((v, k) => v + (rings[bi].points[j][k] - v) * bt),
    ),
    bmid = (bring[0][1] + bring[7][1]) / 2,
    bulkhead = [10, 11, 12, 13, 0, 1, 2, 3, 4].map((j) => [
      bring[j][0] * 0.95,
      bmid + (bring[j][1] - bmid) * 0.96,
      bz,
    ]);
  bulkhead.push([1.7, 1.1, bz], [-1.7, 1.1, bz]);
  const interior = cockpit(root, { paint, dark, metal, glass, skinX, skinY, section, bulkhead });
  cleanGeometry(root);
  smoothNormals(root.getObjectByName('C130J-forebody-C130J-airframe'));
  return {
    root,
    frame: c130Frame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps: [], ailerons: [], animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    deck = group(cabin, 'C130J-flight-deck', [0, 0, deckShift]);
  // Panel scale: the guide's CMDU bezel is 100 px by 138 px against 717 px of panel, and the
  // CMDU is 8 x 11 in, which makes the panel 1.456 m rather than the 2.12 m first estimated. The
  // standby attitude bezel then comes out at 85 mm against a real 3 in indicator.
  const scale = 0.687,
    panel = group(deck, 'C130J-main-panel', [0, 3.72 - scale * 4.025, 11.42 * (1 - scale)]);
  panel.scale.setScalar(scale);
  const d = detailKit(panel, 'C130J-panel-face'),
    cd = detailKit(deck, 'C130J-cabin'),
    hold = detailKit(cabin, 'C130J-hold'),
    pt = panelTools(d),
    ins = instrumentGeometry(panel, 'C130J'),
    { bindings, derived, ink, black, amber } = ins;
  const face = mat('C130J-panel', '#394344', { side: T.DoubleSide }),
    liner = mat('C130J-liner', '#7e8781', { side: T.DoubleSide }),
    seat = mat('C130J-seat', '#505b5a'),
    belt = mat('C130J-harness', '#aab3a2'),
    green = mat('C130J-display-green', '#70e894', { emissive: '#247747', emissiveIntensity: 0.6 }),
    combiner = mat('C130J-combiner', '#a8e8c8', {
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.1,
    });
  const sources = Object.fromEntries(
    ['airspeed', 'pitch', 'roll', 'yaw', 'verticalSpeed', 'gearPosition', 'flapPosition'].map(
      (k) => [
        { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
        { component: 'aircraftState', path: [k] },
      ],
    ),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
  for (const [k, v] of [
    ['pitchInput', 'pitch'],
    ['rollInput', 'roll'],
    ['yawInput', 'yaw'],
    ['power', 'power'],
  ])
    sources[k] = { component: 'aircraftInput', path: [v] };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  // Panel pixels sampled from manufacturer's p22 drawing; total 2.12m width is estimated.
  const px = (u) => ((270 - u) * 2.12) / 450,
    py = (v) => 3.62 + ((280 - v) * 2.12) / 450,
    z = 11.42,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const contour = [
    [47, 360],
    [47, 206],
    [145, 206],
    [145, 194],
    [395, 194],
    [395, 206],
    [495, 206],
    [495, 360],
  ].map(([u, v]) => at(u, v));
  const screens = [
      { u: 107, kind: 'PFD' },
      { u: 237, kind: 'ENG' },
      { u: 303, kind: 'NAV' },
      { u: 433, kind: 'PFD' },
    ],
    holes = screens.map(({ u }) => rectangle(px(u), py(277), 0.252, 0.321, z));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(158) + Math.cos((i * Math.PI) / 20) * 0.056,
      py(254) + Math.sin((i * Math.PI) / 20) * 0.056,
      z,
    ]),
  );
  sheet(d, contour, face, [0, 0, -1], holes);
  outline(d, contour, 0.014, m.dark);
  for (const { u, kind } of screens) {
    const x = px(u),
      y = py(277),
      w = 0.252,
      h = 0.321;
    sheet(
      d,
      rectangle(x, y, w + 0.045, h + 0.045, z - 0.008),
      m.dark,
      [0, 0, -1],
      [rectangle(x, y, w, h, z - 0.008)],
    );
    for (const side of [-1, 1])
      for (let row = 0; row < 7; row++)
        d.box(
          [0.009, 0.013, 0.009],
          [x + side * (w / 2 + 0.011), y + 0.13 - row * 0.043, z - 0.018],
          m.dark,
        );
    for (const side of [-1, 1]) pt.knob(x + side * 0.112, y - 0.175, z - 0.02, 0.012);
    if (kind === 'PFD') {
      const label = u === 107 ? 'pilot' : 'copilot',
        g = group(panel, `C130J-${label}-display`, [x, y, z + 0.018]),
        dd = detailKit(g, g.name),
        ii = instrumentGeometry(g, `C130J-${label}`);
      ii.horizon('horizon', [0, 0.058, 0], 0.15, 0.135, { blankBackdrop: true });
      sheet(
        dd,
        rectangle(0, 0, w, h, -0.012),
        black,
        [0, 0, -1],
        [rectangle(0, 0.058, 0.15, 0.135, -0.012)],
      );
      ii.readout('speed', [0.096, 0.06, -0.018], 'knots', 3, 0.009, ink, false, true);
      ii.readout('altitude', [-0.096, 0.06, -0.018], 'feet', 5, 0.007, ink, true, true);
      dd.text('TAS', [0.096, 0.105, -0.019], 0.006, Math.PI, ink, 'display');
      dd.text('GEO FT', [-0.096, 0.105, -0.019], 0.006, Math.PI, ink, 'display');
      const rose = group(g, `C130J-${label}-heading`, [0, -0.075, -0.018]),
        rr = detailKit(rose, rose.name);
      for (let deg = 0; deg < 360; deg += 10) {
        const a = (deg * Math.PI) / 180,
          p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
        rr.rod(p(deg % 30 ? 0.045 : 0.041), p(0.05), 0.0007, green);
        if (deg % 30 === 0)
          rr.text(
            deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
            p(0.032),
            0.006,
            Math.PI,
            green,
          );
      }
      rr.finish();
      ii.bindings.push({
        node: rose.name,
        source: 'trueHeading',
        property: 'rotation',
        axis: 'z',
        scale: -1,
        period: 2 * Math.PI,
        responseSeconds: 0.15,
      });
      ii.available('heading', 'trueHeading', rose.name);
      dd.rod([0, -0.014, -0.02], [0, -0.027, -0.02], 0.001, amber);
      dd.text('TRUE', [0, -0.004, -0.02], 0.006, Math.PI, ink, 'display');
      ii.readout('vertical', [-0.091, -0.075, -0.018], 'verticalFpm', 4, 0.007, ink, true, true);
      dd.text('FPM', [-0.091, -0.11, -0.02], 0.006, Math.PI, ink);
      dd.text('NAV --', [0.09, -0.095, -0.02], 0.006, Math.PI, green, 'display');
      dd.text('SIM FLIGHT', [0, 0.148, -0.019], 0.006, Math.PI, green, 'display');
      dd.finish();
      bindings.push(...ii.bindings);
      Object.assign(derived, ii.derived);
    } else if (kind === 'ENG') {
      sheet(d, rectangle(x, y, w, h, z + 0.008), black, [0, 0, -1]);
      d.text('ENGINES', [x, y + 0.145, z], 0.011, Math.PI, green);
      for (let i = 0; i < 4; i++) {
        const source = `prop${i + 1}`,
          value = `propPercent${i + 1}`;
        sources[source] = {
          component: 'aircraftState',
          path: ['engines', `engine-${i + 1}`, 'rpm'],
        };
        derived[value] = { op: 'multiply', args: [source, 100] };
        const xx = x + 0.09 - i * 0.06;
        d.text(String(i + 1), [xx, y + 0.12, z], 0.008, Math.PI, green);
        ins.dial(
          `prop-${i + 1}`,
          [xx, y + 0.072, z],
          0.022,
          value,
          [
            [0, -2.2],
            [110, 2.2],
          ],
          [0, 100],
          'NP',
          { responseSeconds: 0.12, material: green },
        );
        ins.readout(
          `prop-number-${i + 1}`,
          [xx, y + 0.025, z - 0.016],
          value,
          3,
          0.008,
          green,
          false,
          true,
        );
        for (let row = 0; row < 3; row++) {
          d.add(new T.RingGeometry(0.015, 0.016, 20).rotateY(Math.PI), green, [
            xx,
            y - 0.035 - row * 0.039,
            z,
          ]);
          d.text('--', [xx, y - 0.035 - row * 0.039, z - 0.002], 0.007, Math.PI, green);
        }
      }
      d.text('TRQ ITT NG OIL --', [x, y - 0.145, z], 0.007, Math.PI, green, 'display');
    } else {
      sheet(d, rectangle(x, y, w, h, z + 0.008), black, [0, 0, -1]);
      const g = group(panel, 'C130J-navigation-heading', [x, y + 0.02, z]),
        rr = detailKit(g, g.name);
      for (let deg = 0; deg < 360; deg += 10) {
        const a = (deg * Math.PI) / 180,
          p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
        rr.rod(p(0.073), p(0.08), 0.001, green);
        if (deg % 30 === 0)
          rr.text(
            deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
            p(0.059),
            0.009,
            Math.PI,
            green,
          );
      }
      rr.finish();
      bindings.push({
        node: g.name,
        source: 'trueHeading',
        property: 'rotation',
        axis: 'z',
        scale: -1,
        period: 2 * Math.PI,
        responseSeconds: 0.15,
      });
      ins.available('nav-heading', 'trueHeading', g.name);
      d.text('TRUE HEADING', [x, y + 0.145, z - 0.01], 0.009, Math.PI, green, 'display');
      d.text('MAP / RADIO INOP', [x, y - 0.12, z - 0.01], 0.008, Math.PI, green);
      d.rod([x, y + 0.113, z - 0.01], [x, y + 0.1, z - 0.01], 0.0015, amber);
    }
  }
  ins.horizon('standby-attitude', at(158, 254, 0.018), 0.112, 0.112, {
    round: true,
    blankBackdrop: true,
  });
  ins.dial(
    'standby-speed',
    at(187, 254, -0.008),
    0.05,
    'knots',
    [
      [0, -2.4],
      [100, -1.3],
      [200, 0.2],
      [350, 2.4],
    ],
    [0, 100, 200, 300],
    'TAS',
  );
  ins.altimeter('standby-altitude', at(237, 348, -0.008), 0.041, 'feet');
  ins.dial(
    'flap-position',
    at(221, 328, -0.008),
    0.027,
    'flapPosition',
    [
      [0, -2],
      [1, 2],
    ],
    [0, 0.5, 1],
    'FLAP',
  );
  for (const [u, w] of [
    [172, 0.132],
    [216, 0.137],
    [260, 0.132],
    [370, 0.137],
  ]) {
    d.box([w, 0.105, 0.02], at(u, 210, -0.018), black);
    d.text('CNI --', at(u, 210, -0.03), 0.01, Math.PI, green, 'display');
    pt.knob(px(u) - w * 0.44, py(222), z - 0.03, 0.009);
  }
  for (const u of [63, 479])
    for (let j = 0; j < 9; j++) d.box([0.045, 0.007, 0.008], at(u, 245 + j * 7, -0.018), black);
  for (const [u, v] of [
    [84, 215],
    [435, 215],
    [292, 330],
    [304, 341],
    [321, 330],
    [335, 341],
    [366, 340],
    [389, 340],
  ])
    pt.knob(px(u), py(v), z - 0.025, 0.011);
  for (let col = 0; col < 5; col++)
    for (let row = 0; row < 3; row++)
      d.box([0.014, 0.014, 0.01], at(282 + col * 5, 199 + row * 5, -0.025), black);
  d.text('C-130J', at(270, 355, -0.025), 0.019, Math.PI, ink);
  // Individual removable lower panels and the blank optional-system bay.
  sheet(d, rectangle(px(368), py(276), 0.285, 0.343, z - 0.012), m.dark, [0, 0, -1]);
  for (const u of [340, 396]) for (const v of [241, 312]) pt.knob(px(u), py(v), z - 0.027, 0.006);
  for (const [u, v, w, h, label] of [
    [174, 340, 0.27, 0.15, 'HYD'],
    [307, 340, 0.24, 0.16, 'GEAR'],
    [370, 340, 0.28, 0.16, 'HYD'],
  ]) {
    sheet(d, rectangle(px(u), py(v), w, h, z - 0.014), face, [0, 0, -1]);
    d.text(label, at(u, v - 10, -0.027), 0.008, Math.PI, ink);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 4; col++) {
        const xx = px(u) + (col - 1.5) * w * 0.19,
          yy = py(v) + 0.012 - row * 0.04;
        d.rod([xx, yy, z - 0.026], [xx, yy + 0.012, z - 0.045], 0.003, m.metal);
      }
  }
  const gearLamp = group(panel, 'C130J-gear-down', at(318, 352, -0.025)),
    gd = detailKit(gearLamp, gearLamp.name);
  for (const x of [-0.025, 0, 0.025]) gd.box([0.014, 0.014, 0.003], [x, 0, 0], green);
  gd.finish();
  bindings.push({
    node: gearLamp.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  // The console and overhead were authored about 1.2 times oversize; the guide's Dzus rails, 146 mm
  // apart, make the overhead 0.82 x 1.09 m.
  const ped = group(deck, 'C130J-center-console', [0, 3.06, 10.53]);
  ped.rotation.x = Math.PI / 2;
  ped.scale.setScalar(0.8);
  cd.box([0.46, 0.3, 1.7], [0, 2.87, 10.53], face);
  const td = detailKit(ped, ped.name),
    tp = panelTools(td);
  beveledBox(td, [0.62, 2.18, 0.2], [0, 0, 0.05], face);
  for (const y of [-0.49, 0.07, 0.76]) {
    td.box([0.59, 0.26, 0.025], [0, y, -0.063], m.dark);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 8; col++)
        tp.knob(-0.25 + col * 0.071, y - 0.07 + row * 0.07, -0.087, 0.009);
  }
  for (const x of [-0.205, 0.205]) {
    td.box([0.18, 0.39, 0.025], [x, 0.34, -0.073], black);
    td.box([0.15, 0.11, 0.008], [x, 0.43, -0.09], m.dark);
    td.text('CNI --', [x, 0.43, -0.096], 0.011, Math.PI, green, 'display');
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 5; col++)
        td.box([0.022, 0.023, 0.009], [x - 0.06 + col * 0.03, 0.34 - row * 0.031, -0.093], m.dark);
  }
  for (let i = 0; i < 4; i++) {
    const x = 0.09 - i * 0.06;
    td.box([0.02, 0.39, 0.008], [x, 0.34, -0.074], black);
    const g = group(ped, `C130J-throttle-${i + 1}`, [x, 0.16, -0.09]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.13, -0.14], 0.012, m.metal);
    beveledBox(dd, [0.053, 0.047, 0.035], [0, 0.13, -0.14], m.dark);
    dd.text(String(i + 1), [0, 0.13, -0.161], 0.009, Math.PI, ink);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.68,
      offset: -0.2,
    });
  }
  td.box([0.21, 0.35, 0.025], [0, -0.83, -0.073], black);
  td.box([0.18, 0.1, 0.008], [0, -0.72, -0.09], m.dark);
  td.text('CNI --', [0, -0.72, -0.096], 0.011, Math.PI, green, 'display');
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++)
      td.box([0.025, 0.022, 0.009], [-0.07 + col * 0.035, -0.8 - row * 0.031, -0.093], m.dark);
  const fg = group(ped, 'C130J-flap-lever', [-0.23, -0.35, -0.09]),
    fd = detailKit(fg, fg.name);
  fd.rod([0, 0, 0], [0, 0, -0.12], 0.012, m.metal);
  fd.box([0.09, 0.027, 0.035], [0, 0, -0.13], liner);
  fd.finish();
  bindings.push({
    node: fg.name,
    source: 'flapPosition',
    property: 'rotation',
    axis: 'x',
    scale: -0.65,
  });
  td.text('POWER', [0, 0.6, -0.08], 0.014, Math.PI, ink);
  td.finish();
  const overhead = group(deck, 'C130J-overhead', [0, 4.46, 10.46]);
  overhead.rotation.x = -Math.PI / 2 + 0.44;
  overhead.scale.setScalar(0.85);
  const od = detailKit(overhead, overhead.name),
    op = panelTools(od);
  beveledBox(od, [0.93, 1.4, 0.065], [0, 0, 0], face);
  for (const [x, y, w, h, label] of [
    [0, 0.42, 0.31, 0.22, 'START'],
    [0, 0.15, 0.38, 0.22, 'ELECTRICAL'],
    [0, -0.13, 0.38, 0.22, 'FUEL'],
    [0, -0.42, 0.38, 0.2, 'PROP'],
    [0.34, 0.18, 0.2, 0.39, 'BLEED'],
    [-0.34, 0.18, 0.2, 0.39, 'PRESS'],
    [0.34, -0.36, 0.2, 0.43, 'ICE'],
    [-0.34, -0.36, 0.2, 0.43, 'LIGHTS'],
  ]) {
    od.box([w, h, 0.014], [x, y, -0.043], m.dark);
    od.text(label, [x, y + h * 0.36, -0.055], 0.011, Math.PI, ink);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const xx = x + (col - 1) * w * 0.27,
          yy = y + (0.1 - row * 0.36) * h;
        op.knob(xx, yy, -0.057, 0.009);
        od.rod([xx, yy, -0.067], [xx, yy + 0.017, -0.085], 0.003, m.metal);
      }
  }
  for (let i = 0; i < 4; i++)
    beveledBox(od, [0.044, 0.08, 0.025], [-0.1 + i * 0.067, 0.4, -0.067], od.red, 0.005);
  od.finish();
  // Head-up displays: a small projector in the roof beside the overhead, and a hinged arm dropping
  // a framed combiner in front of each pilot's eye, 0.33 m ahead of it. Static, deployed glass.
  const eye = { y: 3.97, z: 10.55 };
  for (const side of [-1, 1]) {
    const x = side * 0.55,
      c = { y: eye.y + 0.04, z: eye.z + 0.33 },
      tilt = 0.25,
      w = 0.1,
      h = 0.08,
      corner = (dx, dy) => [x + dx, c.y + dy * Math.cos(tilt), c.z + dy * Math.sin(tilt)],
      rim = [corner(-w, -h), corner(w, -h), corner(w, h), corner(-w, h)],
      outboard = x + side * (w + 0.012);
    sheet(cd, rim, combiner, [0, Math.sin(tilt), -Math.cos(tilt)]);
    // A hinged C-frame carries the glass on its top and outboard edges only.
    const [low, high, far] = side > 0 ? [rim[1], rim[2], rim[3]] : [rim[0], rim[3], rim[2]];
    outline(cd, [low, high, far], 0.005, black, false);
    outline(cd, [rim[0], rim[1]], 0.002, m.dark, false);
    outline(cd, [far, side > 0 ? rim[0] : rim[1]], 0.002, m.dark, false);
    beveledBox(cd, [0.14, 0.09, 0.3], [x, 4.36, eye.z + 0.08], m.dark, 0.015);
    cd.box([0.05, 0.05, 0.05], [outboard, 4.3, eye.z + 0.22], m.dark);
    outline(
      cd,
      [
        [outboard, 4.29, eye.z + 0.22],
        [outboard + side * 0.008, 4.23, eye.z + 0.37],
        [outboard + side * 0.008, 4.14, eye.z + 0.37],
        corner(side * (w + 0.012), h * 0.4),
      ],
      0.011,
      m.dark,
      false,
    );
    const yg = group(deck, `C130J-yoke-${side}`, [x, 3.4, 10.97]),
      yd = detailKit(yg, yg.name);
    yd.rod([0, -0.65, 0.28], [0, 0, 0], 0.045, m.metal);
    outline(
      yd,
      [
        [-0.16, 0.12, -0.05],
        [-0.22, 0.08, -0.05],
        [-0.19, -0.1, -0.05],
        [0.19, -0.1, -0.05],
        [0.22, 0.08, -0.05],
        [0.16, 0.12, -0.05],
      ],
      0.028,
      m.dark,
      false,
    );
    beveledBox(yd, [0.15, 0.16, 0.065], [0, -0.01, -0.05], m.dark);
    yd.text('C-130J', [0, 0.02, -0.087], 0.012, Math.PI, ink);
    yd.finish();
    bindings.push(
      { node: yg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.72 },
      { node: yg.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.09 },
    );
    for (const dx of [-0.16, 0.16]) {
      const g = group(deck, `C130J-pedal-${side}-${Math.sign(dx)}`, [x + dx, 2.86, 11.46]),
        dd = detailKit(g, g.name);
      dd.box([0.19, 0.08, 0.13], [0, 0, 0], m.dark);
      for (let j = 0; j < 5; j++)
        dd.rod([-0.08, 0.046, -0.05 + j * 0.025], [0.08, 0.046, -0.05 + j * 0.025], 0.003, m.metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: Math.sign(dx) * 0.045,
      });
    }
    cd.box([0.43, 0.24, 0.48], [x, 2.88, 10.5], m.metal);
    beveledBox(cd, [0.5, 0.14, 0.56], [x, 3.11, 10.5], seat, 0.04);
    const sg = group(deck, `C130J-seat-back-${side}`, [x, 3.57, 10.23]);
    sg.rotation.x = -0.1;
    const sd = detailKit(sg, sg.name);
    beveledBox(sd, [0.5, 0.81, 0.17], [0, 0, 0], seat, 0.05);
    beveledBox(sd, [0.4, 0.23, 0.17], [0, 0.5, 0], seat, 0.035);
    for (const dx of [-0.16, 0.16]) {
      sd.rod([dx, 0.49, 0.095], [dx * 0.45, -0.35, 0.11], 0.024, belt);
      sd.rod([dx, 0.22, -0.1], [dx, -0.32, -0.1], 0.025, m.metal);
    }
    sd.finish();
    cd.rod([x - 0.23, 3.22, 10.35], [x + 0.2, 3.22, 10.67], 0.025, belt);
    cd.box([0.075, 0.025, 0.055], [x + 0.02, 3.24, 10.53], m.metal);
    for (const dx of [-0.28, 0.28])
      beveledBox(cd, [0.07, 0.08, 0.37], [x + dx, 3.38, 10.42], seat, 0.016);
    // Side consoles, wall stowage and the nose wheel tiller at the pilot's left hand.
    cd.box([0.13, 0.5, 1.5], [side * 1.28, 3.1, 10.1], face);
    cd.box([0.1, 0.21, 0.22], [side * 1.23, 3.6, 10.02], black);
    cd.rod([side * 1.25, 3.65, 10.17], [side * 1.22, 3.38, 10.28], 0.014, m.dark);
    if (side > 0) {
      cd.ring(0.1, 0.012, [1.02, 3.52, 10.95], black, 'y');
      cd.rod([1.02, 3.36, 10.95], [1.02, 3.52, 10.95], 0.014, m.dark);
      cd.box([0.2, 0.05, 0.3], [1.03, 3.35, 10.95], face);
    }
  }
  // Hood: a flat plane from the panel top falling to the skin ahead, which it reaches below the
  // glass. Blanking panels then close the nose bay beside the panel and above the foot wells.
  const panelZ = deckShift + 11.42,
    top = 3.72,
    wall = (zz, yy) => m.skinX(zz, yy) * 0.95,
    edge = wall(panelZ, 3.64),
    fall = (top - 3.64) / edge,
    drop = 0.9,
    hood = (x, zz) => top - fall * x - drop * (zz - panelZ),
    meet = (zz) => {
      let x = 0.5;
      for (let i = 0; i < 12; i++) x = wall(zz, hood(x, zz));
      return x;
    };
  let hoodTip = panelZ;
  while (hoodTip < 13.4 && meet(hoodTip + 0.01) > 0.08) hoodTip += 0.01;
  const hoodOutline = [[0, top, panelZ]];
  for (let i = 0; i <= 12; i++) {
    const zz = panelZ + ((hoodTip - panelZ) * i) / 12,
      x = i === 12 ? 0 : meet(zz);
    hoodOutline.push([x, hood(x, zz), zz]);
  }
  const shift = ([x, y, zz]) => [x, y, zz - deckShift];
  for (const side of [-1, 1]) {
    const flip = ([x, y, zz]) => shift([side * x, y, zz]);
    sheet(cd, hoodOutline.map(flip), black, [side * fall, 1, drop]);
    const lower = 3.17,
      toe = 13.2;
    sheet(
      cd,
      [
        [0.725, lower, panelZ + 0.01],
        [wall(panelZ, lower), lower, panelZ + 0.01],
        [edge, hood(edge, panelZ), panelZ + 0.01],
        [0.725, 3.68, panelZ + 0.01],
      ].map(flip),
      face,
      [0, 0, -1],
    );
    quad(
      cd,
      flip([0, lower, panelZ]),
      flip([wall(panelZ, lower), lower, panelZ]),
      flip([wall(toe, lower), lower, toe]),
      flip([0, lower, toe]),
      m.dark,
      [0, -1, 0],
    );
    sheet(
      cd,
      [
        [0, 2.75, toe],
        [wall(toe, 2.75), 2.75, toe],
        [wall(toe, lower), lower, toe],
        [0, lower, toe],
      ].map(flip),
      m.dark,
      [0, 0, -1],
    );
    // Flight deck floor, fitted to the walls forward of the barrel.
    sheet(
      hold,
      [
        [0, 2.745, 8.8],
        [side * 2.03, 2.745, 8.8],
        [side * (m.section(10.65, 1) - 0.04), 2.745, 10.65],
        [side * (m.section(11.6, 1) - 0.03), 2.745, 11.6],
        [side * (m.section(12.3, 1) - 0.03), 2.745, 12.3],
        [side * wall(toe, 2.75), 2.745, toe],
        [0, 2.745, toe],
      ],
      m.dark,
      [0, 1, 0],
    );
  }
  sheet(hold, m.bulkhead, liner, [0, 0, 1], [rectangle(0, 2.13, 0.68, 1.9, 8.6)]);
  for (let i = 0; i < 4; i++)
    hold.box([0.64, 0.08, 0.28], [0, 2.5 - i * 0.35, 8.55 - i * 0.28], m.dark);
  hold.box([2.95, 0.04, 10.75], [0, 1.1, 2.775], liner);
  d.finish();
  cd.finish();
  hold.finish();
  // The two display faces use one telemetry graph, including digit decoding and validity.
  // There is no second simulated AHRS or air-data computer behind the copilot screen.
  for (const binding of bindings)
    binding.source = binding.source.replace('C130J-copilot.', 'C130J-pilot.');
  for (const key of Object.keys(derived)) if (key.startsWith('C130J-copilot.')) delete derived[key];
  return { nodes: ['cockpit'], sources, derived, bindings };
}
