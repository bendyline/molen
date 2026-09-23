/// <reference lib="webworker" />
import { buildWorld, KernelHost } from '@bendyline/molen-kernel';
import { type MessageLink, validate } from '@bendyline/molen-schema';
import sceneDoc from '../scene.json';
import { setup } from './viz';

const scene = validate('scene', sceneDoc);
if (!scene.ok) throw new Error(scene.formatted);

new KernelHost(buildWorld(scene.value, setup), self as unknown as MessageLink, {
  keyframeInterval: scene.value.keyframeInterval,
});
