import { fortTemiscamingueOutbuilding } from '../../../../../../../../packages/worldgen/scripts/fort-temiscamingue-outbuildings.mjs';

export const { model, skyline, district, street, closeup } = fortTemiscamingueOutbuilding(
  new URL('../plan-controls.json', import.meta.url),
);
