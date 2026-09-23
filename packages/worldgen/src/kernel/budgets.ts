import type { WorldgenBudgets } from './types';

/** Generic per-batch caps; world bindings scale these by quality and detail level. */
export const DEFAULT_WORLDGEN_BUDGETS: WorldgenBudgets = Object.freeze({
  maxBuildings: 500,
  maxBuildingVertices: 90_000,
  detailedCount: 600,
  maxInstancesPerRule: 4000,
  maxInstances: 8000,
  maxPropModels: 4,
  maxMaterialGroups: 10,
});

export function normalizeBudgets(partial: Partial<WorldgenBudgets> | undefined): WorldgenBudgets {
  const merged: WorldgenBudgets = { ...DEFAULT_WORLDGEN_BUDGETS, ...partial };
  for (const [key, value] of Object.entries(merged)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`worldgen budget ${key} must be a non-negative finite number`);
    }
  }
  return merged;
}
