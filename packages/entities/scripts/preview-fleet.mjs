/**
 * Summary previews and contact sheets for the entity fleet, composed from local review captures.
 *
 * `capture-fleet.mjs` leaves four turntable angles, a lit three-quarter view, the operator's
 * view and a wide cabin view in each bundle's ignored `shots/` directory. This script turns
 * two of those into the durable, tracked review artifacts the model image policy asks for
 * (content/ASSET-PACKS.md, "Model review images"):
 *
 * - `preview.png` beside each source bundle: the three-quarter view and the cabin view side
 *   by side, 1024 px wide, listed in `source.json` `files.documents` and linked from the README.
 * - One contact sheet per collection under `content/entities/`, built from the rosters in
 *   `content/entities/source/*.json` and the remaining bundles of each category, so a whole
 *   collection can be scanned on one page: `<collection>-preview.png` (exteriors) and
 *   `<collection>-interiors-preview.png` (operator views; none for cycles). The file names are
 *   the ones the review documents already link.
 *
 * Nothing is rendered here, so no browser is needed; run it after a capture pass. Missing
 * captures skip a model's preview with a note and fail a contact sheet, because a sheet with
 * holes would read as evidence. Requires the workspace tooling dependencies (sharp).
 *
 *   node packages/entities/scripts/preview-fleet.mjs                 # every preview and sheet
 *   node packages/entities/scripts/preview-fleet.mjs --ids=slug,slug # those previews, no sheets
 *   node packages/entities/scripts/preview-fleet.mjs --sheets        # only the contact sheets
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../content/entities');
const sharp = createRequire(resolve(here, '../../tooling/package.json'))('sharp');

const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const sheetsOnly = process.argv.includes('--sheets');
const categories = ['vehicles', 'cycles', 'watercraft', 'transit', 'aircraft'];

// Scene captures are 1000 × 750 and turntable captures 900 × 650. The exterior camera frames
// every model by its length, so one crop fits all of them; the operator view keeps most of its
// frame; the side view stands in for cycles, whose rider's view shows no vehicle at all.
const EXTERIOR = { left: 180, top: 195, width: 640, height: 430 };
const INTERIOR = { left: 100, top: 75, width: 800, height: 600 };
const SIDE = { left: 190, top: 110, width: 520, height: 390 };
const BACKGROUND = { r: 233, g: 236, b: 239 };
const LABEL = '#2b3238';
// Flat-shaded renders lose nothing visible to a 256-colour palette and shrink by about two thirds.
const PNG = { compressionLevel: 9, palette: true, colours: 256, dither: 0 };

const exists = (path) =>
  stat(path).then(
    () => true,
    (e) => {
      if (e.code === 'ENOENT') return false;
      throw e;
    },
  );

/** Every bundle with a source manifest, keyed by slug, with its captures if they exist. */
async function bundles() {
  const found = new Map();
  for (const category of categories) {
    for (const slug of (await readdir(resolve(root, 'source', category))).sort()) {
      const directory = resolve(root, 'source', category, slug);
      if (!(await exists(resolve(directory, 'source.json')))) continue;
      const source = JSON.parse(await readFile(resolve(directory, 'source.json'), 'utf8'));
      const shot = async (name) => {
        const path = resolve(directory, 'shots', name);
        return (await exists(path)) ? path : undefined;
      };
      found.set(slug, {
        slug,
        category,
        directory,
        title: source.title,
        exterior: await shot('three-quarter.png'),
        interior:
          category === 'cycles'
            ? undefined
            : ((await shot('cabin.png')) ?? (await shot('operator.png'))),
        side: await shot('angle_1.png'),
      });
    }
  }
  return found;
}

const panel = (path, crop, width, height) =>
  sharp(path).extract(crop).resize(width, height).png().toBuffer();

/** Exterior and operator (or side) views side by side, 1024 px wide; false without captures. */
async function writePreview(bundle) {
  const second = bundle.interior ?? bundle.side;
  if (!bundle.exterior || !second) {
    console.log(`${bundle.slug}: no captures in shots/, preview skipped`);
    return false;
  }
  const gap = 8,
    height = 360;
  const left = await panel(bundle.exterior, EXTERIOR, 536, height);
  const right = await panel(second, bundle.interior ? INTERIOR : SIDE, 480, height);
  await sharp({
    create: { width: 536 + gap + 480, height, channels: 3, background: BACKGROUND },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: 536 + gap, top: 0 },
    ])
    .png(PNG)
    .toFile(resolve(bundle.directory, 'preview.png'));
  await listPreview(bundle);
  return true;
}

/** Lists preview.png in source.json's documents and links it under the README title, once. */
async function listPreview(bundle) {
  const manifestPath = resolve(bundle.directory, 'source.json');
  const text = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(text);
  if (!manifest.files.documents.includes('preview.png')) {
    manifest.files.documents.push('preview.png');
    const next = `${JSON.stringify(manifest, null, 2)}\n`;
    if (next !== text) await writeFile(manifestPath, next);
  }
  const readmePath = resolve(bundle.directory, 'README.md');
  if (!(await exists(readmePath))) return;
  const readme = await readFile(readmePath, 'utf8');
  if (readme.includes('](preview.png)')) return;
  const lines = readme.split('\n');
  const title = lines.findIndex((line) => line.startsWith('# '));
  if (title < 0) return;
  lines.splice(title + 1, 0, '', '![Molen preview](preview.png)');
  await writeFile(readmePath, lines.join('\n'));
}

const escapeXml = (value) =>
  value.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

/** A labelled grid of one view per model; four columns, rows as needed. */
async function writeSheet(name, members, view) {
  const columns = 4,
    gap = 8,
    width = 296,
    label = 26;
  const crop = view === 'interior' ? INTERIOR : EXTERIOR;
  const height = Math.round((width * crop.height) / crop.width);
  const cell = height + label;
  const rows = Math.ceil(members.length / columns);
  const sheet = {
    width: gap + columns * (width + gap),
    height: gap + rows * (cell + gap),
  };
  const composites = [];
  for (const [index, bundle] of members.entries()) {
    const path = bundle[view];
    if (!path) throw new Error(`${bundle.slug} has no ${view} capture; run capture-fleet first.`);
    const left = gap + (index % columns) * (width + gap);
    const top = gap + Math.floor(index / columns) * (cell + gap);
    composites.push({ input: await panel(path, crop, width, height), left, top });
    const text = escapeXml(bundle.title);
    composites.push({
      input: Buffer.from(
        `<svg width="${width}" height="${label}" xmlns="http://www.w3.org/2000/svg">` +
          `<rect width="${width}" height="${label}" fill="#f6f7f8"/>` +
          `<text x="6" y="17" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="${LABEL}">${text}</text>` +
          '</svg>',
      ),
      left,
      top: top + height,
    });
  }
  await sharp({ create: { ...sheet, channels: 3, background: BACKGROUND } })
    .composite(composites)
    .png(PNG)
    .toFile(resolve(root, `${name}.png`));
  console.log(`${name}.png: ${members.length} models`);
}

/** Roster-backed collections keep the file names the review documents link. */
async function collections(all) {
  const roster = async (file) =>
    JSON.parse(await readFile(resolve(root, 'source', file), 'utf8')).models.map((m) => m.slug);
  const sheets = [
    {
      name: 'us-vehicles',
      interiors: 'us-vehicle-interiors',
      slugs: await roster('us-vehicles.json'),
    },
    {
      name: 'regional-vehicles',
      interiors: 'regional-vehicles-interiors',
      slugs: await roster('regional-vehicles.json'),
    },
    {
      name: 'variety-vehicles',
      interiors: 'variety-vehicle-interiors',
      slugs: await roster('variety-vehicles.json'),
    },
    { name: 'rvs', interiors: 'rv-interiors', slugs: await roster('rvs.json') },
    {
      name: 'mini-acura',
      interiors: 'mini-acura-interiors',
      slugs: await roster('mini-acura.json'),
    },
  ];
  const listed = new Set(sheets.flatMap((s) => s.slugs));
  const rest = (category) =>
    [...all.values()]
      .filter((b) => b.category === category && !listed.has(b.slug))
      .map((b) => b.slug);
  sheets.push(
    { name: 'bendy-vehicles', interiors: 'bendy-vehicle-interiors', slugs: rest('vehicles') },
    { name: 'cycles', interiors: 'cycle-interiors', slugs: rest('cycles') },
    { name: 'watercraft', interiors: 'watercraft-interiors', slugs: rest('watercraft') },
    { name: 'transit', interiors: 'transit-interiors', slugs: rest('transit') },
    { name: 'aircraft', interiors: 'aircraft-interiors', slugs: rest('aircraft') },
  );
  return sheets;
}

const all = await bundles();
if (!sheetsOnly) {
  let written = 0;
  for (const bundle of all.values()) {
    if (selection && !selection.includes(bundle.slug)) continue;
    if (await writePreview(bundle)) written++;
  }
  if (selection && !written) throw new Error('No bundle matched --ids.');
  console.log(`${written} previews written`);
}
if (!selection) {
  for (const sheet of await collections(all)) {
    const members = sheet.slugs.map((slug) => {
      const bundle = all.get(slug);
      if (!bundle) throw new Error(`Roster slug ${slug} has no source bundle.`);
      return bundle;
    });
    if (!members.length) continue;
    await writeSheet(`${sheet.name}-preview`, members, 'exterior');
    if (members.some((b) => b.interior))
      await writeSheet(`${sheet.interiors}-preview`, members, 'interior');
  }
}
