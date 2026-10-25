import { createTextGeometry } from '@bendyline/molen-client/text';
import { loadFontLibrary } from '@bendyline/molen-materials/text';
import { generateSignModel } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import catalog from '../../../../content/earth/fonts/catalog.json';

const sources = import.meta.glob<string>('../../../../content/earth/fonts/*.json', {
  query: '?raw',
  import: 'default',
});
const fonts = await loadFontLibrary(catalog, async (path) => {
  const read = sources[`../../../../content/earth/fonts/${path}`];
  if (!read) throw new Error(`Missing font ${path}`);
  return JSON.parse(await read());
});
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 900);
renderer.setPixelRatio(1);
renderer.setClearColor('#ece8df');
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-8, 8, 5.625, -5.625, 0.1, 100);
camera.position.set(0, 0, 20);
const ink = new THREE.MeshBasicMaterial({ color: '#f5f0e4' });
const captionInk = new THREE.MeshBasicMaterial({ color: '#53635b' });
function text(
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  font = 'highway',
  material = ink,
) {
  const geometry = createTextGeometry(value, fonts, {
    font,
    size: height * 2,
    maxWidth: width,
    maxHeight: height,
    align: 'center',
    verticalAlign: 'center',
  });
  if (geometry.userData.textLayout.missingGlyphs.length) throw new Error('Missing showcase glyph');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0.08);
  scene.add(mesh);
}
function panel(x: number, y: number, w: number, h: number, color: string) {
  const border = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, h + 0.08), ink);
  border.position.set(x, y, 0);
  scene.add(border);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color }),
  );
  face.position.set(x, y, 0.02);
  scene.add(face);
}
panel(0, 2.5, 13.4, 2.55, '#225d43');
text('EXIT 17B', 4.8, 3.31, 2.2, 0.32);
text('Lake City', -2.8, 2.9, 5.3, 0.65);
text('Downtown', -2.8, 1.94, 5.3, 0.65);
text('I 90  EAST', 3.65, 2.49, 4.8, 0.6);
text('↓', 3.65, 1.67, 1, 0.55);
const shops = [
  {
    text: 'Café Étoile',
    font: 'serif',
    background: '#503b30',
    symbol: 'cup',
    x: -3.6,
    y: -0.5,
    caption: 'Serif · cafés & bookshops',
  },
  {
    text: 'North Market',
    font: 'sans',
    background: '#3c5964',
    symbol: 'letters',
    letters: 'NM',
    x: 3.6,
    y: -0.5,
    caption: 'Sans · storefronts & labels',
  },
  {
    text: 'RADIO 108.50',
    font: 'mono',
    background: '#303a42',
    symbol: 'letters',
    letters: 'FM',
    x: -3.6,
    y: -3.1,
    caption: 'Monospaced · equipment & instruments',
  },
  {
    text: 'São José 24h',
    font: 'highway',
    background: '#6a4935',
    symbol: 'letters',
    letters: 'SJ',
    x: 3.6,
    y: -3.1,
    caption: 'Highway · mixed case, accents & digits',
  },
] as const;
for (const shop of shops) {
  const data = generateSignModel({ ...shop, foreground: '#f5f0e4', mark: '#f5f0e4' }, 0, fonts);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.scale.setScalar(1.5);
  mesh.position.set(shop.x, shop.y - 1.0125, 0);
  scene.add(mesh);
  text(shop.caption, shop.x, shop.y - 1.3, 6.5, 0.19, 'sans', captionInk);
}
renderer.render(scene, camera);
(window as unknown as { typographyQA: { ready: boolean; triangles: number } }).typographyQA = {
  ready: true,
  triangles: renderer.info.render.triangles,
};
