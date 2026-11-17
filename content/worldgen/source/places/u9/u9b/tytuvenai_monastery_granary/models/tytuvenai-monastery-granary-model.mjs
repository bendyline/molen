import { outbuildingModel } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-outbuilding-geometry.mjs';

const asset = outbuildingModel(import.meta.url, {
  barn: false,
  scale: 0.45,
  yaw: 2.75,
  camera: [-24, 14, -27],
  lookAt: [0, 3.2, 0],
  brief:
    'Two-storey Tytuvėnai Monastery granary, with a half-hipped tile roof, round gable openings and arched west doorway.',
  views: [
    {
      name: 'west-entry-and-plastered-gable',
      position: [-21, 6.5, -14],
      lookAt: [-7, 3.9, 0],
    },
    {
      name: 'half-hips-and-round-openings',
      position: [18, 17, -19],
      lookAt: [2, 6.4, 0],
    },
  ],
});
export const { model, skyline, district, street, closeup } = asset;
