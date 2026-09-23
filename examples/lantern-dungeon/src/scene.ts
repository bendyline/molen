import { loadProject } from '@bendyline/molen-kernel';
import type { SceneManifest } from '@bendyline/molen-schema';
import document from '../scene.json';

// loadProject validates the document and inlines each script's source, matching the sources a
// bundler hands over to the `path` the scene declares — the browser and the tests end up with
// the identical manifest the CLI builds by reading those files from disk.
const scripts = import.meta.glob('../scripts/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Browser and tests load the same scene + scripts that the CLI reads from disk. */
export function scene(): SceneManifest {
  return loadProject({ scene: document, scripts }).scene;
}
