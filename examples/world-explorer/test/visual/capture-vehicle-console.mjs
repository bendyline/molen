// Capture and check the vehicle console (`@bendyline/molen-client/console`) on its fixture page,
// vehicle-console.html: a phone in landscape over a bright sky for a set of vehicles, the P-51
// also over snow and dusk and on a portrait phone and a tablet, at rest and in use. Real touches
// work its controls: two thumbs at once on the stick and the throttle, the rudder, the gear handle
// (refused on the ground), the flap notches and the engine switch. Reports the strip's share of
// the view and its main-thread cost. Writes PNGs and capture.json to .artifacts/vehicle-console.
// `CASES=phone:aircraft/p51d,...` narrows the run; `TAG` prefixes file names.
//
// Run in the engine repository after building the client package:
//   node examples/world-explorer/test/visual/capture-vehicle-console.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(resolve(root, 'packages/tooling/package.json'));
const { chromium } = require('playwright');
const out = resolve(root, '.artifacts/vehicle-console');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  logLevel: 'warn',
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
const SIZES = {
  phone: { width: 852, height: 393 },
  portrait: { width: 393, height: 852 },
  tablet: { width: 1180, height: 820 },
};
const DEFAULT_CASES = [
  'phone:aircraft/p51d',
  'phone:aircraft/p51d:bg=snow',
  'phone:aircraft/p51d:bg=dusk',
  'phone:aircraft/p51d:ground=1',
  'phone:aircraft/oh6',
  'phone:aircraft/cessna_172s',
  'phone:aircraft/f_16b',
  'phone:aircraft/baron_g58',
  'phone:vehicle/toyota_corolla_2025',
  'phone:cycle/standard_motorcycle',
  'phone:watercraft/speedboat',
  'phone:walk',
  'portrait:aircraft/p51d',
  'portrait:vehicle/toyota_corolla_2025',
  'tablet:aircraft/p51d',
  'tablet:aircraft/baron_g58',
];
const cases = (process.env.CASES?.split(',') ?? DEFAULT_CASES).map((entry) => {
  const [size, vehicle, query = ''] = entry.split(':');
  return { size, vehicle, query };
});
const tag = process.env.TAG ? `${process.env.TAG}-` : '';
const results = [];
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  const channel = process.env.MOLEN_TEST_BROWSER_CHANNEL;
  browser = await chromium.launch({
    headless: true,
    ...(channel ? { channel } : {}),
    args: channel ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const { size, vehicle, query } of cases) {
    const viewport = SIZES[size];
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: size !== 'tablet',
    });
    const page = await context.newPage();
    // A tablet-sized software-rendered frame is slow: screenshots get room to wait for one.
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const suffix = query ? `-${query.replace(/[=&]/g, '-')}` : '';
    const name = `${tag}${size}-${vehicle.replace('/', '-')}${suffix}`;
    await page.goto(
      `http://127.0.0.1:${port}/vehicle-console.html?vehicle=${vehicle}${query ? `&${query}` : ''}`,
    );
    await page.waitForFunction(() => window.consoleQA?.ready, undefined, { timeout: 180000 });
    // Let the parts' programs build, then settle.
    await page.waitForTimeout(500);
    await page.evaluate(() => window.consoleQA.run(1.5));
    const layout = await page.evaluate(() => window.consoleQA.layout());
    const result = { name, layout, errors, checks: {} };
    results.push(result);
    await page.screenshot({ path: resolve(out, `${name}-rest.png`) });
    if (layout) {
      const strip = {
        x: 0,
        y: viewport.height - layout.height,
        width: viewport.width,
        height: layout.height,
      };
      await page.screenshot({ path: resolve(out, `${name}-rest-strip.png`), clip: strip });
      result.coverage = await page.evaluate(() => window.consoleQA.coverage());
      checkLayout(result, layout, viewport, size);
    }
    await page.evaluate(() => window.consoleQA.release());
    const touch = await context.newCDPSession(page);
    if (vehicle.startsWith('aircraft/') && layout) {
      const shot = resolve(out, `${name}-in-use.png`);
      result.checks.thumbs = await twoThumbs(page, touch, layout, shot);
      if (layout.rects.pedals) result.checks.rudder = await rudder(page, touch, layout);
      if (layout.rects.gear) result.checks.gear = await gear(page, touch, layout);
      if (layout.rects.flaps) result.checks.flaps = await flaps(page, touch, layout);
      if (layout.rects.engine) result.checks.engine = await tap(page, touch, layout.rects.engine);
    } else if (layout?.rects.stick && !vehicle.startsWith('walk')) {
      result.checks.steer = await steer(page, touch, resolve(out, `${name}-in-use.png`));
    }
    if (size === 'phone' && vehicle === 'aircraft/p51d' && !query)
      result.timing = await page.evaluate(() => window.consoleQA.timing(120));
    await context.close();
  }
  await writeFile(resolve(out, `${tag}capture.json`), JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify(
      results.map(({ layout: _layout, ...rest }) => rest),
      null,
      2,
    ),
  );
  for (const result of results) {
    assert.deepEqual(result.errors, [], `errors in ${result.name}`);
    const { thumbs, rudder: yaw, gear: handle, flaps: notch, engine, steer: wheel } = result.checks;
    if (thumbs) {
      assert(thumbs.during.pitch < -0.3, `${result.name}: the stick pitched the nose down`);
      assert(
        thumbs.during.power > thumbs.before.power + 0.1,
        `${result.name}: the throttle opened`,
      );
      assert(Math.abs(thumbs.after.pitch) < 1e-9, `${result.name}: the stick centered`);
      assert(thumbs.after.power > thumbs.before.power + 0.1, `${result.name}: throttle kept`);
      assert(
        Math.abs(thumbs.later.power - thumbs.after.power) < 1e-9,
        `${result.name}: the throttle stayed where it was left`,
      );
    }
    if (yaw) {
      assert(yaw.during > 0.4, `${result.name}: sliding right on the pedals gave right rudder`);
      assert.equal(yaw.after, 0, `${result.name}: the pedals centered`);
    }
    if (handle) {
      const grounded = result.name.includes('ground');
      const expected = grounded ? handle.before : !handle.before;
      assert.equal(handle.after, expected, `${result.name}: gear`);
    }
    if (notch) assert.equal(notch.after, 0.5, `${result.name}: flaps settled on the half notch`);
    if (engine)
      assert.notEqual(engine.after.engine, engine.before.engine, `${result.name}: engine`);
    if (wheel) assert(Math.abs(wheel.during) > 0.2, `${result.name}: the wheel steered`);
    for (const problem of result.layoutProblems ?? []) assert.fail(`${result.name}: ${problem}`);
  }
} finally {
  await browser?.close();
  await server.close();
}

/** Every control at least 44 px, none overlapping, inside the view; the stick where it was. */
function checkLayout(result, layout, viewport, size) {
  const problems = [];
  const rects = Object.entries(layout.rects);
  for (const [id, r] of rects) {
    if (Math.min(r.width, r.height) < 44) problems.push(`${id} smaller than 44 px`);
    const outside =
      r.left < 0 ||
      r.top < 0 ||
      r.left + r.width > viewport.width + 0.5 ||
      r.top + r.height > viewport.height + 0.5;
    if (outside) problems.push(`${id} outside the view`);
  }
  for (const [i, [a, ra]] of rects.entries())
    for (const [b, rb] of rects.slice(i + 1))
      if (
        ra.left < rb.left + rb.width - 0.5 &&
        rb.left < ra.left + ra.width - 0.5 &&
        ra.top < rb.top + rb.height - 0.5 &&
        rb.top < ra.top + ra.height - 0.5
      )
        problems.push(`${a} overlaps ${b}`);
  if (size === 'phone' && (layout.stick.side !== 24 || layout.stick.bottom !== 24))
    problems.push(`stick box moved to ${layout.stick.side}/${layout.stick.bottom}`);
  result.layoutProblems = problems;
}

function center(r) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function end(touch) {
  return touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function drag(touch, points, frames, page) {
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: points.map((p, id) => ({ ...p.from, id })),
  });
  for (let step = 1; step <= frames; step++) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points.map((p, id) => ({
        x: p.from.x + ((p.to.x - p.from.x) * step) / frames,
        y: p.from.y + ((p.to.y - p.from.y) * step) / frames,
        id,
      })),
    });
    await page.waitForTimeout(25);
  }
}
function settle(page) {
  return page.waitForTimeout(400);
}
function input(page) {
  return page.evaluate(() => window.consoleQA.input());
}
function until(page, check) {
  return page.waitForFunction(check, undefined, { timeout: 5000 }).catch(() => {});
}

/** Push the stick forward with one thumb while opening the throttle with the other. */
async function twoThumbs(page, touch, layout, shot) {
  await page.evaluate(() => {
    window.consoleQA.pose({ power: 0.3, seconds: 0.2 });
    window.consoleQA.release();
  });
  const box = await page.locator('.molen-touch-joystick').boundingBox();
  const stick = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const lever = center(layout.rects.throttle);
  const before = await input(page);
  await drag(
    touch,
    [
      { from: stick, to: { x: stick.x + 24, y: stick.y - 48 } },
      { from: lever, to: { x: lever.x, y: lever.y - layout.rects.throttle.height * 0.35 } },
    ],
    8,
    page,
  );
  await settle(page);
  const during = await input(page);
  await page.screenshot({ path: shot });
  await end(touch);
  await until(page, () => window.consoleQA.input().pitch === 0);
  const after = await input(page);
  // Latched: still there a moment later (a slow page can still be applying the last moves
  // when `during` is read, so the comparison is with itself after the release).
  await settle(page);
  const later = await input(page);
  return { before, during, after, later };
}

async function rudder(page, touch, layout) {
  const r = layout.rects.pedals;
  const from = center(r);
  await drag(touch, [{ from, to: { x: from.x + r.width * 0.4, y: from.y } }], 6, page);
  await settle(page);
  const during = (await input(page)).yaw;
  await end(touch);
  await until(page, () => window.consoleQA.input().yaw === 0);
  return { during, after: (await input(page)).yaw };
}

/** Throw the gear handle the other way: past halfway, then let go. */
async function gear(page, touch, layout) {
  const r = layout.rects.gear;
  const before = (await input(page)).gear;
  const from = center(r);
  // Down is gear down: from up, drag down; from down, drag up.
  const dy = (before ? -1 : 1) * r.height * 0.5;
  await drag(touch, [{ from, to: { x: from.x, y: from.y + dy } }], 6, page);
  await end(touch);
  await settle(page);
  return { before, after: (await input(page)).gear };
}

/** Drag the flap lever a quarter of its way down: it settles on the half notch. */
async function flaps(page, touch, layout) {
  const r = layout.rects.flaps;
  const from = center(r);
  await drag(touch, [{ from, to: { x: from.x, y: from.y + r.height * 0.55 * 0.45 } }], 6, page);
  await end(touch);
  await settle(page);
  return { after: (await input(page)).flaps };
}

async function tap(page, touch, rect) {
  const before = await input(page);
  const at = center(rect);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...at, id: 0 }],
  });
  await end(touch);
  await settle(page);
  return { before, after: await input(page) };
}

/** Steer right with the stick and hold it there for a picture. */
async function steer(page, touch, shot) {
  const box = await page.locator('.molen-touch-joystick').boundingBox();
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await drag(touch, [{ from, to: { x: from.x + 50, y: from.y - 30 } }], 6, page);
  await settle(page);
  const during = (await input(page)).steer;
  await page.screenshot({ path: shot });
  await end(touch);
  return { during };
}
