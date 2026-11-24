import { defineConfig, mergeConfig } from 'vitest/config';
import unit from './vitest.config';

// The landmark LOD suites regenerate detail levels of real landmarks and are nearly all of this
// package's test time, so they run as their own task (test:lods), with the unit suites' limits. To
// run one file while authoring: `pnpm --filter @bendyline/molen-tooling test:lods <name>`.
export default mergeConfig(unit, defineConfig({ test: { include: ['test/**/*-lods.test.mjs'] } }));
