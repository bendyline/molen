/// <reference lib="webworker" />
import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
import { buildWorld, KernelHost } from '@bendyline/molen-kernel';
import { type MessageLink, validate } from '@bendyline/molen-schema';
import sceneDoc from '../scene.json';

// The Worker entry: the scene is pure data (figures, a hat, a rider, one script), so the only
// code here installs the figures capability and hosts the world.
const scene = validate('scene', sceneDoc);
if (!scene.ok) throw new Error(scene.formatted);

const world = buildWorld(scene.value, undefined, {
  capabilities: [(w) => ({ figures: figuresScriptApi(installFigures(w)) })],
});
new KernelHost(world, self as unknown as MessageLink, {
  keyframeInterval: scene.value.keyframeInterval,
});
