/** Generate the photo-linked gallery from the same recipes used by the runtime. */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, siteDir } from './packages.mjs';

const root = join(repoRoot, 'content/entities');
const read = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const cell = (value) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const families = {
  aircraft: 'Aircraft',
  vehicle: 'Cars, trucks and RVs',
  cycle: 'Cycles',
  transit: 'Transit',
  watercraft: 'Watercraft',
};
const aliases = { f_16b: 'f16', winnebago_view_2022: 'rv', ford_mustang_2024: 'mustang' };
const slug = (id) => aliases[id.split('.').at(-1)] ?? id.split('.').at(-1);
const anchor = (title) => title.toLowerCase().replaceAll(',', '').replaceAll(' ', '-');

async function inventory() {
  const models = (await read('source/liveries.json')).models;
  const project = await read('project.json');
  const labels = {};
  for (const path of project.types)
    for (const [id, type] of Object.entries((await read(path)).types)) {
      const c = type.components;
      labels[id] = (c?.aircraft ?? c?.vehicle ?? c?.boat)?.spec?.label ?? id.split('.').at(-1);
    }
  for (const [id, data] of Object.entries(models)) {
    if (!Object.hasOwn(families, id.split('.')[2]))
      throw new Error(`Unlisted livery family: ${id}`);
    if (
      data.variants.some((v) => v.provenance.kind === 'original' || !v.provenance.references.length)
    )
      throw new Error(`${id}: gallery requires a photograph for every choice`);
  }
  const variants = Object.values(models).flatMap((m) => m.variants);
  const refs = [
    ...new Map(variants.flatMap((v) => v.provenance.references).map((r) => [r.url, r])).values(),
  ];
  return {
    models,
    labels,
    refs,
    counts: { vehicles: Object.keys(models).length, total: variants.length, sources: refs.length },
  };
}

function choices(data) {
  return (
    '| Livery id | Appearance | Photographs |\n| --- | --- | --- |\n' +
    data.variants
      .map(
        (v) =>
          `| \`${v.id}\` | ${cell(v.label)} | ${v.provenance.references.map((r, i) => `[Photo${v.provenance.references.length > 1 ? ` ${i + 1}` : ''}](${r.url})`).join(' · ')} |`,
      )
      .join('\n')
  );
}

function notes(data) {
  const unique = [...new Set(data.variants.map((v) => v.provenance.note))];
  if (unique.length === 1) return unique[0];
  return data.variants.map((v) => `**${v.label}.** ${v.provenance.note}`).join('\n\n');
}

export async function generateLiveryGallery({ check = false } = {}) {
  const { models, labels, refs, counts } = await inventory();
  const evidence = `All ${counts.total} choices across ${counts.vehicles} vehicle types have linked real-world photographs. Every vehicle has two choices; the F-16B has three. Colors and visible layout were compared with the photographs and the rendered models. These are **photo-based adaptations** (\`inspired\` provenance), not exact historical or factory replicas.\n\nPaint values are visual estimates, not measured paint codes. Camouflage uses approximate masks; complex emblems and small stencils may be omitted. Generic Bendy bodies adapt finishes from the photographed real vehicles. Each entry explains its scope. Source photos are linked for inspection and attribution; they are not shipped as textures.`;
  function sections(visual) {
    return Object.entries(families)
      .map(
        ([family, title]) =>
          `## ${title}\n\n` +
          Object.entries(models)
            .filter(([id]) => id.split('.')[2] === family)
            .sort(([a], [b]) => labels[a].localeCompare(labels[b], 'en'))
            .map(([id, data]) => {
              const image = `https://molen.dev/guide-media/liveries/${slug(id)}.png`;
              const alt =
                `${labels[id]} livery comparison: ${data.variants.map((v) => v.label).join(', ')}`
                  .replaceAll('[', '\\[')
                  .replaceAll(']', '\\]');
              const preview = visual ? `[![${alt}](${image})](${image})\n\n` : '';
              return `### ${labels[id]}\n\nType: \`${id}\`.\n\n${preview}${choices(data)}\n\n${notes(data)}\n`;
            })
            .join('\n'),
      )
      .join('\n');
  }
  const navigation = Object.values(families)
    .map((title) => `[${title}](#${anchor(title)})`)
    .join(' · ');
  const gallery = `# Livery gallery\n\nCompare every vehicle’s photo-based liveries side by side, then follow the photograph links to inspect the real-world colors and markings. Read each comparison from left to right; its labels give the selection ids.\n\n${navigation}\n\n## Evidence and scope\n\n${evidence}\n\nThe Danish F-16B uses photographs of ET-612 at Oulu in 2014: roundels aft of the canopy, the serial behind them, and small flags high on the fin. Both sides were checked. The old permanent model-name label is removed.\n\nThe [complete catalog](livery-catalog.md) has a text-only inventory and full [source attribution index](livery-catalog.md#source-index). See [vehicle liveries](liveries.md) for the paint-slot and surface-marking system.\n\n## Use a choice\n\nCopy a type and livery id from an entry and set \`livery.selected\`:\n\n\`\`\`json\n{\n  "id": "aircraft",\n  "type": "molen.entities.aircraft.f_16b",\n  "components": { "livery": { "selected": "danish-et-612" } }\n}\n\`\`\`\n\n${sections(true)}\n## Refresh the gallery\n\nIn the engine repository, edit \`content/entities/source/liveries.json\`, validate and propagate the recipes, capture changed sheets, then regenerate the guides:\n\n\`\`\`sh\nnode packages/entities/scripts/generate-liveries.mjs\nnode packages/entities/scripts/preview-liveries.mjs --capture\nnode docs-site/scripts/generate-livery-gallery.mjs\n\`\`\`\n\nThe capture command reuses sheets whose model, recipe and camera hashes still match. Documentation builds verify and copy one small summary image per vehicle; they do not download reference photos or render models. Bulk captures stay local.\n`;
  const catalog = `# Complete livery catalog\n\nFind each vehicle’s livery ids, photograph links and adaptation notes in this text inventory. The [visual gallery](livery-gallery.md) shows all the same choices, and the [authoring guide](liveries.md) explains their reusable model bindings.\n\n${navigation}\n\n## Evidence and scope\n\n${evidence}\n\n${sections(false)}\n## Source index\n\nAttribution and license labels below describe the linked source photographs. No source photograph is redistributed in the pack or gallery.\n\n${refs.map((r, i) => `${i + 1}. [${r.title.replaceAll('[', '\\[').replaceAll(']', '\\]')}](${r.url})`).join('\n')}\n`;
  for (const [name, contents] of [
    ['livery-gallery', gallery],
    ['livery-catalog', catalog],
  ]) {
    const path = join(repoRoot, 'docs-src/guide', `${name}.md`);
    if (check) {
      if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== contents)
        throw new Error(
          `${name}.md is stale; run node docs-site/scripts/generate-livery-gallery.mjs`,
        );
    } else await writeFile(path, contents);
  }
  return counts;
}

export async function stageLiveryPreviews() {
  const models = (await read('source/liveries.json')).models;
  const project = await read('project.json');
  const manifest = await read('livery-previews/manifest.json');
  if (
    manifest.examples.length !== Object.keys(models).length ||
    new Set(manifest.examples.map((e) => e.type)).size !== manifest.examples.length
  )
    throw new Error('Preview manifest must cover every vehicle exactly once');
  const out = join(siteDir, 'public/guide-media/liveries');
  await mkdir(out, { recursive: true });
  for (const [type, data] of Object.entries(models)) {
    const entry = manifest.examples.find((e) => e.type === type);
    const asset = await read(project.assets[type]);
    const runtimeHash = hash(
      await readFile(resolve(root, project.assets[type], '..', asset.files.main)),
    );
    const image = join(root, 'livery-previews', `${slug(type)}.png`);
    if (
      !entry ||
      entry.image !== `${slug(type)}.png` ||
      entry.runtimeHash !== runtimeHash ||
      JSON.stringify(entry.variants) !== JSON.stringify(data.variants.map((v) => v.id)) ||
      entry.recipeHash !== hash(JSON.stringify(data)) ||
      entry.imageHash !== hash(await readFile(image))
    )
      throw new Error(
        `Stale ${slug(type)} livery preview; run node packages/entities/scripts/preview-liveries.mjs --capture`,
      );
    await copyFile(image, join(out, entry.image));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(await generateLiveryGallery({ check: process.argv.includes('--check') }));
