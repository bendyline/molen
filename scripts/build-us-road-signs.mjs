// Compile pinned, licensed SVG artwork to plain triangles. Browser DOM parsing only; no WebGL/network.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../content/earth/', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const spec = await read('source/signs/us-states.json');
const provenance = await read('source/signs/americana/sources.json');
const base = (await read('signs/catalog.json')).profiles.find((p) => p.id === 'us');
const check = process.argv.includes('--check');
const svgs = {};
for (const entry of provenance.files) {
  const data = await readFile(
    new URL(`source/signs/americana/${entry.path.split('/').at(-1)}`, root),
    'utf8',
  );
  if (createHash('sha256').update(data).digest('hex') !== entry.sha256)
    throw new Error(`Source hash changed: ${entry.path}`);
  if (entry.path.endsWith('.svg')) svgs[entry.path.split('/').at(-1).slice(0, -4)] = data;
}
const req = createRequire(import.meta.url);
const threeRoot = new URL('./', pathToFileURL(req.resolve('three')));
const modules = {
  '/three.module.js': await readFile(new URL('three.module.js', threeRoot), 'utf8'),
  '/three.core.js': await readFile(new URL('three.core.js', threeRoot), 'utf8'),
  '/SVGLoader.js': await readFile(req.resolve('three/addons/loaders/SVGLoader.js'), 'utf8'),
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
let shields;
try {
  const page = await browser.newPage();
  await page.route('**/*', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: path === '/' ? 'text/html' : 'text/javascript',
      body:
        path === '/'
          ? '<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>'
          : (modules[path] ?? ''),
    });
  });
  await page.goto('http://molen-sign-compiler.local/');
  shields = await page.evaluate(
    async ({ states, svgs }) => {
      const { SVGLoader } = await import('/SVGLoader.js');
      const { ShapeGeometry, Color } = await import('/three.module.js');
      const round = (n) => Math.round(n * 1e6) / 1e6;
      const white = '#eeeadd',
        black = '#242a28';
      const svg = (body) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">${body}</svg>`;
      const outline = (d, fill = white) =>
        `<path d="${d}" fill="${fill}" stroke="${black}" stroke-width=".7"/>`;
      const rectangle = outline('M1 1H19V19H1Z');
      const shapes = {
        rectangle,
        circle: `<rect width="20" height="20" fill="${black}"/><circle cx="10" cy="10" r="9" fill="${white}"/>`,
        diamond: outline('M10 .6 19.4 10 10 19.4 .6 10Z'),
        'diamond-m': outline('M10 .6 19.4 10 10 19.4 .6 10Z'),
        nebraska: outline('M1 1H19L15.8 19H4.2Z'),
        virginia: outline('M1 1H19V12Q18 17 10 19Q2 17 1 12Z'),
        wyoming:
          outline('M1 1H19V19H1Z', '#d8b84f') +
          `<path fill="${black}" d="M3 7 5 6 7 7 9 5 11 6 10 8 8 9 6 8 4 9 3 11 2 11 3 8 1 7 2 6ZM8 8 10 10 12 10 12 11 9 11 7 9ZM5 8 6 11 5 13 4 13 5 10Z M6 6 7 4 6 3 6 2 8 2 8 3 8 5 9 6ZM7 4 10 3 11 1 12 1 11 4 8 5Z"/>`,
      };
      const result = {};
      for (const state of states) {
        const variants = [];
        for (const source of state.icons ?? [state.shape]) {
          const input = state.icons ? svgs[source] : svg(shapes[source]);
          if (!input) throw Error(`Missing artwork for ${state.code}`);
          const doc = new DOMParser().parseFromString(input, 'image/svg+xml');
          const w = +doc.documentElement.getAttribute('width'),
            h = +doc.documentElement.getAttribute('height');
          const bounds = doc.documentElement
            .getAttribute('viewBox')
            ?.split(/[ ,]+/)
            .map(Number) ?? [0, 0, w, h];
          const parsed = new SVGLoader().parse(input);
          const layers = [];
          const add = (geometry, color) => {
            const position = geometry.getAttribute('position');
            const indices =
              geometry.index?.array ?? Array.from({ length: position.count }, (_, i) => i);
            const points = Array.from({ length: position.count }, (_, i) => [
              round((position.getX(i) - bounds[0]) / bounds[2] - 0.5),
              round(
                (state.reflect
                  ? (position.getY(i) - bounds[1]) / bounds[3]
                  : 1 - (position.getY(i) - bounds[1]) / bounds[3]) - 0.5,
              ),
            ]).flat();
            const hex = new Color(color).getHexString();
            const unique = [],
              lookup = new Map(),
              remap = [];
            for (let i = 0; i < points.length; i += 2) {
              const key = `${points[i]},${points[i + 1]}`;
              if (!lookup.has(key)) {
                lookup.set(key, unique.length / 2);
                unique.push(points[i], points[i + 1]);
              }
              remap.push(lookup.get(key));
            }
            layers.push({
              color: hex === 'ffffff' ? white : hex === '000000' ? black : `#${hex}`,
              positions: unique,
              indices: Array.from(indices, (i) => remap[i]),
            });
            geometry.dispose();
          };
          for (const path of parsed.paths) {
            const style = path.userData.style;
            if (style.fill !== 'none' && style.fillOpacity !== 0)
              for (const shape of SVGLoader.createShapes(path))
                add(new ShapeGeometry(shape, 12), style.fill);
            if (style.stroke && style.stroke !== 'none' && style.strokeOpacity !== 0)
              for (const subpath of path.subPaths) {
                const geometry = SVGLoader.pointsToStroke(subpath.getPoints(12), style, 8);
                if (geometry) add(geometry, style.stroke);
              }
          }
          const [l, r, t, b] = state.padding;
          let box = [
            (l - r) / (2 * w),
            (b - t) / (2 * h),
            Math.min(0.75, (w - l - r) / w),
            Math.min(0.55, (h - t - b) / h),
          ];
          const legends = [];
          if (['IL', 'IN', 'MT', 'NE', 'TX'].includes(state.code)) {
            legends.push({
              text: state.name.toUpperCase(),
              box: [0, 0.31, 0.78, 0.12],
              color: black,
            });
            box = [0, -0.06, 0.72, 0.48];
          }
          if (state.code === 'MI') {
            legends.push({ text: 'M', box: [0, 0.27, 0.2, 0.16], color: black });
            box = [0, -0.07, 0.56, 0.38];
          }
          if (state.code === 'CA') {
            legends.push({ text: 'CALIFORNIA', box: [0, 0.17, 0.65, 0.08], color: white });
            box = [0, -0.12, 0.65, 0.36];
          }
          if (state.code === 'NC') box = [0, 0, 0.56, 0.42];
          if (state.code === 'HI') box = [0, -0.1, 0.6, 0.4];
          if (state.code === 'MD')
            legends.push({ text: 'MARYLAND', box: [0, 0.35, 0.75, 0.09], color: black });
          if (state.code === 'VT')
            legends.push({ text: 'VERMONT', box: [0, 0.35, 0.7, 0.08], color: '#236346' });
          if (state.code === 'WY') {
            legends.push({ text: 'WYOMING', box: [0, -0.36, 0.78, 0.1], color: black });
            box = [0.15, -0.13, 0.58, 0.28];
          }
          if (state.code === 'NV') box = [-0.05, 0.14, 0.6, 0.32];
          variants.push({
            aspect: round(w / h),
            layers,
            textBox: box.map(round),
            textColor: state.textColor,
            legends,
          });
        }
        result[state.network] = { title: state.name, subdivision: `US-${state.code}`, variants };
      }
      return result;
    },
    { states: spec.states, svgs },
  );
} finally {
  await browser.close();
}
async function emit(path, doc) {
  const text = `${JSON.stringify(doc)}\n`,
    url = new URL(path, root);
  if (check) {
    if ((await readFile(url, 'utf8')) !== text) throw new Error(`Stale state signs: ${path}`);
  } else await writeFile(url, text);
}
await emit('signs/route-shields.json', { format: 'molen/route-shields@1', shields });
await emit('signs/us-states.json', {
  format: 'molen/road-sign-profiles@1',
  profiles: spec.states.map((state) => ({
    ...base,
    id: `us-${state.code.toLowerCase()}`,
    title: state.name,
    countries: [],
    subdivisions: [`US-${state.code}`],
    stateNetwork: state.network,
    notes: `${state.name} state-route marker. Shared U.S. regulatory signs. Artwork adapted for medium-fi rendering; county routes, toll and business variants are not implied. Local street-name blades vary by municipality.`,
    sources: [`${spec.source}/tree/${spec.revision}/icons`, ...base.sources],
  })),
});
console.log(
  `50 state profiles; ${Object.keys(shields).length} route shield designs: ${fileURLToPath(root)}`,
);
