// Country outlines are shared source inputs, but sign selection must not use architectural regions.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../content/earth/', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await read('signs/catalog.json');
const source = await read('source/architecture-countries.json');
const codes = new Set(catalog.profiles.flatMap((profile) => profile.countries));
// Some ISO codes have several source features (Australia includes island territories).
// Cyprus's separate northern outline follows the same traffic rule.
const byCode = new Map();
for (const country of source.countries) {
  const code = country.code === 'CYN' ? 'CY' : country.code;
  if (!codes.has(code)) continue;
  const existing = byCode.get(code);
  if (existing) existing.polygons.push(...country.polygons);
  else byCode.set(code, { ...country, code, polygons: [...country.polygons] });
}
const countries = [...byCode.values()];
const states = (await read('source/signs/us-state-boundaries.json')).states;
const stateProfiles = (await read('signs/us-states.json')).profiles;
if (
  states.length !== 50 ||
  states.some(
    (state) => !stateProfiles.some((profile) => profile.subdivisions.includes(state.code)),
  )
)
  throw new Error('Incomplete state sign geography');
if (countries.length !== codes.size) throw new Error('A sign country has no source outline');
const atlas = {
  format: 'molen/region-atlas@1',
  id: 'molen.earth.roadsigns.regions',
  title: 'Road sign countries and U.S. states',
  doc: `${source.source.title}; public-domain country outlines, simplified at 0.02 degrees. Approximate visual selection, not surveyed boundaries. Exact containment wins; a bounded coastal fallback covers simplification gaps.`,
  version: 1,
  fallbackDistanceMeters: 2500,
  regions: [
    ...countries.map((country) => ({
      id: country.code.toLowerCase(),
      title: country.name,
      priority: 0,
      polygons: country.polygons,
      bindings: { buildings: [] },
    })),
    ...states.map((state) => ({
      id: state.code.toLowerCase(),
      title: state.name,
      priority: 1,
      polygons: state.polygons,
      bindings: { buildings: [] },
    })),
  ],
  default: { buildings: [] },
};
const path = new URL('signs/regions.atlas.json', root);
const text = `${JSON.stringify(atlas)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')) !== text) throw new Error('Road sign country atlas is stale');
} else await writeFile(path, text);
console.log(`${countries.length} road sign countries: ${fileURLToPath(path)}`);
