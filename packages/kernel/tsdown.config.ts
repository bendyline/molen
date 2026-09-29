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
    'src/aircraft.ts',
    'src/world-entry.ts',
  ],
  format: 'esm',
  dts: true,
  clean: true,
});
