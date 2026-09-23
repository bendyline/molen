import { type LoadedProject, loadProject } from '@bendyline/molen-kernel';
import type { SceneManifest } from '@bendyline/molen-schema';
import sceneDoc from '../scene.json';
import typesDoc from '../types/arena.types.json';

// The arena is DATA: scene.json declares the world, the `move` command, the input rules, and
// its scripts as file refs. loadProject validates all of it and inlines those scripts from the
// sources Vite hands over, so the browser, the tests and the CLI all build the same manifest.
const scripts = import.meta.glob('../scripts/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

let loaded: LoadedProject | undefined;
/** The validated scene (scripts inlined) and the flattened type registry. */
export function arenaProject(): LoadedProject {
  loaded ??= loadProject({ scene: sceneDoc, types: typesDoc, scripts });
  return loaded;
}

export function arenaScene(): SceneManifest {
  return arenaProject().scene;
}
