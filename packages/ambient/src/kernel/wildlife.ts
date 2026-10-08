/** Bounded, fixed-step ambient wildlife. No global randomness, timers, geography or renderer. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import { fnv1a, q4, unit01 } from './ids';
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

function suitable(
  species: WildlifeSpecies,
  habitat: WildlifeHabitat | undefined,
): habitat is WildlifeHabitat {
  return (
    habitat?.safe === true &&
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

/** Stable world-grid candidates. Adding an unrelated species does not reroll an existing one. */
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
  const found: Array<{ agent: WildlifeAgent; distance: number }> = [];
  for (
    let row = Math.floor((observer[2] - radius) / size);
    row <= Math.floor((observer[2] + radius) / size);
    row++
  ) {
    for (
      let column = Math.floor((observer[0] - radius) / size);
      column <= Math.floor((observer[0] + radius) / size);
      column++
    ) {
      // One host lookup per cell. Choices are rechecked at the species-specific point below.
      const choices = world.choices((column + 0.5) * size, (row + 0.5) * size);
      for (const choice of choices) {
        const species = choice.species;
        const id = `${species.id}@${species.version}/${column}/${row}`;
        const seed = fnv1a(id);
        if (unit01(seed, 0) >= Math.min(1, (choice.density * size * size) / 1_000_000) * density)
          continue;
        const x = q4((column + 0.15 + unit01(seed, 1) * 0.7) * size);
        const z = q4((row + 0.15 + unit01(seed, 2) * 0.7) * size);
        const distance = (x - observer[0]) ** 2 + (z - observer[2]) ** 2;
        if (distance > radius * radius) continue;
        const actual = world.choices(x, z).find((entry) => entry.species.id === species.id);
        if (
          actual === undefined ||
          unit01(seed, 0) >= Math.min(1, (actual.density * size * size) / 1_000_000) * density
        )
          continue;
        const habitat = world.habitat(x, z, species.margin);
        if (!suitable(species, habitat) || !actual.habitats.includes(habitat.kind)) continue;
        const y = heightFor(species, habitat);
        // Flying over mountains and viewing Earth from orbit must not activate distant fauna.
        if ((y - observer[1]) ** 2 + distance > radius * radius) continue;
        found.push({
          distance,
          agent: {
            id,
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
    }
  }
  return found
    .sort((a, b) => a.distance - b.distance || (a.agent.id < b.agent.id ? -1 : 1))
    .slice(0, limit)
    .map(({ agent }) => agent);
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
      !suitable(species, start) ||
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
          !suitable(species, habitat) ||
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
