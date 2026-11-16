import { perimeterModel } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-perimeter-geometry.mjs';
const asset = perimeterModel(import.meta.url, {
  standing: true,
  scale: 0.63,
  yaw: 2.7,
  camera: [78, 43, -60],
  lookAt: [31, 3, -6],
  brief:
    'The curved northern enclosure wall and stepped double gate with adjacent wicket at Tytuvėnai Monastery.',
  views: [
    {
      name: 'stepped-double-gate-and-wicket',
      position: [53, 9, -39],
      lookAt: [57, 2.7, -19],
    },
    {
      name: 'curved-enclosure-wall',
      position: [22, 61, 65],
      lookAt: [7, 2, -5],
    },
  ],
});
export const { model, skyline, district, street, closeup } = asset;
