import { createReadStream } from 'node:fs';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import { startCaptureResources } from '../capture-server';

const safeFrameName = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
// Kept as a tuple, unlike the core formats, which use array().length(n) so the emitted JSON
// Schema carries minItems/maxItems (see the note on rngStateSchema in @bendyline/molen-schema).
// Here the arity check in the type annotations below is worth more: this file hand-writes
// ExperiencePlayAction as an eleven-member union, and the annotations are what keep it and the
// Zod schema from drifting apart. Zod still enforces the arity; only the derived JSON Schema in
// the docs is loose about it, which is why the field descriptions state it outright.
const coordinate = z
  .tuple([z.number().min(0).max(1), z.number().min(0).max(1)])
  .describe('Fractional point inside the target element: exactly two numbers, [x, y], each 0-1.');
const baseAction = { note: z.string().optional() };

interface ExperiencePlayActionBase {
  note?: string;
}

export type ExperiencePlayAction = ExperiencePlayActionBase &
  (
    | { type: 'wait'; durationMs: number }
    | { type: 'wait-for'; selector: string; text?: string; timeoutMs?: number }
    | {
        type: 'wait-for-stable';
        selector: string;
        text?: string;
        stableMs?: number;
        timeoutMs?: number;
      }
    | { type: 'keys'; keys: string[]; durationMs: number }
    | { type: 'key-down'; keys: string[] }
    | { type: 'key-up'; keys: string[] }
    | {
        type: 'drag';
        selector: string;
        from: [number, number];
        to: [number, number];
        durationMs?: number;
        steps?: number;
      }
    | { type: 'click'; selector: string }
    | { type: 'select'; selector: string; value: string }
    | { type: 'navigate'; path: string }
    | {
        type: 'screenshot';
        name: string;
        settleMs?: number;
        fullPage?: boolean;
        timeoutMs?: number;
      }
  );

export interface ExperiencePlayScenario {
  format: 'molen/experience-play@1';
  name: string;
  path?: string;
  viewport?: [number, number];
  probes?: { name: string; selector: string }[];
  actions: ExperiencePlayAction[];
}

const actionSchema: z.ZodType<ExperiencePlayAction> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('wait'), durationMs: z.number().int().nonnegative(), ...baseAction }),
  z.object({
    type: z.literal('wait-for'),
    selector: z.string().min(1),
    text: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    ...baseAction,
  }),
  z.object({
    type: z.literal('wait-for-stable'),
    selector: z.string().min(1),
    text: z.string().optional(),
    stableMs: z.number().int().positive().optional(),
    timeoutMs: z.number().int().positive().optional(),
    ...baseAction,
  }),
  z.object({
    type: z.literal('keys'),
    keys: z.array(z.string().min(1)).min(1),
    durationMs: z.number().int().positive(),
    ...baseAction,
  }),
  z.object({
    type: z.literal('key-down'),
    keys: z.array(z.string().min(1)).min(1),
    ...baseAction,
  }),
  z.object({
    type: z.literal('key-up'),
    keys: z.array(z.string().min(1)).min(1),
    ...baseAction,
  }),
  z.object({
    type: z.literal('drag'),
    selector: z.string().min(1),
    from: coordinate,
    to: coordinate,
    durationMs: z.number().int().positive().optional(),
    steps: z.number().int().positive().optional(),
    ...baseAction,
  }),
  z.object({ type: z.literal('click'), selector: z.string().min(1), ...baseAction }),
  z.object({
    type: z.literal('select'),
    selector: z.string().min(1),
    value: z.string(),
    ...baseAction,
  }),
  z.object({ type: z.literal('navigate'), path: z.string().min(1), ...baseAction }),
  z.object({
    type: z.literal('screenshot'),
    name: z.string().regex(safeFrameName),
    settleMs: z.number().int().nonnegative().optional(),
    fullPage: z.boolean().optional(),
    // A capture waits for a fresh composited frame; under the software rasterizer one frame of a
    // dense scene can take many seconds, so heavy scenarios raise this above the default.
    timeoutMs: z.number().int().positive().optional(),
    ...baseAction,
  }),
]);

const scenarioSchema: z.ZodType<ExperiencePlayScenario> = z.object({
  format: z.literal('molen/experience-play@1'),
  name: z.string().min(1).describe('Scenario name; used to label the run and its output folder.'),
  path: z
    .string()
    .optional()
    .describe("Page to open inside the built app, including any query string (default '/')."),
  viewport: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .optional()
    .describe('Browser viewport in CSS pixels: exactly two positive integers, [width, height].'),
  probes: z
    .array(
      z.object({
        name: z.string().min(1).describe('Probe name; the key its text appears under per frame.'),
        selector: z
          .string()
          .min(1)
          .describe('CSS selector whose text is captured with every screenshot.'),
      }),
    )
    .optional()
    .describe('Page values to read alongside each frame — a HUD line, a status element.'),
  actions: z
    .array(actionSchema)
    .describe(
      'What to do, in order: wait, wait-for, wait-for-stable, keys, key-down, key-up, drag, ' +
        'click, select, navigate, screenshot. Each screenshot yields one frame plus its probes.',
    ),
});

let registered = false;
/** Register the play-scenario schema into the shared registry (idempotent). */
export function registerExperiencePlaySchema(): void {
  if (registered) return;
  registered = true;
  registerSchema('experience-play', scenarioSchema, {
    id: 'molen/experience-play@1',
    title: 'Experience play scenario',
    description:
      'A scripted browser session over a built app: real keyboard and pointer input in, ' +
      'screenshots and probed page text out. Run it with `molen play`.',
    examples: [
      {
        format: 'molen/experience-play@1',
        name: 'walk-to-the-gate',
        path: '/?synthetic=1',
        viewport: [960, 540],
        probes: [{ name: 'status', selector: '#status' }],
        actions: [
          { type: 'wait-for', selector: '#status', text: 'ready', timeoutMs: 60000 },
          { type: 'screenshot', name: '01-start' },
          { type: 'keys', keys: ['w'], durationMs: 1500 },
          { type: 'screenshot', name: '02-moved' },
        ],
      },
    ],
    docsRef: 'guide/experience-playback.md',
  });
}

export interface ExperiencePlayInput {
  /** Built browser-app directory containing index.html and its static assets. */
  appDir: string;
  scenario: ExperiencePlayScenario | Record<string, unknown>;
  outDir: string;
  headed?: boolean;
}

export interface ExperiencePlayDiagnostic {
  kind: 'console' | 'page-error' | 'request-failed';
  level?: string;
  text: string;
  url?: string;
  actionIndex: number;
}

export interface ExperiencePlayFrame {
  name: string;
  path: string;
  actionIndex: number;
  probes: Record<string, string>;
}

export interface ExperiencePlayOutput {
  ok: boolean;
  scenario?: string;
  manifestPath?: string;
  frames?: ExperiencePlayFrame[];
  diagnostics?: ExperiencePlayDiagnostic[];
  error?: string;
}

export interface ExperienceServer {
  url: string;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
};

function pathWithin(root: string, candidate: string): boolean {
  const cleanRoot = normalize(root).replace(/[\\/]+$/, '');
  const cleanCandidate = normalize(candidate);
  return cleanCandidate === cleanRoot || cleanCandidate.startsWith(`${cleanRoot}${sep}`);
}

function parseRange(value: string | undefined, size: number): [number, number] | undefined | null {
  if (value === undefined) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (match === null || (match[1] === '' && match[2] === '')) return null;
  const startText = match[1] as string;
  const endText = match[2] as string;
  let start: number;
  let end: number;
  if (startText === '') {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === '' ? size - 1 : Number(endText);
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return null;
  }
  return [start, Math.min(end, size - 1)];
}

/**
 * Resolve the app directory, failing with an actionable message *before* anything expensive
 * starts. `molen play nope-dir` used to surface this as a raw ENOENT from inside `Promise.all`.
 */
async function resolveAppDir(appDir: string): Promise<string> {
  const root = resolve(appDir);
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(root);
  } catch {
    throw new Error(
      `app directory not found: ${root} — molen play needs a built browser app directory (the one containing index.html)`,
    );
  }
  if (!info.isDirectory()) throw new Error(`app path is not a directory: ${root}`);
  return root;
}

/**
 * Acquire the two play resources as one transaction. The app directory is validated first, so a
 * typo never launches Chromium at all; acquisition then goes through `startCaptureResources`,
 * which settles BOTH promises before rethrowing and closes whichever one succeeded. A bare
 * `Promise.all` rejects before the browser handle is assigned, orphaning a live Chromium that
 * keeps the process alive — every failed `play_experience` over MCP leaked one.
 */
export async function startPlayResources<TBrowser extends { close(): Promise<void> }>(
  appDir: string,
  launchBrowser: () => Promise<TBrowser>,
  startServer: (appDir: string) => Promise<ExperienceServer> = startExperienceServer,
): Promise<{ browser: TBrowser; server: ExperienceServer }> {
  const root = await resolveAppDir(appDir);
  return startCaptureResources(launchBrowser, root, undefined, (dir) => startServer(dir));
}

/** Host a built browser experience on an ephemeral localhost port, including PMTiles ranges. */
export async function startExperienceServer(appDir: string): Promise<ExperienceServer> {
  const root = await realpath(resolve(appDir));
  const server: Server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const decoded = decodeURIComponent(url.pathname);
        const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
        let candidate = resolve(root, relativePath);
        if (!pathWithin(root, candidate)) throw new Error('path escapes app root');
        try {
          candidate = await realpath(candidate);
        } catch {
          if (extname(relativePath) !== '') throw new Error('static asset not found');
          candidate = await realpath(join(root, 'index.html'));
        }
        if (!pathWithin(root, candidate)) throw new Error('symlink escapes app root');
        const info = await stat(candidate);
        if (!info.isFile()) throw new Error('not a file');

        const range = parseRange(
          typeof request.headers.range === 'string' ? request.headers.range : undefined,
          info.size,
        );
        if (range === null) {
          response.writeHead(416, { 'content-range': `bytes */${info.size}` }).end();
          return;
        }
        const [start, end] = range ?? [0, info.size - 1];
        response.writeHead(range === undefined ? 200 : 206, {
          'accept-ranges': 'bytes',
          'cache-control': 'no-store',
          'content-length': end - start + 1,
          'content-type': MIME[extname(candidate).toLowerCase()] ?? 'application/octet-stream',
          ...(range === undefined ? {} : { 'content-range': `bytes ${start}-${end}/${info.size}` }),
        });
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        const stream = createReadStream(candidate, { start, end });
        stream.on('error', () => response.destroy());
        stream.pipe(response);
      } catch {
        response.writeHead(404).end('not found');
      }
    })();
  });
  try {
    await new Promise<void>((resolveListen, reject) => {
      const onError = (error: Error): void => reject(error);
      server.once('error', onError);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolveListen();
      });
    });
  } catch (error) {
    server.close();
    throw error;
  }
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()));
      }),
  };
}

export function parseExperiencePlayScenario(
  value: ExperiencePlayScenario | Record<string, unknown>,
): ExperiencePlayScenario {
  const parsed = scenarioSchema.safeParse(value);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  const names = new Set<string>();
  for (const action of parsed.data.actions) {
    if (action.type !== 'screenshot') continue;
    if (names.has(action.name)) throw new Error(`duplicate screenshot name "${action.name}"`);
    names.add(action.name);
  }
  return parsed.data;
}

async function waitForStableText(
  page: import('playwright').Page,
  action: Extract<ExperiencePlayAction, { type: 'wait-for-stable' }>,
): Promise<void> {
  const timeoutMs = action.timeoutMs ?? 15_000;
  const stableMs = action.stableMs ?? 750;
  const deadline = Date.now() + timeoutMs;
  const locator = page.locator(action.selector).first();
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  let previous = '';
  let unchangedSince: number | undefined;
  while (Date.now() < deadline) {
    // Stability is measured in rendered frames, not wall-clock time. A status written from
    // requestAnimationFrame cannot change while one slow frame holds the main thread, so a
    // wall-clock poll would count that stall as stable and pass on text from before a click.
    // Each read therefore waits for a full page frame, and uses the timestamp of the frame
    // that started it.
    const { text: current, frameTime } = await locator.evaluate(
      (element) =>
        new Promise<{ text: string; frameTime: number }>((resolve) => {
          const scope = globalThis as unknown as {
            requestAnimationFrame: (callback: (time: number) => void) => number;
          };
          scope.requestAnimationFrame((frameTime) => {
            scope.requestAnimationFrame(() =>
              resolve({ text: element.textContent ?? '', frameTime }),
            );
          });
        }),
    );
    const eligible = action.text === undefined || current.includes(action.text);
    // An earlier frame time means the page loaded a new document, which restarts its clock.
    if (
      unchangedSince === undefined ||
      frameTime < unchangedSince ||
      current !== previous ||
      !eligible
    ) {
      previous = current;
      unchangedSince = frameTime;
    } else if (frameTime - unchangedSince >= stableMs) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(
    `timed out waiting for ${action.selector} to stabilize${action.text === undefined ? '' : ` with "${action.text}"`}; last text: ${JSON.stringify(previous)}`,
  );
}

async function writeRunManifest(
  outDir: string,
  scenario: ExperiencePlayScenario,
  viewport: [number, number],
  frames: ExperiencePlayFrame[],
  diagnostics: ExperiencePlayDiagnostic[],
  error?: string,
): Promise<string> {
  const manifestPath = join(outDir, 'experience-run.json');
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        format: 'molen/experience-run@1',
        scenario: scenario.name,
        viewport,
        frames,
        diagnostics,
        ...(error === undefined ? {} : { error }),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return manifestPath;
}

/** Play a built browser experience: browser inputs in, screenshots and diagnostics out. */
export async function playExperience(input: ExperiencePlayInput): Promise<ExperiencePlayOutput> {
  let scenario: ExperiencePlayScenario;
  try {
    scenario = parseExperiencePlayScenario(input.scenario);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  await mkdir(input.outDir, { recursive: true });
  const diagnostics: ExperiencePlayDiagnostic[] = [];
  const frames: ExperiencePlayFrame[] = [];
  let actionIndex = -1;
  const { chromium } = await import('playwright');
  let browser: import('playwright').Browser | undefined;
  let server: ExperienceServer | undefined;
  const viewport = scenario.viewport ?? [1280, 720];
  try {
    ({ browser, server } = await startPlayResources(input.appDir, () =>
      chromium.launch({
        headless: input.headed !== true,
        args: [
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--disable-gpu-sandbox',
        ],
      }),
    ));
    const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
    page.on('console', (message) => {
      if (!['warning', 'error'].includes(message.type())) return;
      diagnostics.push({
        kind: 'console',
        level: message.type(),
        text: message.text(),
        actionIndex,
      });
    });
    page.on('pageerror', (error) =>
      diagnostics.push({ kind: 'page-error', text: error.message, actionIndex }),
    );
    page.on('requestfailed', (request) =>
      diagnostics.push({
        kind: 'request-failed',
        text: request.failure()?.errorText ?? 'request failed',
        url: request.url(),
        actionIndex,
      }),
    );

    const startUrl = new URL(scenario.path ?? '/', server.url).href;
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    for (actionIndex = 0; actionIndex < scenario.actions.length; actionIndex++) {
      const action = scenario.actions[actionIndex] as ExperiencePlayAction;
      if (action.type === 'wait') {
        await page.waitForTimeout(action.durationMs);
      } else if (action.type === 'wait-for') {
        const locator = page.locator(action.selector).first();
        await locator.waitFor({ state: 'visible', timeout: action.timeoutMs ?? 15_000 });
        if (action.text !== undefined) {
          await page
            .locator(action.selector)
            .filter({ hasText: action.text })
            .first()
            .waitFor({ state: 'visible', timeout: action.timeoutMs ?? 15_000 });
        }
      } else if (action.type === 'wait-for-stable') {
        await waitForStableText(page, action);
      } else if (action.type === 'keys') {
        for (const key of action.keys) await page.keyboard.down(key);
        try {
          await page.waitForTimeout(action.durationMs);
        } finally {
          for (const key of [...action.keys].reverse()) await page.keyboard.up(key);
        }
      } else if (action.type === 'key-down') {
        for (const key of action.keys) await page.keyboard.down(key);
      } else if (action.type === 'key-up') {
        for (const key of [...action.keys].reverse()) await page.keyboard.up(key);
      } else if (action.type === 'drag') {
        const box = await page.locator(action.selector).first().boundingBox();
        if (box === null) throw new Error(`drag target is not visible: ${action.selector}`);
        const from = {
          x: box.x + box.width * action.from[0],
          y: box.y + box.height * action.from[1],
        };
        const to = { x: box.x + box.width * action.to[0], y: box.y + box.height * action.to[1] };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: action.steps ?? 12 });
        await page.mouse.up();
        if (action.durationMs !== undefined) await page.waitForTimeout(action.durationMs);
      } else if (action.type === 'click') {
        await page.locator(action.selector).first().click();
      } else if (action.type === 'select') {
        await page.locator(action.selector).first().selectOption(action.value);
      } else if (action.type === 'navigate') {
        await page.goto(new URL(action.path, server.url).href, { waitUntil: 'domcontentloaded' });
      } else {
        if (action.settleMs !== undefined) await page.waitForTimeout(action.settleMs);
        const path = join(input.outDir, `${action.name}.png`);
        await page.screenshot({
          path,
          fullPage: action.fullPage ?? false,
          timeout: action.timeoutMs ?? 30_000,
        });
        const probes: Record<string, string> = {};
        for (const probe of scenario.probes ?? []) {
          probes[probe.name] =
            (await page
              .locator(probe.selector)
              .first()
              .textContent()
              .catch(() => undefined)) ?? '(missing)';
        }
        frames.push({ name: action.name, path, actionIndex, probes });
      }
    }
    const manifestPath = await writeRunManifest(
      input.outDir,
      scenario,
      viewport,
      frames,
      diagnostics,
    );
    return {
      ok: diagnostics.every((diagnostic) => diagnostic.kind !== 'page-error'),
      scenario: scenario.name,
      manifestPath,
      frames,
      diagnostics,
    };
  } catch (error) {
    const message = (error as Error).message;
    const manifestPath = await writeRunManifest(
      input.outDir,
      scenario,
      viewport,
      frames,
      diagnostics,
      message,
    );
    return {
      ok: false,
      scenario: scenario.name,
      manifestPath,
      frames,
      diagnostics,
      error: message,
    };
  } finally {
    await Promise.allSettled(
      [browser?.close(), server?.close()].filter(Boolean) as Promise<void>[],
    );
  }
}
