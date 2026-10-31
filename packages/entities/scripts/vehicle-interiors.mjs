/** Authored cockpit geometry. Reference photographs remain in the citation catalog, never GLBs. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import catalog from '../../../content/entities/source/interiors.json' with { type: 'json' };

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
        32,
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
      const a = Math.PI * (-0.25 + (i * 1.5) / 12);
      d.rod(
        [x + Math.cos(a) * radius * 0.77, y + Math.sin(a) * radius * 0.77, front - 0.008],
        [x + Math.cos(a) * radius * 0.91, y + Math.sin(a) * radius * 0.91, front - 0.008],
        radius * 0.022,
        face === dark ? ink : dark,
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
    } else if (kind === 'driver') {
      for (const side of [-1, 1]) {
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

/** Dashboard dimensions follow the authored eye and cowl, independently of exterior shape recipes. */
export function addRoadDashboard(root, s, frame, makeKit) {
  const p = interiorProfile(s.id),
    layout = p.layout;
  const { eye, width: W, dashY: y, dashZ, seatY, clearance = 0.1 } = frame;
  const d = frame.cabin ?? makeKit(root, 'cabin');
  const ownKit = !frame.cabin;
  const trim = material(
    'cabin-trim',
    p.slug === 'chevrolet-ssr-2005' ? (s.color ?? p.trim) : p.trim,
    0.08,
    0.72,
  );
  const a = panelTools(d, frame),
    { dark, metal, ink } = a;
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
  const white = inSet(layout, 'mini-r56 mini-r60 fiat');
  const wide = inSet(
    layout,
    'gm-wide gm-linked ford-wide f150 mustang triple-screen genesis hummer-ev hyundai-bridge kia-bridge lucid rivian ioniq byd alphard toyota-wide toyota-truck wrangler',
  );
  const portrait = inSet(layout, 'ram ford-portrait clio subaru');
  const radio =
    element ||
    inSet(
      layout,
      'retro-triple rugged-radio fiat gt solstice brz saab scion-center smart volvo hiace e-series economy worktruck fj',
    );
  const floating = inSet(layout, 'i3 ioniq rivian byd byd-wave casper wuling bendy-ev');
  const digital =
    centerOnly ||
    floating ||
    (wide && layout !== 'wrangler') ||
    inSet(layout, 'tt prius peugeot kei-high staria leaf volt corvette coach-digital supra');
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
    dark,
  );
  d.box([W * 0.81, centerOnly ? 0.055 : 0.072, 0.019], [0, y - 0.049, z + 0.006], trim);
  if (layout === 'byd-wave' || layout === 'i3') {
    for (let i = -3; i <= 3; i++) {
      const shelf = d.box(
        [W * 0.115, 0.028, 0.16],
        [i * W * 0.112, y - 0.11 + Math.abs(i) * 0.009, z + 0.025],
        trim,
      );
      shelf.rotation.z = -i * 0.022;
    }
  }
  // Glove box, latch, stitching and demister slots carry the passenger-side close view.
  d.box([W * 0.32, 0.16, 0.025], [-W * 0.245, y - 0.15, z + 0.025], dark);
  d.box([0.075, 0.012, 0.009], [-W * 0.245, y - 0.1, z + 0.008], metal);
  for (let i = -5; i <= 5; i++)
    d.box(
      [0.045, 0.003, 0.015],
      [i * W * 0.065, y + 0.067, dashZ + (frame.shallowDash ? -0.07 : 0.1)],
      metal,
    );
  d.rod([-W * 0.39, y - 0.012, z - 0.008], [W * 0.39, y - 0.012, z - 0.008], 0.0015, ink);
  if (centerOnly || inSet(layout, 'lucid rivian')) {
    a.vent(0, y + 0.018, z - 0.01, 'slot', W * 0.73);
  } else if (layout === 'honda-mesh') {
    // The reference grille is a fine, recessed band; it stops at the instrument binnacle.
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
    for (const x of [-W, W].map((v) => v * (layout === 'gt' ? 0.425 : 0.365)))
      a.vent(
        x,
        y + 0.018,
        z - 0.01,
        round
          ? 'round'
          : ssr || transit || inSet(layout, 'ram ford-portrait f150 bronco cts jaguar')
            ? 'vertical'
            : 'rect',
        ssr ? 0.065 : round ? 0.105 : 0.12,
      );
    if (layout === 'tt') {
      for (const x of [-0.16, 0, 0.16]) {
        a.vent(x, y + 0.07, z - 0.02, 'round', 0.12);
        a.knob(x, y + 0.07, z - 0.04, 0.018);
      }
    } else if (inSet(layout, 'mini-r56 mini-r60')) {
      for (const x of [-0.19, 0.19]) a.vent(x, y + 0.105, z - 0.025, 'round', 0.095);
    } else if (layout === 'gt') {
      // The GT's gauge bank spans the driver and center fascia; its third round vent
      // sits just beyond the large speedometer, not across the auxiliary instruments.
      a.vent(dx - 0.79, cy, z - 0.025, 'round', 0.105);
    } else if (layout === 'miata') {
      // The ND has one round center vent beside a narrow rectangular passenger vent.
      a.vent(0.11, y - 0.07, z - 0.025, 'round', 0.105);
      a.vent(-0.14, y - 0.07, z - 0.025, 'rect', 0.16);
    } else if (
      strada ||
      dmax ||
      transit ||
      ssr ||
      inSet(layout, 'acura-dual bronco cts fiat volt z34 luxury-clock')
    ) {
      for (const x of [-0.2, 0.2]) a.vent(x, y + 0.06, z - 0.025, 'vertical', 0.06);
    } else if (acuraTL) {
      for (const x of [-0.075, 0.075]) a.vent(x, y - 0.075, z - 0.025, 'rect', 0.105);
    } else if (!portrait) {
      for (const x of [-0.135, 0.135])
        a.vent(
          x,
          inSet(layout, 'jaguar jeep-luxury porsche hilux lincoln')
            ? y + 0.13
            : radio || layout === 'golf'
              ? y + 0.085
              : y - 0.07,
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
      for (const x of [-0.17, 0.17]) a.vent(x, y + 0.005, z - 0.025, 'vertical', 0.065);
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
  if (high) {
    // Raised kei/MPV and head-up clusters still need a physical pedestal above the cowl.
    const baseY = y + 0.045;
    const topY = cy - 0.02;
    if (topY > baseY)
      d.box(
        [layout === 'scion-center' ? 0.28 : 0.24, topY - baseY, 0.08],
        [layout === 'scion-center' ? 0 : dx, (baseY + topY) / 2, z + 0.045],
        dark,
      );
  }
  if (inSet(layout, 'mini-r56 mini-r60')) {
    // R56/R60 use a speedometer here; the F56 circular infotainment unit is a different generation.
    d.box([0.27, 0.25, 0.09], [0, y + 0.085, z + 0.04], dark);
    a.gauge(0, y + 0.11, z - 0.023, 0.112, ink, false);
    needle(0, y + 0.11, z - 0.04, 0.112);
    a.gauge(dx, cy, z - 0.005, 0.067, ink);
    a.display(0, y - 0.015, z - 0.03, 0.12, 0.033, 'radio');
    d.box([0.25, 0.21, 0.04], [0, y - 0.12, z + 0.028], trim);
    for (const x of [-0.075, 0, 0.075]) a.knob(x, y - 0.105, z - 0.035, 0.023);
    a.buttons(0, y - 0.055, z - 0.032, 5, 0.034);
    for (let i = -2; i <= 2; i++) {
      a.knob(i * 0.04, y - 0.18, z - 0.016, 0.008);
      d.rod([i * 0.04, y - 0.18, z - 0.024], [i * 0.04, y - 0.192, z - 0.045], 0.003, metal);
    }
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
  } else if (!centerOnly) {
    if (!floating)
      d.box([layout === 'porsche' ? 0.37 : 0.3, 0.11, 0.09], [dx, cy + 0.022, z + 0.045], dark);
    if (digital) {
      const dw = layout === 'lucid' ? 0.38 : layout === 'tt' ? 0.29 : high ? 0.22 : 0.27;
      a.display(
        dx,
        cy,
        z - 0.006,
        dw,
        high ? 0.078 : 0.115,
        'driver',
        layout === 'ioniq' ? ink : dark,
      );
      if (layout === 'leaf') a.display(dx, cy + 0.065, z + 0.07, 0.2, 0.04, 'driver');
      if (layout === 'supra') a.gauge(dx, cy, z - 0.016, 0.055, dark);
    } else {
      const count =
        kwid || inSet(layout, 'fiat smart')
          ? 1
          : layout === 'porsche'
            ? 5
            : element || acuraTL || inSet(layout, 'miata mazda brz retro-triple z34 saab fj')
              ? 3
              : 2;
      const radius = count === 1 ? 0.083 : count === 5 ? 0.041 : count === 3 ? 0.043 : 0.053;
      for (let i = 0; i < count; i++) {
        const gx = dx + (i - (count - 1) / 2) * (count === 5 ? 0.063 : 0.105);
        const gy = cy - Math.abs(i - (count - 1) / 2) * (count === 5 ? 0.014 : 0);
        a.gauge(
          gx,
          gy,
          z - 0.006,
          layout === 'fj' ? (i === 1 ? 0.062 : 0.043) : radius,
          white ? ink : dark,
          i !== 0,
        );
        if (i === 0) needle(gx, gy, z - 0.023, radius);
      }
      if (layout === 'fiat') d.ring(0.054, 0.002, [dx, cy, z - 0.016], metal);
      if (kwid) a.display(dx - 0.07, cy - 0.015, z - 0.022, 0.095, 0.045, 'driver');
      if (layout === 'solstice') a.gauge(dx, cy + 0.045, z - 0.008, 0.023);
    }
  }
  if (inSet(layout, 'z34 fj smart')) {
    const n = layout === 'smart' ? 2 : 3;
    const auxY = Math.min(eye[1] - 0.13, y + 0.18);
    for (let i = 0; i < n; i++) {
      const auxX = (i - (n - 1) / 2) * 0.1;
      d.add(new T.CylinderGeometry(0.043, 0.043, 0.055, 20).rotateX(Math.PI / 2), dark, [
        auxX,
        auxY,
        z + 0.08,
      ]);
      d.rod([auxX, y + 0.06, z + 0.08], [auxX, auxY - 0.025, z + 0.08], 0.012, dark);
      a.gauge(auxX, auxY, z + 0.05, 0.035);
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
  const embedded =
    radio ||
    inSet(
      layout,
      'alfa acura-old cts muscle luxury-clock corvette jeep-luxury lincoln golf polo hiace transit-van sprinter camper-van honda-van truck-tablet hilux bronco z34 leaf porsche jaguar staria',
    );
  if (embedded || strada) sy = y + 0.015;
  if (acuraTL) sy = y + 0.11;
  if (layout === 'z34') {
    sw = 0.25;
    sh = 0.125;
  }
  if (inSet(layout, 'mustang gm-linked gm-wide ford-wide hyundai-bridge kia-bridge ioniq')) sy = cy;
  if (radio) {
    sw = 0.19;
    sh = 0.05;
    sy = y - 0.03;
    if (layout === 'solstice') sy = y - 0.15;
  }
  // Screens, switches and vents belong to one molded center stack, not isolated boxes.
  if (
    !centerOnly &&
    !inSet(layout, 'tt mini-r56 mini-r60 ioniq i3 byd-wave casper wuling rivian')
  ) {
    const top =
      embedded || radio
        ? Math.max(
            y + (inSet(layout, 'jaguar jeep-luxury porsche hilux') ? 0.17 : 0.07),
            sy + sh / 2 + 0.018,
          )
        : y + 0.045;
    const bottom = y - 0.235;
    d.box(
      [Math.max(0.285, sw + 0.035), top - bottom, 0.035],
      [0, (top + bottom) / 2, z + 0.028],
      trim,
    );
  }
  if (inSet(layout, 'mini-r56 mini-r60 tt')) {
    // All infotainment is already accounted for above.
  } else if (portrait) {
    d.box([0.27, 0.34, 0.065], [0, y - 0.018, z + 0.025], trim);
    a.display(0, y - 0.005, z - 0.024, layout === 'ram' ? 0.22 : 0.185, 0.285);
  } else if (inSet(layout, 'acura-dual jaguar')) {
    d.box([0.32, 0.15, 0.08], [0, sy + 0.01, z + 0.035], dark);
    a.display(0, sy, z - 0.01, 0.28, 0.12);
    a.display(0, y - 0.09, z - 0.035, 0.235, 0.105, 'climate');
  } else {
    if (layout === 'volt') d.box([0.31, 0.33, 0.05], [0, y - 0.03, z + 0.01], ink);
    if (inSet(layout, 'mustang gm-linked gm-wide ford-wide hyundai-bridge kia-bridge ioniq')) {
      const left = Math.min(-sw / 2 - 0.018, dx - 0.15);
      const right = Math.max(sw / 2 + 0.018, dx + 0.15);
      d.box(
        [right - left, 0.165, 0.035],
        [(left + right) / 2, (cy + sy) / 2, z + 0.029],
        layout === 'ioniq' ? ink : dark,
      );
    }
    a.display(0, sy, z - 0.023, sw, sh, radio ? 'radio' : 'map', layout === 'ioniq' ? ink : dark);
    if (inSet(layout, 'lucid genesis coach-mixed'))
      a.display(0, y - 0.16, z - 0.09, 0.19, layout === 'lucid' ? 0.15 : 0.07, 'climate');
    if (layout === 'triple-screen') a.display(-W * 0.235, sy, z - 0.02, 0.3, 0.135, 'media');
    if (layout === 'coach-digital') a.display(-0.36, y - 0.04, z - 0.03, 0.22, 0.13, 'camera');
  }
  if (!centerOnly && !inSet(layout, 'tt mini-r56 mini-r60 lucid rivian')) {
    const ky = layout === 'solstice' ? y - 0.035 : portrait ? y - 0.18 : y - 0.15;
    const threeKnobs =
      element ||
      strada ||
      dmax ||
      kwid ||
      layout === 'scion-center' ||
      inSet(layout, 'solstice saab honda-suv honda-mesh miata brz wuling fj jimny golf clio');
    for (const kx of threeKnobs ? [-0.09, 0, 0.09] : [-0.09, 0.09])
      a.knob(kx, ky, z - 0.033, 0.018);
    if (!threeKnobs) a.buttons(0, ky, z - 0.035, 3, 0.024);
    if (inSet(layout, 'acura-old cts saab volvo')) {
      for (let i = 0; i < 3; i++)
        a.buttons(0, y - (acuraTL ? 0.11 : 0.07) - i * 0.025, z - 0.034, 4, 0.028);
    } else a.buttons(0, ky - 0.029, z - 0.02, inSet(layout, 'duster peugeot') ? 7 : 5);
  }
  if (layout === 'luxury-clock')
    a.gauge(0, Math.min(y + 0.18, eye[1] - 0.12), z + 0.01, 0.025, ink);
  if (inSet(layout, 'bronco defender jimny fj hummer-ev')) {
    d.rod([-W * 0.34, y - 0.14, z - 0.04], [-W * 0.16, y - 0.14, z - 0.04], 0.019, metal);
    for (const x of [-W * 0.34, -W * 0.16])
      d.rod([x, y - 0.14, z - 0.04], [x, y - 0.14, z + 0.04], 0.02, dark);
    a.buttons(-W * 0.25, y - 0.04, z - 0.022, 4);
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
  d.box([W * 0.84, firewallHeight, 0.04], [0, floorY + firewallHeight / 2, dashZ + 0.14], dark);
  // Overlap the firewall: even a small longitudinal gap exposes the front tires in a wide view.
  d.box([W * 0.84, 0.025, 1.32], [0, floorY, eye[2] + 0.08], dark);
  for (const side of [-1, 1])
    d.box(
      [0.025, firewallHeight, 1.3],
      [side * W * 0.418, floorY + firewallHeight / 2, eye[2] + 0.08],
      dark,
    );
  if (!open) {
    d.box([0.235, 0.15, 0.55], [0, tunnelY, eye[2]], dark);
    d.box([0.22, 0.017, 0.48], [0, tunnelY + 0.08, eye[2] + 0.01], trim);
    for (const cupZ of [eye[2] - 0.05, eye[2] + 0.085]) {
      d.add(new T.CircleGeometry(0.036, 16).rotateX(-Math.PI / 2), dark, [0, tunnelY + 0.09, cupZ]);
      d.ring(0.037, 0.003, [0, tunnelY + 0.091, cupZ], metal, 'y');
    }
    d.box([0.2, 0.05, 0.18], [0, tunnelY + 0.075, eye[2] - 0.23], trim);
  }
  const gz = p.selector === 'dash' ? z - 0.09 : eye[2] + 0.22;
  const gy = p.selector === 'dash' ? y - 0.2 : tunnelY + 0.12;
  if (p.selector === 'lever' || p.selector === 'dash') {
    d.box([0.09, 0.012, 0.11], [0, gy - 0.04, gz], dark);
    for (let i = 0; i < 3; i++)
      d.box([0.07 - i * 0.014, 0.015, 0.08 - i * 0.016], [0, gy - 0.025 + i * 0.013, gz], dark);
    d.rod([0, gy, gz], [0, gy + 0.065, gz - 0.015], 0.012, metal);
    d.box([0.052, 0.04, 0.047], [0, gy + 0.07, gz - 0.015], dark);
  } else if (p.selector === 'buttons') {
    for (let i = 0; i < 4; i++)
      d.box([0.043, 0.012, 0.027], [-0.04, gy - 0.025, gz + i * 0.038], i === 0 ? metal : dark);
  } else if (p.selector === 'rotary' || p.selector === 'puck') {
    if (layout === 'ram') a.knob(dx * 0.46, y - 0.13, z - 0.04, 0.031);
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
      d.rod(
        [x - side * 0.022, cardY - 0.16 + i * 0.014, eye[2] + 0.08],
        [x - side * 0.022, cardY - 0.16 + i * 0.014, eye[2] + 0.22],
        0.002,
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
  const flat = inSet(layout, 'peugeot tt golf corvette mustang');
  if (flat) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const angle = Math.PI * (-0.25 + (i * 1.5) / 30);
      pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
    }
    pts.push(pts[0]);
    wheel.path(pts, 0.013, dark);
  } else wheel.ring(radius, 0.013, [0, 0, 0], dark);
  const twoSpoke = inSet(layout, 'i3 ioniq skoda smart genesis');
  wheel.box([twoSpoke ? 0.13 : 0.095, 0.066, 0.05], [0, 0, 0], dark);
  for (const side of [-1, 1]) {
    wheel.rod([side * 0.035, 0, 0], [side * (radius - 0.02), -0.012, 0], 0.016, metal);
    wheel.box([0.038, 0.027, 0.012], [side * 0.092, -0.005, -0.015], dark);
    for (let i = 0; i < 2; i++)
      wheel.box([0.009, 0.002, 0.002], [side * 0.092, -0.011 + i * 0.012, -0.023], ink);
    if (layout !== 'tesla-highland')
      d.rod(
        [dx, eye[1] - 0.34, eye[2] + 0.36],
        [dx + side * 0.13, eye[1] - 0.31, eye[2] + 0.38],
        0.008,
        dark,
      );
  }
  if (!twoSpoke) wheel.rod([0, -0.03, 0], [0, -radius + 0.014, 0], 0.016, metal);
  if (layout === 'alfa')
    wheel.add(
      new T.CircleGeometry(0.012, 12).rotateY(Math.PI),
      frame.red ?? wheel.red,
      [0.052, -0.044, -0.028],
    );
  wheel.finish();
  d.rod(wheelRoot.position.toArray(), [dx, y - 0.08, dashZ], 0.027, dark);
  for (const px of [dx - 0.08, dx + 0.055]) {
    d.box([0.055, 0.013, 0.09], [px, floorY + 0.035, eye[2] + 0.4], dark);
    for (let i = -1; i <= 1; i++)
      d.box([0.04, 0.002, 0.003], [px, floorY + 0.043, eye[2] + 0.4 + i * 0.021], metal);
  }
  if (ownKit) d.finish();
}

/** The eight Bendy boats have purpose-specific stations rather than a car dashboard at sea. */
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
  const width = sail
    ? 0.38
    : small
      ? 0.94
      : fishing
        ? 1.24
        : tug
          ? 1.65
          : layout === 'passenger-ferry'
            ? 1.85
            : layout === 'car-ferry'
              ? 2.2
              : layout === 'container-ship'
                ? 2.65
                : 2.45;
  const console = material(
    'marine-console',
    small ? '#b4beb6' : sail ? '#a6a99d' : tug ? '#60716e' : fishing ? '#667567' : '#637376',
  );
  d.box([width, sail ? 0.5 : 0.25, 0.38], [x, sail ? y - 0.22 : y - 0.09, z], console);
  const floorY = s.helmFloor ?? s.freeboard;
  const plinthTop = y - (sail ? 0.47 : 0.215);
  if (plinthTop > floorY)
    d.box(
      [width * (sail ? 0.8 : 0.92), plinthTop - floorY, 0.3],
      [x, (plinthTop + floorY) / 2, z + 0.025],
      console,
    );
  const panelZ = z - 0.197;
  if (sail) {
    // Pedestal compass, small chartplotter and stainless grab loop.
    d.add(new T.SphereGeometry(0.067, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), d.dark, [
      x,
      y + 0.045,
      z,
    ]);
    for (const side of [-1, 1])
      d.rod([x + side * 0.21, y - 0.22, z], [x + side * 0.21, y + 0.23, z], 0.014, d.metal);
    d.rod([x - 0.21, y + 0.23, z], [x + 0.21, y + 0.23, z], 0.014, d.metal);
    a.display(x, y + 0.13, panelZ, 0.2, 0.105);
    a.gauge(x - 0.11, y - 0.07, panelZ, 0.035);
    a.gauge(x + 0.11, y - 0.07, panelZ, 0.035);
  } else if (small) {
    for (const gx of [-0.14, 0.14]) a.gauge(x + gx, y + 0.055, panelZ, 0.065);
    a.display(x - 0.32, y + 0.045, panelZ - 0.01, 0.15, 0.11);
    a.buttons(x, y - 0.07, panelZ - 0.015, 6, 0.041);
  } else {
    const count = layout === 'container-ship' ? 4 : layout === 'bulk-carrier' ? 3 : 2;
    const spacing = large ? (layout === 'container-ship' ? 0.48 : 0.53) : 0.35;
    for (let i = 0; i < count; i++) {
      const sx = x + (i - (count - 1) / 2) * spacing;
      a.display(
        sx,
        y + 0.055,
        panelZ - 0.02,
        large ? 0.43 : 0.27,
        large ? 0.25 : 0.19,
        i === 0 ? 'radar' : i === 1 ? 'map' : 'engine',
      );
      a.buttons(sx, y - 0.09, panelZ - 0.035, 5, 0.032);
      a.knob(sx - (large ? 0.19 : 0.1), y - 0.085, panelZ - 0.04);
    }
    const sideX = x - width * 0.41;
    a.gauge(sideX, y + 0.07, panelZ, 0.042);
    a.gauge(sideX, y - 0.04, panelZ, 0.035);
    // VHF face and hanging microphone, separate from chart/radar displays.
    a.display(x + width * 0.4, y + 0.11, panelZ, 0.12, 0.045, 'radio');
    a.knob(x + width * 0.4 - 0.045, y + 0.06, panelZ - 0.012, 0.009);
    d.box([0.035, 0.075, 0.022], [x + width * 0.4 + 0.1, y + 0.08, panelZ - 0.03], d.dark);
    for (let i = 0; i < 7; i++)
      d.ring(
        0.009,
        0.002,
        [x + width * 0.4 + 0.1, y - 0.005 - i * 0.011, panelZ - 0.03],
        d.dark,
        'y',
      );
    if (large) {
      d.box([0.47, 0.02, 0.55], [x - 0.98, y - 0.2, ez + 0.22], console);
      d.box([0.35, 0.002, 0.35], [x - 0.98, y - 0.188, ez + 0.22], d.ivory);
      for (let i = -2; i <= 2; i++)
        d.rod(
          [x - 1.13, y - 0.185, ez + 0.22 + i * 0.06],
          [x - 0.84, y - 0.185, ez + 0.22 + i * 0.06],
          0.0015,
          d.dark,
        );
    }
  }
  const controls = tug || large ? 2 : 1;
  // Throttle quadrants attach to the console through a return shelf.
  d.box(
    [sail ? 0.16 : width * 0.27, 0.055, 0.42],
    [x - (sail ? 0.26 : width * 0.35), y - 0.16, ez + 0.38],
    console,
  );
  for (let i = 0; i < controls; i++) {
    const tx = x - (sail ? 0.26 : width * 0.32) - i * 0.08;
    d.box([0.06, 0.09, 0.19], [tx, y - 0.1, ez + 0.23], d.dark);
    d.rod([tx, y - 0.06, ez + 0.24], [tx, y + 0.075, ez + 0.29], 0.009, d.metal);
    d.box([0.052, 0.035, 0.045], [tx, y + 0.08, ez + 0.29], tug ? d.amber : d.dark);
  }
  d.text(sail ? 'HELM' : tug ? 'THRUST' : 'BENDY', [x, y - 0.16, panelZ - 0.008], 0.022, Math.PI);
  if (!sail) {
    const seatBottom = ey - 0.71;
    if (seatBottom > floorY)
      d.add(new T.CylinderGeometry(0.045, 0.075, seatBottom - floorY, 12), d.metal, [
        x,
        (seatBottom + floorY) / 2,
        ez - 0.05,
      ]);
    d.box([0.54, 0.1, 0.48], [x, ey - 0.66, ez - 0.05], small ? d.ivory : console);
    d.box([0.54, 0.38, 0.08], [x, ey - 0.43, ez - 0.27], small ? d.ivory : console);
    for (const side of [-1, 1])
      d.rod(
        [x + side * 0.28, ey - 0.62, ez - 0.12],
        [x + side * 0.28, ey - 0.44, ez + 0.03],
        0.018,
        d.metal,
      );
  }
  d.rod([x, y - (sail ? 0.03 : 0), ez + 0.3], [x, y - (sail ? 0.03 : 0), z], 0.025, d.metal);
  d.finish();
  const wheel = new T.Group();
  wheel.name = 'helm-wheel';
  wheel.position.set(x, y - (sail ? 0.03 : 0), ez + 0.3);
  root.add(wheel);
  const c = makeKit(wheel, 'helm-wheel-trim'),
    radius = sail ? 0.3 : small ? 0.17 : large ? 0.16 : 0.21;
  c.ring(radius, sail ? 0.012 : 0.016, [0, 0, 0], sail ? c.metal : c.dark);
  const spokes = sail ? 6 : small ? 3 : tug ? 5 : 4;
  for (let i = 0; i < spokes; i++) {
    const angle = (i * Math.PI * 2) / spokes;
    c.rod([0, 0, 0], [Math.cos(angle) * radius, Math.sin(angle) * radius, 0], 0.009, c.metal);
  }
  c.add(new T.CylinderGeometry(0.035, 0.035, 0.03, 16).rotateX(Math.PI / 2), c.metal);
  c.finish();
}
