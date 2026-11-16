import { createTaiTamTukMasonryBridge } from '../../../../../../../../packages/worldgen/scripts/tai-tam-tuk-masonry-bridge-geometry.mjs';

const bridge = createTaiTamTukMasonryBridge(import.meta.url, {
  scale: 0.32,
  camera: [9.36, 12.09, 39],
  lookAt: [0, 1.6, 0],
  yaw: -0.48,
  brief:
    'Historic Tai Tam Tuk Reservoir masonry bridge 3, with 3 granite-faced arches and a stone parapet.',
  views: [
    { name: 'granite-arch-elevation', position: [0, 5.85, 26.52], lookAt: [0, 0.45, 0] },
    { name: 'parapets-and-mapped-crossing', position: [16.77, 16.38, -17.94], lookAt: [0, 1.6, 0] },
    { name: 'imposts-and-ravine', position: [-10.14, 7.02, 16.38], lookAt: [0, -0.4, 0] },
  ],
});
export const { model, skyline, district, street, closeup } = bridge;
