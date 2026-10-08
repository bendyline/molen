/** Wildlife follows the streamed habitat, with its own small population and animation budgets. */
import { WildlifeRenderer } from '@bendyline/molen-ambient/client';
import {
  stepWildlife,
  WILDLIFE_TICK_RATE,
  type WildlifeAgent,
  type WildlifeSpecies,
  type WildlifeWorld,
  wildlifeCandidates,
} from '@bendyline/molen-ambient/kernel';
import type { RegionalEnvironment } from '@bendyline/molen-worldgen-earth/kernel';
import type * as THREE from 'three';
import type { EarthAmbientBudget } from './ambient';
import type { SemanticTileObserver } from './ambient-tiles';
import { WildlifeHabitatTiles } from './wildlife-habitat';

export interface EarthWildlifeStats {
  animals: number;
  triangles: number;
  candidates: number;
}
export class EarthWildlife {
  readonly landcover: SemanticTileObserver;
  readonly features: SemanticTileObserver;
  private readonly habitat: WildlifeHabitatTiles;
  private readonly renderer: WildlifeRenderer;
  private readonly world: WildlifeWorld;
  private agents: WildlifeAgent[] = [];
  private tick = 0;
  private accumulator = 0;
  private lastSync = -Infinity;
  private habitatVersion = -1;
  private budget = { animals: 24, radius: 250, density: 0.65 };
  private enabled = true;
  private readonly local = new Map<string, ReturnType<WildlifeHabitatTiles['sample']>>();
  private readonly winter = new Map<string, WildlifeSpecies>();

  constructor(
    private readonly environment: RegionalEnvironment,
    parent: THREE.Object3D,
    prepare?: (object: THREE.Object3D) => void,
    seaLevel?: number,
  ) {
    this.habitat = new WildlifeHabitatTiles(parent, seaLevel);
    this.landcover = this.habitat.observer('landcover');
    this.features = this.habitat.observer('features');
    this.renderer = new WildlifeRenderer(prepare);
    parent.add(this.renderer.group);
    this.world = {
      choices: (x, z) => {
        const key = `${x},${z}`;
        let habitat = this.local.get(key);
        if (!this.local.has(key)) {
          habitat = this.habitat.sample(x, z, 0);
          this.local.set(key, habitat);
        }
        return habitat === undefined ? [] : environment.wildlife(x, z, habitat);
      },
      habitat: (x, z, margin) => this.habitat.sample(x, z, margin),
    };
  }

  setBudget(ambient: EarthAmbientBudget): void {
    const animals = Math.min(64, Math.max(4, Math.round(ambient.pedestrians * 0.5)));
    this.budget = {
      animals,
      radius: Math.min(450, ambient.activityRadius),
      density: Math.min(1, 0.3 + animals / 64),
    };
    this.renderer.setBudget({
      animals,
      radius: Math.min(300, this.budget.radius),
      posesPerFrame: Math.max(2, Math.floor(ambient.posesPerFrame / 2)),
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
    this.local.clear();
    this.habitat.sync(camera, this.budget.radius);
    if (
      this.habitat.version !== this.habitatVersion ||
      this.tick - this.lastSync >= WILDLIFE_TICK_RATE
    ) {
      const candidates = wildlifeCandidates(this.world, camera, this.budget, this.tick);
      const old = new Map(this.agents.map((agent) => [agent.id, agent]));
      this.agents = candidates.map((candidate) => old.get(candidate.id) ?? candidate);
      this.lastSync = this.tick;
      this.habitatVersion = this.habitat.version;
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
  /** Regional levels for the existing generic sound bank; these are not species recordings. */
  ambience(position: readonly [number, number, number]): { birds: number; insects: number } {
    const habitat = this.habitat.sample(position[0], position[2], 0);
    if (!this.enabled || habitat === undefined || !habitat.safe) return { birds: 0, insects: 0 };
    const choices = this.environment
      .wildlife(position[0], position[2], habitat)
      .filter((choice) => choice.habitats.includes(habitat.kind));
    return {
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
