import { createTaiTamTukMasonryBridge } from '../../../../../../../../packages/worldgen/scripts/tai-tam-tuk-masonry-bridge-geometry.mjs';

const bridge = createTaiTamTukMasonryBridge(import.meta.url, {
  scale: 0.42,
  camera: [11.76, 15.19, 49],
  lookAt: [0, 1.4, 0],
  yaw: -0.48,
  brief:
    'Historic Tai Tam Tuk Reservoir masonry bridge 2, with 4 granite-faced arches and a stone parapet.',
  views: [
    { name: 'granite-arch-elevation', position: [0, 7.35, 33.32], lookAt: [0, 0.25, 0] },
    { name: 'parapets-and-mapped-crossing', position: [21.07, 20.58, -22.54], lookAt: [0, 1.4, 0] },
    { name: 'imposts-and-ravine', position: [-12.74, 8.82, 20.58], lookAt: [0, -0.6, 0] },
  ],
});
export const { model, skyline, district, street, closeup } = bridge;
