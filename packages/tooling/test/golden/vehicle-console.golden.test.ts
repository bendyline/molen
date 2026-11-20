import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';

// The vehicle console's touch mechanics in a real browser: an aircraft laid out as the P-51's
// cockpit (stick, one quadrant lever, a pair of pedals, the bolted-on module's gear plunger), its
// controls worked by two touches at once, a slide, a throw and a hold. Pixels are not compared:
// the parts' look is reviewed with the World Explorer's capture-vehicle-console.mjs.
const page = `
  import * as THREE from 'three';
  import { applyAircraftControl, createAircraftVisual } from '@bendyline/molen-client/aircraft';
  import { createVehicleConsole } from '@bendyline/molen-client/console';
  import { NavigationInputSource } from '@bendyline/molen-client/navigation';
  import types from '../../../../content/entities/source/aircraft/p-51/entity.types.json';

  const spec = Object.values(types.types)[0].components.aircraft.spec;
  const group = (name, at = [0, 0, 0], control) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(...at);
    if (control) node.userData.aircraftControl = control;
    return node;
  };
  const box = (name, size, at) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size, 2, 2, 2), new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.position.set(...at);
    return mesh;
  };
  const model = group('aircraft');
  const cockpit = group('cockpit');
  const stick = group('control-stick', [0, 1.39, 0.25]);
  stick.add(box('stick-shaft', [0.02, 0.32, 0.02], [0, 0.16, 0]));
  const quadrant = group('throttle-quadrant', [0.37, 1.72, 0.21]);
  const lever = group('engine-control-0', [0, 0.03, 0.09], {
    action: 'power',
    motion: { property: 'rotation', axis: 'x', scale: 0.65 },
  });
  lever.add(box('engine-lever-0', [0.01, 0.1, 0.01], [0, 0.05, 0]));
  quadrant.add(lever);
  cockpit.add(stick, quadrant);
  for (const side of [-1, 1]) {
    const pedal = group('rudder-control-' + side, [0, 0, 0], {
      action: 'yaw',
      motion: { property: 'position', axis: 'z', scale: -side * 0.035 },
    });
    pedal.add(box('rudder-pedal-' + side, [0.16, 0.12, 0.025], [side * 0.145, 1.42, 0.465]));
    cockpit.add(pedal);
  }
  const kit = group('flight-controls');
  const plunger = group('flight-gear-common', [-0.2, 1.47, 0.46], {
    action: 'gear',
    motion: { property: 'position', axis: 'y', scale: -0.025 },
  });
  plunger.add(box('flight-gear-common-moving', [0.03, 0.02, 0.03], [0, 0, -0.03]));
  kit.add(plunger);
  model.add(cockpit, kit);
  const visual = createAircraftVisual(model, spec);

  const canvas = document.querySelector('canvas');
  const input = new NavigationInputSource({ element: canvas, profile: 'pilot' });
  const air = {
    input: { power: 0.3, pitch: 0, roll: 0, yaw: 0, engine: true, gear: true, flaps: 0, brake: false },
    state: { grounded: false, engines: {}, velocity: [0, 0, 0], rpm: 1, rotorAngle: 0 },
  };
  const vehicleConsole = createVehicleConsole(document.querySelector('main'), {
    input: input.map,
    focusTarget: canvas,
  });
  vehicleConsole.setSubject({
    kind: 'aircraft',
    visual,
    spec,
    session: () => ({
      id: 'p51',
      cockpit: visual.cockpit,
      spec,
      input: air.input,
      state: air.state,
      change: (change) => {
        air.input = applyAircraftControl(air.input, change, spec, air.state);
      },
      release: () => {},
    }),
  });
  function frame(now) {
    const read = input.read(1 / 60);
    air.input = {
      ...air.input,
      pitch: -read.move.forward,
      roll: read.move.right,
      yaw: read.pilot?.yaw ?? 0,
      brake: read.jump,
    };
    visual.update(air.state, air.input, 600);
    vehicleConsole.update(now);
    canvas.dataset.input = JSON.stringify(air.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.consoleLayout = () => Object.fromEntries(vehicleConsole.layout?.rects ?? []);
`;

it('works an aircraft console with two touches at once, a slide, a throw and a hold', async () => {
  const bundle = await build({
    stdin: {
      contents: page,
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      loader: 'js',
    },
    bundle: true,
    write: false,
    format: 'esm',
    loader: { '.json': 'json' },
  });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 852, height: 393 },
      hasTouch: true,
      isMobile: true,
    });
    const tab = await context.newPage();
    const errors: string[] = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.setContent(`<!doctype html>
      <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="margin:0"><main style="position:relative;width:100vw;height:100vh">
        <canvas tabindex="0" aria-label="World view" style="display:block;width:100%;height:100%"></canvas>
      </main></body></html>`);
    await tab.addScriptTag({ type: 'module', content: bundle.outputFiles[0]?.text ?? '' });
    await tab.waitForFunction(() => document.querySelector('canvas')?.dataset.input);
    type Rect = { left: number; top: number; width: number; height: number };
    const rects = (await tab.evaluate('window.consoleLayout()')) as Record<string, Rect>;
    for (const id of ['stick', 'pedals', 'throttle', 'gear', 'brakes'])
      expect(rects[id], id).toBeDefined();
    // The touch stick's box is where the plain stick's always was.
    const stick = await tab.locator('.molen-touch-joystick').boundingBox();
    // 144 px and a 2 px border, 24 px in from the corner.
    expect(stick).toMatchObject({ x: 24, y: 393 - 24 - 148, width: 148, height: 148 });
    const read = async () =>
      JSON.parse((await tab.locator('canvas[tabindex]').getAttribute('data-input')) ?? '{}');
    const touch = await context.newCDPSession(tab);
    const send = (type: string, touchPoints: { x: number; y: number; id: number }[]) =>
      touch.send('Input.dispatchTouchEvent', { type, touchPoints });
    const center = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

    // Two thumbs: stick forward and throttle up at once.
    const s = { x: 24 + 72, y: 393 - 24 - 72 };
    const t = center(rects.throttle as Rect);
    await send('touchStart', [{ ...s, id: 1 }]);
    await send('touchStart', [
      { ...s, id: 1 },
      { ...t, id: 2 },
    ]);
    for (let step = 1; step <= 6; step++) {
      await send('touchMove', [
        { x: s.x, y: s.y - step * 8, id: 1 },
        { x: t.x, y: t.y - step * 10, id: 2 },
      ]);
    }
    await expect.poll(async () => (await read()).pitch).toBeLessThan(-0.3);
    expect((await read()).power).toBeGreaterThan(0.5);
    await send('touchEnd', []);
    await expect.poll(async () => (await read()).pitch).toBe(0);
    const power = (await read()).power;
    expect(power).toBeGreaterThan(0.5);

    // The rudder slides and centers.
    const p = center(rects.pedals as Rect);
    await send('touchStart', [{ ...p, id: 3 }]);
    await send('touchMove', [{ x: p.x + 40, y: p.y, id: 3 }]);
    await expect.poll(async () => (await read()).yaw).toBeGreaterThan(0.4);
    await send('touchEnd', []);
    await expect.poll(async () => (await read()).yaw).toBe(0);

    // The gear handle throws up past halfway; the brakes work while held.
    const g = center(rects.gear as Rect);
    await send('touchStart', [{ ...g, id: 4 }]);
    await send('touchMove', [{ x: g.x, y: g.y - 60, id: 4 }]);
    await send('touchEnd', []);
    await expect.poll(async () => (await read()).gear).toBe(false);
    const b = center(rects.brakes as Rect);
    await send('touchStart', [{ ...b, id: 5 }]);
    await expect.poll(async () => (await read()).brake).toBe(true);
    await send('touchEnd', []);
    await expect.poll(async () => (await read()).brake).toBe(false);
    expect((await read()).power).toBe(power);
    // The page never scrolled or zoomed under the touches.
    expect(await tab.evaluate(() => scrollY)).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
