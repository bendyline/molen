/** P-51D station: black asymmetric panel, K-14 sight, bucket seat and sidewall controls. */
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { finishCockpit } from '../../../../../../packages/entities/scripts/aircraft/cockpit-surfaces.mjs';
import { instrumentParts } from './instruments.mjs';

export function addInterior(parent, layout, api) {
  const { group, box, rod, sphere, mesh, silver, dark, green, rubber, yellow, red } = api;
  const { plate, gauge, screw, placard, toggle, grip, text } = instrumentParts(api);
  const cabin = group(parent, layout.root);
  plate(cabin, 'instrument-panel', layout.panelOutline, layout.panelZ);
  for (const instrument of layout.gauges) gauge(cabin, instrument);
  for (const [i, [x, y]] of layout.panelOutline.entries())
    screw(
      cabin,
      `panel-fastener-${i}`,
      x * 0.94,
      y > 2 ? y - 0.018 : y + 0.013,
      layout.panelZ - 0.007,
    );
  box(cabin, 'lower-switch-panel', [0.76, 0.11, 0.035], [0, 1.49, 0.805], dark);
  for (const [i, label] of ['BAT', 'GEN', 'LIGHT', 'FUEL', 'PITOT', 'GUN'].entries())
    toggle(cabin, `panel-switch-${i}`, [0.32 - i * 0.105, 1.49, 0.781], label);
  placard(cabin, 'landing-check', 'GEAR DOWN', [0.185, 1.735, 0.774], 0.13, 0.0011);
  const brake = group(cabin, 'parking-brake', [0.03, 1.56, 0.743]);
  brake.userData.aircraftControl = {
    action: 'brake',
    motion: { property: 'position', axis: 'z', scale: -0.025 },
  };
  rod(brake, 'brake-shaft', [0, 0, 0], [0, 0, -0.055], 0.007, silver);
  box(brake, 'brake-handle', [0.076, 0.018, 0.02], [0, 0, -0.06], yellow);
  for (const [i, color] of [green, red, yellow].entries())
    sphere(
      cabin,
      `gear-indicator-${i}`,
      [0.008, 0.008, 0.004],
      [0.25 + i * 0.035, 1.955, 0.772],
      color,
    );
  // Narrow flat crown and long sloping legs follow the reference's A-shaped support.
  const coaming = new T.CatmullRomCurve3(
    [
      [-0.435, 1.995, 0.79],
      [-0.385, 2.025, 0.8],
      [-0.24, 2.2, 0.84],
      [-0.14, 2.31, 0.86],
      [-0.08, 2.32, 0.86],
      [0.08, 2.32, 0.86],
      [0.14, 2.31, 0.86],
      [0.24, 2.2, 0.84],
      [0.385, 2.025, 0.8],
      [0.435, 1.995, 0.79],
    ].map((p) => new T.Vector3(...p)),
  );
  mesh(cabin, 'windscreen-support-frame', new T.TubeGeometry(coaming, 48, 0.018, 8, false), silver);
  addChecklist(cabin, api);
  const sight = group(cabin, 'k14-gunsight', [0, 2.19, 0.89]);
  box(sight, 'sight-mount', [0.09, 0.07, 0.11], [0, -0.085, 0.04], dark);
  const body = mesh(
    sight,
    'sight-optical-housing',
    new T.CylinderGeometry(0.079, 0.065, 0.11, 24),
    dark,
  );
  body.rotation.x = Math.PI / 2;
  box(sight, 'sight-range-dial', [0.155, 0.025, 0.032], [0, 0.036, -0.062], dark);
  text(sight, 'sight-range-scale', '100 200 400', 0, 0.038, -0.08, 0.0013);
  const reflector = box(
    sight,
    'canopy-gunsight-glass',
    [0.14, 0.083, 0.003],
    [0, 0.085, -0.035],
    api.glass,
  );
  reflector.rotation.x = -0.16;
  for (const side of [-1, 1])
    rod(
      sight,
      `sight-reflector-post-${side}`,
      [side * 0.072, 0.025, 0],
      [side * 0.072, 0.127, -0.042],
      0.004,
      dark,
    );

  // The wing crown reaches 1.38 m here; the cockpit floor sits above it.
  const floor = new T.BoxGeometry(1, 0.045, 1.79, 1, 1, 12);
  const floorVertices = floor.getAttribute('position');
  for (let i = 0; i < floorVertices.count; i++) {
    const width = api.cabinWidth(floorVertices.getY(i) + 1.36, floorVertices.getZ(i) + 0.145);
    floorVertices.setX(i, Math.sign(floorVertices.getX(i)) * (width - 0.006));
  }
  floor.computeVertexNormals();
  mesh(cabin, 'floor', floor, green, [0, 1.36, 0.145]);
  box(cabin, 'heel-trough', [0.37, 0.025, 0.7], [0, 1.3925, 0.42], rubber);
  addSidewalls(cabin, api);
  for (const side of [-1, 1]) {
    box(cabin, `side-console-${side}`, [0.09, 0.14, 0.9], [side * 0.397, 1.59, 0.09], green);
  }
  const throttle = group(cabin, 'throttle-quadrant', [0.37, 1.72, 0.21]);
  box(throttle, 'quadrant-case', [0.085, 0.115, 0.29], [0, 0, 0], dark);
  for (const [i, color] of [rubber, yellow, red].entries()) {
    const lever = group(throttle, `engine-control-${i}`, [-0.008, 0.03, 0.09 - i * 0.083]);
    lever.userData.aircraftControl = {
      action: ['power', 'propeller', 'mixture'][i],
      motion: { property: 'rotation', axis: 'x', scale: 0.65, offset: i === 0 ? 0 : -0.65 },
    };
    rod(lever, `engine-lever-${i}`, [0, 0, 0], [-0.017, 0.1, 0.04], 0.006, silver);
    sphere(lever, `engine-lever-knob-${i}`, [0.018, 0.024, 0.018], [-0.017, 0.115, 0.04], color);
  }
  placard(cabin, 'throttle-placard', 'THROTTLE PROP MIX', [0.32, 1.66, 0.37], 0.2, 0.0013);
  // Close-view quadrant gates and mounting hardware; the levers keep their existing pivots.
  for (let i = 0; i < 3; i++) {
    box(throttle, `quadrant-slot-${i}`, [0.045, 0.005, 0.055], [0, 0.06, 0.09 - i * 0.083], silver);
    box(
      throttle,
      `quadrant-slot-recess-${i}`,
      [0.007, 0.007, 0.049],
      [0, 0.063, 0.09 - i * 0.083],
      rubber,
    );
  }
  for (const side of [-1, 1]) {
    const lamp = group(cabin, `panel-lamp-${side}`, [side * 0.385, 2.07, 0.725]);
    rod(lamp, 'lamp-neck', [0, 0, 0], [-side * 0.035, 0.02, -0.02], 0.005, silver);
    box(lamp, 'lamp-shade', [0.032, 0.021, 0.035], [-side * 0.035, 0.02, -0.02], dark);
    for (const z of [-0.2, 0.11, 0.42]) {
      box(
        cabin,
        `rib-foot-bracket-${side}-${z}`,
        [0.035, 0.055, 0.035],
        [side * 0.419, 1.385, z],
        silver,
      );
      screw(cabin, `bracket-screw-${side}-${z}`, side * 0.419, 1.388, z - 0.02);
    }
  }
  box(cabin, 'radio-control-box', [0.09, 0.16, 0.29], [-0.373, 1.72, -0.04], dark);
  for (let i = 0; i < 4; i++)
    sphere(
      cabin,
      `radio-channel-${i}`,
      [0.012, 0.012, 0.012],
      [-0.322, 1.79 - i * 0.035, 0.065],
      rubber,
    );
  const selector = group(cabin, 'fuel-selector', [0, 1.49, 0.55]);
  const selectorPlate = mesh(
    selector,
    'selector-plate',
    new T.CylinderGeometry(0.075, 0.075, 0.01, 24),
    dark,
  );
  selectorPlate.rotation.x = Math.PI / 2;
  box(selector, 'selector-handle', [0.06, 0.013, 0.018], [0.02, 0, -0.02], red);
  text(selector, 'selector-label', 'L OFF R', 0, 0.05, -0.008, 0.0017);

  plate(
    cabin,
    'seat-bucket-back',
    [
      [-0.23, 1.49],
      [-0.23, 1.95],
      [-0.17, 2.1],
      [0.17, 2.1],
      [0.23, 1.95],
      [0.23, 1.49],
    ],
    -0.395,
    green,
    0.028,
  );
  box(cabin, 'seat-pan', [0.46, 0.05, 0.49], [0, 1.49, -0.15], green);
  mesh(
    cabin,
    'seat-cushion',
    new RoundedBoxGeometry(0.39, 0.1, 0.41, 2, 0.018),
    api.brown,
    [0, 1.56, -0.13],
  );
  mesh(
    cabin,
    'seat-back-pad',
    new RoundedBoxGeometry(0.36, 0.41, 0.06, 2, 0.012),
    api.brown,
    [0, 1.85, -0.353],
  );
  for (const x of [-0.14, 0.14])
    rod(cabin, `cushion-seam-${x}`, [x, 1.67, -0.319], [x, 2.02, -0.319], 0.0018, dark);
  for (const x of [-0.18, 0.18])
    box(cabin, `lap-belt-anchor-${x}`, [0.045, 0.033, 0.025], [x, 1.55, -0.31], silver);
  box(cabin, 'armor-plate', [0.39, 0.5, 0.04], [0, 2.12, -0.47], dark);
  mesh(
    cabin,
    'headrest',
    new T.CapsuleGeometry(0.07, 0.11, 4, 12).rotateZ(Math.PI / 2),
    rubber,
    [0, 2.335, -0.426],
  );
  for (const side of [-1, 1]) {
    const strap = box(
      cabin,
      `shoulder-harness-${side}`,
      [0.04, 0.54, 0.01],
      [side * 0.115, 1.86, -0.31],
      api.white,
    );
    strap.rotation.z = side * 0.13;
    box(cabin, `lap-belt-${side}`, [0.17, 0.025, 0.01], [side * 0.09, 1.61, -0.08], api.white);
  }
  box(cabin, 'harness-buckle', [0.04, 0.035, 0.015], [0, 1.62, -0.072], silver);
  const stick = group(cabin, 'control-stick', [0, 1.39, 0.25]);
  sphere(stick, 'stick-boot', [0.063, 0.075, 0.063], [0, 0, 0], rubber);
  rod(stick, 'stick-shaft', [0, 0, 0], [0, 0.32, -0.03], 0.016, silver);
  grip(stick, 'stick-grip', [0, 0.365, -0.045]);
  for (const side of [-1, 1]) {
    rod(
      cabin,
      `pedal-link-${side}`,
      [side * 0.145, 1.32, 0.58],
      [side * 0.145, 1.4, 0.7],
      0.009,
      silver,
    );
    const pedal = box(
      cabin,
      `rudder-pedal-${side}`,
      [0.16, 0.12, 0.025],
      [side * 0.145, 1.42, 0.715],
      silver,
    );
    pedal.rotation.x = -0.28;
    for (let i = 0; i < 5; i++)
      box(
        cabin,
        `pedal-tread-${side}-${i}`,
        [0.13, 0.008, 0.007],
        [side * 0.145, 1.38 + i * 0.021, 0.692],
        dark,
      );
  }
  for (const side of [-1, 1]) {
    const pedal = group(cabin, `rudder-control-${side}`);
    for (const name of [
      `pedal-link-${side}`,
      `rudder-pedal-${side}`,
      ...Array.from({ length: 5 }, (_, i) => `pedal-tread-${side}-${i}`),
    ])
      pedal.attach(cabin.getObjectByName(name));
    pedal.userData.aircraftControl = {
      action: 'yaw',
      motion: { property: 'position', axis: 'z', scale: side * 0.035 },
    };
  }
  for (const name of ['instrument-panel', 'lower-switch-panel']) {
    const panel = cabin.getObjectByName(name);
    panel.material = panel.material.clone();
    panel.material.color.set('#343a3b');
  }
  finishCockpit(cabin, (mesh) => {
    if (['instrument-panel', 'lower-switch-panel'].includes(mesh.name)) return 'panel';
    if (/^(shoulder-harness-|lap-belt-)/.test(mesh.name) && mesh.material === api.white)
      return 'webbing';
    if (['seat-cushion', 'seat-back-pad'].includes(mesh.name)) return 'canvas';
    if (['headrest', 'stick-boot'].includes(mesh.name)) return 'vinyl';
    if (
      ['floor', 'seat-pan', 'seat-bucket-back'].includes(mesh.name) ||
      mesh.name.startsWith('side-console-')
    )
      return 'paint';
  });
}

/** Two-column card and canopy-release warning transcribed from the supplied cockpit photo. */
function addChecklist(cabin, api) {
  const { group, box, rod, mesh, dark, silver } = api;
  const { text, screw } = instrumentParts(api);
  const header = new T.MeshStandardMaterial({
    name: 'checklist-red-header',
    color: '#a23b32',
    roughness: 0.8,
  });
  const paper = new T.MeshStandardMaterial({
    name: 'warning-cream-card',
    color: '#e2d7b5',
    roughness: 0.85,
  });
  const warningInk = new T.MeshStandardMaterial({
    name: 'warning-red-print',
    color: '#a22519',
    emissive: '#a22519',
    emissiveIntensity: 0.12,
    roughness: 0.8,
  });
  const card = group(cabin, 'takeoff-landing-checklist', [0, 2.2145, 0.735]);
  mesh(card, 'checklist-backing', new RoundedBoxGeometry(0.25, 0.125, 0.008, 1, 0.003), dark);
  box(card, 'checklist-divider', [0.002, 0.119, 0.002], [0, 0, -0.005], paper);
  const columns = [
    {
      x: 0.062,
      title: 'BEFORE TAKE OFF',
      rows: ['TRIM TABS', 'FUEL BOOST', 'HYD-PRESSURE', 'BATTERY & GENERATOR'],
    },
    { x: -0.062, title: 'BEFORE LANDING', rows: ['MIXTURE', 'FUEL BOOST', 'PROP', 'LANDING GEAR'] },
  ];
  for (const { x, title, rows } of columns) {
    box(card, `checklist-header-${title}`, [0.119, 0.022, 0.002], [x, 0.05, -0.005], header);
    text(card, `checklist-title-${title}`, title, x, 0.05, -0.007, 0.0018);
    for (const [i, value] of rows.entries())
      text(
        card,
        `checklist-${value}-${x}`,
        value,
        x,
        0.023 - i * 0.022,
        -0.006,
        value.length > 15 ? 0.0015 : 0.0018,
      );
    box(card, `checklist-clip-${x}`, [0.017, 0.022, 0.012], [x, -0.068, 0.005], silver);
    screw(card, `checklist-mount-${x}`, x, 0.068, 0.008, 0.003);
    rod(card, `checklist-support-${x}`, [x, 0.067, 0.008], [x, 0.105, 0.125], 0.003, silver);
  }
  box(card, 'checklist-top-clip', [0.14, 0.012, 0.02], [0, 0.068, 0.005], silver);
  const warning = group(cabin, 'canopy-release-warning', [0, 2.12, 0.755]);
  box(warning, 'warning-card', [0.165, 0.05, 0.003], [0, 0, 0], paper);
  text(warning, 'warning-title', 'WARNING', 0, 0.014, -0.003, 0.0028, warningInk);
  for (const [i, line] of [
    'BEFORE EMERGENCY RELEASE',
    'OF CANOPY IN FLIGHT DROP',
    'SEAT AND LOWER HEAD AS',
    'FAR AS POSSIBLE',
  ].entries())
    text(warning, `warning-line-${i}`, line, 0, 0.001 - i * 0.007, -0.003, 0.0014, warningInk);
}

/** Reference-informed sheet-metal lining and fittings, inside the existing fuselage envelope. */
function addSidewalls(cabin, api) {
  const { group, box, rod, mesh, cabinWidth, green, dark, rubber, silver, red } = api;
  const { plate, placard } = instrumentParts(api);
  const walls = group(cabin, 'cockpit-sidewalls');
  const enamel = green.clone();
  enamel.name = 'sidewall-interior-green';
  enamel.color.set('#7b8754');
  const point = (side, y, z, inset = 0.01) => [side * (cabinWidth(y, z) - inset), y, z];
  const stations = [-0.72, -0.42, -0.12, 0.18, 0.48, 0.78, 1.055];
  for (const side of [-1, 1]) {
    // Shallow curved panels leave the continuous inward-facing skin behind each seam.
    for (let bay = 0; bay < stations.length - 1; bay++) {
      const positions = [],
        indices = [];
      for (let row = 0; row <= 8; row++) {
        const y = 1.31 + (row / 8) * 0.737;
        for (const z of [stations[bay] + 0.003, stations[bay + 1] - 0.003])
          positions.push(...point(side, y, z));
      }
      for (let row = 0; row < 8; row++) {
        const a = row * 2;
        const faces = [a, a + 2, a + 3, a, a + 3, a + 1];
        for (let i = 0; i < faces.length; i += 3)
          indices.push(faces[i], faces[i + (side === 1 ? 2 : 1)], faces[i + (side === 1 ? 1 : 2)]);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      mesh(walls, `sidewall-panel-${side}-${bay}`, geometry, enamel);
    }
    // Formed vertical ribs and twin longitudinal canopy channels match the metal tub.
    for (const z of stations.slice(1, -1)) {
      const curve = new T.CatmullRomCurve3(
        [1.34, 1.57, 1.8, 2.035].map((y) => new T.Vector3(...point(side, y, z, 0.022))),
      );
      mesh(
        walls,
        `sidewall-rib-${side}-${z}`,
        new T.TubeGeometry(curve, 8, 0.009, 6, false),
        enamel,
      );
    }
    for (const y of [1.965, 2.045]) {
      const curve = new T.CatmullRomCurve3(
        stations.map((z) => new T.Vector3(...point(side, y, z, 0.024))),
      );
      mesh(
        walls,
        `canopy-inner-channel-${side}-${y}`,
        new T.TubeGeometry(curve, 20, 0.011, 6, false),
        enamel,
      );
      for (let i = 0; i < 14; i++) {
        const z = -0.67 + i * 0.125;
        const rivet = mesh(
          walls,
          `rail-rivet-${side}-${y}-${i}`,
          new T.CylinderGeometry(0.003, 0.003, 0.003, 6),
          silver,
          point(side, y, z, 0.035),
        );
        rivet.rotation.z = Math.PI / 2;
      }
    }
    const label = group(walls, `sidewall-instructions-${side}`, point(side, 1.9, 0.44, 0.018));
    label.rotation.y = (side * Math.PI) / 2;
    placard(
      label,
      'instructions',
      side === 1 ? 'FLAPS  TRIM' : 'OXYGEN  RADIO',
      [0, 0, 0],
      0.19,
      0.0016,
    );
    // The dark footboards and closing bulkhead prevent a view into the engine/wing cavities.
    box(walls, `footboard-${side}`, [0.24, 0.018, 1.1], [side * 0.21, 1.39, 0.14], rubber);
  }
  const bulkhead = [
    [-0.38, 1.28],
    [-0.43, 1.5],
    [-0.44, 1.75],
    [-0.4, 2.055],
    [0.4, 2.055],
    [0.44, 1.75],
    [0.43, 1.5],
    [0.38, 1.28],
  ];
  plate(walls, 'forward-footwell-bulkhead', bulkhead, 1.025, enamel, 0.018);
  // P-51-style trim wheels below the left throttle and equipment on the right sidewall.
  for (const [i, z] of [-0.15, 0.045].entries()) {
    const wheel = mesh(walls, `trim-wheel-${i}`, new T.TorusGeometry(0.06, 0.008, 6, 20), rubber, [
      0.332,
      1.53,
      z,
    ]);
    wheel.rotation.y = Math.PI / 2;
    rod(walls, `trim-hub-${i}`, [0.325, 1.53, z], [0.391, 1.53, z], 0.016, silver);
    for (let spoke = 0; spoke < 3; spoke++) {
      const angle = (spoke * Math.PI * 2) / 3;
      rod(
        walls,
        `trim-spoke-${i}-${spoke}`,
        [0.332, 1.53, z],
        [0.332, 1.53 + Math.cos(angle) * 0.055, z + Math.sin(angle) * 0.055],
        0.004,
        dark,
      );
    }
  }
  box(walls, 'right-electrical-box', [0.085, 0.1, 0.34], [-0.346, 1.57, -0.23], dark);
  for (let i = 0; i < 5; i++)
    mesh(
      walls,
      `electrical-button-${i}`,
      new T.CylinderGeometry(0.009, 0.009, 0.014, 8),
      i === 0 ? red : rubber,
      [-0.343, 1.628, -0.36 + i * 0.065],
    );
  const hose = new T.CatmullRomCurve3(
    [
      [-0.3, 1.37, -0.2],
      [-0.32, 1.41, 0.02],
      [-0.335, 1.57, 0.3],
      [-0.355, 1.81, 0.55],
    ].map((p) => new T.Vector3(...p)),
  );
  mesh(walls, 'oxygen-hose', new T.TubeGeometry(hose, 24, 0.014, 8, false), green);
  for (let i = 0; i < 28; i++) {
    const t = i / 27;
    const collar = mesh(
      walls,
      `hose-corrugation-${i}`,
      new T.TorusGeometry(0.014, 0.0025, 4, 8),
      rubber,
      hose.getPoint(t).toArray(),
    );
    collar.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), hose.getTangent(t).normalize());
  }
  finishCockpit(walls, (part) => (part.material === enamel ? 'paint' : undefined));
  // These fittings are static: retain only one draw per material, with controls outside this group.
  walls.updateMatrixWorld(true);
  const inverse = walls.matrixWorld.clone().invert(),
    batches = new Map();
  walls.traverse((part) => {
    if (!part.isMesh) return;
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, part.matrixWorld));
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(geometry);
  });
  walls.clear();
  for (const [material, geometries] of batches)
    mesh(walls, `sidewall-${material.name}`, mergeGeometries(geometries), material);
}
