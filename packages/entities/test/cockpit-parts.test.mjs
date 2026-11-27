import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';
import { cockpitBulkhead, lineSeatFrames } from '../scripts/aircraft/cockpit-fit.mjs';
import {
  controlStation,
  engineMasterGeometry,
  flapSelectorGeometry,
  gearHandleGeometry,
  handleGeometry,
  leverGate,
  leverGeometry,
  parkingBrakeGeometry,
  partPalette,
  pedalGeometry,
  stationMotion,
  stickGeometry,
  switchGeometry,
  yokeGeometry,
} from '../scripts/aircraft/cockpit-parts.mjs';
import { detailKit } from '../scripts/aircraft/mesh-kit.mjs';
import {
  carVent,
  steeringWheelGeometry,
  VENT_STYLES,
  WHEEL_STYLES,
} from '../scripts/cabin-parts.mjs';

/** Build one part into a fresh kit; return its triangle count and bounds. */
function build(draw) {
  const root = new Group();
  const kit = detailKit(root, 'part');
  draw(kit);
  kit.finish();
  root.updateMatrixWorld(true);
  let triangles = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const v of g.attributes.position.array) expect(Number.isFinite(v)).toBe(true);
  });
  return { triangles, box: new Box3().setFromObject(root) };
}

describe('cockpit parts library', () => {
  const families = [
    [
      'pedal',
      ['fighter', 'ga', 'airliner', 'heli', 'warbird'],
      (d, style) => pedalGeometry(d, { style }),
    ],
    [
      'grip',
      ['hornet', 'b8', 'f16', 'euro', 'soviet', 'cyclic', 'airbus', 'warbird'],
      (d, style) => stickGeometry(d, { style, height: 0.4 }),
    ],
    [
      'yoke',
      ['cessna', 'piper', 'beech', 'kingair', 'boeing', 'wheel'],
      (d, style) => yokeGeometry(d, { style }),
    ],
    [
      'lever',
      [
        'throttle',
        'throttle-t',
        'prop',
        'mixture',
        'condition',
        'thrust-boeing',
        'thrust-airbus',
        'power-turboprop',
        'start-lever',
        'hotas-left',
        'hotas-right',
        'hotas-euro',
        'hotas-f16',
        'mig',
        'collective',
      ],
      (d, style) => leverGeometry(d, { style }),
    ],
    ['gear', ['jet', 'ga', 'lever'], (d, style) => gearHandleGeometry(d, { style })],
    [
      'flaps',
      ['airfoil', 'lever', 'toggle', 'johnson'],
      (d, style) => flapSelectorGeometry(d, { style }),
    ],
    ['brake', ['tee', 'lever', 'rotary', 'loop'], (d, style) => parkingBrakeGeometry(d, { style })],
    [
      'engine',
      ['key', 'guarded', 'toggle', 'button', 'rotary', 'fuel-valve'],
      (d, style) => engineMasterGeometry(d, { style }),
    ],
    [
      'switch',
      [
        'toggle',
        'paddle',
        'guarded',
        'rocker',
        'korry',
        'pointer',
        'fluted',
        'chicken',
        'concentric',
      ],
      (d, style) => switchGeometry(d, { style }),
    ],
    ['handle', ['lever', 'slider', 'hook', 'canopy'], (d, style) => handleGeometry(d, { style })],
  ];
  for (const [family, styles, draw] of families)
    it.each(styles)(`${family} %s builds a bounded part of finite geometry`, (style) => {
      const { triangles, box } = build((d) => draw(d, style));
      expect(triangles).toBeGreaterThan(40); // the console lifts parts of 40 or more as real parts
      expect(triangles).toBeLessThan(8000);
      expect(box.getSize(new Vector3()).length()).toBeLessThan(1);
    });

  it('keeps switch-sized parts cheap', () => {
    for (const style of ['toggle', 'rocker', 'korry', 'pointer'])
      expect(build((d) => switchGeometry(d, { style })).triangles).toBeLessThan(900);
  });

  it('draws a station part at its pivot and moves it the documented way', () => {
    const model = new Group();
    const cabin = new Group();
    cabin.name = 'cockpit';
    model.add(cabin);
    const write = () => {};
    const pivot = controlStation(
      model,
      cabin,
      'cockpit-flaps-common',
      'flaps',
      {
        style: 'toggle',
        at: [0.3, 2, 6],
        rotation: [Math.PI / 2, 0, 0],
      },
      write,
    );
    model.updateMatrixWorld(true);
    // The part sits within a few centimetres of its station, not offset by it twice.
    const center = new Box3().setFromObject(pivot).getCenter(new Vector3());
    expect(center.distanceTo(new Vector3(0.3, 2, 6))).toBeLessThan(0.05);
    expect(pivot.parent.parent).toBe(cabin);
    expect(pivot.userData.aircraftControl).toMatchObject({ action: 'flaps' });
    // Gear down (1) puts a panel handle's knob below its pivot; up (0) above it.
    const gear = stationMotion('gear', 'jet');
    expect(gear.property).toBe('rotation');
    expect(Math.sin(gear.scale + (gear.offset ?? 0))).toBeLessThan(0);
    expect(Math.sin(gear.offset ?? 0)).toBeGreaterThan(0);
    // A switch is off (tipped down) at 0 and on (tipped up) at 1.
    const toggle = stationMotion('engine', 'guarded');
    expect(0.35 + (toggle.offset ?? 0)).toBeLessThan(0);
    expect(0.35 + toggle.scale + (toggle.offset ?? 0)).toBeGreaterThan(0);
  });

  it('faces a lever gate at the pilot, or up when it lies on a console', () => {
    for (const [upright, axis, sign] of [
      [false, 'z', -1],
      [true, 'y', 1],
    ]) {
      const root = new Group();
      const kit = detailKit(root, 'gate');
      leverGate(kit, { upright });
      kit.finish();
      root.updateMatrixWorld(true);
      const center = (name) => {
        const mesh = root
          .getObjectsByProperty('isMesh', true)
          .find((m) => m.material.name === name);
        return new Box3().setFromObject(mesh).getCenter(new Vector3())[axis];
      };
      // The slot stands proud of the plate on the side the pilot sees.
      expect(
        sign * (center('flight-control-black') - center('flight-control-panel')),
      ).toBeGreaterThan(0);
    }
  });

  it('shares one default palette, named for the cockpit finisher', () => {
    const a = partPalette(),
      b = partPalette();
    expect(a.grip).toBe(b.grip);
    expect(a.grip.name).toBe('flight-control-grip');
    expect(a.alloy.name).toBe('flight-control-alloy');
  });
});

describe('cockpit fit helpers', () => {
  // A tube of skin (radius 0.6, axis Z) around an eye at the origin.
  const skin = () => {
    const root = new Group();
    const shell = new Mesh(
      new CylinderGeometry(0.6, 0.6, 4, 32, 1, true).rotateX(Math.PI / 2),
      new MeshStandardMaterial({ side: DoubleSide }),
    );
    shell.name = 'shell';
    root.add(shell);
    return root;
  };
  it('closes the section inside the skin', () => {
    const root = skin();
    const kit = detailKit(root, 'cockpit');
    const outline = cockpitBulkhead(kit, root, {
      z: 0.5,
      yFrom: -0.5,
      yTo: 0.3,
      material: new MeshStandardMaterial(),
    });
    for (const [x, y, z] of outline) {
      expect(z).toBe(0.5);
      expect(Math.hypot(x, y)).toBeLessThan(0.6);
      expect(Math.hypot(x, y)).toBeGreaterThan(0.5);
    }
  });
  it('lines frames seen directly from the seat, not through glass', () => {
    const root = new Group();
    const bar = (name, z) => {
      const mesh = new Mesh(new BoxGeometry(0.4, 0.05, 0.05), new MeshStandardMaterial());
      mesh.name = name;
      mesh.position.set(0, 0.3, z);
      root.add(mesh);
    };
    bar('near-frame', 0.6);
    bar('far-nose', 1.3);
    // A frame behind the cockpit's own trim (a liner between it and the eye) stays as it is.
    const hidden = new Mesh(new BoxGeometry(0.4, 0.05, 0.05), new MeshStandardMaterial());
    hidden.name = 'hidden-frame';
    hidden.position.set(0, -0.5, 0.3);
    root.add(hidden);
    const cabin = new Group();
    cabin.name = 'cockpit';
    // Faced up into the cabin, as a liner is: a face seen from behind is culled and hides nothing.
    const liner = new Mesh(
      new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new MeshStandardMaterial(),
    );
    liner.position.set(0, -0.3, 0.3);
    cabin.add(liner);
    root.add(cabin);
    const glass = new Mesh(
      new PlaneGeometry(2, 2).rotateY(Math.PI),
      new MeshStandardMaterial({ transparent: true, opacity: 0.3 }),
    );
    glass.position.set(0, 0, 1);
    root.add(glass);
    lineSeatFrames(root, [new Vector3(0, 0, 0)], new MeshStandardMaterial(), {
      reach: 2,
      exclude: ['cockpit'],
    });
    const box = new Box3().setFromObject(root.getObjectByName('near-frame-lining'));
    expect(root.getObjectByName('far-nose-lining')).toBeUndefined();
    expect(root.getObjectByName('hidden-frame-lining')).toBeUndefined();
    expect(cabin.getObjectsByProperty('isMesh', true)).toHaveLength(1); // the cockpit is never lined
    // Only the near bar's faces toward the eye are lined; the bar behind the glass is not.
    expect(box.max.z).toBeLessThan(1);
    expect(box.min.z).toBeGreaterThan(0.5);
  });
});

describe('car cabin parts', () => {
  const palette = partPalette();
  const P = {
    dark: palette.panel,
    trim: palette.panel,
    metal: palette.alloy,
    ink: palette.legend,
    black: palette.black,
  };
  it.each(VENT_STYLES)('vent %s builds within its opening', (style) => {
    const { triangles, box } = build((d) => carVent(d, P, [0, 0, 0], { style, width: 0.12 }));
    const size = box.getSize(new Vector3());
    expect(triangles).toBeGreaterThan(20);
    expect(size.x).toBeLessThan(0.13);
    expect(box.min.z).toBeGreaterThan(-0.03); // protrudes no more than 3 cm toward the driver
  });
  it.each(WHEEL_STYLES)('steering wheel %s fits its radius', (style) => {
    const { box } = build((d) => steeringWheelGeometry(d, P, { style, radius: 0.16 }));
    const size = box.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(0.3);
    expect(size.x).toBeLessThan(0.4);
  });
});
