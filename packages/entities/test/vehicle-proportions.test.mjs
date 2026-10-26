import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// Proportion rules for recipe road vehicles (road-vehicle-geometry.mjs). They guard the
// defects the 2026-10-26 model review found across whole families: SUVs, hatchbacks, wagons
// and vans drawn with a sedan's sloping rear and trunk deck, and dashboards pushed through the
// windshield base when an upright screen put the driver's eye too far forward. Lengths are the
// recipe's fractions of overall length, converted to metres.
const root = new URL('../../../content/entities/source/vehicles/', import.meta.url);
const recipes = [];
for (const slug of (await readdir(root)).sort()) {
  const text = await readFile(new URL(`${slug}/models/recipe.json`, root), 'utf8').catch(
    (error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    },
  );
  if (!text) continue;
  const recipe = JSON.parse(text);
  if (recipe.family !== 'road-vehicle') continue;
  const types = JSON.parse(await readFile(new URL(`${slug}/entity.types.json`, root), 'utf8'));
  recipes.push({ slug, recipe, spec: types.types[recipe.id].components.vehicle.spec });
}
const hatchbacks = [
  'suv',
  'crossover',
  'hatchback',
  'wagon',
  'van',
  'offroad',
  'city',
  'cargo-van',
];

describe('road vehicle proportions', () => {
  it.each(
    recipes.filter(({ recipe }) => hatchbacks.includes(recipe.bodyStyle)),
  )('$slug ends in a tailgate, not a sedan deck', ({ recipe }) => {
    const { length: L, form: f } = recipe;
    // The rear glass meets the body close to the rear end...
    expect((0.5 + f.rearBase) * L).toBeLessThanOrEqual(0.32);
    // ...and climbs to the roof over at most a metre (a coupe-SUV's slope, not a trunk lid).
    expect((f.roofRear - f.rearBase) * L).toBeLessThanOrEqual(1);
  });

  it.each(
    recipes.filter(({ recipe }) => recipe.bodyStyle === 'pickup'),
  )('$slug stands its cab and bed on a frame', ({ recipe }) => {
    const { wheelRadius: R, form: f } = recipe;
    // Sills sit near axle height (the builder's default is the wheel radius).
    expect(f.clearance ?? R).toBeGreaterThanOrEqual(0.25);
  });

  it.each(
    recipes.filter(({ recipe }) => !recipe.form.fitCabin),
  )('$slug keeps its dashboard behind the windshield base', ({ recipe, spec }) => {
    // addRoadDashboard puts the full-depth fascia 0.57 m ahead of the eye, 0.16 m deep.
    const cowl = recipe.form.windshieldBase * recipe.length;
    expect(spec.driverEye[2] + 0.57 + 0.16).toBeLessThanOrEqual(cowl + 0.02);
  });
});
