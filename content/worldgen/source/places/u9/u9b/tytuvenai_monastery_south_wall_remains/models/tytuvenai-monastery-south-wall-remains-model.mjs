import { perimeterModel } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-perimeter-geometry.mjs';

const asset = perimeterModel(import.meta.url, {
  standing: false,
  scale: 0.29,
  yaw: 2.7,
  camera: [8, 5, -12],
  lookAt: [0, 0.55, 0],
  brief: 'Surviving fragments of a brick enclosure wall and wicket by the Tytuvėnai granary.',
  views: [
    {
      name: 'broken-brick-crown-and-wicket',
      position: [-9, 3, -9],
      lookAt: [0, 0.7, 0],
    },
    {
      name: 'stone-base-and-remnant-niche',
      position: [5, 2.9, -8],
      lookAt: [1, 0.66, 0],
    },
  ],
});
export const { model, skyline, district, street, closeup } = asset;
