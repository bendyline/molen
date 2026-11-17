import { outbuildingModel } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-outbuilding-geometry.mjs';

const asset = outbuildingModel(import.meta.url, {
  barn: true,
  scale: 0.62,
  yaw: 2.75,
  camera: [32, 15, -25],
  lookAt: [0, 2.8, 0],
  brief:
    'The eastern livestock barn at Tytuvėnai, with a plain gable roof, fieldstone base and a partly exposed lower level.',
  views: [
    {
      name: 'rising-ground-and-lower-level',
      position: [20, 10, -20],
      lookAt: [2, 2, 0],
    },
    {
      name: 'gable-and-recessed-doors',
      position: [-26, 9, -16],
      lookAt: [-7, 2.6, 0],
    },
  ],
});
export const { model, skyline, district, street, closeup } = asset;
