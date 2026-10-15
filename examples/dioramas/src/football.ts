import type { DioramaDefinition } from '@bendyline/molen-dioramas/client';
import { inlineScriptSources } from '@bendyline/molen-kernel';
import { validate } from '@bendyline/molen-schema';
import bounds from '../../../content/dioramas/football/bounds.json';
import document from '../../../content/dioramas/football/scene.json';
import source from '../../../content/dioramas/football/scripts/high-school-football.ts?raw';

/** This entire module, including the script text, is a separate lazy chunk. */
export function football(): DioramaDefinition {
  const checked = validate('scene', document);
  if (!checked.ok) throw new Error(checked.formatted);
  return {
    scene: inlineScriptSources(checked.value, { 'scripts/high-school-football.ts': source }),
    bounds: {
      min: bounds.min as [number, number, number],
      max: bounds.max as [number, number, number],
    },
  };
}
