import {
  FIGURE_PRESET_IDS,
  type FigureArchetype,
  type FigurePresetId,
  type ResolvedFigureDescriptor,
  resolveFigureDescriptor,
} from '@bendyline/molen-figures/kernel';

// The preset catalog, for agents: which figure presets exist and what each one resolves to.

export interface FigurePresetsInput {
  archetype?: FigureArchetype;
}

export interface FigurePresetEntry {
  id: FigurePresetId;
  archetype: FigureArchetype;
  species: string;
  /** Standing height in meters (bipeds: head top; quadrupeds: withers). */
  height: number;
  descriptor: ResolvedFigureDescriptor;
}

export interface FigurePresetsOutput {
  ok: boolean;
  presets: FigurePresetEntry[];
}

/** List the shipped figure presets with their resolved descriptors. */
export function listFigurePresets(input: FigurePresetsInput = {}): FigurePresetsOutput {
  const presets: FigurePresetEntry[] = [];
  for (const id of FIGURE_PRESET_IDS) {
    const descriptor = resolveFigureDescriptor({ preset: id });
    if (input.archetype !== undefined && descriptor.archetype !== input.archetype) continue;
    presets.push({
      id,
      archetype: descriptor.archetype,
      species: descriptor.species,
      height: descriptor.height,
      descriptor,
    });
  }
  return { ok: true, presets };
}
