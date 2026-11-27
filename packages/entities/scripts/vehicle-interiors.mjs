/** Authored cockpit geometry. Reference photographs remain in the citation catalog, never GLBs. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import catalog from '../../../content/entities/source/interiors.json' with { type: 'json' };
import { switchGeometry } from './aircraft/cockpit-parts.mjs';
import { carPedal, carVent, shifterGeometry, steeringWheelGeometry } from './cabin-parts.mjs';

export function interiorProfile(id) {
  const profile = catalog.profiles[id];
  if (!profile) throw new Error(`Missing authored interior profile: ${id}`);
  return profile;
}

const inSet = (value, list) => list.split(' ').includes(value);
const material = (name, color, metalness = 0, roughness = 0.7) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true });

/** Remove the original five masters' solid painted cabin infill, retaining their exterior skin.
 * The source master stays untouched; the derived model receives new seats, floor and controls.
 * Clip triangles at the cavity boundary rather than dropping whole faces through the shell.
 */
export function carveLegacyCabin(root, s) {
  const body = root.getObjectByName('body');
  if (!body?.isMesh || Array.isArray(body.material))
    throw new Error(`Unexpected legacy body: ${s.id}`);
  root.updateMatrixWorld(true);
  const eye = s.driverEye;
  const floor = Math.max(s.wheelRadius * 0.4 + 0.035, eye[1] - 0.96);
  const min = [-s.width * 0.4, floor, eye[2] - 0.72];
  // Only the solid lower body needs hollowing. Extending this cut to eye height also
  // sliced through the sloping pillars, leaving exposed cut edges above the door cards.
  const max = [s.width * 0.4, eye[1] + 0.1, eye[2] + 0.64];
  const planes = min.flatMap((v, axis) => [
    [axis, 1, -v],
    [axis, -1, max[axis]],
  ]);
  const geometry = body.geometry.index ? body.geometry.toNonIndexed() : body.geometry.clone();
  const attributes = Object.entries(geometry.attributes);
  const output = Object.fromEntries(attributes.map(([name]) => [name, []]));
  const point = new T.Vector3();
  const read = (index) => {
    const data = Object.fromEntries(
      attributes.map(([name, a]) => [
        name,
        Array.from({ length: a.itemSize }, (_, c) => a.getComponent(index, c)),
      ]),
    );
    return { data, world: point.fromArray(data.position).applyMatrix4(body.matrixWorld).toArray() };
  };
  const interpolate = (a, b, t) => ({
    data: Object.fromEntries(
      attributes.map(([name]) => [name, a.data[name].map((v, i) => v + (b.data[name][i] - v) * t)]),
    ),
    world: a.world.map((v, i) => v + (b.world[i] - v) * t),
  });
  const clip = (polygon, plane, inside) => {
    const [axis, sign, offset] = plane,
      result = [];
    const distance = (v) => (sign * v.world[axis] + offset) * (inside ? 1 : -1);
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const da = distance(a),
        db = distance(b);
      if (da >= 0) result.push(a);
      if (da < 0 !== db < 0) result.push(interpolate(a, b, da / (da - db)));
    }
    return result;
  };
  const emit = (polygon) => {
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const vertex of [polygon[0], polygon[i], polygon[i + 1]]) {
        for (const [name] of attributes) output[name].push(...vertex.data[name]);
      }
    }
  };
  for (let i = 0; i < geometry.attributes.position.count; i += 3) {
    let remaining = [read(i), read(i + 1), read(i + 2)];
    if (remaining.some((v) => v.world[1] > s.height * 0.78)) {
      emit(remaining);
      continue;
    }
    for (const plane of planes) {
      emit(clip(remaining, plane, false));
      remaining = clip(remaining, plane, true);
      if (remaining.length < 3) break;
    }
  }
  const result = new T.BufferGeometry();
  for (const [name, a] of attributes)
    result.setAttribute(name, new T.Float32BufferAttribute(output[name], a.itemSize));
  result.normalizeNormals();
  geometry.dispose();
  body.geometry = result;
  // The masters contain exterior faces only. Give their roof and pillars a matching
  // inward surface instead of letting back-face culling reveal the sky through them.
  const lining = result.clone();
  const indices = [];
  for (let i = 0; i < lining.attributes.position.count; i += 3) indices.push(i, i + 2, i + 1);
  lining.setIndex(indices);
  lining.computeVertexNormals();
  const inner = new T.Mesh(lining, material('legacy-body-lining', '#737a77'));
  inner.name = 'legacy-body-lining';
  inner.position.copy(body.position);
  inner.quaternion.copy(body.quaternion);
  inner.scale.copy(body.scale);
  body.parent.add(inner);
}

/** Small physical controls share a material batch. Graphics deliberately contain no fake live values. */
export function aircraftPanelTools(d, palette = {}) {
  return panelTools(d, { ...palette, flushGauges: true });
}

export function panelTools(d, palette = {}) {
  const dark = palette.black ?? d.dark,
    metal = palette.chrome ?? d.metal;
  const ink = palette.pixel ?? d.ivory,
    red = palette.red ?? d.red;
  const screen = palette.screen ?? material('instrument-display', '#182d34', 0.05, 0.4);
  const knob = (x, y, z, radius = 0.014) => {
    d.add(new T.CylinderGeometry(radius, radius, 0.013, 12).rotateX(Math.PI / 2), metal, [x, y, z]);
    d.add(new T.CircleGeometry(radius * 0.8, 12).rotateY(Math.PI), dark, [x, y, z - 0.007]);
    d.box([0.0025, radius * 0.38, 0.002], [x, y + radius * 0.48, z - 0.009], ink);
  };
  const buttons = (x, y, z, count = 5, pitch = 0.027, color = dark) => {
    for (let i = 0; i < count; i++) {
      const bx = x + (i - (count - 1) / 2) * pitch;
      d.box([pitch * 0.72, 0.012, 0.009], [bx, y, z], color);
      d.box([pitch * 0.32, 0.002, 0.001], [bx, y + 0.002, z - 0.005], ink);
    }
  };
  const gauge = (x, y, z, radius, face = dark, pointer = true) => {
    const flush = palette.flushGauges;
    // Instrument cans sit behind the panel; only a narrow mounting lip is exposed.
    const front = flush ? z + 0.005 : z;
    d.add(
      new T.CylinderGeometry(
        radius * (flush ? 1.035 : 1.1),
        radius * (flush ? 1.035 : 1.1),
        flush ? 0.009 : 0.018,
        flush ? 32 : 24,
      ).rotateX(Math.PI / 2),
      flush ? dark : metal,
      [x, y, z + (flush ? 0.0035 : 0.005)],
    );
    if (flush)
      d.add(new T.RingGeometry(radius, radius * 1.035, 32).rotateY(Math.PI), metal, [
        x,
        y,
        z - 0.0012,
      ]);
    d.add(new T.CircleGeometry(radius, 32).rotateY(Math.PI), face, [x, y, front - 0.006]);
    for (let i = 0; i < 13; i++) {
      // Flat tick bars (a box costs half a rod and reads the same at a few millimetres).
      const a = Math.PI * (-0.25 + (i * 1.5) / 12);
      d.add(
        new T.BoxGeometry(radius * 0.044, radius * 0.14, radius * 0.044).rotateZ(a - Math.PI / 2),
        face === dark ? ink : dark,
        [x + Math.cos(a) * radius * 0.84, y + Math.sin(a) * radius * 0.84, front - 0.008],
      );
    }
    if (pointer)
      d.rod(
        [x, y, front - 0.012],
        [x + radius * 0.5, y - radius * 0.5, front - 0.012],
        radius * 0.026,
        red,
      );
    d.box([radius * 0.65, radius * 0.18, 0.003], [x, y - radius * 0.42, front - 0.01], screen);
  };
  const display = (x, y, z, width, height, kind = 'map', bezel = dark) => {
    d.box([width + 0.016, height + 0.016, 0.023], [x, y, z + 0.01], bezel);
    d.box([width, height, 0.004], [x, y, z - 0.004], screen);
    const front = z - 0.007;
    if (kind === 'map') {
      for (const k of [-0.25, 0, 0.25]) {
        d.box([width * 0.56, 0.002, 0.001], [x + width * 0.12, y + height * k, front], metal);
        d.rod(
          [x + width * k, y - height * 0.36, front],
          [x + width * (k + 0.1), y + height * 0.36, front],
          0.0015,
          metal,
        );
      }
      d.rod(
        [x + width * 0.3, y - height * 0.23, front - 0.002],
        [x + width * 0.04, y + height * 0.16, front - 0.002],
        0.003,
        ink,
      );
      for (let i = 0; i < 4; i++)
        d.box(
          [width * 0.05, height * 0.035, 0.002],
          [x - width * 0.4, y + height * (i - 1.5) * 0.18, front],
          ink,
        );
    } else if (kind === 'driver' || kind === 'driver-dial') {
      for (const side of [-1, 1]) {
        if (kind === 'driver-dial' && side === 1) {
          // A virtual speedometer on the driver's left: the dial a live needle sweeps.
          const r = height * 0.36;
          for (let i = 0; i < 13; i++) {
            const a = Math.PI * (-0.25 + (i * 1.5) / 12);
            d.add(
              new T.BoxGeometry(0.0022, i % 3 ? 0.004 : 0.007, 0.001).rotateZ(a - Math.PI / 2),
              ink,
              [
                x + width * 0.26 + Math.cos(a) * r * 0.9,
                y - height * 0.02 + Math.sin(a) * r * 0.9,
                front,
              ],
            );
          }
          continue;
        }
        // Abstract instrument arcs, not a frozen numeric speedometer.
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.2 + (i * 0.6) / 8);
          const px = x + side * width * 0.28 + Math.cos(a) * height * 0.3;
          const py = y + Math.sin(a) * height * 0.3 - height * 0.12;
          d.box([0.004, 0.006, 0.001], [px, py, front], ink);
        }
      }
      d.box([width * 0.12, 0.002, 0.001], [x, y - height * 0.25, front], ink);
    } else if (kind === 'radar') {
      d.ring(height * 0.34, 0.002, [x, y, front], ink);
      d.ring(height * 0.2, 0.0015, [x, y, front], metal);
      d.rod([x, y, front], [x + height * 0.2, y + height * 0.23, front], 0.002, ink);
    } else if (kind === 'attitude') {
      d.box([width * 0.7, height * 0.3, 0.001], [x, y + height * 0.15, front], d.green);
      d.box([width * 0.7, height * 0.3, 0.001], [x, y - height * 0.15, front], d.amber);
      for (let i = -2; i <= 2; i++)
        d.box(
          [width * (i === 0 ? 0.6 : 0.2), 0.002, 0.001],
          [x, y + i * height * 0.1, front - 0.002],
          ink,
        );
    } else {
      for (let i = 0; i < 3; i++)
        d.box(
          [width * (0.35 + i * 0.1), 0.003, 0.001],
          [x, y + (i - 1) * height * 0.22, front],
          ink,
        );
    }
  };
  const vent = (x, y, z, style = 'rect', width = 0.13) => {
    if (style === 'round') {
      d.add(new T.CylinderGeometry(width / 2, width / 2, 0.02, 16).rotateX(Math.PI / 2), metal, [
        x,
        y,
        z + 0.005,
      ]);
      d.add(new T.CircleGeometry(width * 0.43, 16).rotateY(Math.PI), dark, [x, y, z - 0.006]);
      for (let i = -2; i <= 2; i++)
        d.box(
          [width * (0.72 - Math.abs(i) * 0.08), 0.004, 0.008],
          [x, y + i * width * 0.12, z - 0.011],
          metal,
        );
    } else {
      const h = style === 'vertical' ? width * 1.45 : style === 'slot' ? 0.025 : 0.065;
      d.box([width + 0.012, h + 0.012, 0.013], [x, y, z], metal);
      d.box([width, h, 0.008], [x, y, z - 0.008], dark);
      for (let i = -2; i <= 2; i++)
        d.box([width * 0.91, 0.0025, 0.008], [x, y + i * h * 0.15, z - 0.013], metal);
      d.box([0.018, 0.009, 0.011], [x, y, z - 0.018], dark);
    }
  };
  return { knob, buttons, gauge, display, vent, dark, metal, ink, screen };
}

/**
 * Line the inside of a car's painted roof and pillars. Body materials are double-sided, so from
 * the seat the roof, A pillars and drip rails showed the body colour. This copies the painted
 * triangles above the belt inside the cabin (between `zFront` and `zRear`, within `halfWidth`),
 * faces them inward and sets them 8 mm in: a headliner and pillar trim only seen from inside.
 */
export function addCabinLiner(root, { paints, color, zFront, zRear, beltAt, halfWidth }) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const targets = new Set(paints.map((m) => m.name));
  const middle = (zFront + zRear) / 2;
  const positions = [];
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    n = new T.Vector3(),
    e = new T.Vector3();
  root.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material) || !targets.has(mesh.material.name)) return;
    const matrix = inverse.clone().multiply(mesh.matrixWorld);
    const p = mesh.geometry.getAttribute('position'),
      index = mesh.geometry.index,
      count = index ? index.count : p.count;
    const read = (i, v) => v.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(matrix);
    for (let i = 0; i < count; i += 3) {
      read(i, a);
      read(i + 1, b);
      read(i + 2, c);
      const cx = (a.x + b.x + c.x) / 3,
        cy = (a.y + b.y + c.y) / 3,
        cz = (a.z + b.z + c.z) / 3;
      if (cz > zFront || cz < zRear || Math.abs(cx) > halfWidth) continue;
      const belt = beltAt(cz);
      if (cy < belt + 0.015) continue;
      n.subVectors(b, a).cross(e.subVectors(c, a));
      // Slivers under 2 cm² (seams, drip-rail edges) are a few hundredths of a percent of
      // the lining and not worth their triangles.
      if (n.lengthSq() < 4 * 0.0002 ** 2) continue;
      n.normalize();
      // Which way is the cabin: toward head height on the centre line, mid-cabin. A face
      // authored outward is flipped and set in; one already facing in is set in as it is.
      e.set(-cx, belt + 0.25 - cy, middle - cz).normalize();
      const inward = n.dot(e);
      if (Math.abs(inward) < 0.12) continue;
      const s = Math.sign(inward) * 0.008;
      const corners = inward > 0 ? [a, b, c] : [a, c, b];
      for (const v of corners) positions.push(v.x + n.x * s, v.y + n.y * s, v.z + n.z * s);
    }
  });
  if (!positions.length) return undefined;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const liner = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      name: 'cabin-headliner',
      color,
      metalness: 0,
      roughness: 0.95,
      flatShading: true,
      side: T.FrontSide,
    }),
  );
  liner.name = 'cabin-liner';
  root.add(liner);
  return liner;
}

/** A low rounded housing, flat at its foot (a gauge pod on a dash top). */
/**
 * One smooth shelf along X: a section `thickness` tall and `depth` deep with a rounded front edge
 * (toward the driver, -Z), swept over `length`. `wave` lifts its ends and dips its middle (a
 * BYD wave fascia); 0 keeps it straight (the BMW i3's open shelf).
 */
function shelfBand(length, thickness, depth, wave = 0, stations = 24) {
  const r = thickness / 2;
  const section = [
    [r, depth / 2],
    [r, -depth / 2 + r],
    [r * Math.SQRT1_2, -depth / 2 + r - r * Math.SQRT1_2],
    [0, -depth / 2],
    [-r * Math.SQRT1_2, -depth / 2 + r - r * Math.SQRT1_2],
    [-r, -depth / 2 + r],
    [-r, depth / 2],
  ];
  const rings = Array.from({ length: stations + 1 }, (_, i) => {
    const x = -length / 2 + (i * length) / stations,
      t = (2 * x) / length;
    const lift = wave * (t * t - 0.4);
    return section.map(([y, z]) => [x, y + lift, z]);
  });
  const positions = [];
  for (let i = 0; i < stations; i++)
    for (let j = 0; j < section.length - 1; j++) {
      const [a, b, c, d] = [rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]];
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  // Close the ends.
  for (const [ring, flip] of [
    [rings[0], true],
    [rings[stations], false],
  ])
    for (let j = 1; j < section.length - 1; j++) {
      const tri = [ring[0], ring[j], ring[j + 1]];
      if (flip) tri.reverse();
      for (const v of tri) positions.push(...v);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function roundedPod(width, height, depth) {
  const shape = new T.Shape();
  const r = Math.min(height * 0.45, width * 0.2);
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2 - r);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2);
  shape.lineTo(-width / 2 + r, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r);
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  geometry.deleteAttribute('uv');
  return geometry.translate(0, 0, -depth / 2);
}

let blackSwitch;
/** Switch caps, pads and adjuster tabs: blacker than the fascia they sit in. */
const cabinBlack = () => (blackSwitch ??= material('cabin-switch-black', '#15181a', 0.04, 0.6));
/**
 * The vent family a dashboard's generation uses (cabin-parts.mjs VENT_STYLES), from the layout's
 * coarse shape (round, rect, vertical, slot) and its brand/era. `vents` in a profile overrides.
 */
function ventStyleFor(p, layout) {
  return (shape) => {
    // `vents` names one family for every vent, or maps the layout's shapes to families
    // ({ "round": "turbine", "rect": "slat" }) when outer and center vents differ.
    if (typeof p.vents === 'string') return p.vents;
    if (p.vents?.[shape]) return p.vents[shape];
    if (shape === 'slot') return 'slim';
    if (shape === 'vertical') return inSet(layout, 'volvo cts') ? 'chrome-slat' : 'vertical';
    if (shape === 'round') {
      if (inSet(layout, 'tt alfa gt supra porsche')) return 'turbine';
      if (inSet(layout, 'smart wuling fj jimny scion-center') || /element|kwid/.test(p.slug))
        return 'eyeball';
      return 'round';
    }
    if (
      inSet(layout, 'lincoln luxury-clock jaguar jeep-luxury genesis alphard retro-triple muscle')
    )
      return 'chrome-slat';
    if (
      inSet(
        layout,
        'ioniq kia-bridge hyundai-bridge byd byd-wave casper bendy-ev leaf i3 prius nissan-tablet mazda staria',
      )
    )
      return 'slim';
    if (
      inSet(
        layout,
        'golf polo skoda clio peugeot saab volvo subaru rugged-radio worktruck e-series hiace defender duster',
      )
    )
      return 'grid';
    return 'slat';
  };
}
/** The steering wheel family of a dashboard's generation (cabin-parts.mjs WHEEL_STYLES). */
function wheelStyleFor(p, layout) {
  if (p.wheel) return p.wheel;
  if (inSet(layout, 'peugeot tt golf corvette mustang gt alfa')) return 'sport';
  if (inSet(layout, 'i3 ioniq skoda genesis lucid')) return 'two-spoke';
  if (layout.startsWith('coach')) return 'bus';
  if (inSet(layout, 'retro-triple') || p.slug === 'chevrolet-ssr-2005') return 'retro';
  if (inSet(layout, 'fj defender jimny e-series hiace worktruck rugged-radio wrangler'))
    return 'four-spoke';
  return 'modern';
}

/**
 * Turn a stack toward the driver (a profile's `stackAngle`): every finished cabin vertex in the
 * stack's region, from its parts' fronts to just behind its face, rotates about the vertical
 * axis through the stack's face. Run once the cabin's kits have merged.
 */
export function angleCabinStack(root) {
  const r = root.userData.molenStackRegion;
  if (!r) return;
  delete root.userData.molenStackRegion;
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const turn = new T.Matrix4().makeRotationY(r.angle);
  const pivot = new T.Vector3(0, 0, r.z - 0.0105);
  const v = new T.Vector3(),
    n = new T.Vector3();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let part = mesh; part && part !== root; part = part.parent)
      if (part.name === 'steering-wheel') return;
    const toRoot = inverse.clone().multiply(mesh.matrixWorld);
    const fromRoot = toRoot.clone().invert();
    const position = mesh.geometry.getAttribute('position'),
      normal = mesh.geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(toRoot);
      // Just behind the face: the plate's back stays put (a wedge into the dash), and the glove
      // box behind the stack is left alone.
      if (
        Math.abs(v.x) > r.half ||
        v.y < r.bottom ||
        v.y > r.top ||
        v.z < r.z - 0.09 ||
        v.z > r.z + 0.012
      )
        continue;
      v.sub(pivot).applyMatrix4(turn).add(pivot).applyMatrix4(fromRoot);
      position.setXYZ(i, v.x, v.y, v.z);
      if (normal) {
        n.fromBufferAttribute(normal, i).transformDirection(toRoot).transformDirection(turn);
        n.transformDirection(fromRoot);
        normal.setXYZ(i, n.x, n.y, n.z);
      }
    }
    position.needsUpdate = true;
    if (normal) normal.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
}

/** Dashboard dimensions follow the authored eye and cowl, independently of exterior shape recipes. */
export function addRoadDashboard(root, s, frame, makeKit) {
  const p = interiorProfile(s.id),
    layout = p.layout;
  const { eye, width: W, dashY: y, dashZ, seatY, clearance = 0.1 } = frame;
  const d = frame.cabin ?? makeKit(root, 'cabin');
  const ownKit = !frame.cabin;
  const trim = material('cabin-trim', p.trim, 0.08, 0.72);
  const a = panelTools(d, frame),
    { metal, ink } = a;
  // A profile's `dash` colors the fascia, tunnel and door cards (two-tone and colored cabins);
  // the wheel, pedals and shifter keep their black hardware.
  const dark = p.dash ? material('cabin-dash', p.dash, 0.03, 0.82) : a.dark;
  const P = { dark, trim, metal, ink, black: cabinBlack() };
  // A profile's `stack` colors the center stack apart from the accent band (light band, black stack).
  // `stack` or `band` set to "body" take the paint colour (the SSR console, a Fiat 500 dash band).
  const bodyPanel = () => material('cabin-body-panel', s.color ?? p.trim, 0.3, 0.4);
  const stackTrim =
    p.stack === 'body'
      ? bodyPanel()
      : p.stack
        ? material('cabin-stack', p.stack, 0.08, 0.72)
        : trim;
  // `band` "body" or a colour sets the accent band apart from the trim (a Tesla's wood strip).
  const bandTrim =
    p.band === 'body' ? bodyPanel() : p.band ? material('cabin-band', p.band, 0.08, 0.72) : trim;
  const hardware = { ...P, dark: a.dark };
  const ventStyle = ventStyleFor(p, layout);
  const vent = (vx, vy, vz, shape = 'rect', width = 0.13) => {
    const style = ventStyle(shape);
    // A tall vent drawn in a horizontal-slat family keeps its tall opening (a Transit's).
    // A slot drawn as a grid keeps a slot's height (a Saab's wide grid vent).
    const height =
      shape === 'vertical' && inSet(style, 'slat chrome-slat')
        ? width * 1.4
        : shape === 'slot' && style === 'grid'
          ? 0.05
          : undefined;
    return carVent(d, P, [vx, vy, vz], { style, width, height });
  };
  // Rotary knobs by family: stacked concentric controls in premium cabins, chunky fluted
  // knobs in utility and off-road ones, a slim pointer knob elsewhere.
  const knobStyle =
    p.knobs ??
    (inSet(
      layout,
      'lincoln luxury-clock jaguar jeep-luxury genesis alphard porsche cts acura-dual alfa',
    )
      ? 'concentric'
      : inSet(
            layout,
            'fj jimny wrangler defender rugged-radio worktruck e-series hiace bronco toyota-truck hilux duster economy',
          )
        ? 'fluted'
        : 'pointer');
  const knob = (kx, ky, kz, radius = 0.014) =>
    switchGeometry(d, {
      style: knobStyle,
      scale: radius / 0.012,
      at: [kx, ky, kz],
      palette: { grip: P.black, legend: ink, alloy: metal },
    });
  const z = dashZ - 0.182,
    dx = eye[0];
  d.root.userData.interiorProfile = { layout, signature: p.signature, reference: p.reference };
  const ssr = p.slug === 'chevrolet-ssr-2005';
  const strada = p.slug === 'fiat-strada-2024';
  const kwid = p.slug === 'renault-kwid-2024';
  const dmax = p.slug === 'isuzu-d-max-2024';
  const transit = p.slug === 'ford-transit-2021';
  const acuraTL = p.slug === 'acura-tl-2013';
  const element = p.slug === 'honda-element-2008';
  const round =
    !ssr &&
    (element ||
      strada ||
      kwid ||
      layout === 'scion-center' ||
      /chevrolet-(colorado|equinox|trax)/.test(p.slug) ||
      layout === 'wuling' ||
      inSet(
        layout,
        'mini-r56 mini-r60 tt fiat smart miata brz z34 solstice sprinter camper-van wrangler jimny fj retro-triple soul yaris alfa gt',
      ));
  const high = inSet(layout, 'prius peugeot kei-high staria scion-center leaf');
  const centerOnly = inSet(layout, 'tesla-highland tesla-y');
  // Light-faced dials (Mini, Fiat 500, FJ Cruiser...); a profile's `dials` (light|dark) states it.
  const white =
    p.dials === 'light' || (p.dials !== 'dark' && inSet(layout, 'mini-r56 mini-r60 fiat'));
  const wide = inSet(
    layout,
    'gm-wide gm-linked ford-wide f150 mustang triple-screen genesis hummer-ev hyundai-bridge kia-bridge lucid rivian ioniq byd alphard toyota-wide toyota-truck wrangler',
  );
  const portrait = inSet(layout, 'ram ford-portrait clio subaru staria');
  const radio =
    element ||
    inSet(
      layout,
      'retro-triple rugged-radio fiat gt solstice brz saab scion-center smart volvo hiace e-series economy worktruck fj',
    );
  const floating = inSet(layout, 'i3 ioniq rivian byd byd-wave casper wuling bendy-ev');
  // Layouts whose center screen is set into the fascia rather than standing above it.
  const embeddedLayouts =
    'alfa acura-old cts muscle luxury-clock corvette jeep-luxury lincoln golf polo hiace transit-van sprinter camper-van honda-van truck-tablet hilux bronco z34 leaf porsche jaguar staria';
  // A profile's `cluster` (digital|analog) states the generation's driver display outright.
  const digital =
    p.cluster === 'digital' ||
    (p.cluster !== 'analog' &&
      (centerOnly ||
        floating ||
        (wide && layout !== 'wrangler') ||
        inSet(layout, 'tt prius peugeot kei-high staria leaf volt corvette coach-digital supra')));
  const cy = high ? eye[1] - 0.205 : Math.max(y + 0.055, eye[1] - 0.235);
  // A stepped shell gives the fascia depth; the rear edge stays below the driver's sightline.
  d.box(
    [W * 0.85, 0.14, frame.shallowDash ? 0.12 : 0.32],
    [0, y - 0.035, dashZ - (frame.shallowDash ? 0.1 : 0)],
    dark,
  );
  d.box(
    [W * 0.84, 0.048, frame.shallowDash ? 0.06 : 0.2],
    [0, y + 0.04, dashZ + (frame.shallowDash ? -0.075 : 0.035)],
    // `dashTop` colours the upper pad apart from the fascia (an N-Box's grey pad over ivory).
    p.dashTop ? material('cabin-dash-top', p.dashTop, 0.03, 0.82) : dark,
  );
  // `lowerDash` colours the fascia below the accent band apart from the hood and bezels (a
  // Genesis's or Palisade's cream lower dash under a dark top).
  if (p.lowerDash)
    d.box(
      [W * 0.8, 0.12, 0.012],
      [0, y - 0.145, z + 0.014],
      material('cabin-lower-dash', p.lowerDash, 0.03, 0.8),
    );
  // `cornerPods`: round speaker pods standing on the dash top's outer corners (a Kia Soul's).
  if (p.cornerPods)
    for (const side of [-1, 1]) {
      const at = [side * W * 0.395, y + 0.078, dashZ + (frame.shallowDash ? -0.075 : 0.04)];
      d.add(new T.CylinderGeometry(0.046, 0.05, 0.03, 20), dark, at);
      d.add(new T.CylinderGeometry(0.036, 0.036, 0.004, 20), P.black, [
        at[0],
        at[1] + 0.015,
        at[2],
      ]);
      d.ring(0.039, 0.003, [at[0], at[1] + 0.016, at[2]], metal, 'y');
    }
  // `bandHeight` widens the accent band into a fascia the screens sit in (a Rivian's wood).
  const bandH = p.bandHeight ?? (centerOnly ? 0.055 : 0.072);
  d.box([W * 0.81, bandH, 0.019], [0, y - 0.085 + bandH / 2, z + 0.006], bandTrim);
  if (layout === 'byd-wave' || layout === 'i3') {
    // One smooth shelf across the fascia, the i3's straight and the Seagull's a wave rising at
    // the doors, rather than a row of stepped blocks.
    d.add(shelfBand(W * 0.8, 0.032, 0.15, layout === 'byd-wave' ? 0.024 : 0), trim, [
      0,
      y - 0.1,
      z + 0.02,
    ]);
  }
  // Glove box, latch, stitching and demister slots carry the passenger-side close view. The
  // passenger side is opposite the driver's eye, so right-hand-drive cabins mirror it.
  const passenger = dx > 0 ? -1 : 1;
  d.box([W * 0.32, 0.16, 0.025], [passenger * W * 0.245, y - 0.15, z + 0.025], dark);
  d.box([0.075, 0.012, 0.009], [passenger * W * 0.245, y - 0.1, z + 0.008], metal);
  // Demister slots are dark grilles in the dash top, not bright marks.
  for (let i = -5; i <= 5; i++)
    d.box(
      [0.045, 0.003, 0.015],
      [i * W * 0.065, y + 0.067, dashZ + (frame.shallowDash ? -0.07 : 0.1)],
      P.black,
    );
  d.rod([-W * 0.39, y - 0.012, z - 0.008], [W * 0.39, y - 0.012, z - 0.008], 0.0015, ink);
  // The center vents a stack plate must frame: their height and outer half-width.
  let stackVents;
  if (centerOnly || inSet(layout, 'lucid rivian')) {
    vent(0, y + 0.018, z - 0.01, 'slot', W * 0.73);
  } else if (layout === 'honda-mesh') {
    // The reference grille is a fine, recessed band; it stops at the instrument binnacle. It is a
    // bright mesh on a black strip between chrome edges, not marks on the trim colour.
    for (const [x0, x1] of [
      [-W * 0.38, dx - 0.18],
      [dx + 0.18, W * 0.38],
    ].map(([a, b]) => [Math.min(a, b), Math.max(a, b)])) {
      if (x1 - x0 < 0.02) continue;
      d.box([x1 - x0, 0.034, 0.004], [(x0 + x1) / 2, y - 0.025, z - 0.012], P.black);
      for (const ey of [-0.0425, -0.0075])
        d.box([x1 - x0, 0.0025, 0.004], [(x0 + x1) / 2, y + ey, z - 0.0145], metal);
    }
    for (let i = 0; i < 96; i++) {
      const x = -W * 0.38 + (i * W * 0.76) / 95;
      if (Math.abs(x - dx) < 0.18) continue;
      for (const row of [-1, 0, 1]) {
        const gy = y - 0.025 + row * 0.009;
        for (const angle of [-Math.PI / 4, Math.PI / 4])
          d.add(new T.PlaneGeometry(0.0013, 0.0113).rotateZ(angle).rotateY(Math.PI), metal, [
            x,
            gy,
            z - 0.016,
          ]);
      }
    }
    for (const x of [-W * 0.32, -0.1, 0.1, W * 0.32])
      d.box([0.025, 0.012, 0.018], [x, y + 0.005, z - 0.028], dark);
  } else {
    // Outer vents at the fascia ends; on a narrow cabin the driver's one moves outboard of the
    // cluster rather than sitting under its outer dial.
    const outer = (v) => {
      const x = v * (layout === 'gt' ? 0.4 : 0.365);
      if (Math.sign(x) !== Math.sign(dx) || Math.abs(x - dx) >= 0.235) return x;
      return Math.sign(x) * Math.min(W * 0.43, Math.abs(dx) + 0.235);
    };
    for (const x of [-W, W].map(outer))
      vent(
        x,
        y + 0.018,
        z - 0.01,
        round
          ? 'round'
          : ssr || transit || inSet(layout, 'ram ford-portrait f150 bronco cts hummer-ev')
            ? 'vertical'
            : 'rect',
        ssr
          ? 0.065
          : round
            ? 0.105
            : ssr || transit || inSet(layout, 'ram ford-portrait f150 bronco cts hummer-ev')
              ? 0.085
              : 0.12,
      );
    if (layout === 'tt') {
      for (const x of [-0.16, 0, 0.16]) {
        vent(x, y + 0.07, z - 0.02, 'round', 0.12);
        knob(x, y + 0.07, z - 0.04, 0.018);
      }
    } else if (inSet(layout, 'mini-r56 mini-r60')) {
      for (const x of [-0.19, 0.19]) vent(x, y + 0.105, z - 0.025, 'round', 0.095);
    } else if (layout === 'gt') {
      // The GT's gauge bank spans the driver and center fascia; its third round vent
      // sits just beyond the large speedometer, not across the auxiliary instruments.
      vent(dx - 0.79, cy, z - 0.025, 'round', 0.105);
    } else if (layout === 'miata') {
      // The ND has one round center vent beside a narrow rectangular passenger vent.
      vent(0.11, y - 0.07, z - 0.025, 'round', 0.105);
      vent(-0.14, y - 0.07, z - 0.025, 'rect', 0.16);
    } else if (
      strada ||
      dmax ||
      transit ||
      ssr ||
      inSet(layout, 'acura-dual bronco cts fiat volt z34 luxury-clock')
    ) {
      if (layout === 'fiat') {
        for (const x of [-0.08, 0.08]) vent(x, y + 0.06, z - 0.025, 'rect', 0.13);
        stackVents = { y: y + 0.06, half: 0.155, height: 0.06 };
      } else {
        const vy = layout === 'acura-dual' ? y - 0.09 : y + 0.06;
        for (const x of [-0.2, 0.2]) vent(x, vy, z - 0.025, 'vertical', 0.06);
        stackVents = { y: vy, half: 0.232, height: 0.085 };
      }
    } else if (acuraTL) {
      for (const x of [-0.075, 0.075]) vent(x, y - 0.075, z - 0.025, 'rect', 0.105);
    } else if (!portrait) {
      // Under an embedded screen the pair drops clear of its lower edge.
      const vy = inSet(layout, 'jaguar jeep-luxury porsche hilux lincoln')
        ? y + 0.13
        : inSet(layout, 'golf soul corvette')
          ? y + 0.125
          : radio
            ? y + 0.085
            : p.screen === 'embedded' || (p.screen !== 'floating' && inSet(layout, embeddedLayouts))
              ? y - 0.09
              : y - 0.07;
      // A profile's `centerVents: 'rail'` draws one slim vent rail across the stack instead;
      // 'flank' sets them beside the screen (drawn with it below); 'none' leaves the stack bare.
      const besideScreen = p.centerVents === 'flank' || p.centerVents === 'none';
      // A rail wider than half a metre runs across the fascia (a Palisade's), not just the stack,
      // so it no longer sets the stack plate's width.
      const fasciaRail = p.railWidth > 0.5;
      if (!besideScreen)
        stackVents = {
          y: vy,
          half: p.railWidth && !fasciaRail ? p.railWidth / 2 + 0.012 : 0.19,
          height: 0.06,
        };
      if (p.centerVents === 'rail') vent(0, vy, z - 0.025, 'slot', p.railWidth ?? 0.34);
      else if (besideScreen) {
        // Nothing on the stack itself.
      } else
        for (const x of [-0.135, 0.135])
          vent(
            x,
            vy,
            z - 0.025,
            round &&
              !element &&
              !kwid &&
              !/chevrolet-(colorado|equinox|trax)/.test(p.slug) &&
              !inSet(layout, 'wrangler soul smart brz jimny fj')
              ? 'round'
              : 'rect',
            0.105,
          );
    } else {
      for (const x of [-0.17, 0.17]) vent(x, y + 0.005, z - 0.025, 'vertical', 0.065);
    }
  }
  const needle = (x, gy, gz, radius) => {
    const pivot = new T.Group();
    pivot.name = 'speed-needle';
    pivot.position.set(x, gy, gz);
    root.add(pivot);
    const kit = makeKit(pivot, 'needle');
    kit.rod([0, 0, 0], [radius * 0.52, -radius * 0.52, 0], 0.0017, frame.red ?? kit.red);
    kit.finish();
  };
  // Kei boxes, the Staria and the Prius stand a thin driver screen on the dash top, no hood.
  const thinCluster = inSet(layout, 'kei-high staria prius');
  if (high) {
    // Raised kei/MPV and head-up clusters still need a physical pedestal above the cowl.
    const baseY = y + 0.045;
    const topY = cy - 0.02;
    if (thinCluster && topY > baseY)
      d.box([0.06, topY - baseY + 0.01, 0.03], [dx, (baseY + topY) / 2, z + 0.06], dark);
    else if (topY > baseY)
      d.box(
        [layout === 'scion-center' ? 0.28 : 0.24, topY - baseY, 0.08],
        [layout === 'scion-center' ? 0 : dx, (baseY + topY) / 2, z + 0.045],
        dark,
      );
  }
  if (inSet(layout, 'mini-r56 mini-r60')) {
    // R56/R60 use a speedometer here; the F56 circular infotainment unit is a different generation.
    // `pod` colours the centre pod (a Countryman's silver); `dials: 'dark'` the speedometer face.
    const pod = p.pod ? material('cabin-pod', p.pod, 0.4, 0.4) : dark;
    d.add(new T.CylinderGeometry(0.128, 0.13, 0.09, 32).rotateX(Math.PI / 2), pod, [
      0,
      y + 0.11,
      z + 0.04,
    ]);
    d.box([0.2, y + 0.11 - (y - 0.03), 0.09], [0, (y + 0.11 + y - 0.03) / 2, z + 0.04], pod);
    a.gauge(0, y + 0.11, z - 0.023, 0.112, p.dials === 'dark' ? a.dark : ink, false);
    needle(0, y + 0.11, z - 0.04, 0.112);
    a.gauge(dx, cy, z - 0.005, 0.067, ink);
    a.display(0, y - 0.015, z - 0.03, 0.12, 0.033, 'radio');
    // The switch stack under the speedometer takes the profile's `stack` (a Countryman's black).
    d.box([0.25, 0.21, 0.04], [0, y - 0.12, z + 0.006], stackTrim);
    for (const x of [-0.075, 0, 0.075]) knob(x, y - 0.105, z - 0.0145, 0.023);
    a.buttons(0, y - 0.055, z - 0.023, 5, 0.034);
    for (let i = -2; i <= 2; i++) {
      knob(i * 0.04, y - 0.18, z - 0.016, 0.008);
      d.rod([i * 0.04, y - 0.18, z - 0.024], [i * 0.04, y - 0.192, z - 0.045], 0.003, metal);
    }
  } else if (layout === 'scion-center' && p.gauges) {
    // A profile's `gauges` (dial radii) replaces the three-dial pod: the first xB's speedometer
    // stands in its own round pod toward the driver, a warning-light window beside it.
    const side = Math.sign(dx) || 1,
      r = Math.max(...p.gauges),
      sx = side * 0.12,
      gy = cy + 0.02;
    d.add(new T.CylinderGeometry(r * 1.22, r * 1.22, 0.08, 24).rotateX(Math.PI / 2), dark, [
      sx,
      gy,
      z + 0.04,
    ]);
    // The pod rises from the dash top on a short foot, above the stack's vents.
    d.box([0.1, gy - y - 0.04, 0.07], [sx, (gy + y + 0.04) / 2, z + 0.045], dark);
    a.gauge(sx, gy, z - 0.005, r, white ? ink : dark, false);
    needle(sx, gy, z - 0.022, r);
    d.box([0.15, 0.06, 0.07], [-side * 0.06, cy - 0.01, z + 0.035], dark);
    a.display(-side * 0.06, cy - 0.01, z - 0.008, 0.125, 0.032, 'warnings');
  } else if (layout === 'scion-center') {
    d.box([0.32, 0.12, 0.08], [0, cy, z + 0.04], dark);
    for (const [x, radius] of [
      [0.02, 0.055],
      [-0.09, 0.033],
      [0.115, 0.026],
    ])
      a.gauge(x, cy, z - 0.005, radius, dark, x !== 0.02);
    needle(0.02, cy, z - 0.02, 0.055);
  } else if (layout === 'gt') {
    d.box([0.9, 0.15, 0.09], [dx - 0.3, cy + 0.015, z + 0.045], dark);
    // Seven instruments in one bank: small auxiliary, large tachometer, four
    // auxiliaries, and the large speedometer at the passenger end.
    const bank = [
      [0.05, 0.035],
      [-0.06, 0.06],
      [-0.18, 0.035],
      [-0.29, 0.035],
      [-0.4, 0.035],
      [-0.51, 0.035],
      [-0.64, 0.06],
    ];
    for (const [offset, radius] of bank) {
      a.gauge(dx + offset, cy, z - 0.006, radius, dark, offset !== -0.64);
      if (offset === -0.64) needle(dx + offset, cy, z - 0.023, radius);
    }
    // The toggle bank under the bank's centre: eight aluminium bats in two groups of four on a
    // brushed plate, and the red engine start button beside the stack.
    const tx = dx - 0.33,
      ty = y - 0.035;
    d.box([0.31, 0.042, 0.012], [tx, ty, z - 0.0045], metal);
    for (let i = 0; i < 8; i++)
      switchGeometry(d, {
        style: 'toggle',
        scale: 1.6,
        at: [tx + (i - 3.5) * 0.032 + (i < 4 ? -0.01 : 0.01), ty, z - 0.0105],
        palette: { grip: metal, legend: ink, alloy: metal },
      });
    d.add(new T.CylinderGeometry(0.016, 0.016, 0.006, 20).rotateX(Math.PI / 2), metal, [
      -passenger * 0.1,
      y - 0.07,
      z - 0.0135,
    ]);
    d.add(
      new T.CylinderGeometry(0.0115, 0.0115, 0.006, 20).rotateX(Math.PI / 2),
      frame.red ?? d.red,
      [-passenger * 0.1, y - 0.07, z - 0.0175],
    );
  } else if (!centerOnly) {
    if (layout === 'jimny') {
      // The Jimny's two dials each sit in their own squared hood, with a gap between the two
      // (0.125 m hoods on 0.125 m centres had merged into one).
      const half = Math.max(0.105, 0.053 * 2.35) / 2;
      for (const side of [-1, 1])
        d.box([0.112, 0.12, 0.09], [dx + side * half, cy + 0.018, z + 0.045], dark);
    } else if (!floating && !thinCluster && layout !== 'lucid')
      d.box(
        [layout === 'porsche' ? 0.37 : 0.3, 0.11, 0.09],
        [dx, cy + 0.022, z + 0.045],
        // `clusterHood: 'body'` paints it in the body colour (a PT Cruiser).
        p.clusterHood === 'body' ? bodyPanel() : dark,
      );
    else if (thinCluster) d.box([0.25, 0.1, 0.012], [dx, cy, z + 0.012], dark);
    if (digital) {
      const dw =
        layout === 'lucid'
          ? 0.38
          : layout === 'tt'
            ? 0.29
            : layout === 'i3'
              ? 0.16
              : high
                ? 0.22
                : 0.27;
      const dh = high ? 0.078 : 0.115;
      // A profile that states a digital cluster replaces an analog speedometer the model's
      // bindings still drive: its screen draws a virtual dial with a live needle.
      const dial = p.cluster === 'digital';
      // A joined panel brings the driver display forward to the centre screen's face.
      const dz = p.panel === 'joined' ? z - 0.023 : z - 0.006;
      a.display(
        dx,
        cy,
        dz,
        dw,
        dh,
        dial ? 'driver-dial' : 'driver',
        layout === 'ioniq' ? ink : p.screenBezel === 'black' ? P.black : dark,
      );
      if (dial) needle(dx + dw * 0.26, cy - dh * 0.02, dz - 0.0105, dh * 0.36);
      if (layout === 'leaf') a.display(dx, cy + 0.065, z + 0.07, 0.2, 0.04, 'driver');
      if (layout === 'supra') a.gauge(dx, cy, z - 0.016, 0.055, dark);
    } else {
      if (p.gauges) {
        // A profile's `gauges` lists the dials' radii from the driver's left (+X) to right, a
        // bezel gap apart (the Element's large centre speedometer between a tachometer and a
        // fuel and temperature dial). The largest, raised a little, carries the live needle.
        const radii = p.gauges,
          big = radii.indexOf(Math.max(...radii));
        const gaps = radii.slice(1).map((r, i) => 1.1 * (r + radii[i]) + 0.006);
        let gx = dx + gaps.reduce((sum, g) => sum + g, 0) / 2;
        radii.forEach((r, i) => {
          if (i) gx -= gaps[i - 1];
          const gy = cy + (i === big ? 0.006 : -0.004);
          a.gauge(gx, gy, z - 0.006, r, white ? ink : a.dark, i !== big);
          if (i === big) needle(gx, gy, z - 0.023, r);
        });
      }
      const count = p.gauges
        ? 0
        : kwid || inSet(layout, 'fiat smart')
          ? 1
          : layout === 'porsche'
            ? 5
            : element || inSet(layout, 'miata mazda brz retro-triple z34 saab fj cts')
              ? 3
              : 2;
      const radius = count === 1 ? 0.083 : count === 5 ? 0.041 : count === 3 ? 0.043 : 0.053;
      for (let i = 0; i < count; i++) {
        // Dials sit apart: their bezels (1.1 r) must not meet.
        const gx =
          dx + (i - (count - 1) / 2) * (count === 5 ? 0.063 : Math.max(0.105, radius * 2.35));
        const gy = cy - Math.abs(i - (count - 1) / 2) * (count === 5 ? 0.014 : 0);
        a.gauge(
          gx,
          gy,
          z - 0.006,
          layout === 'fj' ? (i === 1 ? 0.062 : 0.043) : radius,
          white ? ink : a.dark,
          i !== 0,
        );
        if (i === 0) needle(gx, gy, z - 0.023, radius);
        // A sporty tachometer carries its red line: an arc at the top of the scale.
        if (
          i === count - 1 &&
          count > 1 &&
          inSet(layout, 'muscle mustang z34 brz miata gt corvette porsche supra alfa')
        )
          for (let k = 0; k < 4; k++) {
            const a0 = Math.PI * (0.18 + k * 0.06),
              a1 = a0 + 0.06 * Math.PI,
              rr = (layout === 'fj' ? (i === 1 ? 0.062 : 0.043) : radius) * 0.86;
            d.rod(
              [gx + Math.cos(a0) * rr, gy + Math.sin(a0) * rr, z - 0.017],
              [gx + Math.cos(a1) * rr, gy + Math.sin(a1) * rr, z - 0.017],
              0.0025,
              frame.red ?? d.red,
            );
          }
      }
      if (layout === 'fiat') d.ring(0.054, 0.002, [dx, cy, z - 0.016], metal);
      if (kwid) a.display(dx - 0.07, cy - 0.015, z - 0.022, 0.095, 0.045, 'driver');
      if (layout === 'solstice') a.gauge(dx, cy + 0.045, z - 0.008, 0.023);
    }
  }
  if (inSet(layout, 'z34 fj smart')) {
    // The auxiliary gauges sit side by side in one low pod moulded onto the dash top.
    const n = layout === 'smart' ? 2 : 3;
    // A solid hump from the dash top up to the gauges (thin posts read as lollipops).
    const auxY = Math.min(eye[1] - 0.13, y + 0.17);
    const podTop = auxY + 0.045,
      podFoot = y + 0.04;
    d.add(roundedPod(n * 0.1 + 0.012, podTop - podFoot, 0.09), dark, [
      0,
      (podTop + podFoot) / 2,
      z + 0.09,
    ]);
    for (let i = 0; i < n; i++) {
      const auxX = (i - (n - 1) / 2) * 0.1;
      d.add(new T.CylinderGeometry(0.043, 0.043, 0.04, 20).rotateX(Math.PI / 2), dark, [
        auxX,
        auxY,
        z + 0.058,
      ]);
      a.gauge(auxX, auxY, z + 0.04, 0.035);
    }
  }
  let sy = Math.min(eye[1] - 0.14, y + 0.13);
  let sw = centerOnly ? 0.35 : wide ? 0.32 : 0.25,
    sh = centerOnly ? 0.205 : 0.145;
  if (inSet(layout, 'toyota-truck alphard gm-wide')) sw = 0.35;
  if (layout === 'mazda') {
    sw = 0.29;
    sh = 0.105;
  }
  if (layout === 'prius') {
    sw = 0.29;
    sh = 0.135;
    sy -= 0.035;
  }
  if (layout === 'wuling') {
    sw = 0.22;
    sh = 0.125;
  }
  if (layout === 'coach-digital') sw = 0.34;
  // A profile's `screen` (embedded|floating) overrides where the layout puts its center screen.
  const embedded =
    p.panel !== 'joined' &&
    (p.screen === 'embedded' ||
      (p.screen !== 'floating' && (radio || inSet(layout, embeddedLayouts))));
  if (embedded || strada) sy = y + 0.015;
  if (acuraTL) sy = y + 0.11;
  if (layout === 'z34') {
    sw = 0.25;
    sh = 0.125;
  }
  // `panel: 'separate'` stands the centre screen apart from a linked layout's driver display
  // (a 2025 Explorer's tablet on the dash top).
  const linked =
    p.panel === 'joined' ||
    (p.panel !== 'separate' &&
      inSet(layout, 'mustang gm-linked gm-wide ford-wide hyundai-bridge kia-bridge ioniq'));
  if (linked) sy = cy;
  if (radio) {
    sw = 0.19;
    sh = 0.05;
    sy = y - 0.03;
    if (layout === 'solstice') sy = y - 0.15;
    if (layout === 'gt') sy = y - 0.125;
  }
  // A profile's `screenSize` ([width, height] in metres) sizes the centre screen. On a radio
  // layout a touchscreen of that size replaces the radio, just under the vents above it (the
  // 2024 Kwid's 8 in screen).
  const touch = radio && Boolean(p.screenSize);
  if (p.screenSize) {
    [sw, sh] = p.screenSize;
    if (touch) sy = y + 0.05 - sh / 2;
  }
  // `centerVents: 'flank'`: tall vents either side of the screen in one bezel with it (an F-150,
  // a Sierra, a Tundra).
  const flank = p.centerVents === 'flank' && !portrait && !centerOnly;
  const flankStyle = ventStyle('vertical'),
    flankWidth = inSet(flankStyle, 'round turbine eyeball') ? 0.105 : 0.075;
  if (flank) stackVents = { y: sy, half: sw / 2 + flankWidth + 0.025, height: sh };
  // Screens, switches and vents belong to one molded center stack, not isolated boxes.
  if (
    !centerOnly &&
    !inSet(layout, 'tt mini-r56 mini-r60 ioniq i3 byd-wave casper wuling rivian')
  ) {
    const top = Math.max(
      embedded || radio
        ? Math.max(
            y + (inSet(layout, 'jaguar jeep-luxury porsche hilux') ? 0.12 : 0.07),
            sy + sh / 2 + 0.004,
          )
        : y + 0.01,
      stackVents ? stackVents.y + stackVents.height / 2 + 0.012 : -Infinity,
    );
    const bottom = y - 0.235;
    const plateWidth =
      p.stackWidth ?? Math.max(0.285, sw + 0.035, stackVents ? 2 * stackVents.half + 0.02 : 0);
    // `stackFrame` outlines the stack's upper section in a thin bright frame (a Saab 9-3's).
    if (p.stackFrame) {
      const low = y - 0.13;
      for (const fy of [top - 0.004, low])
        d.box([plateWidth - 0.012, 0.005, 0.005], [0, fy, z - 0.013], metal);
      for (const side of [-1, 1])
        d.box(
          [0.005, top - low, 0.005],
          [side * (plateWidth / 2 - 0.006), (top + low) / 2, z - 0.013],
          metal,
        );
    }
    // `stackAngle` (degrees) turns the stack toward the driver; applied by angleCabinStack once
    // the cabin's kits have merged.
    if (p.stackAngle)
      root.userData.molenStackRegion = {
        half: plateWidth / 2 + 0.008,
        top: top + 0.01,
        bottom: bottom - 0.005,
        z,
        angle: (-Math.sign(dx || 1) * (p.stackAngle * Math.PI)) / 180,
      };
    d.box(
      [plateWidth, top - bottom, 0.035],
      // Its face meets the backs of the vents, knobs and switches it carries (z - 0.0105):
      // set further back, they stood 2 to 4 cm proud of it, a popped-out look from the seat.
      [0, (top + bottom) / 2, z + 0.007],
      stackTrim,
    );
    // A screen standing above the dash top rests on a slim dark neck, not on the trim plate.
    if (!embedded && !radio && sy - sh / 2 > y + 0.05)
      d.box(
        [Math.min(0.09, sw * 0.4), sy - sh / 2 - y, 0.03],
        [0, (sy - sh / 2 + y) / 2 + 0.01, z + 0.045],
        dark,
      );
  }
  if (flank) {
    const half = sw / 2 + flankWidth + 0.025;
    d.box([2 * half, sh + 0.034, 0.008], [0, sy, z - 0.0105], P.black);
    // The pickups edge the bezel in bright trim; a van's black panel has none.
    if (inSet(layout, 'f150 gm-wide toyota-truck'))
      for (const ey of [1, -1])
        d.box([2 * half, 0.005, 0.005], [0, sy + ey * (sh / 2 + 0.0145), z - 0.016], metal);
    for (const side of [-1, 1])
      carVent(d, P, [side * (sw / 2 + flankWidth / 2 + 0.012), sy, z - 0.02], {
        style: flankStyle,
        width: flankWidth,
        height: Math.min(sh * 0.9, 0.15),
      });
  }
  if (inSet(layout, 'mini-r56 mini-r60 tt')) {
    // All infotainment is already accounted for above.
  } else if (portrait) {
    d.box([0.43, 0.34, 0.065], [0, y - 0.018, z + 0.025], trim);
    a.display(0, y - 0.005, z - 0.024, layout === 'ram' ? 0.22 : 0.185, 0.285);
  } else if (inSet(layout, 'acura-dual jaguar')) {
    d.box([0.32, 0.15, 0.08], [0, sy + 0.01, z + 0.035], dark);
    a.display(0, sy, z - 0.01, 0.28, 0.12);
    a.display(0, y - 0.09, z - 0.035, 0.235, 0.105, 'climate');
  } else {
    if (layout === 'volt') d.box([0.31, 0.33, 0.05], [0, y - 0.03, z + 0.01], ink);
    if (linked) {
      const left = Math.min(
        -sw / 2 - 0.018,
        dx - 0.15,
        p.panel === 'joined' && layout === 'triple-screen' ? -W * 0.235 - 0.168 : 0,
      );
      const right = Math.max(sw / 2 + 0.018, dx + 0.15);
      // A profile's `panel: 'joined'` makes the two displays one glass panel (a Mustang S650,
      // a Colorado): the backing comes forward to the screens' faces, in gloss black.
      const joined = p.panel === 'joined';
      d.box(
        [right - left, 0.165, joined ? 0.03 : 0.035],
        [(left + right) / 2, (cy + sy) / 2, joined ? z - 0.012 : z + 0.029],
        layout === 'ioniq'
          ? ink
          : joined
            ? P.black
            : inSet(layout, 'kia-bridge hyundai-bridge')
              ? a.screen
              : dark,
      );
    }
    a.display(
      0,
      sy,
      z - 0.023,
      sw,
      sh,
      radio && !touch ? 'radio' : 'map',
      layout === 'ioniq' ? ink : p.screenBezel === 'black' ? P.black : dark,
    );
    if (inSet(layout, 'lucid genesis coach-mixed'))
      a.display(0, y - 0.16, z - 0.09, 0.19, layout === 'lucid' ? 0.15 : 0.07, 'climate');
    if (layout === 'triple-screen') a.display(-W * 0.235, sy, z - 0.02, 0.3, 0.135, 'media');
    if (layout === 'coach-digital') a.display(-0.36, y - 0.04, z - 0.03, 0.22, 0.13, 'camera');
  }
  if (!centerOnly && !inSet(layout, 'tt mini-r56 mini-r60 lucid rivian')) {
    const ky = layout === 'solstice' ? y - 0.035 : portrait ? y - 0.18 : y - 0.15;
    // Layouts without a center stack carry their climate controls on a dark bar of their own.
    if (inSet(layout, 'ioniq i3 byd-wave casper wuling'))
      d.box([0.27, 0.075, 0.02], [0, ky - 0.012, z - 0.012], P.black);
    const threeKnobs =
      p.climateKnobs === 3 ||
      element ||
      strada ||
      dmax ||
      kwid ||
      layout === 'scion-center' ||
      inSet(
        layout,
        'solstice saab honda-suv honda-mesh miata brz wuling fj jimny golf clio toyota-tablet',
      );
    // Seated on the stack face, or on the climate bar where a layout has no stack.
    const bar = inSet(layout, 'ioniq i3 byd-wave casper wuling');
    // A knob is drawn forward from its base: the base sits on the face.
    const kz = bar ? z - 0.0225 : z - 0.011,
      bz = bar ? z - 0.031 : z - 0.016;
    // `climateKnobs` 0 or 1: climate lives on the screen, leaving a button row with no dials or
    // with one volume knob at its driver end (a 2025 Explorer, a Monjaro).
    const screenClimate = p.climateKnobs === 0 || p.climateKnobs === 1;
    const driverSide = Math.sign(dx) || 1;
    for (const kx of screenClimate
      ? p.climateKnobs
        ? [driverSide * 0.1]
        : []
      : threeKnobs
        ? [-0.09, 0, 0.09]
        : [-0.09, 0.09])
      knob(kx, ky, kz, 0.018);
    if (screenClimate) a.buttons(p.climateKnobs ? -driverSide * 0.025 : 0, ky, bz, 6, 0.027);
    else if (!threeKnobs) a.buttons(0, ky, bz, 3, 0.024);
    if (inSet(layout, 'acura-old cts saab volvo')) {
      for (let i = 0; i < 3; i++)
        a.buttons(0, y - (acuraTL ? 0.11 : 0.07) - i * 0.025, bz, 4, 0.028);
    } else a.buttons(0, ky - 0.029, bz, inSet(layout, 'duster peugeot') ? 7 : 5);
  }
  if (layout === 'luxury-clock') {
    // The analog clock sits in its own bezel on the dash top over the stack.
    const clockY = Math.min(y + 0.115, eye[1] - 0.12);
    d.box([0.075, clockY - y + 0.03, 0.05], [0, (clockY + y) / 2 + 0.01, z + 0.035], stackTrim);
    a.gauge(0, clockY, z + 0.005, 0.025, ink);
  }
  if (inSet(layout, 'bronco defender jimny fj hummer-ev rugged-radio')) {
    // The passenger's grab handle across the fascia; `grabHandle: false` where the photographed
    // trim has a flat panel there instead (a Bronco's, a Hummer EV's).
    if (p.grabHandle !== false) {
      const [g0, g1] = [passenger * W * 0.34, passenger * W * 0.16];
      d.rod([g0, y - 0.14, z - 0.04], [g1, y - 0.14, z - 0.04], 0.019, metal);
      for (const x of [g0, g1]) d.rod([x, y - 0.14, z - 0.04], [x, y - 0.14, z + 0.04], 0.02, dark);
    }
    a.buttons(passenger * W * 0.25, y - 0.04, z - 0.022, 4);
  }
  if (layout === 'worktaxi') {
    a.display(-0.29, y + 0.1, z - 0.04, 0.15, 0.065, 'meter');
    d.text('TAXI', [-0.29, y + 0.155, z - 0.045], 0.018, Math.PI, ink);
  }
  // Center tunnel: open EV floors, floating bridges, conventional storage, or commercial dash gear.
  const open = inSet(p.selector, 'column open') && inSet(layout, 'i3 ioniq casper staria wuling');
  const tunnelY = Math.min(seatY + 0.08, y - 0.35);
  const floorY = Math.max(clearance + 0.035, Math.min(seatY - 0.34, y - 0.53));
  const firewallHeight = Math.max(0.08, y - 0.1 - floorY);
  // Footwell and floor are carpet: dark even under a colored dash.
  d.box([W * 0.84, firewallHeight, 0.04], [0, floorY + firewallHeight / 2, dashZ + 0.14], a.dark);
  // Overlap the firewall: even a small longitudinal gap exposes the front tires in a wide view.
  d.box([W * 0.84, 0.025, 1.32], [0, floorY, eye[2] + 0.08], a.dark);
  for (const side of [-1, 1])
    d.box(
      [0.025, firewallHeight, 1.3],
      [side * W * 0.418, floorY + firewallHeight / 2, eye[2] + 0.08],
      dark,
    );
  if (layout === 'corvette')
    d.rod(
      [passenger * 0.125, tunnelY + 0.05, eye[2] - 0.12],
      [passenger * 0.125, y - 0.15, eye[2] + 0.3],
      0.011,
      metal,
    );
  if (!open) {
    d.box([0.235, 0.15, 0.55], [0, tunnelY, eye[2]], dark);
    d.box([0.22, 0.017, 0.48], [0, tunnelY + 0.08, eye[2] + 0.01], trim);
    for (const cupZ of [eye[2] - 0.05, eye[2] + 0.085]) {
      d.add(new T.CircleGeometry(0.036, 16).rotateX(-Math.PI / 2), dark, [0, tunnelY + 0.09, cupZ]);
      d.add(new T.TorusGeometry(0.037, 0.003, 4, 16).rotateX(Math.PI / 2), metal, [
        0,
        tunnelY + 0.091,
        cupZ,
      ]);
    }
    d.box([0.2, 0.05, 0.18], [0, tunnelY + 0.075, eye[2] - 0.23], trim);
  }
  const gz = p.selector === 'dash' ? z - 0.09 : eye[2] + 0.22;
  const gy = p.selector === 'dash' ? y - 0.2 : tunnelY + 0.12;
  if (p.selector === 'lever' || p.selector === 'dash') {
    // Pickups and vans carry a T-handle; small sports cars a ball knob over its shift pattern;
    // hybrids a short joystick; the rest a sculpted automatic knob with its release button.
    const shifter = inSet(
      layout,
      'f150 ram transit-van e-series hiace worktruck sprinter camper-van rugged-radio coach-analog coach-digital coach-mixed',
    )
      ? 'tee'
      : inSet(layout, 'miata brz z34 gt jimny wrangler solstice')
        ? 'ball'
        : inSet(layout, 'prius leaf volt')
          ? 'joystick'
          : 'sculpted';
    shifterGeometry(d, hardware, [0, gy - 0.04, gz], {
      style: p.shifter ?? shifter,
      boot: p.selector !== 'dash',
    });
  } else if (p.selector === 'buttons') {
    // A vertical P / R / N / D column on the lower stack face, Park in bright trim.
    const driverSide = p.selectorSide === 'driver';
    const bx = (driverSide ? -passenger : passenger) * 0.13,
      by = driverSide ? 0.07 : 0;
    d.box([0.05, 0.13, 0.012], [bx, y - 0.165 + by, z - 0.0145], P.black);
    for (let i = 0; i < 4; i++)
      d.box(
        [0.036, 0.022, 0.012],
        [bx, y - 0.12 + by - i * 0.03, z - 0.024],
        i === 0 ? metal : dark,
      );
  } else if (p.selector === 'rotary' || p.selector === 'puck') {
    if (layout === 'ram') knob(dx * 0.46, y - 0.13, z - 0.04, 0.031);
    else {
      d.add(new T.CylinderGeometry(0.031, 0.034, 0.03, 16), metal, [0, gy, gz]);
      d.add(new T.CircleGeometry(0.025, 16).rotateX(-Math.PI / 2), dark, [0, gy + 0.016, gz]);
    }
  }
  if (inSet(layout, 'mazda miata supra genesis alfa'))
    d.add(new T.CylinderGeometry(0.027, 0.03, 0.017, 16), metal, [
      0.06,
      tunnelY + 0.104,
      eye[2] + 0.01,
    ]);
  if (inSet(layout, 'volvo i3 defender')) d.box([0.24, 0.015, 0.16], [0, y - 0.29, z + 0.04], trim);
  // Door cards are below the glass and behind the instrument plane; no slab crosses the eye.
  for (const side of [-1, 1]) {
    const x = side * W * 0.425;
    const top = Math.min(seatY + 0.43, frame.doorTop ?? Infinity);
    const cardY = top - 0.13;
    const frontZ = dashZ + 0.15;
    const rearZ = eye[2] - 0.37;
    d.box(
      [0.035, top - floorY, frontZ - rearZ],
      [x, (top + floorY) / 2, (frontZ + rearZ) / 2],
      dark,
    );
    d.box([0.048, 0.07, 0.4], [x - side * 0.025, cardY - 0.04, eye[2] + 0.01], trim);
    d.rod(
      [x - side * 0.03, top - 0.04, eye[2] + 0.09],
      [x - side * 0.03, top - 0.04, eye[2] + 0.2],
      0.008,
      metal,
    );
    for (let i = 0; i < 4; i++)
      d.box([0.018, 0.008, 0.024], [x - side * 0.045, cardY, eye[2] + i * 0.032], dark);
    for (let i = -2; i <= 2; i++)
      d.box(
        [0.004, 0.004, 0.14],
        [x - side * 0.022, cardY - 0.16 + i * 0.014, eye[2] + 0.15],
        metal,
      );
  }
  const wheelRoot = new T.Group();
  wheelRoot.name = 'steering-wheel';
  wheelRoot.position.set(dx, eye[1] - (high ? 0.38 : 0.34), eye[2] + 0.31);
  root.add(wheelRoot);
  const wheel = makeKit(wheelRoot, 'steering-fittings');
  const radius = inSet(layout, 'peugeot prius')
    ? 0.14
    : layout.startsWith('coach') || layout === 'worktruck'
      ? 0.18
      : 0.16;
  // The wheel family follows the generation (cabin-parts.mjs); the rim rakes its top toward the
  // dash as real columns do. The steering binding turns it about its own (raked) axis.
  const wheelStyle = wheelStyleFor(p, layout);
  wheelRoot.rotation.x = layout.startsWith('coach') ? 0.55 : 0.3;
  steeringWheelGeometry(wheel, hardware, {
    style: wheelStyle,
    radius: wheelStyle === 'bus' ? Math.max(radius, 0.2) : radius,
    accent: layout === 'alfa' ? (frame.red ?? wheel.red) : undefined,
  });
  for (const side of [-1, 1])
    if (layout !== 'tesla-highland') {
      // Indicator and wiper stalks from the column shroud.
      d.add(
        new T.CylinderGeometry(0.0055, 0.0045, 0.13, 8).rotateZ(Math.PI / 2 - side * 0.12),
        dark,
        [dx + side * 0.075, eye[1] - 0.322, eye[2] + 0.37],
      );
      d.add(new T.SphereGeometry(0.008, 6, 5), dark, [
        dx + side * 0.138,
        eye[1] - 0.314,
        eye[2] + 0.37,
      ]);
    }
  wheel.finish();
  d.add(new T.CylinderGeometry(0.034, 0.042, 0.16, 14).rotateX(Math.PI / 2 + 0.3), dark, [
    dx,
    eye[1] - 0.33,
    eye[2] + 0.42,
  ]);
  d.rod(wheelRoot.position.toArray(), [dx, y - 0.08, dashZ], 0.027, dark);
  // Hung brake and accelerator from the pedal box; German and Swedish cars hinge theirs at the floor.
  const organ = inSet(layout, 'golf polo skoda porsche volvo alfa saab');
  const pedalZ = eye[2] + 0.44;
  carPedal(d, hardware, [dx + 0.055, floorY + 0.1, pedalZ], {
    kind: 'brake',
    pivot: [dx + 0.055, floorY + 0.27, pedalZ + 0.2],
  });
  carPedal(d, hardware, [dx - 0.085, floorY + (organ ? 0.06 : 0.1), pedalZ + 0.02], {
    kind: 'accelerator',
    organ,
    pivot: [dx - 0.085, floorY + 0.27, pedalZ + 0.21],
  });
  if (ownKit) d.finish();
}

/**
 * The eight Bendy boats have purpose-specific stations rather than a car dashboard at sea. Each
 * class follows public photographs of its kind (cited in interior-references.json, or listed in
 * the 2026-11-27 class check): merchant bridges (container ship, bulk carrier, ro-ro ferry) stand
 * pale grey-green consoles whose displays lie in a sloped desk, with a steering stand carrying a
 * small wheel; a catamaran passenger ferry has a dark console; a fishing wheelhouse a varnished
 * wood console and a spoked wooden wheel; a harbour tug a wood console round a black panel with
 * azimuth-drive heads; a sport boat a black dash set in white moulding, white-faced gauges and a
 * chartplotter; a sailboat a slim pedestal with binnacle compass and guard rail.
 */
export function addMarineDashboard(root, s, makeKit) {
  const { layout } = interiorProfile(s.id);
  const [x, ey, ez] = s.driverEye,
    y = ey - 0.39,
    z = ez + 0.6;
  const d = makeKit(root, 'helm'),
    a = panelTools(d);
  const sail = layout === 'sailboat',
    small = layout === 'speedboat';
  const fishing = layout === 'fishing-boat',
    tug = layout === 'tugboat';
  const large = !sail && !small && !fishing && !tug;
  const passenger = layout === 'passenger-ferry',
    merchant = large && !passenger;
  const width = sail
    ? 0.38
    : small
      ? 0.94
      : fishing
        ? 1.24
        : tug
          ? 1.65
          : passenger
            ? 1.85
            : layout === 'car-ferry'
              ? 2.2
              : layout === 'container-ship'
                ? 2.65
                : 2.45;
  const body = material(
    'marine-console',
    sail
      ? '#c6c9c2'
      : small
        ? '#d6d9d3'
        : fishing
          ? '#8d5f3d'
          : tug
            ? '#7b5538'
            : passenger
              ? '#41484c'
              : '#a9b6ae',
  );
  // The instrument face: a sport boat's black dash, a tug's black panel, a fishing boat's pale
  // desk top; merchant and ferry consoles keep one colour.
  const desk =
    small || tug
      ? material('marine-panel', '#25292c')
      : fishing
        ? material('marine-desk', '#cdc8bb')
        : body;
  const upholstery = small ? d.ivory : material('marine-seat', '#3f4549');
  const floorY = s.helmFloor ?? s.freeboard;
  const panelZ = z - 0.197;
  // A child frame of the helm kit, tilted back about X through `pivot`: panel parts drawn in it lie
  // on a sloped desk. Local +Y runs up the slope, local -Z faces the helmsman.
  const sloped = (pivot, angle) => {
    const g = new T.Group();
    g.position.fromArray(pivot);
    g.rotation.x = angle;
    d.root.add(g);
    return {
      ...d,
      add: (geometry, m, at) => d.add(geometry, m, at, g),
      box: (size, at, m) => d.box(size, at, m, g),
      rod: (p, q, r, m) => d.rod(p, q, r, m, g),
      ring: (r, t, at, m, axis) => d.ring(r, t, at, m, axis, g),
    };
  };
  if (sail) {
    // A slim pedestal on the cockpit sole: binnacle compass on top, a stainless guard loop round
    // it carrying a chartplotter and two instrument heads, the engine control on its side.
    const pz = ez + 0.52,
      top = y + 0.005;
    d.add(new T.CylinderGeometry(0.065, 0.08, top - floorY, 16), body, [x, (top + floorY) / 2, pz]);
    d.add(new T.CylinderGeometry(0.12, 0.13, 0.025, 16), body, [x, floorY + 0.0125, pz]);
    d.add(new T.CylinderGeometry(0.085, 0.07, 0.05, 16), d.dark, [x, top + 0.025, pz]);
    d.add(new T.SphereGeometry(0.07, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), d.dark, [
      x,
      top + 0.05,
      pz,
    ]);
    d.ring(0.072, 0.008, [x, top + 0.05, pz], d.metal, 'y');
    const gz = pz + 0.1,
      barY = y + 0.09;
    for (const side of [-1, 1])
      d.rod([x + side * 0.17, floorY + 0.06, pz], [x + side * 0.17, barY, gz], 0.013, d.metal);
    d.rod([x - 0.17, barY, gz], [x + 0.17, barY, gz], 0.013, d.metal);
    d.box([0.07, 0.03, 0.05], [x, barY + 0.025, gz], d.dark);
    a.display(x, barY + 0.095, gz - 0.025, 0.2, 0.105);
    for (const side of [-1, 1])
      a.display(x + side * 0.17, barY + 0.06, gz - 0.02, 0.075, 0.075, 'engine');
    // Single-lever engine control on the pedestal's starboard side.
    const cx = x - 0.09;
    d.box([0.04, 0.11, 0.11], [cx, y - 0.1, pz], d.dark);
    d.rod([cx - 0.02, y - 0.1, pz], [cx - 0.06, y - 0.02, pz - 0.05], 0.008, d.metal);
    d.box([0.03, 0.025, 0.045], [cx - 0.065, y - 0.012, pz - 0.055], d.dark);
  } else {
    // Lower console with a vertical front, and the sloped desk above it carrying the panel.
    const deskY = y - 0.07,
      deskH = small ? 0.22 : 0.3,
      tilt = small ? 0.7 : 0.45;
    d.box([width, deskY - (y - 0.215), 0.38], [x, (deskY + y - 0.215) / 2, z], body);
    const plinthTop = y - 0.215;
    if (plinthTop > floorY)
      d.box(
        [width * 0.92, plinthTop - floorY, 0.3],
        [x, (plinthTop + floorY) / 2, z + 0.025],
        body,
      );
    const lowerFace = z - 0.19;
    const k = sloped([0, deskY, panelZ], tilt);
    const p = panelTools(k, { screen: a.screen });
    // A sport boat's black dash is inset in the white moulding, clear of the wrapped windscreen.
    k.box(
      small ? [0.8, deskH, 0.28] : [width, deskH, 0.28],
      [small ? x - 0.03 : x, deskH / 2, 0.14],
      desk,
    );
    // Where a local desk point lands in the model frame (for parts that stay upright).
    const onDesk = (ly, lz) => [
      deskY + ly * Math.cos(tilt) - lz * Math.sin(tilt),
      panelZ + ly * Math.sin(tilt) + lz * Math.cos(tilt),
    ];
    if (small) {
      // Sport-boat dash: chartplotter centred over the wheel, tachometer and speedometer beside
      // it, three small gauges stacked outboard, a digital engine display and start button.
      p.display(x, 0.14, -0.02, 0.25, 0.13);
      for (const side of [-1, 1]) p.gauge(x + side * 0.205, 0.085, -0.004, 0.045, d.ivory);
      for (let i = 0; i < 3; i++) p.gauge(x + 0.33, 0.04 + i * 0.06, -0.004, 0.022, d.ivory);
      p.display(x - 0.35, 0.155, -0.012, 0.08, 0.055, 'engine');
      k.add(new T.CylinderGeometry(0.016, 0.016, 0.01, 16).rotateX(Math.PI / 2), d.metal, [
        x - 0.35,
        0.08,
        -0.004,
      ]);
      k.add(new T.CylinderGeometry(0.011, 0.011, 0.01, 16).rotateX(Math.PI / 2), d.red, [
        x - 0.35,
        0.08,
        -0.009,
      ]);
      p.buttons(x - 0.33, 0.03, -0.006, 3, 0.03);
      // Compass on the dash top, and a switch row on the console face.
      const [cy, cz] = onDesk(deskH, 0.09);
      d.add(new T.CylinderGeometry(0.05, 0.055, 0.03, 16), d.dark, [x + 0.24, cy + 0.01, cz]);
      d.add(new T.SphereGeometry(0.044, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), d.dark, [
        x + 0.24,
        cy + 0.025,
        cz,
      ]);
      a.buttons(x + 0.28, y - 0.1, lowerFace - 0.005, 5, 0.035);
    } else {
      const count = layout === 'container-ship' ? 4 : layout === 'bulk-carrier' ? 3 : 2;
      const spacing = large ? (layout === 'container-ship' ? 0.48 : 0.53) : 0.35;
      for (let i = 0; i < count; i++) {
        const sx = x + (i - (count - 1) / 2) * spacing;
        p.display(
          sx,
          0.18,
          -0.02,
          large ? 0.4 : 0.27,
          large ? 0.22 : 0.19,
          i === 0 ? 'radar' : i === 1 ? 'map' : 'engine',
        );
        p.buttons(sx, 0.035, -0.006, 5, 0.032);
        p.knob(sx - (large ? 0.19 : 0.1), 0.038, -0.01);
      }
      const sideX = x - width * 0.41;
      p.gauge(sideX, 0.2, -0.004, 0.042);
      p.gauge(sideX, 0.09, -0.004, 0.035);
      // VHF face and hanging microphone, separate from chart/radar displays.
      const rx = x + width * 0.4;
      p.display(rx, 0.21, -0.008, 0.12, 0.045, 'radio');
      p.knob(rx - 0.045, 0.165, -0.012, 0.009);
      k.box([0.035, 0.075, 0.022], [rx + 0.1, 0.18, -0.02], d.dark);
      for (let i = 0; i < 7; i++)
        k.ring(0.009, 0.002, [rx + 0.1, 0.13 - i * 0.011, -0.02], d.dark, 'y');
      if (tug) {
        // Varnished cap rail round the black panel.
        k.box([width + 0.02, 0.028, 0.05], [x, deskH, 0.02], body);
        for (const side of [-1, 1])
          k.box([0.028, deskH, 0.05], [x + side * (width / 2), deskH / 2, 0.0], body);
      }
      if (fishing) {
        // Chrome grab rail along the console front, on two standoffs.
        const ry = y - 0.1,
          rz = lowerFace - 0.045;
        d.rod([x - width * 0.46, ry, rz], [x + width * 0.46, ry, rz], 0.009, d.metal);
        for (const side of [-1, 1])
          d.rod(
            [x + side * width * 0.42, ry, rz],
            [x + side * width * 0.42, ry, lowerFace],
            0.007,
            d.metal,
          );
      }
      if (merchant) {
        // Steering stand: a pedestal behind the wheel, its sloped head a rudder-angle dial.
        const front = ez + 0.335,
          back = panelZ + 0.02,
          top = y + 0.03;
        d.box(
          [0.26, top - floorY, back - front],
          [x, (top + floorY) / 2, (front + back) / 2],
          body,
        );
        const head = sloped([0, top, front], 0.7);
        head.box([0.26, 0.09, back - front], [x, 0.045, (back - front) / 2], body);
        panelTools(head, { screen: a.screen }).gauge(x, 0.047, -0.004, 0.034, d.ivory);
      }
    }
    if (large) {
      d.box([0.47, 0.02, 0.55], [x - 0.98, y - 0.2, ez + 0.22], body);
      d.box([0.35, 0.002, 0.35], [x - 0.98, y - 0.188, ez + 0.22], d.ivory);
      for (let i = -2; i <= 2; i++)
        d.rod(
          [x - 1.13, y - 0.185, ez + 0.22 + i * 0.06],
          [x - 0.84, y - 0.185, ez + 0.22 + i * 0.06],
          0.0015,
          d.dark,
        );
    }
    const controls = tug || large ? 2 : 1;
    // Throttle quadrants (a tug's azimuth-drive heads) attach to the console through a return shelf.
    d.box([width * 0.27, 0.055, 0.42], [x - width * 0.35, y - 0.16, ez + 0.38], body);
    const shelfTop = y - 0.1325;
    for (let i = 0; i < controls; i++) {
      if (tug) {
        // Azimuth control head: a dial on a round base and an upright grip that turns with it.
        const tx = x - width * 0.3 - i * 0.13,
          tz = ez + 0.27;
        d.add(new T.CylinderGeometry(0.05, 0.055, 0.035, 16), d.dark, [tx, shelfTop + 0.0175, tz]);
        d.add(new T.CircleGeometry(0.043, 16).rotateX(-Math.PI / 2), d.ivory, [
          tx,
          shelfTop + 0.0355,
          tz,
        ]);
        d.ring(0.043, 0.003, [tx, shelfTop + 0.036, tz], d.dark, 'y');
        d.rod([tx, shelfTop + 0.035, tz], [tx, shelfTop + 0.12, tz + 0.02], 0.009, d.metal);
        d.add(new T.CylinderGeometry(0.018, 0.016, 0.065, 12), d.dark, [
          tx,
          shelfTop + 0.15,
          tz + 0.025,
        ]);
        d.box([0.008, 0.012, 0.03], [tx, shelfTop + 0.04, tz + 0.03], d.amber);
        continue;
      }
      const tx = x - width * 0.32 - i * 0.08;
      d.box([0.06, 0.09, 0.19], [tx, y - 0.1, ez + 0.23], d.dark);
      d.rod([tx, y - 0.06, ez + 0.24], [tx, y + 0.075, ez + 0.29], 0.009, d.metal);
      d.box([0.052, 0.035, 0.045], [tx, y + 0.08, ez + 0.29], d.dark);
    }
    d.text(tug ? 'THRUST' : 'BENDY', [x + 0.3, y - 0.16, lowerFace - 0.002], 0.022, Math.PI);
    const seatBottom = ey - 0.71;
    if (seatBottom > floorY)
      d.add(new T.CylinderGeometry(0.045, 0.075, seatBottom - floorY, 12), d.metal, [
        x,
        (seatBottom + floorY) / 2,
        ez - 0.05,
      ]);
    d.box([0.54, 0.1, 0.48], [x, ey - 0.66, ez - 0.05], upholstery);
    d.box([0.54, 0.38, 0.08], [x, ey - 0.43, ez - 0.27], upholstery);
    for (const side of [-1, 1])
      d.rod(
        [x + side * 0.28, ey - 0.62, ez - 0.12],
        [x + side * 0.28, ey - 0.44, ez + 0.03],
        0.018,
        d.metal,
      );
  }
  if (layout === 'car-ferry') {
    // Repeater dials hung at the window head ahead of the helm: rudder angle, the two engines'
    // revolutions and speed, faced down at the helmsman, as in the Seikan ferries' wheelhouses
    // (2026-11-27 class check). Two rods carry the housing from the deckhead.
    const hy = ey + 0.9,
      hz = ez + 0.95;
    const repeaters = sloped([0, hy, hz], -0.6);
    repeaters.box([0.98, 0.2, 0.1], [x, 0, 0.05], body);
    const dials = panelTools(repeaters, { screen: a.screen });
    for (const [i, gx] of [-0.34, -0.11, 0.11, 0.34].entries())
      dials.gauge(x + gx, 0, -0.002, 0.07, d.ivory, i !== 0);
    // The ferry's full-beam wheelhouse showed its green roof paint overhead: a white deckhead
    // just under it, between the side windows (±5.96 m) and from the rear to the front glass
    // (measured from the helm eye).
    d.box(
      [11.9, 0.02, 4.8],
      [0, ey + 1.235, ez - 1.0],
      material('marine-deckhead', '#e4e5df', 0, 0.85),
    );
    for (const side of [-1, 1])
      d.rod(
        [x + side * 0.38, hy + 0.06, hz + 0.08],
        [x + side * 0.38, ey + 1.25, hz + 0.08],
        0.012,
        d.metal,
      );
  }
  const hubY = y - (sail ? 0.03 : 0);
  d.rod([x, hubY, ez + 0.3], [x, hubY, sail ? ez + 0.52 : z], 0.025, d.metal);
  d.finish();
  const wheel = new T.Group();
  wheel.name = 'helm-wheel';
  wheel.position.set(x, hubY, ez + 0.3);
  root.add(wheel);
  const c = makeKit(wheel, 'helm-wheel-trim'),
    radius = sail ? 0.3 : small ? 0.17 : large || tug ? 0.16 : 0.21;
  if (fishing) {
    // A traditional spoked wooden wheel: rim and inner ring, eight spokes run out to handles.
    const wood = material('marine-wheel-wood', '#6e4329', 0, 0.55);
    c.ring(radius, 0.017, [0, 0, 0], wood);
    c.ring(radius * 0.5, 0.01, [0, 0, 0], wood);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4,
        dir = [Math.cos(angle), Math.sin(angle)];
      c.rod([0, 0, 0], [dir[0] * (radius + 0.035), dir[1] * (radius + 0.035), 0], 0.009, wood);
      c.add(new T.CylinderGeometry(0.011, 0.008, 0.05, 6).rotateZ(angle - Math.PI / 2), wood, [
        dir[0] * (radius + 0.055),
        dir[1] * (radius + 0.055),
        0,
      ]);
    }
    c.add(new T.CylinderGeometry(0.038, 0.038, 0.035, 16).rotateX(Math.PI / 2), c.metal);
  } else {
    c.ring(radius, sail ? 0.012 : 0.016, [0, 0, 0], sail ? c.metal : c.dark);
    const spokes = sail ? 6 : small ? 3 : tug ? 5 : 4;
    for (let i = 0; i < spokes; i++) {
      const angle = (i * Math.PI * 2) / spokes;
      c.rod([0, 0, 0], [Math.cos(angle) * radius, Math.sin(angle) * radius, 0], 0.009, c.metal);
    }
    c.add(new T.CylinderGeometry(0.035, 0.035, 0.03, 16).rotateX(Math.PI / 2), c.metal);
  }
  c.finish();
}
