import { outbuildingModel } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-outbuilding-geometry.mjs';
const asset = outbuildingModel(import.meta.url, {
  barn: true,
  scale: 0.62,
  yaw: 2.75,
  camera: [-40, 18, -30],
  lookAt: [0, 3, 0],
  brief:
    'The historic northern livestock barn at Tytuvėnai, with a long gable roof, brick and masonry walls and prominent arched entrances.',
  views: [
    {
      name: 'long-north-exterior-and-arched-doors',
      position: [-18, 8, -32],
      lookAt: [0, 2, 0],
    },
    {
      name: 'gable-and-service-masonry',
      position: [-31, 14, 19],
      lookAt: [-15, 3.4, 0],
    },
  ],
});
export const { model, skyline, district, street, closeup } = asset;
