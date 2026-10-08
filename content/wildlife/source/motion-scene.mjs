/** Browser-only acceptance harness; exercises the actual wildlife skinning and movement APIs. */
import * as THREE from 'three';
import { WildlifeRenderer } from '../../../packages/ambient/dist/client.mjs';
import { stepWildlife } from '../../../packages/ambient/dist/kernel.mjs';
import {
  EARTH_EXPOSURE,
  EARTH_LIGHTING,
  EARTH_SKY_PALETTE,
  EARTH_TONE_MAPPING,
} from '../../../packages/earth/src/client/look.ts';
import catalog from '../regional.catalog.json';

const scene = new THREE.Scene();
scene.background = new THREE.Color(EARTH_SKY_PALETTE.dayZenith);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1000, 700);
if (EARTH_TONE_MAPPING !== 'neutral')
  throw new Error('Update the review tone mapping to match Earth');
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = EARTH_EXPOSURE;
renderer.shadowMap.enabled = true;
document.body.style.margin = '0';
document.body.append(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, EARTH_LIGHTING.dayAmbient));
const sun = new THREE.DirectionalLight(0xffffff, EARTH_LIGHTING.sunIntensity);
sun.position.set(-12, 20, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: '#7c8b65', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.015;
ground.receiveShadow = true;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(45, 1000 / 700, 0.01, 500);
const wildlife = new WildlifeRenderer();
scene.add(wildlife.group);
wildlife.setBudget({ animals: 8, posesPerFrame: 8, radius: 300 });
const species = new Map(catalog.animals.map((recipe) => [recipe.id, recipe]));

window.wildlifeReview = (name, ticks = 0, tier = 0, side = 1) => {
  const recipe = catalog.animals.find((animal) => animal.id.endsWith(`.${name}`));
  if (!recipe) throw new Error(`Unknown animal ${name}`);
  const water = recipe.motion === 'swim';
  ground.material.color.set(water ? '#397d98' : '#7c8b65');
  const habitat = { kind: water ? 'freshwater' : 'forest', height: 0, safe: true, water };
  const world = {
    choices: () => [{ species: recipe, density: 1, habitats: [habitat.kind] }],
    habitat: () => habitat,
  };
  let agents = [
    {
      id: 'review',
      species: recipe.id,
      seed: 473,
      anchor: [0, 0],
      position: [0, recipe.motion === 'fly' ? recipe.clearance : water ? -recipe.clearance : 0, 0],
      target: [0, 12],
      heading: 0,
      speed: recipe.speed,
      since: 0,
      nextDecision: 240,
      decisions: 0,
      phase: 0,
    },
  ];
  for (let tick = 1; tick <= ticks; tick++) agents = stepWildlife(agents, species, world, tick);
  const agent = agents[0];
  if (!agent) throw new Error('Review animal left its valid habitat');
  const span = Math.max(recipe.body.height * 1.3, recipe.body.length, recipe.body.width * 3);
  camera.position.set(
    agent.position[0] + side * span * 1.8,
    agent.position[1] + span * 0.85,
    agent.position[2] + span * 1.9,
  );
  camera.lookAt(agent.position[0], agent.position[1] + recipe.body.height * 0.5, agent.position[2]);
  // Keep the composition identical while selecting the actual renderer's distance LOD.
  const observer =
    tier === 0
      ? camera.position.toArray()
      : [agent.position[0] + (tier === 1 ? 50 : 120), agent.position[1], agent.position[2]];
  wildlife.update(agents, species, observer, ticks / 20);
  renderer.render(scene, camera);
  const matrices = [];
  wildlife.group.traverse((object) => {
    if (object.isSkinnedMesh) matrices.push(...object.skeleton.boneMatrices);
  });
  return {
    name,
    ticks,
    tier,
    animals: wildlife.count,
    triangles: wildlife.triangles,
    position: agent.position,
    phase: agent.phase,
    finitePose: matrices.every(Number.isFinite),
    matrices,
    calls: renderer.info.render.calls,
  };
};
