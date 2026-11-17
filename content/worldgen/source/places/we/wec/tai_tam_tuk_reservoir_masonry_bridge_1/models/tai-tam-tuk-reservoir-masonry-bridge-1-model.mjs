import { createTaiTamTukMasonryBridge } from '../../../../../../../../packages/worldgen/scripts/tai-tam-tuk-masonry-bridge-geometry.mjs';

const bridge = createTaiTamTukMasonryBridge(import.meta.url, {
  scale: 0.64,
  camera: [17.76, 22.94, 74],
  lookAt: [0, 0.1, 0],
  yaw: -0.48,
  brief:
    'Historic Tai Tam Tuk Reservoir masonry bridge 1, with 3 granite-faced arches and a stone parapet.',
  views: [
    { name: 'granite-arch-elevation', position: [0, 11.1, 50.32], lookAt: [0, -1.05, 0] },
    { name: 'parapets-and-mapped-crossing', position: [31.82, 31.08, -34.04], lookAt: [0, 0.1, 0] },
    { name: 'imposts-and-ravine', position: [-19.24, 13.32, 31.08], lookAt: [0, -1.9, 0] },
  ],
});
export const { model, skyline, district, street, closeup } = bridge;
