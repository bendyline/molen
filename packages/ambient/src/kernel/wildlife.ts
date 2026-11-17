/** Bounded, fixed-step ambient wildlife. No global randomness, timers, geography or renderer. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import { q4, unit01 } from './ids';
import type { WildlifeChoice, WildlifeHabitat, WildlifeSpecies } from './wildlife-types';

export const WILDLIFE_TICK_RATE = 20;
export const WILDLIFE_CELL_METERS = 96;

export interface WildlifeAgent {
  id: string;
  species: string;
  seed: number;
  anchor: [number, number];
  position: [number, number, number];
  target: [number, number];
  heading: number;
  speed: number;
  since: number;
  nextDecision: number;
  decisions: number;
  phase: number;
}

export interface WildlifeWorld {
  choices(x: number, z: number): readonly WildlifeChoice[];
  habitat(x: number, z: number, margin: number): WildlifeHabitat | undefined;
}

export interface WildlifeBudget {
  animals: number;
  radius: number;
  /** 0..1 stable thinning. Changing quality keeps existing candidate identities. */
  density: number;
}

/**
 * Whether the animal may be at this point. Spawn anchors need safe ground. An animal already
 * `moving` may also be over a road if it flies (`overflight`): flight has no building heights to
 * clear, so buildings stay closed to it, but a street between two gardens does not.
 */
function suitable(
  species: WildlifeSpecies,
  habitat: WildlifeHabitat | undefined,
  moving = false,
): habitat is WildlifeHabitat {
  return (
    habitat !== undefined &&
    (habitat.safe === true ||
      (moving && species.motion === 'fly' && habitat.overflight === true)) &&
    Number.isFinite(habitat.height) &&
    (species.motion === 'fly' || (species.motion === 'swim' ? habitat.water : !habitat.water))
  );
}

function heightFor(species: WildlifeSpecies, habitat: WildlifeHabitat): number {
  return (
    habitat.height +
    (species.motion === 'fly'
      ? species.clearance
      : species.motion === 'swim'
        ? -species.clearance
        : 0)
  );
}

/** FNV-1a's offset basis: `fnvAppend` from it over a whole string is `fnv1a` of that string. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a (see `fnv1a`) continued from `state` over `text`, so a shared prefix is hashed once. */
function fnvAppend(state: number, text: string): number {
  let h = state;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h;
}

interface Found {
  agent: WildlifeAgent;
  distance: number;
}
const nearer = (a: Found, b: Found): number =>
  a.distance - b.distance || (a.agent.id < b.agent.id ? -1 : 1);

/**
 * Stable world-grid candidates, the nearest `budget.animals` of them. Adding an unrelated species
 * does not reroll an existing one.
 *
 * Cells are read nearest first and the read stops once the cap is full of animals nearer than
 * any cell left: where animals are many (a town's gardens) a few cells fill it, and reading
 * every cell within the radius cost the same however near the animals stood. The answer is the
 * one a read of every cell gives.
 */
export function wildlifeCandidates(
  world: WildlifeWorld,
  observer: readonly [number, number, number],
  budget: WildlifeBudget,
  tick = 0,
): WildlifeAgent[] {
  const radius = Math.max(0, Math.min(2000, budget.radius));
  const density = dmath.clamp(budget.density, 0, 1);
  const limit = Math.max(0, Math.min(256, Math.floor(budget.animals)));
  if (limit === 0 || density === 0 || !observer.every(Number.isFinite)) return [];
  const size = WILDLIFE_CELL_METERS;
  // Each cell with the least squared distance any of its points can have from the observer.
  const cells: Array<{ column: number; row: number; near: number }> = [];
  for (
    let row = Math.floor((observer[2] - radius) / size);
    row <= Math.floor((observer[2] + radius) / size);
    row++
  ) {
    const dz = Math.max(row * size - observer[2], 0, observer[2] - (row + 1) * size);
    for (
      let column = Math.floor((observer[0] - radius) / size);
      column <= Math.floor((observer[0] + radius) / size);
      column++
    ) {
      const dx = Math.max(column * size - observer[0], 0, observer[0] - (column + 1) * size);
      cells.push({ column, row, near: dx * dx + dz * dz });
    }
  }
  cells.sort((a, b) => a.near - b.near || a.row - b.row || a.column - b.column);
  // An agent's seed is the hash of its id, `${species.id}@${species.version}/${column}/${row}`:
  // the part before the cell is hashed once a species, and the id written only for an agent.
  const prefixes = new Map<WildlifeSpecies, number>();
  const found: Found[] = [];
  // No cell farther than this can hold an animal that belongs in the answer.
  let reach = radius * radius;
  for (const { column, row, near } of cells) {
    if (near > reach) break;
    const had = found.length;
    const cell = `${column}/${row}`;
    // One host lookup per cell. Choices are rechecked at the species-specific point below.
    const choices = world.choices((column + 0.5) * size, (row + 0.5) * size);
    for (const choice of choices) {
      const species = choice.species;
      let prefix = prefixes.get(species);
      if (prefix === undefined) {
        prefix = fnvAppend(FNV_OFFSET, `${species.id}@${species.version}/`);
        prefixes.set(species, prefix);
      }
      const seed = fnvAppend(prefix, cell) >>> 0;
      if (unit01(seed, 0) >= Math.min(1, (choice.density * size * size) / 1_000_000) * density)
        continue;
      const x = q4((column + 0.15 + unit01(seed, 1) * 0.7) * size);
      const z = q4((row + 0.15 + unit01(seed, 2) * 0.7) * size);
      const distance = (x - observer[0]) ** 2 + (z - observer[2]) ** 2;
      if (distance > radius * radius) continue;
      // The ground first: most points in a town are a road's or a building's, and those need
      // no second lookup.
      const habitat = world.habitat(x, z, species.margin);
      if (!suitable(species, habitat)) continue;
      const y = heightFor(species, habitat);
      // Flying over mountains and viewing Earth from orbit must not activate distant fauna.
      if ((y - observer[1]) ** 2 + distance > radius * radius) continue;
      const actual = world.choices(x, z).find((entry) => entry.species.id === species.id);
      if (
        actual === undefined ||
        unit01(seed, 0) >= Math.min(1, (actual.density * size * size) / 1_000_000) * density ||
        !actual.habitats.includes(habitat.kind)
      )
        continue;
      found.push({
        distance,
        agent: {
          id: `${species.id}@${species.version}/${cell}`,
          species: species.id,
          seed,
          anchor: [x, z],
          position: [x, q4(y), z],
          target: [x, z],
          heading: unit01(seed, 3) * dmath.PI * 2,
          speed: 0,
          since: tick,
          nextDecision: tick,
          decisions: 0,
          phase: unit01(seed, 4),
        },
      });
    }
    if (found.length >= limit && found.length > had) {
      found.sort(nearer);
      found.length = limit;
      reach = Math.min(reach, (found[limit - 1] as Found).distance);
    }
  }
  return found.sort(nearer).map(({ agent }) => agent);
}

/** Advance one 1/20-second step. A host can snapshot these plain records without hidden state. */
export function stepWildlife(
  agents: readonly WildlifeAgent[],
  speciesById: ReadonlyMap<string, WildlifeSpecies>,
  world: WildlifeWorld,
  tick: number,
): WildlifeAgent[] {
  const next: WildlifeAgent[] = [];
  for (const previous of agents) {
    const species = speciesById.get(previous.species);
    if (species === undefined) continue;
    const start = world.habitat(previous.position[0], previous.position[2], species.margin);
    const choices = world.choices(previous.position[0], previous.position[2]);
    const currentChoice = choices.find((choice) => choice.species.id === species.id);
    if (
      !suitable(species, start, true) ||
      currentChoice === undefined ||
      !currentChoice.habitats.includes(start.kind)
    )
      continue;
    const agent = {
      ...previous,
      position: [...previous.position] as [number, number, number],
      target: [...previous.target] as [number, number],
    };
    if (tick >= agent.nextDecision) {
      const stream = 10 + agent.decisions++ * 4;
      const angle = unit01(agent.seed, stream) * dmath.PI * 2;
      const radius = species.roam * dmath.sqrt(unit01(agent.seed, stream + 1));
      const resting =
        species.motion !== 'fly' &&
        species.motion !== 'swim' &&
        unit01(agent.seed, stream + 2) < species.rest;
      agent.target = resting
        ? [agent.position[0], agent.position[2]]
        : [
            q4(agent.anchor[0] + dmath.cos(angle) * radius),
            q4(agent.anchor[1] + dmath.sin(angle) * radius),
          ];
      agent.nextDecision =
        tick + Math.floor((4 + unit01(agent.seed, stream + 3) * 8) * WILDLIFE_TICK_RATE);
      agent.since = tick;
    }
    const dx = agent.target[0] - agent.position[0];
    const dz = agent.target[1] - agent.position[2];
    const distance = dmath.sqrt(dx * dx + dz * dz);
    const travel = Math.min(distance, species.speed / WILDLIFE_TICK_RATE);
    agent.speed = 0;
    if (distance > 0.01) {
      const x = q4(agent.position[0] + (dx / distance) * travel);
      const z = q4(agent.position[2] + (dz / distance) * travel);
      // Substeps prevent small animals and fast flight from tunnelling through a narrow exclusion.
      const steps = Math.max(1, Math.ceil(travel / Math.max(0.1, species.margin)));
      let destination: WildlifeHabitat | undefined;
      for (let i = 1; i <= steps; i++) {
        const sx = agent.position[0] + ((x - agent.position[0]) * i) / steps;
        const sz = agent.position[2] + ((z - agent.position[2]) * i) / steps;
        const habitat = world.habitat(sx, sz, species.margin);
        const choice = world.choices(sx, sz).find((entry) => entry.species.id === species.id);
        if (
          !suitable(species, habitat, true) ||
          choice === undefined ||
          !choice.habitats.includes(habitat.kind)
        ) {
          destination = undefined;
          break;
        }
        destination = habitat;
      }
      if (destination !== undefined) {
        agent.position = [x, q4(heightFor(species, destination)), z];
        agent.heading = dmath.atan2(dx, dz);
        agent.speed = q4(travel * WILDLIFE_TICK_RATE);
        agent.phase = q4((agent.phase + travel / Math.max(0.1, species.body.length)) % 1);
      } else agent.nextDecision = tick + 1;
    } else if (species.motion === 'fly' || species.motion === 'swim') agent.nextDecision = tick + 1;
    next.push(agent);
  }
  return next;
}
