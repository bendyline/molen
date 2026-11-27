/**
 * OH-6A cabin: a small rounded panel on a center post, J-shaped cyclics from the center console,
 * collectives beside each seat, and tube seats hung on the canted station 78.50 bulkhead.
 * Authored in the station frame (STA, WL in inches), so the whole cabin takes the airframe's
 * attitude on its skids from one group.
 */
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  bar,
  contour,
  lathe,
  loftUp,
  pedalGeometry,
  place,
  pushPullGeometry,
  roundedBox,
  stickGeometry,
} from '../../../../../../packages/entities/scripts/aircraft/cockpit-parts.mjs';
import { finishCockpit } from '../../../../../../packages/entities/scripts/aircraft/cockpit-surfaces.mjs';
import { detailKit } from '../../../../../../packages/entities/scripts/aircraft/mesh-kit.mjs';
import { instrumentParts } from './instruments.mjs';

const IN = 0.0254;
/** A view of detail kit `d` whose additions land in a posed sub-group of its root. */
const posed = (d, at = [0, 0, 0], rotation = [0, 0, 0]) => {
  const holder = new T.Group();
  holder.position.fromArray(at);
  holder.rotation.set(...rotation);
  d.root.add(holder);
  return { ...d, add: (geometry, material, p = [0, 0, 0]) => d.add(geometry, material, p, holder) };
};
/** Station frame to the cockpit group's local metres; x is already metres. */
const P = (sta, wl, x = 0) => [x, wl * IN, (100 - sta) * IN];

export function addInterior(parent, layout, api) {
  const { group, box, rod, mesh, silver, dark, green, rubber, red, frame, wall } = api;
  const { gauge, plate, screw, text, placard, toggle } = instrumentParts(api);
  const cabin = group(parent, layout.root, frame.position);
  cabin.rotation.x = -frame.pitch;
  const gray = new T.MeshStandardMaterial({
    name: 'cabin-gray-enamel',
    color: '#4c514f',
    metalness: 0.15,
    roughness: 0.68,
  });
  const floorPaint = new T.MeshStandardMaterial({
    name: 'cabin-floor-paint',
    color: '#34382f',
    roughness: 0.85,
  });
  const fabric = new T.MeshStandardMaterial({
    name: 'seat-olive-fabric',
    color: '#4a513d',
    roughness: 0.97,
  });
  const webbing = new T.MeshStandardMaterial({
    name: 'harness-webbing',
    color: '#7d7a5e',
    roughness: 0.9,
  });
  // The cabin's inner skin, window frames and posts are black in the Hughes 500M cockpit
  // photograph, not the airframe's interior green. The airframe builds that lining (and the frame
  // reveals) as one `cabin-interior` mesh before the cabin is added; repaint it here.
  const lining = parent.getObjectByName('cabin-interior');
  if (lining)
    lining.material = new T.MeshStandardMaterial({
      name: 'cabin-lining-black',
      color: '#1c1f1e',
      metalness: 0.08,
      roughness: 0.6,
    });
  // The panel plate leans back a little on its post. Its children are in panel-local metres.
  const panel = group(cabin, 'instrument-cluster', P(...layout.panelStation));
  panel.rotation.x = layout.panelTilt;
  plate(panel, 'instrument-panel', layout.panelOutline, layout.panelZ, gray);
  for (const spec of layout.gauges) gauge(panel, spec);
  for (const [i, [x, y]] of layout.panelOutline.entries())
    screw(panel, `panel-fastener-${i}`, x * 0.94, y * 0.94, layout.panelZ - 0.0065);
  // The binnacle hood over the instruments (Hughes 500M cockpit photograph): a deep black box
  // shroud over the top edge, its sides running down the plate's upper flanks. It was a 10 cm lip
  // so the top row of dials stayed clear. Each pilot eye, 0.38 m to the side, looks across the hood
  // top almost edge-on, so an 18 cm top that still rises toward the eyes and steep cheeks hide no
  // dial from either seat (the near cheek covers only the plate's outer centimetre); a head raised
  // about 15 cm above the eye point starts to lose the top row's upper rims. Both windings, so it
  // reads from inside and outside.
  {
    const rim = [
        [-0.28, -0.05, 0],
        [-0.28, 0.05, 0.08],
        [-0.28, 0.125, 0.15],
        [-0.25, 0.155, 0.17],
        [0, 0.155, 0.18],
        [0.25, 0.155, 0.17],
        [0.28, 0.125, 0.15],
        [0.28, 0.05, 0.08],
        [0.28, -0.05, 0],
      ],
      lip = rim.map(([x, y, deep]) => [
        x * (1 + deep * 0.25),
        y + deep * 0.15,
        layout.panelZ - deep,
      ]),
      edge = rim.map(([x, y]) => [x * 1.012, y + (y > 0.14 ? 0.004 : 0), layout.panelZ]),
      positions = [],
      index = [];
    for (let i = 0; i < rim.length - 1; i++) {
      const base = positions.length / 3;
      positions.push(...edge[i], ...edge[i + 1], ...lip[i + 1], ...lip[i]);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      index.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const hood = new T.BufferGeometry();
    hood.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    hood.setIndex(index);
    mesh(panel, 'instrument-hood', hood.toNonIndexed(), dark).geometry.computeVertexNormals();
    const curve = new T.CatmullRomCurve3(lip.map((p) => new T.Vector3(...p)));
    mesh(panel, 'instrument-hood-lip', new T.TubeGeometry(curve, 18, 0.006, 6, false), dark);
  }
  // Annunciator block on the left of the plate, caution lamps and placards beneath it.
  box(panel, 'annunciator-block', [0.112, 0.082, 0.006], [0.2, 0.09, -0.008], dark);
  for (let i = 0; i < 5; i++) {
    box(panel, `annunciator-${i}`, [0.04, 0.012, 0.003], [0.2, 0.122 - i * 0.016, -0.012], rubber);
    text(
      panel,
      `annunciator-print-${i}`,
      ['GEN', 'OIL', 'FUEL', 'RPM', 'TEMP'][i],
      0.2,
      0.122 - i * 0.016,
      -0.0138,
      0.0009,
    );
  }
  box(panel, 'caution-panel', [0.13, 0.062, 0.006], [0.2, 0.012, -0.008], dark);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      box(
        panel,
        `caution-lamp-${i}-${j}`,
        [0.036, 0.014, 0.003],
        [0.245 - i * 0.045, 0.031 - j * 0.019, -0.012],
        i === 0 && j === 0 ? api.yellow : rubber,
      );
  placard(panel, 'rotor-limit-placard', 'ROTOR 400 RPM', [0.195, -0.06, -0.006], 0.13, 0.0012);
  box(panel, 'radio-face', [0.15, 0.062, 0.015], [0, -0.215, -0.01], dark);
  text(panel, 'radio-frequency', 'FM 34.50', 0, -0.205, -0.0185, 0.0018);
  for (const x of [-0.055, 0.055])
    mesh(
      panel,
      `radio-knob-${x}`,
      new T.CylinderGeometry(0.01, 0.01, 0.012, 16).rotateX(Math.PI / 2),
      rubber,
      [x, -0.228, -0.02],
    );
  for (let i = 0; i < 4; i++)
    toggle(panel, `pedestal-switch-${i}`, [0.054 - i * 0.036, -0.27, -0.006]);
  for (const x of [-0.067, 0.067])
    for (const y of [-0.192, -0.238]) screw(panel, `radio-mount-${x}-${y}`, x, y, -0.0185);
  box(panel, 'radio-microphone', [0.03, 0.058, 0.024], [-0.16, -0.098, -0.014], rubber);
  for (let i = 0; i < 4; i++)
    box(
      panel,
      `microphone-grille-${i}`,
      [0.022, 0.003, 0.002],
      [-0.16, -0.084 - i * 0.008, -0.027],
      silver,
    );
  for (let i = 0; i < 7; i++) {
    const ring = mesh(
      panel,
      `microphone-cord-${i}`,
      new T.TorusGeometry(0.008, 0.002, 4, 10),
      rubber,
      [-0.16, -0.135 - i * 0.011, -0.014],
    );
    ring.rotation.x = Math.PI / 2;
  }
  // The post, the pedestal foot and the console that carries the cyclics.
  const [post, foot] = [P(...layout.panelStation), P(54, 15)];
  rod(
    cabin,
    'panel-post',
    [0, post[1] - 0.18, post[2] + 0.04],
    [0, foot[1], foot[2]],
    0.05,
    gray,
    0.07,
  );
  box(cabin, 'pedestal-body', [0.2, 0.17, 0.3], P(55, 18.5), floorPaint);
  box(cabin, 'center-console', [0.2, 0.16, 0.56], P(70, 18), floorPaint);
  // The fuel shutoff valve control on the console (TM 55-1520-214-23: the electrical control
  // console carries the fuel shutoff valve control): a red T-handle, pushed in to open and pulled
  // up to shut the engine down. It is the engine master.
  const valveMount = group(cabin, 'fuel-valve-mount', [0, 18 * IN + 0.08, (100 - 70) * IN]);
  valveMount.rotation.x = Math.PI / 2;
  const valve = group(valveMount, 'fuel-valve');
  valve.userData.aircraftControl = {
    action: 'engine',
    motion: { property: 'position', axis: 'z', scale: 0.04, offset: -0.04 },
  };
  const valveKit = detailKit(valve, 'fuel-valve-handle');
  pushPullGeometry(valveKit, { kind: 'tee', reach: 0.022, palette: { grip: red } });
  valveKit.finish();
  placard(valveMount, 'fuel-valve-placard', 'FUEL VALVE', [0, -0.04, -0.0016], 0.07, 0.0011);
  for (let i = 0; i < 4; i++)
    toggle(cabin, `console-switch-${i}`, [0.075 - i * 0.05, 21.2 * IN, (100 - 63) * IN]);
  deck(cabin, 'floor', 14, 43.5, 122, floorPaint);
  for (const side of [-1, 1]) {
    // Seat bottoms sit on the seat structure and the backs hang from the canted bulkhead.
    const x = side * 0.38;
    const seat = group(cabin, `front-seat-${side}`);
    box(seat, 'seat-base', [0.44, 0.17, 0.5], [x, 17.6 * IN, (100 - 76) * IN], floorPaint);
    box(seat, 'seat-pan', [0.43, 0.022, 0.46], [x, 20.9 * IN, (100 - 76) * IN], gray);
    mesh(seat, 'seat-cushion', new RoundedBoxGeometry(0.4, 0.075, 0.44, 2, 0.018), fabric, [
      x,
      23 * IN,
      (100 - 76) * IN,
    ]);
    const lean = -0.31,
      backHeight = 0.62,
      back = mesh(
        seat,
        'seat-back',
        new RoundedBoxGeometry(0.38, backHeight, 0.06, 2, 0.014),
        fabric,
        [x, 38.5 * IN, (100 - 85) * IN],
      );
    back.rotation.x = lean;
    for (const dx of [-0.19, 0.19]) {
      rod(
        seat,
        `seat-back-frame-${dx}`,
        [x + dx, 25.5 * IN, (100 - 81.4) * IN],
        [x + dx, 51 * IN, (100 - 89.6) * IN],
        0.0115,
        silver,
      );
    }
    rod(
      seat,
      'seat-upper-rail',
      [x - 0.19, 51 * IN, (100 - 89.6) * IN],
      [x + 0.19, 51 * IN, (100 - 89.6) * IN],
      0.0115,
      silver,
    );
    for (const dx of [-0.095, 0.095]) {
      const strap = box(
        seat,
        `shoulder-harness-${dx}`,
        [0.036, 0.5, 0.008],
        [x + dx, 40 * IN, (100 - 83.9) * IN],
        webbing,
      );
      strap.rotation.x = lean;
      box(
        seat,
        `harness-adjuster-${dx}`,
        [0.045, 0.027, 0.012],
        [x + dx, 44 * IN, (100 - 84.6) * IN],
        silver,
      );
    }
    box(seat, 'lap-belt', [0.34, 0.024, 0.012], [x, 25.6 * IN, (100 - 79.5) * IN], webbing);
    box(seat, 'harness-buckle', [0.038, 0.032, 0.016], [x, 25.8 * IN, (100 - 79.3) * IN], silver);
    // J-shaped cyclic: out of the console, sweeping up and outward to the pilot's lap.
    const stick = group(cabin, side === -1 ? 'control-stick' : 'control-stick_1', [
      side * 0.085,
      22 * IN,
      (100 - 62) * IN,
    ]);
    const boot = new T.Mesh(
      lathe(
        [
          [0, -0.012],
          [0.045, -0.012],
          [0.043, 0.002],
          [0.032, 0.014],
          [0.018, 0.024],
          [0.013, 0.03],
          [0, 0.03],
        ],
        14,
        30,
      ),
      rubber,
    );
    boot.name = 'cyclic-boot';
    stick.add(boot);
    const curve = new T.CatmullRomCurve3(
      [
        [0, 0, 0],
        [side * 0.03, 0.1, -0.01],
        [side * 0.14, 0.2, -0.035],
        [side * 0.25, 0.26, -0.06],
        [side * 0.295, 0.33, -0.075],
      ].map((p) => new T.Vector3(...p)),
    );
    mesh(stick, 'cyclic-shaft', new T.TubeGeometry(curve, 16, 0.0125, 10, false), silver);
    // The molded cyclic grip: trim and radio switches on its cocked head, trigger in front.
    const gripKit = detailKit(stick, 'cyclic-grip');
    stickGeometry(posed(gripKit, [side * 0.295, 0.33, -0.075]), {
      style: 'cyclic',
      height: 0.012,
      boot: false,
      shaft: 0.0125,
    });
    gripKit.finish();
    const collective = group(cabin, side === -1 ? 'collective' : 'collective_1', [
      x + 0.235,
      24 * IN,
      (100 - 84) * IN,
    ]);
    // Collective: a tube from its hinge to the ribbed twist-grip throttle and the switch box on
    // the end (starter trigger, idle release, landing light).
    const lever = detailKit(collective, 'collective-lever');
    collectiveGeometry(posed(lever, [0, 0, 0], [Math.atan2(0.42, 0.15), 0, 0]), {
      dark,
      rubber,
      silver,
      red,
    });
    lever.finish();
    for (const dx of [-0.092, 0.092]) {
      // Green-painted paddle pedals on posts from the floor, as in the cockpit photographs.
      const pedal = group(cabin, `rudder-control-${side}-${dx}`);
      const pad = detailKit(pedal, `rudder-pedal-${side}-${dx}`);
      pedalGeometry(posed(pad, [x + dx, 21 * IN, (100 - 47) * IN]), {
        style: 'heli',
        side: Math.sign(dx),
        drop: 0.095,
        palette: { steel: green },
      });
      pad.finish();
      pedal.userData.aircraftControl = {
        action: 'yaw',
        // Right rudder pushes the right pedal (-X) forward.
        motion: { property: 'position', axis: 'z', scale: -Math.sign(dx) * 0.035 },
      };
    }
    rod(
      cabin,
      `door-inner-handle-${side}`,
      [side * (wall(78, 30) - 0.05), 30 * IN, (100 - 74) * IN],
      [side * (wall(78, 30) - 0.05), 30 * IN, (100 - 79.5) * IN],
      0.011,
      dark,
    );
    box(
      cabin,
      `door-map-pocket-${side}`,
      [0.03, 0.15, 0.2],
      [side * (wall(66, 21) - 0.06), 21 * IN, (100 - 66) * IN],
      rubber,
    );
  }
  // Fold-down troop seats on the station 124 bulkhead, and the bulkhead itself.
  box(cabin, 'aft-seat-bench', [0.98, 0.075, 0.38], P(109, 25.5), fabric);
  box(cabin, 'aft-seat-base', [1.02, 0.25, 0.5], P(110, 19), floorPaint);
  const aftBack = box(cabin, 'aft-seat-back', [0.98, 0.5, 0.06], P(118.2, 38), fabric);
  aftBack.rotation.x = -0.13;
  for (const x of [-0.26, 0.26])
    box(
      cabin,
      `aft-seat-belt-${x}`,
      [0.036, 0.42, 0.008],
      [x, 38.5 * IN, (100 - 117) * IN],
      webbing,
    );
  bulkhead(cabin, 'aft-bulkhead', 121.5, floorPaint);
  finishCockpit(cabin, (mesh) => {
    if (['instrument-panel', 'pedestal-body', 'center-console'].includes(mesh.name)) return 'panel';
    if (mesh.material === fabric) return 'canvas';
    if (mesh.material === webbing) return 'webbing';
    if (mesh.material === gray || mesh.material === floorPaint) return 'paint';
    if (/^(cyclic-boot|door-map-pocket-)/.test(mesh.name)) return 'vinyl';
  });

  /** The OH-6 collective along +Y from its hinge: tube, twist grip and end switch box. */
  function collectiveGeometry(d, m) {
    const parts = [
      [m.dark, place(roundedBox([0.04, 0.045, 0.05], 0.008), [0, 0.006, 0])],
      [m.dark, bar([0, 0.02, 0], [0, 0.4, 0], 0.0135, 12)],
      [
        m.silver,
        lathe(
          [
            [0.0135, 0],
            [0.018, 0.004],
            [0.018, 0.01],
            [0.015, 0.013],
          ],
          12,
        ).translate(0, 0.39, 0),
      ],
      [
        m.rubber,
        loftUp(
          [
            [0.403, 0.017],
            [0.413, 0.0205],
            [0.488, 0.0205],
            [0.5, 0.018],
          ].map(([y, r]) => ({ y, points: contour(0, 0, r, r, 12, 2) })),
        ),
      ],
      [m.dark, place(roundedBox([0.046, 0.04, 0.05], 0.008), [0, 0.52, -0.004], [-0.2, 0, 0])],
      [
        m.red,
        place(
          new T.CylinderGeometry(0.0055, 0.0055, 0.006, 12),
          [0.01, 0.535, -0.03],
          [Math.PI / 2 - 0.2, 0, 0],
        ),
      ],
      [m.silver, bar([-0.01, 0.53, -0.026], [-0.01, 0.537, -0.042], 0.0022, 8)],
      [m.rubber, place(roundedBox([0.012, 0.016, 0.01], 0.003), [0, 0.508, 0.028], [-0.2, 0, 0])],
    ];
    for (const y of [0.43, 0.455, 0.48])
      parts.push([
        m.dark,
        place(new T.TorusGeometry(0.0207, 0.0012, 3, 12), [0, y, 0], [Math.PI / 2, 0, 0]),
      ]);
    for (const [material, geometry] of parts) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      g.deleteAttribute('uv');
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      d.add(g, material);
    }
  }
  /** A flat deck following the shell at one waterline. */
  function deck(owner, name, wl, from, to, material) {
    const count = 14,
      stations = Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count),
      shape = new T.Shape();
    const left = stations.map((sta) => [wall(sta, wl) - 0.015, (100 - sta) * IN]),
      right = stations.map((sta) => [-(wall(sta, wl) - 0.015), (100 - sta) * IN]).reverse(),
      outline = [...left, ...right];
    shape.moveTo(...outline[0]);
    for (const [x, z] of outline.slice(1)) shape.lineTo(x, z);
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, steps: 1 });
    geometry.rotateX(Math.PI / 2);
    return mesh(owner, name, geometry, material, [0, wl * IN + 0.03, 0]);
  }
  /** A flat bulkhead closing the shell at one station. */
  function bulkhead(owner, name, sta, material) {
    const shape = new T.Shape(),
      top = 60,
      low = 4;
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const wl = low + ((top - low) * i) / steps,
        x = wall(sta, wl) - 0.012;
      if (i) shape.lineTo(x, wl * IN);
      else shape.moveTo(x, wl * IN);
    }
    for (let i = steps; i >= 0; i--) {
      const wl = low + ((top - low) * i) / steps;
      shape.lineTo(-(wall(sta, wl) - 0.012), wl * IN);
    }
    shape.closePath();
    const geometry = new T.ShapeGeometry(shape);
    const object = mesh(owner, name, geometry, material, [0, 0, (100 - sta) * IN]);
    object.material.side = T.DoubleSide;
    return object;
  }
}
