import { outbuildingModel } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-outbuilding-geometry.mjs';

const asset = outbuildingModel(import.meta.url, {
  barn: false,
  scale: 0.45,
  yaw: 2.75,
  camera: [25, 12, -24],
  lookAt: [0, 2.3, 0],
  brief:
    'Single-storey plastered servants’ house at Tytuvėnai Monastery, with a tile gable and molded chimney.',
  views: [
    {
      name: 'chimney-and-end-wall',
      position: [20, 12, -13],
      lookAt: [7, 3.8, 0],
    },
    {
      name: 'plaster-and-rectangular-openings',
      position: [-14, 7, -17],
      lookAt: [0, 2.1, 0],
    },
  ],
});
export const { model, skyline, district, street, closeup } = asset;
