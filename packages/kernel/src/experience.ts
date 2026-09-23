import type { CommandHandler, CommandTypeDef } from './commands';
import type { WorldSetup } from './scene';
import type { Phase, System, World } from './world';

// The typed authoring entry: declare commands and systems as data instead of writing an
// imperative setup body. Composes into a plain WorldSetup, so every consumer of setup functions
// (buildWorld, the tooling setup loader, workers) accepts an Experience unchanged.

export interface ExperienceDef {
  /** Imperative escape hatch; runs after commands/systems are registered. */
  setup?: WorldSetup;
  /** Command type -> handler (or handler + payload validator). */
  commands?: Record<string, CommandHandler<World> | CommandTypeDef<World>>;
  systems?: { fn: System; phase?: Phase; name?: string }[];
}

export interface Experience {
  readonly kind: 'molen-experience';
  readonly setup: WorldSetup;
}

/** Is a value an Experience (vs a bare WorldSetup function)? */
export function isExperience(value: unknown): value is Experience {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as { kind?: unknown }).kind === 'molen-experience' &&
    typeof (value as { setup?: unknown }).setup === 'function'
  );
}

/**
 * Define an experience: commands + systems + an optional imperative setup, composed into one
 * WorldSetup. `buildWorld(manifest, experience.setup)` — or hand the whole object to tooling,
 * whose setup loader accepts either form.
 */
export function defineExperience(def: ExperienceDef): Experience {
  const setup: WorldSetup = (world, manifest) => {
    for (const [type, entry] of Object.entries(def.commands ?? {})) {
      if (typeof entry === 'function') {
        world.registerCommand(type, entry);
      } else {
        world.registerCommand(type, entry.handler, {
          ...(entry.validatePayload !== undefined
            ? { validatePayload: entry.validatePayload }
            : {}),
        });
      }
    }
    for (const s of def.systems ?? []) {
      world.addSystem(s.fn, {
        ...(s.phase !== undefined ? { phase: s.phase } : {}),
        ...(s.name !== undefined ? { name: s.name } : {}),
      });
    }
    def.setup?.(world, manifest);
  };
  return { kind: 'molen-experience', setup };
}
