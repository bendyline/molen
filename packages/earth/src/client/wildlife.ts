/** Wildlife follows the streamed habitat, with its own small population and animation budgets. */
import { WildlifeRenderer } from '@bendyline/molen-ambient/client';
import {
  stepWildlife,
  WILDLIFE_TICK_RATE,
  type WildlifeAgent,
  type WildlifeChoice,
  type WildlifeSpecies,
  type WildlifeWorld,
  wildlifeCandidates,
} from '@bendyline/molen-ambient/kernel';
import type { RegionalEnvironment } from '@bendyline/molen-worldgen-earth/kernel';
import type * as THREE from 'three';
import type { EarthAmbientBudget } from './ambient';
import type { SemanticTileObserver } from './ambient-tiles';
import { WildlifeHabitatTiles, type WildlifeLocalHabitat } from './wildlife-habitat';

export interface EarthWildlifeStats {
  animals: number;
  triangles: number;
  candidates: number;
}
/** Animals drawn when a budget names no count: the Balanced tier's. */
const DEFAULT_ANIMALS = 16;
export class EarthWildlife {
  readonly landcover: SemanticTileObserver;
  readonly features: SemanticTileObserver;
  private readonly habitat: WildlifeHabitatTiles;
  private readonly renderer: WildlifeRenderer;
  /** The streamed habitat, sampled afresh: animals move every step. */
  private readonly world: WildlifeWorld;
  /** The same, its fixed candidate points' samples and choices kept (see `local`). */
  private readonly grid: WildlifeWorld;
  private agents: WildlifeAgent[] = [];
  private tick = 0;
  private accumulator = 0;
  private lastSync = -Infinity;
  private habitatVersion = -1;
  private habitatLost = 0;
  private budget = { animals: 24, radius: 250, density: 1 };
  private enabled = true;
  // Species choices by candidate point, for the habitat sample they were read from: a resample
  // asks about every cell within reach, and sampling each again cost it 5 ms. A kept sample is
  // the same object until a tile under the point changes (see WildlifeHabitatTiles.sample).
  private readonly local = new Map<
    string,
    { habitat: WildlifeLocalHabitat; choices: readonly WildlifeChoice[] }
  >();
  private readonly winter = new Map<string, WildlifeSpecies>();
  // The point either world's `habitat` last sampled, and that sample. The kernel asks for a
  // point's habitat and then its choices, which read only the water distance and protection, the
  // same at any margin: sampling the point a second time for them was half an animal's step.
  // Forgotten whenever the tiles may have changed (see update).
  private lastX = Number.NaN;
  private lastZ = Number.NaN;
  private lastHabitat: WildlifeLocalHabitat | undefined;

  constructor(
    private readonly environment: RegionalEnvironment,
    parent: THREE.Object3D,
    prepare?: (object: THREE.Object3D) => unknown,
    seaLevel?: number,
  ) {
    this.habitat = new WildlifeHabitatTiles(parent, seaLevel);
    this.landcover = this.habitat.observer('landcover');
    this.features = this.habitat.observer('features');
    this.renderer = new WildlifeRenderer(prepare);
    parent.add(this.renderer.group);
    this.world = {
      choices: (x, z) => {
        const habitat = this.context(x, z, false);
        return habitat === undefined ? [] : environment.wildlife(x, z, habitat);
      },
      habitat: (x, z, margin) => this.sampled(x, z, this.habitat.sample(x, z, margin)),
    };
    this.grid = {
      choices: (x, z) => {
        const habitat = this.context(x, z, true);
        if (habitat === undefined) return [];
        const key = `${x},${z}`;
        const known = this.local.get(key);
        if (known?.habitat === habitat) return known.choices;
        if (this.local.size > 16_384) this.local.clear();
        const choices = environment.wildlife(x, z, habitat);
        this.local.set(key, { habitat, choices });
        return choices;
      },
      habitat: (x, z, margin) => this.sampled(x, z, this.habitat.sample(x, z, margin, true)),
    };
  }

  private sampled(
    x: number,
    z: number,
    habitat: WildlifeLocalHabitat | undefined,
  ): WildlifeLocalHabitat | undefined {
    this.lastX = x;
    this.lastZ = z;
    this.lastHabitat = habitat;
    return habitat;
  }
  /** The habitat a point's species choices are read against (its water distance, protection). */
  private context(x: number, z: number, keep: boolean): WildlifeLocalHabitat | undefined {
    return x === this.lastX && z === this.lastZ
      ? this.lastHabitat
      : this.habitat.sample(x, z, 0, keep);
  }

  setBudget(ambient: EarthAmbientBudget): void {
    // The tier's own count (see performance.ts), not a share of its pedestrians: that cap was cut
    // to a third for the streets' sake and left 4 to 7 animals.
    const wanted = ambient.animals ?? DEFAULT_ANIMALS;
    const animals = Number.isFinite(wanted) ? Math.min(64, Math.max(0, Math.round(wanted))) : 0;
    this.budget = {
      animals,
      radius: Math.min(450, ambient.activityRadius),
      // No thinning: the cap already takes the nearest animals, and thinning the candidates only
      // stood the same number farther from the viewer (at 0.55, seven Seattle and Bellevue
      // blocks' 16 animals reached out 160-310 m rather than 120-170 m).
      density: 1,
    };
    this.renderer.setBudget({
      animals,
      radius: Math.min(300, this.budget.radius),
      // Half the figures' poses, and never fewer than half the animals: the nearest half of a
      // frame's poses are the nearest animals, the rest take turns.
      posesPerFrame: Math.max(Math.ceil(animals / 2), Math.floor(ambient.posesPerFrame / 2)),
    });
    this.lastSync = -Infinity;
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.agents = [];
    this.renderer.group.visible = enabled;
    this.lastSync = -Infinity;
  }

  update(dt: number, camera: readonly [number, number, number]): void {
    if (!this.enabled) return;
    this.habitat.sync(camera, this.budget.radius);
    this.lastX = Number.NaN;
    // Habitat changes resample sooner than the once-a-second refresh: at once when animals may
    // stand on lost habitat or there are none yet, else within half a second. The visible tiles
    // change most frames while the view turns, and a resample walks up to ~90 cells (all of them
    // where the cap is not filled: over built-up ground, or from the air).
    const since = this.tick - this.lastSync;
    const changed = this.habitat.version !== this.habitatVersion;
    if (
      (changed &&
        (this.habitat.lostVersion !== this.habitatLost ||
          this.agents.length === 0 ||
          since >= WILDLIFE_TICK_RATE / 2)) ||
      since >= WILDLIFE_TICK_RATE
    ) {
      const candidates = wildlifeCandidates(this.grid, camera, this.budget, this.tick);
      const old = new Map(this.agents.map((agent) => [agent.id, agent]));
      this.agents = candidates.map((candidate) => old.get(candidate.id) ?? candidate);
      this.lastSync = this.tick;
      this.habitatVersion = this.habitat.version;
      this.habitatLost = this.habitat.lostVersion;
    }
    this.accumulator += Math.max(0, Math.min(0.2, Number.isFinite(dt) ? dt : 0));
    const step = 1 / WILDLIFE_TICK_RATE;
    while (this.accumulator >= step) {
      this.agents = stepWildlife(
        this.agents,
        this.environment.library.animals,
        this.world,
        this.tick++,
      );
      this.accumulator -= step;
    }
    this.renderer.update(
      this.agents,
      this.environment.library.animals,
      camera,
      this.tick / WILDLIFE_TICK_RATE,
      (agent, recipe) => {
        if (
          recipe.winterColor === undefined ||
          this.environment.seasonAt(agent.position[2]) !== 'winter'
        )
          return recipe;
        let variant = this.winter.get(recipe.id);
        if (variant === undefined) {
          variant = { ...recipe, body: { ...recipe.body, color: recipe.winterColor } };
          this.winter.set(recipe.id, variant);
        }
        return variant;
      },
    );
  }
  /** Observed habitat and regional levels for the sound bank's curated recordings. */
  ambience(position: readonly [number, number, number]): {
    birds: number;
    insects: number;
    habitat?: string;
  } {
    const habitat = this.habitat.sample(position[0], position[2], 0);
    // A listener on a street or a path still hears the habitat it runs through (`overflight`);
    // inside a building's or a built-up area's buffer, or on unknown ground, there is none.
    if (!this.enabled || habitat === undefined || !(habitat.safe || habitat.overflight))
      return { birds: 0, insects: 0 };
    const choices = this.environment
      .wildlife(position[0], position[2], habitat)
      .filter((choice) => choice.habitats.includes(habitat.kind));
    return {
      habitat: habitat.kind,
      birds: choices.some((choice) => choice.species.body.family === 'bird') ? 1 : 0,
      insects: choices.some((choice) => choice.species.body.family === 'insect') ? 1 : 0,
    };
  }
  stats(): EarthWildlifeStats {
    return {
      animals: this.renderer.count,
      triangles: this.renderer.triangles,
      candidates: this.agents.length,
    };
  }
  dispose(): void {
    this.agents = [];
    this.habitat.clear();
    this.renderer.dispose();
    this.local.clear();
    this.winter.clear();
  }
}
