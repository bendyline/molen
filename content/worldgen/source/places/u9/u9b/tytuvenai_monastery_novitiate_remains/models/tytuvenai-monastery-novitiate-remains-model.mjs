import { perimeterModel } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-perimeter-geometry.mjs';

const asset = perimeterModel(import.meta.url, {
  standing: false,
  scale: 0.35,
  yaw: 2.7,
  camera: [14, 8, -16],
  lookAt: [0, 0.32, 0],
  brief:
    'Low exposed traces of the former Tytuvėnai novitiate and school beside the courtyard gallery.',
  views: [
    {
      name: 'broken-masonry-by-the-arcade',
      position: [-5, 5, -10],
      lookAt: [1, 0.3, -4],
    },
    {
      name: 'exposed-low-alignment',
      position: [9, 12, 13],
      lookAt: [0, 0.25, 0],
    },
  ],
});
export const { model, skyline, district, street, closeup } = asset;
