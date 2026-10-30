import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ROAD_FASCIA_STYLES, roadVehicleModel } from '../scripts/road-vehicle-geometry.mjs';

// Recipe fascia styles are free strings, and the builder draws a default shape for a name it
// does not know: a 'slots7' grille silently became the generic mesh, a 'kidneys' grille the
// same, and badge or belt flags did nothing. Every style and form key a road recipe names must
// be one the builder draws or reads.
const root = new URL('../../../content/entities/source/vehicles/', import.meta.url);
const scripts = new URL('../scripts/', import.meta.url);
const recipes = [];
// Motorhome and box-truck cabs are built by the same road builder from their recipe's grille,
// lamps and form keys, so those are held to the same vocabulary.
const cabs = [];
for (const slug of (await readdir(root)).sort()) {
  const text = await readFile(new URL(`${slug}/models/recipe.json`, root), 'utf8').catch(
    (error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    },
  );
  if (!text) continue;
  const recipe = JSON.parse(text);
  if (recipe.family === 'road-vehicle') recipes.push({ slug, recipe });
  else if (['recreational-vehicle', 'box-truck'].includes(recipe.family))
    cabs.push({ slug, recipe });
}
// Form keys the road builders read as f.<key> or form.<key>, plus measurements a recipe keeps
// for reference only (bed length, eye height, door count).
const read = new Set(['bed', 'eyeHeight', 'doors']);
const sources = (await readdir(scripts)).filter(
  (name) => /^road-.*\.mjs$/.test(name) || name === 'vehicle-interiors.mjs',
);
for (const name of sources)
  for (const [, key] of (await readFile(new URL(name, scripts), 'utf8')).matchAll(
    /\b(?:f|form)\.([A-Za-z]\w*)/g,
  ))
    read.add(key);

describe('road vehicle fascia vocabulary', () => {
  it('finds the road recipes and the builder keys', () => {
    expect(recipes.length).toBeGreaterThan(100);
    for (const key of ['grilleTrim', 'lampSweep', 'tailWrap', 'intakeWidth', 'exhaust'])
      expect(read.has(key), key).toBe(true);
  });

  // Enumerated form values may be given per end ([front, rear]).
  const checkForm = (form = {}) => {
    for (const [key, values] of Object.entries(ROAD_FASCIA_STYLES.form))
      if (key in form)
        for (const value of [form[key]].flat()) expect(values, `form.${key}`).toContain(value);
    for (const key of Object.keys(form))
      expect(read.has(key), `form.${key} is not read by the builder`).toBe(true);
  };

  it.each(recipes)('$slug names only styles the builder draws', ({ recipe }) => {
    expect(ROAD_FASCIA_STYLES.grille, 'grille').toContain(recipe.grille);
    expect(ROAD_FASCIA_STYLES.lamps, 'lamps').toContain(recipe.lamps);
    expect(ROAD_FASCIA_STYLES.tail, 'tail').toContain(recipe.tail);
    expect(ROAD_FASCIA_STYLES.intake, 'intake').toContain(recipe.intake ?? 'none');
    checkForm(recipe.form);
  });

  it('finds the motorhome and box-truck cabs', () => {
    expect(cabs.length).toBeGreaterThanOrEqual(7);
  });

  it.each(cabs)('$slug cab names only styles the road builder draws', ({ recipe }) => {
    for (const key of ['grille', 'lamps'])
      if (recipe[key] !== undefined) expect(ROAD_FASCIA_STYLES[key], key).toContain(recipe[key]);
    checkForm(recipe.form);
  });
});

// Every lamp, grille, trim, wheel and accessory option must change what is drawn: an option the
// builder silently ignores is as bad as an unknown style. Each variant is built on a Bendy
// generic (pickup-only options on the pickup) and compared with the plain build.
const generic = Object.fromEntries(
  recipes.filter(({ slug }) => ['compact', 'pickup'].includes(slug)).map((r) => [r.slug, r]),
);
const signature = (spec) => {
  const root = roadVehicleModel({ ...spec, articulate: false });
  root.updateMatrixWorld(true);
  let count = 0,
    sum = 0;
  const p = { x: 0, y: 0, z: 0 },
    materials = {};
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    materials[mesh.material.name] = (materials[mesh.material.name] ?? 0) + position.count;
    for (let i = 0; i < position.count; i++) {
      p.x = position.getX(i);
      p.y = position.getY(i);
      p.z = position.getZ(i);
      const e = mesh.matrixWorld.elements;
      sum +=
        1.3 * (e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) +
        1.7 * (e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) +
        1.1 * (e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14]);
    }
    count += position.count;
  });
  return {
    count,
    sum,
    materials: JSON.stringify(Object.entries(materials).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
};
const variants = [
  ...['split', 'multi', 'mesh', 'dial', 'aero'].map((v) => [{ wheelStyle: v }]),
  ...['dark', 'machined'].map((v) => [{ wheelFinish: v }]),
  ...['rect', 'wedge', 'boomerang', 'oval', 'rounded'].map((v) => [{ lampShape: v }]),
  ...['line', 'l', 'chevron', 'bars', 'frame', 'ring', 'none'].map((v) => [{ lampDrl: v }]),
  [{ lampDrop: 0.12 }],
  [{ lampProjectors: 3 }],
  [{ lampSweep: 0.2, lampShape: 'boomerang' }],
  [{}, { tail: 'round-wrap' }],
  [{}, { tail: 'slashes' }],
  [{ tailNotch: 0.6 }, {}, 'compact', { tail: 'boomerang' }],
  ...['smoked', 'clear'].map((v) => [{ tailHousing: v }, {}, 'compact', { tail: 'horizontal' }]),
  [{ tailStack: true }, {}, 'compact', { tail: 'horizontal', form: { tailCount: 2 } }],
  ...['chrome', 'body'].map((v) => [
    { tailBandFinish: v, tailBandY: 0.5 },
    {},
    'compact',
    { form: { tailBand: 0.04 } },
  ]),
  [{}, { grille: 'three-port' }],
  [{ grilleFill: 'fine' }],
  [{ grilleFrame: 0.04 }],
  ...['chrome', 'body', 'black', 'light'].map((v) => [{ grilleBar: v }]),
  ...['wing', 'v'].map((v) => [{ grilleBar: 'chrome', grilleBarShape: v }]),
  ...['slots', 'fangs'].map((v) => [{}, { intake: v }]),
  ...['round', 'rect', 'bar', 'none'].map((v) => [{ fogLamps: v }]),
  [{ fogTrim: 'chrome' }, {}, 'compact', { form: { fogLamps: 'round' } }],
  ...['silver', 'black'].map((v) => [{ skid: v }]),
  ...['chrome', 'black'].map((v) => [{ garnish: v }]),
  ...['black', 'silver'].map((v) => [{ diffuser: v }]),
  [{ bumperFinish: 'grey' }, {}, 'compact', { form: { bumperTrim: 0.2 } }],
  [{ bumperWrap: 0.1 }, {}, 'compact', { form: { bumperTrim: 0.2 } }],
  ...['grey', 'chrome', 'body'].map((v) => [
    { rockerFinish: v },
    {},
    'compact',
    { form: { rocker: 0.1 } },
  ]),
  ...['chrome', 'black'].map((v) => [{ rockerStrip: v }]),
  ...['board', 'tube'].map((v) => [{ sideSteps: v }]),
  [{ sideStepFinish: 'chrome' }, {}, 'compact', { form: { sideSteps: 'board' } }],
  [{ railStyle: 'feet' }, {}, 'compact', { form: { rails: true } }],
  ...['body', 'silver', 'black', 'ring'].map((v) => [
    { spareCover: v },
    {},
    'compact',
    { form: { spare: true } },
  ]),
  [{ hoodVents: 'centre' }],
  [{ sideIntakeZ: 0.2, sideIntakeDrop: 0.2 }, {}, 'compact', { form: { sideIntakes: true } }],
  [{ lightBarY: 0.4 }, {}, 'compact', { form: { frontLightBar: true } }],
  ...[1.6, 0].map((v) => [{ mirrorScale: v }]),
  ...['at', 'mt'].map((v) => [{ tread: v }]),
  [{ deckGrille: 0.3 }],
  ...['black', 'chrome'].map((v) => [{ rollBar: v }, {}, 'pickup']),
  [{ tailgateCap: true }, {}, 'pickup'],
  // [form option, recipe option, generic, context the option needs (in both builds)]
].map(([form, recipe = {}, slug = 'compact', given = {}]) => ({
  slug,
  name: `${slug} ${JSON.stringify({ ...given.form, ...recipe, ...form })}`,
  form,
  recipe,
  given,
}));

describe('road vehicle fascia, wheel, trim and accessory options', () => {
  it.each(variants)('$name changes the build', ({ slug, form, recipe, given }) => {
    const base = structuredClone(generic[slug].recipe),
      context = { ...base, ...given, form: { ...base.form, ...given.form } },
      reference = signature(context),
      result = signature({ ...context, ...recipe, form: { ...context.form, ...form } });
    expect(Number.isFinite(result.sum)).toBe(true);
    expect(
      result.count !== reference.count ||
        Math.abs(result.sum - reference.sum) > 1e-3 ||
        result.materials !== reference.materials,
      'the option changes nothing',
    ).toBe(true);
    for (const [key, value] of Object.entries(form))
      if (key in ROAD_FASCIA_STYLES.form)
        expect(ROAD_FASCIA_STYLES.form[key], `form.${key}`).toContain(value);
    for (const key of ['grille', 'lamps', 'tail', 'intake'])
      if (recipe[key] !== undefined) expect(ROAD_FASCIA_STYLES[key], key).toContain(recipe[key]);
  });
});
