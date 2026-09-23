/// <reference lib="webworker" />
import { buildWorld, KernelHost } from '@bendyline/molen-kernel';
import { type MessageLink, validate } from '@bendyline/molen-schema';
import sceneDoc from '../scene.json';
import { setup } from './cubes';

// The Worker entry: build the world (scene entities + cubes systems/commands) and host it,
// wiring the kernel protocol to the worker's own message port.
const scene = validate('scene', sceneDoc);
if (!scene.ok) throw new Error(scene.formatted);

const world = buildWorld(scene.value, setup);
new KernelHost(world, self as unknown as MessageLink, {
  keyframeInterval: scene.value.keyframeInterval,
});
