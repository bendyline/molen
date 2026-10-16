import * as THREE from 'three';
import type { WildlifeAgent } from '../kernel/wildlife';
import type { WildlifeSpecies } from '../kernel/wildlife-types';
import { type WildlifeGeometry, type WildlifeTier, wildlifeGeometry } from './wildlife-geometry';

interface ActiveAnimal {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  geometry: WildlifeGeometry;
  key: string;
  seen: number;
}
export interface WildlifeRenderBudget {
  animals: number;
  radius: number;
  posesPerFrame: number;
}

/** One opaque skinned draw per visible animal. Geometry is shared and released on disposal. */
export class WildlifeRenderer {
  readonly group: THREE.Group = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  });
  private readonly cache = new Map<string, WildlifeGeometry>();
  private readonly active = new Map<string, ActiveAnimal>();
  private frame = 0;
  private cursor = 0;
  private budget: WildlifeRenderBudget = { animals: 32, radius: 180, posesPerFrame: 16 };

  constructor(private readonly prepare?: (object: THREE.Object3D) => void) {
    this.group.name = 'ambient:wildlife';
  }
  setBudget(budget: Partial<WildlifeRenderBudget>): void {
    this.budget = { ...this.budget, ...budget };
  }
  get count(): number {
    return this.active.size;
  }
  get triangles(): number {
    let count = 0;
    for (const animal of this.active.values()) count += animal.geometry.triangles;
    return count;
  }

  private remove(id: string, animal: ActiveAnimal): void {
    animal.mesh.skeleton.dispose();
    animal.root.removeFromParent();
    this.active.delete(id);
  }

  update(
    agents: readonly WildlifeAgent[],
    species: ReadonlyMap<string, WildlifeSpecies>,
    camera: readonly [number, number, number],
    seconds: number,
    appearance?: (agent: WildlifeAgent, recipe: WildlifeSpecies) => WildlifeSpecies,
  ): void {
    this.frame++;
    const visible = agents
      .map((agent) => ({
        agent,
        distance: Math.hypot(
          agent.position[0] - camera[0],
          agent.position[1] - camera[1],
          agent.position[2] - camera[2],
        ),
      }))
      .filter(({ distance }) => distance < this.budget.radius)
      .sort((a, b) => a.distance - b.distance || (a.agent.id < b.agent.id ? -1 : 1))
      .slice(0, this.budget.animals);
    const pose: Array<{ animal: ActiveAnimal; agent: WildlifeAgent; species: WildlifeSpecies }> =
      [];
    for (const { agent, distance } of visible) {
      const base = species.get(agent.species);
      const recipe = base === undefined ? undefined : (appearance?.(agent, base) ?? base);
      if (
        recipe === undefined ||
        (recipe.body.family === 'insect' && distance > 10) ||
        (recipe.body.height < 0.1 && distance > 25)
      )
        continue;
      const tier: WildlifeTier = distance < 35 ? 0 : distance < 100 ? 1 : 2;
      const key = `${recipe.id}@${recipe.version}/${recipe.body.color}/${tier}`;
      let animal = this.active.get(agent.id);
      if (animal?.key !== key) {
        if (animal !== undefined) this.remove(agent.id, animal);
        let geometry = this.cache.get(key);
        if (geometry === undefined) {
          geometry = wildlifeGeometry(recipe, tier);
          this.cache.set(key, geometry);
        }
        const mesh = new THREE.SkinnedMesh(geometry.geometry, this.material);
        const bones = geometry.joints.map((joint) => {
          const bone = new THREE.Bone();
          bone.name = joint.name;
          bone.position.set(...joint.pivot);
          mesh.add(bone);
          return bone;
        });
        mesh.bind(new THREE.Skeleton(bones));
        mesh.castShadow = tier === 0;
        mesh.receiveShadow = true;
        const root = new THREE.Group();
        root.add(mesh);
        root.userData.walkIgnore = true;
        root.traverse((object) => {
          object.userData.walkIgnore = true;
        });
        this.group.add(root);
        this.prepare?.(root);
        animal = { root, mesh, bones, geometry, key, seen: this.frame };
        this.active.set(agent.id, animal);
      }
      animal.seen = this.frame;
      animal.root.position.set(...agent.position);
      animal.root.rotation.y = agent.heading;
      pose.push({ animal, agent, species: recipe });
    }
    for (const [id, animal] of this.active) if (animal.seen !== this.frame) this.remove(id, animal);
    const count = Math.min(pose.length, this.budget.posesPerFrame);
    // Half of the pose budget stays on the nearest animals, the rest visits the entire set.
    const near = Math.ceil(count / 2),
      remaining = pose.length - near;
    for (let i = 0; i < count; i++) {
      const entry = pose[i < near ? i : near + ((this.cursor + i - near) % remaining)];
      if (entry === undefined) continue;
      const { animal, agent, species: recipe } = entry;
      const gait = agent.phase * Math.PI * 2;
      const flying = recipe.motion === 'fly';
      const flapping = Math.sin(
        seconds * (recipe.body.family === 'insect' ? 45 : 6 / Math.max(0.3, recipe.body.length)) +
          (agent.seed % 100),
      );
      animal.root.position.y =
        agent.position[1] +
        (recipe.motion === 'hop' && agent.speed > 0.01
          ? Math.abs(Math.sin(gait)) * recipe.body.height * 0.12
          : 0);
      for (let index = 0; index < animal.bones.length; index++) {
        const bone = animal.bones[index];
        if (bone === undefined) continue;
        const name = animal.geometry.joints[index]?.name ?? '';
        bone.rotation.set(0, 0, 0);
        if (name.startsWith('leg.') && agent.speed > 0.01) {
          const reverse = name.includes('rear') !== name.endsWith('.r');
          bone.rotation.x =
            Math.sin(gait + (recipe.motion === 'hop' ? 0 : reverse ? Math.PI : 0)) *
            (recipe.motion === 'hop' ? 0.22 : 0.27);
        } else if (name.startsWith('wing.') && flying)
          bone.rotation.z = flapping * (name.endsWith('.l') ? -0.55 : 0.55);
        else if (name === 'tail')
          bone.rotation.y = Math.sin(recipe.motion === 'swim' ? seconds * 5 : gait) * 0.15;
        else if (name === 'head' && agent.speed < 0.01)
          bone.rotation.x = Math.sin(seconds * 0.4 + (agent.seed % 30)) * 0.08;
        else if (name === 'trunk') bone.rotation.x = Math.sin(seconds * 0.7) * 0.06;
      }
    }
    if (remaining > 0) this.cursor = (this.cursor + count - near) % remaining;
    // Bound recipe cache under pack changes and geographic travel; retain only active geometries.
    if (this.cache.size > 96) {
      const used = new Set([...this.active.values()].map((animal) => animal.key));
      for (const [key, geometry] of this.cache)
        if (!used.has(key)) {
          geometry.geometry.dispose();
          this.cache.delete(key);
        }
    }
  }

  dispose(): void {
    for (const [id, animal] of this.active) this.remove(id, animal);
    for (const geometry of this.cache.values()) geometry.geometry.dispose();
    this.cache.clear();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
