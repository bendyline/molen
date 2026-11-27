import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createVehicleScreen,
  findCockpitMapDisplay,
  findVehicleCenterDisplay,
} from '../src/vehicle-screen';

const glass = new THREE.MeshStandardMaterial({ name: 'display-glass' });
const graphics = new THREE.MeshStandardMaterial({ name: 'display-graphics' });

/** A box the size `size`, centred at `at`, as the generators place a screen or a stroke. */
function box(size: [number, number, number], at: [number, number, number]): THREE.BufferGeometry {
  return new THREE.BoxGeometry(...size).translate(...at);
}

/**
 * A dashboard as the road generators draw it (`panelTools().display`): a 25 x 14.5 cm centre
 * screen 4 mm deep whose face looks toward -Z at z = 0.398, a printed route standing 6 mm proud
 * of it, and a driver's display off the centre line, the screens merged into one mesh. The whole
 * model sits under a moved, scaled parent, as a loaded GLB's root can.
 */
function dashboard(options: { center?: boolean; radio?: boolean } = {}): THREE.Group {
  const screens = [box([0.27, 0.115, 0.004], [0.37, 1.1, 0.42])];
  if (options.center !== false) screens.push(box([0.25, 0.145, 0.004], [0, 1, 0.4]));
  if (options.radio) screens.push(box([0.19, 0.05, 0.004], [0, 0.85, 0.4]));
  const model = new THREE.Group();
  const cabin = new THREE.Group();
  cabin.scale.setScalar(2);
  const merged = mergeGeometries(screens.map((g) => g.scale(0.5, 0.5, 0.5)));
  const display = new THREE.Mesh(merged, glass);
  display.name = 'cabin-display-glass';
  const strokes = new THREE.Mesh(
    mergeGeometries([
      box([0.14, 0.002, 0.001], [0.03, 1, 0.3975]),
      box([0.006, 0.08, 0.006], [-0.04, 1, 0.395]),
    ]).scale(0.5, 0.5, 0.5),
    graphics,
  );
  strokes.name = 'cabin-display-graphics';
  // Half-size geometry under a parent scaled by two: a quantized GLB's node scale.
  cabin.add(display, strokes);
  model.add(cabin);
  const world = new THREE.Group();
  world.position.set(100, 5, -20);
  world.rotation.y = 0.7;
  world.add(model);
  return model;
}

describe('findVehicleCenterDisplay', () => {
  it('finds the centre screen face toward the seats, and how far its strokes stand', () => {
    const found = findVehicleCenterDisplay(dashboard(), { eye: [0.4, 1.1, -0.05] });
    expect(found).toBeDefined();
    if (found === undefined) return;
    expect(found.width).toBeCloseTo(0.25, 4);
    expect(found.height).toBeCloseTo(0.145, 4);
    expect(found.center[0]).toBeCloseTo(0, 4);
    expect(found.center[1]).toBeCloseTo(1, 4);
    // The face nearer the seat (z 0.398), not the box's back (0.402).
    expect(found.center[2]).toBeCloseTo(0.398, 4);
    expect(found.normal[2]).toBeCloseTo(-1, 6);
    expect(found.up[1]).toBeCloseTo(1, 6);
    // The route's front is at z 0.392: 6 mm, plus 0.8 mm clearance.
    expect(found.relief).toBeCloseTo(0.0068, 4);
  });

  it('defaults to the seats behind the screen, toward -Z', () => {
    expect(findVehicleCenterDisplay(dashboard())?.normal[2]).toBeCloseTo(-1, 6);
    // A seat ahead of it reads the other face.
    const ahead = findVehicleCenterDisplay(dashboard(), { eye: [0, 1, 2] });
    expect(ahead?.normal[2]).toBeCloseTo(1, 6);
    expect(ahead?.center[2]).toBeCloseTo(0.402, 4);
  });

  it('finds none in a car with a radio and a driver display only', () => {
    expect(findVehicleCenterDisplay(dashboard({ center: false, radio: true }))).toBeUndefined();
  });

  it('takes the larger screen where a radio strip shares the centre line', () => {
    const found = findVehicleCenterDisplay(dashboard({ radio: true }));
    expect(found?.height).toBeCloseTo(0.145, 4);
  });

  it('ignores a screen it laid itself', () => {
    const model = dashboard();
    const first = findVehicleCenterDisplay(model);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.01), glass);
    slab.userData.vehicleScreen = true;
    model.add(slab);
    expect(findVehicleCenterDisplay(model)).toEqual(first);
  });
});

/** The pilot sits at the origin looking along +Z; the panel is 0.8 m ahead. */
const EYE: [number, number, number] = [0, 1.2, 0];
const PANEL = 0.8;

/** A named mesh: one screen's box of `material`, its face toward the pilot. */
function screen(
  name: string,
  material: string,
  size: [number, number],
  at: [number, number],
  parent: THREE.Object3D,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    box([size[0], size[1], 0.006], [at[0], at[1], PANEL]),
    new THREE.MeshStandardMaterial({ name: material }),
  );
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** A part a binding moves, standing `out` in front of the panel at `at`, `size` across. */
function part(name: string, size: [number, number], at: [number, number], parent: THREE.Object3D) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(at[0], at[1], PANEL - 0.01);
  node.add(new THREE.Mesh(box([size[0], size[1], 0.002], [0, 0, 0]), graphics));
  parent.add(node);
  return node;
}

/**
 * A glass cockpit: a PFD ahead of the pilot with a live horizon card, an MFD beside it with a
 * live engine strip down its outer edge and a heading rose over its middle, and a seat headrest
 * behind the pilot.
 */
function cockpit(): {
  model: THREE.Group;
  bindings: { node: string; source: string; property: string; axis?: string }[];
} {
  const model = new THREE.Group();
  const panel = new THREE.Group();
  panel.name = 'Test-PFD-panel';
  model.add(panel);
  screen('pfd', 'Test-instrument-black', [0.2, 0.16], [0.05, 1], panel);
  part('horizon-card', [0.12, 0.1], [0.05, 1], panel);
  screen('mfd', 'Test-instrument-black', [0.24, 0.16], [-0.25, 1], panel);
  // The engine strip on the MFD's outer (-X) edge: a tach needle turning about the face's axis.
  const tach = part('tach', [0.004, 0.025], [-0.345, 1.04], panel);
  tach.children[0]?.position.set(0, 0.012, 0);
  part('rose', [0.1, 0.1], [-0.22, 1], panel);
  const seat = new THREE.Mesh(
    box([0.26, 0.26, 0.02], [0, 1.1, -0.15]),
    new THREE.MeshStandardMaterial({ name: 'Test-instrument-black' }),
  );
  model.add(seat);
  return {
    model,
    bindings: [
      { node: 'horizon-card', source: 'roll', property: 'rotation', axis: 'z' },
      { node: 'horizon-card', source: 'pitch', property: 'position', axis: 'y' },
      { node: 'tach', source: 'propRpm', property: 'rotation', axis: 'z' },
      { node: 'rose', source: 'trueHeading', property: 'rotation', axis: 'z' },
      { node: 'rose', source: 'Test.rose.available', property: 'visible' },
    ],
  };
}

describe('findCockpitMapDisplay', () => {
  it('takes the MFD the live parts leave, cut clear of its engine strip, never the PFD', () => {
    const { model, bindings } = cockpit();
    const found = findCockpitMapDisplay(model, { eye: EYE, bindings });
    expect(found).toBeDefined();
    if (found === undefined) return;
    // The MFD (x -0.37 to -0.13) less the tach's sweep (pivot x -0.345, radius about 0.025).
    expect(found.center[0]).toBeLessThan(-0.2);
    expect(found.center[0] + found.width / 2).toBeCloseTo(-0.13, 3);
    expect(found.width).toBeGreaterThan(0.18);
    expect(found.width).toBeLessThan(0.21);
    expect(found.height).toBeCloseTo(0.16, 3);
    // The face toward the pilot, on the panel.
    expect(found.normal[2]).toBeCloseTo(-1, 6);
    expect(found.center[2]).toBeCloseTo(PANEL - 0.003, 4);
  });

  it('counts a part bound to anything but heading', () => {
    const { model, bindings } = cockpit();
    const blocked = bindings.map((b) => (b.node === 'rose' ? { ...b, source: 'groundSpeed' } : b));
    // With the rose live, the MFD keeps less than half: neither screen is a map.
    expect(findCockpitMapDisplay(model, { eye: EYE, bindings: blocked })).toBeUndefined();
  });

  it("takes a glass NAV page's own map area first", () => {
    const { model, bindings } = cockpit();
    const panel = model.children[0] as THREE.Object3D;
    screen('nav', 'avionics-terrain', [0.08, 0.06], [0.3, 1.1], panel);
    const found = findCockpitMapDisplay(model, { eye: EYE, bindings });
    expect(found?.width).toBeCloseTo(0.08, 4);
    expect(found?.center[0]).toBeCloseTo(0.3, 4);
  });

  it('finds none in a cockpit of round gauges, where a black sheet is panel backing', () => {
    const model = new THREE.Group();
    screen('backing', 'Test-instrument-black', [0.3, 0.2], [0, 1], model);
    expect(findCockpitMapDisplay(model, { eye: EYE })).toBeUndefined();
    // The same sheet is a screen in a glass cockpit.
    screen('PFD-frame', 'Test-panel', [0.05, 0.05], [0.4, 1.4], model);
    expect(findCockpitMapDisplay(model, { eye: EYE })?.width).toBeCloseTo(0.3, 4);
  });

  it('lays the slab square on a tilted screen', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const model = new THREE.Group();
    const stand = new THREE.Group();
    stand.name = 'Test-MFD-console';
    stand.position.set(0, 0.7, 0.6);
    stand.rotation.x = 0.5;
    model.add(stand);
    const mesh = new THREE.Mesh(
      box([0.2, 0.15, 0.006], [0, 0, 0]),
      new THREE.MeshStandardMaterial({ name: 'Test-screen' }),
    );
    stand.add(mesh);
    const found = findCockpitMapDisplay(model, { eye: EYE });
    if (found === undefined) throw new Error('no display');
    const normal = new THREE.Vector3(...found.normal);
    const expected = new THREE.Vector3(0, 0, -1).applyEuler(stand.rotation);
    expect(normal.dot(expected)).toBeCloseTo(1, 6);
    const slab = createVehicleScreen(model, found);
    if (slab === undefined) throw new Error('no slab');
    expect(slab.object.parent).toBe(stand);
    const out = new THREE.Vector3(0, 0, 1).applyQuaternion(
      slab.object.getWorldQuaternion(new THREE.Quaternion()),
    );
    expect(out.dot(expected)).toBeCloseTo(1, 6);
    slab.dispose();
    vi.unstubAllGlobals();
  });
});

/** Stand-in for a worker's OffscreenCanvas: only what a CanvasTexture and the tests touch. */
class FakeCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext(): object {
    return { canvas: this };
  }
}

describe('createVehicleScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is undefined where the platform has no 2D canvas', () => {
    const model = dashboard();
    const display = findVehicleCenterDisplay(model);
    expect(display && createVehicleScreen(model, display)).toBeUndefined();
    expect(model.getObjectByName('vehicle-screen')).toBeUndefined();
  });

  it('lays a slab on the face, deep enough to cover the strokes, and takes it off again', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const model = dashboard();
    const display = findVehicleCenterDisplay(model);
    if (display === undefined) throw new Error('no display');
    const screen = createVehicleScreen(model, display, { resolution: 256 });
    expect(screen).toBeDefined();
    if (screen === undefined) return;
    expect([screen.width, screen.height]).toEqual([256, Math.round((256 * 0.145) / 0.25)]);
    const slab = screen.object;
    // Beside the screen's mesh, in the scaled cabin group, so it moves and hides with it.
    expect(slab.parent).toBe(model.children[0]);
    expect(slab.castShadow).toBe(false);
    expect(slab.userData.walkIgnore).toBe(true);
    // Its back on the glass, its front the relief in front of it, the picture turned to the seat.
    const bounds = new THREE.Box3().setFromObject(slab);
    const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
    bounds.applyMatrix4(toModel);
    expect(bounds.max.z).toBeCloseTo(0.398, 4);
    expect(bounds.min.z).toBeCloseTo(0.398 - display.relief, 4);
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(slab.quaternion);
    expect(front.z).toBeCloseTo(-1, 6);
    // The canvas's right edge is the driver's right: model -X.
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(slab.quaternion);
    expect(right.x).toBeCloseTo(-1, 6);
    // Found again with the slab on, the face is the same: the slab is not a screen.
    expect(findVehicleCenterDisplay(model)).toEqual(display);
    screen.dispose();
    expect(slab.parent).toBeNull();
    screen.dispose();
  });
});
