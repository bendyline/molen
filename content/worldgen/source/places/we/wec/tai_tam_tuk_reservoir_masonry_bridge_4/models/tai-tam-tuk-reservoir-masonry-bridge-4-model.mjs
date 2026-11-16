import { createTaiTamTukMasonryBridge } from '../../../../../../../../packages/worldgen/scripts/tai-tam-tuk-masonry-bridge-geometry.mjs';

const bridge = createTaiTamTukMasonryBridge(import.meta.url, {
  scale: 0.47,
  camera: [12.96, 16.74, 54],
  lookAt: [0, -1.2, 0],
  yaw: -0.48,
  brief:
    'Historic Tai Tam Tuk Reservoir masonry bridge 4, with 6 granite-faced arches and a stone parapet.',
  views: [
    { name: 'granite-arch-elevation', position: [0, 8.1, 36.72], lookAt: [0, -2.35, 0] },
    {
      name: 'parapets-and-mapped-crossing',
      position: [23.22, 22.68, -24.84],
      lookAt: [0, -1.2, 0],
    },
    { name: 'imposts-and-ravine', position: [-14.04, 9.72, 22.68], lookAt: [0, -3.2, 0] },
  ],
});
export const { model, skyline, district, street, closeup } = bridge;
