/** Explicit authoring-time refresh. Runtime placement never queries public OSM/Wikidata APIs. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(root, 'content/earth/structures/evidence');
const catalog = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/candidates.json'), 'utf8'),
);
const snapshot = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/wikidata-snapshot.json'), 'utf8'),
);
const candidates = catalog.candidates;
const mode = process.argv.includes('--osm-relations')
  ? 'osm-relations'
  : process.argv.includes('--osm')
    ? 'osm'
    : 'wikidata';
const all = process.argv.includes('--spares');
const ids = [
  ...new Set(
    all
      ? Object.values(snapshot.groups).flatMap((group) => group.rows.map((row) => row.id))
      : candidates.map((entry) => entry.wikidataId),
  ),
].filter((id) => /^Q\d+$/.test(id));
const properties = [
  'P31',
  'P149',
  'P84',
  'P2048',
  'P2049',
  'P2043',
  'P625',
  'P576',
  'P5817',
  'P571',
  'P361',
];
await mkdir(output, { recursive: true });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function save(path, value) {
  const temporary = `${path}.pending`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, path);
      return;
    } catch (error) {
      if (attempt >= 9) throw error;
      await wait(500);
    }
  }
}
async function request(url, options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent':
            'MolenStructureAuthoring/1.0 (https://github.com/bendyline/molen; local asset preparation)',
          ...options?.headers,
        },
        signal: AbortSignal.timeout(180000),
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await wait(10000 * (attempt + 1));
      continue;
    }
    if (response.ok) return response.json();
    if (![429, 502, 503, 504].includes(response.status) || attempt === 2)
      throw new Error(`${url.slice(0, 100)}: HTTP ${response.status}`);
    await wait(10000 * (attempt + 1));
  }
}
if (mode === 'wikidata') {
  const path = resolve(output, 'wikidata-details.json');
  const previous = await readFile(path, 'utf8')
    .then(JSON.parse)
    .catch(() => ({ entities: {} }));
  const missing = ids.filter((id) => !previous.entities[id]);
  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50);
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|descriptions|claims',
      languages: 'en',
      format: 'json',
    });
    const result = await request(url);
    if (result.error) throw new Error(JSON.stringify(result.error));
    for (const [id, entity] of Object.entries(result.entities ?? {}))
      previous.entities[id] = {
        id,
        title: entity.labels?.en?.value,
        description: entity.descriptions?.en?.value,
        claims: Object.fromEntries(
          properties
            .filter((property) => entity.claims?.[property])
            .map((property) => [property, entity.claims[property]]),
        ),
      };
    await save(path, {
      format: 'molen/structure-wikidata-evidence@1',
      capturedAt: new Date().toISOString(),
      source: 'https://www.wikidata.org/w/api.php',
      license: 'CC0-1.0',
      entities: previous.entities,
    });
    console.log(
      `Wikidata ${Math.min(start + 50, missing.length)}/${missing.length}; ${Object.keys(previous.entities).length} total`,
    );
    await wait(1100);
  }
} else if (mode === 'osm-relations') {
  // `out tags geom` omits relation member bodies. Fill those explicitly without
  // repeating all identity queries or manufacturing polygons from bounding boxes.
  const path = resolve(output, 'osm-features.json');
  const previous = JSON.parse(await readFile(path, 'utf8'));
  const elements = new Map(previous.elements.map((entry) => [`${entry.type}/${entry.id}`, entry]));
  const missing = previous.elements
    .filter((entry) => entry.type === 'relation' && !entry.members)
    .map((entry) => entry.id);
  for (let start = 0; start < missing.length; start += 40) {
    const batch = missing.slice(start, start + 40);
    const query = `[out:json][timeout:120];rel(id:${batch.join(',')});out body geom;`;
    const endpoint = 'https://overpass-api.de/api/interpreter';
    const result = await request(endpoint, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
    });
    if (result.remark) throw new Error(`Overpass incomplete result: ${result.remark}`);
    for (const element of result.elements ?? [])
      elements.set(`${element.type}/${element.id}`, element);
    await save(path, {
      ...previous,
      capturedAt: new Date().toISOString(),
      elements: [...elements.values()],
    });
    console.log(`OSM relation geometry ${Math.min(start + 40, missing.length)}/${missing.length}`);
    await wait(2100);
  }
} else {
  const path = resolve(output, 'osm-features.json');
  const previous = await readFile(path, 'utf8')
    .then(JSON.parse)
    .catch(() => ({ queried: [], elements: [] }));
  const missing = ids.filter((id) => !previous.queried.includes(id));
  const elements = new Map(previous.elements.map((entry) => [`${entry.type}/${entry.id}`, entry]));
  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50);
    const query = `[out:json][timeout:120];(${batch.map((id) => `nwr["wikidata"="${id}"];`).join('')});out body geom;`;
    const endpoint = 'https://overpass-api.de/api/interpreter';
    const result = await request(endpoint, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
    });
    if (result.remark) throw new Error(`Overpass incomplete result: ${result.remark}`);
    for (const element of result.elements ?? [])
      elements.set(`${element.type}/${element.id}`, element);
    previous.queried.push(...batch);
    await save(path, {
      format: 'molen/structure-osm-evidence@1',
      capturedAt: new Date().toISOString(),
      source: endpoint,
      attribution: '© OpenStreetMap contributors',
      license: 'ODbL-1.0',
      queried: previous.queried,
      elements: [...elements.values()],
    });
    console.log(
      `OSM ${Math.min(start + 50, missing.length)}/${missing.length}; ${elements.size} features`,
    );
    await wait(2100);
  }
}
