import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/testing.ts',
    'src/kinematics.ts',
    'src/scripting.ts',
    'src/character.ts',
    'src/terrain.ts',
    'src/platformer.ts',
    'src/determinism.ts',
    'src/content-entry.ts',
    'src/vehicles.ts',
    'src/glass.ts',
    'src/boats.ts',
    'src/aircraft.ts',
    'src/trials.ts',
    'src/world-entry.ts',
    'src/data.ts',
  ],
  format: 'esm',
  dts: true,
  clean: true,
});
