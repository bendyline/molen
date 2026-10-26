/** Licensed font outlines baked with the portable WASM rasterizer, never host-installed fonts. */
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { BufferGeometry, Float32BufferAttribute, Mesh } from 'three';
import opentype from 'three/addons/libs/opentype.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import profiles from '../../../../content/entities/fonts/cockpit-profiles.json' with {
  type: 'json',
};
import { bakeSvg } from '../../../materials/dist/index.mjs';
import { replaceDetailText } from '../vehicle-detail.mjs';

export const cockpitFontProfiles = profiles.profiles;

export const letteringTag = 'molenCockpitLettering';
const size = [1024, 1024],
  cell = 64,
  rowHeight = 128,
  em = 54,
  padding = 2;
const fonts = new Map();
for (const [id, path] of [
  ['period', '../../../../content/entities/fonts/Jost-500-Medium.ttf'],
  ['technical', '../../../../content/earth/source/fonts/Overpass-SemiBold.ttf'],
  ['modern', '../../../../content/earth/source/fonts/Overpass-Regular.ttf'],
  ['display', '../../../../content/earth/source/fonts/OverpassMono-SemiBold.ttf'],
]) {
  const bytes = await readFile(new URL(path, import.meta.url));
  const font = opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const glyphs = new Map(),
    paths = [];
  const cap = font.charToGlyph('H').getPath(0, 0, em).getBoundingBox();
  for (let code = 32; code <= 126; code++) {
    const char = String.fromCharCode(code),
      glyph = font.charToGlyph(char);
    const path = glyph.getPath(0, 0, em),
      bounds = path.getBoundingBox();
    const col = (code - 32) % 16,
      row = Math.floor((code - 32) / 16);
    const rect = [
      Math.floor(bounds.x1) - padding,
      Math.floor(bounds.y1) - padding,
      Math.ceil(bounds.x2) + padding,
      Math.ceil(bounds.y2) + padding,
    ];
    const origin = [col * cell + 2 - rect[0], row * rowHeight + 2 - rect[1]];
    if (
      origin[0] + rect[0] < col * cell ||
      origin[0] + rect[2] >= (col + 1) * cell ||
      origin[1] + rect[1] < row * rowHeight ||
      origin[1] + rect[3] >= (row + 1) * rowHeight
    )
      throw Error(`Cockpit atlas cell overflow: ${id}/${char}`);
    paths.push(`<g transform="translate(${origin.join(' ')})">${path.toSVG(4)}</g>`);
    glyphs.set(char, { glyph, rect, origin, advance: (glyph.advanceWidth * em) / font.unitsPerEm });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.join(' ')}">${paths.join('')}</svg>`;
  const baked = await bakeSvg(svg, { rasterSize: size });
  const png = new PNG({ width: size[0], height: size[1] });
  // White RGB even in clear texels prevents dark fringes under linear/mipmap filtering.
  for (let i = 0; i < png.data.length; i += 4)
    png.data.set([255, 255, 255, baked.slots.baseColor.data[i + 3]], i);
  fonts.set(id, {
    font,
    glyphs,
    capHeight: cap.y2 - cap.y1,
    png: PNG.sync.write(png, { filterType: 4, deflateLevel: 9 }),
  });
}

export function cockpitFontTexture(id) {
  const entry = fonts.get(id);
  if (!entry) throw Error(`Unknown cockpit font: ${id}`);
  return entry.png;
}

/** Replace authored labels inside a selected cabin; keep each animated batch's parent intact. */
export function textureCockpitLettering(cabin, profile) {
  replaceDetailText(cabin, (holder, runs, material) => {
    const batches = new Map();
    for (const run of runs) {
      const font = profile[run.role];
      if (!font) throw Error(`Unknown cockpit lettering role: ${run.role}`);
      const mesh = cockpitText(
        holder,
        `${holder.name}-print`,
        run.label,
        [0, 0, 0],
        run.height,
        material,
        font,
        (Math.max(1, run.label.length * 4 - 1) * run.height) / 5,
      );
      if (!mesh) continue;
      // detailKit text faces +Z; cockpitText faces -Z. Preserve the authored mounting/yaw.
      mesh.geometry.rotateY(Math.PI).applyMatrix4(run.matrix);
      const key = `${font}/${run.role}`;
      const batch = batches.get(key) ?? {
        material: mesh.material,
        geometries: [],
        role: run.role,
        font,
      };
      batch.geometries.push(mesh.geometry);
      batches.set(key, batch);
      mesh.removeFromParent();
    }
    for (const batch of batches.values()) {
      const mesh = new Mesh(mergeGeometries(batch.geometries), batch.material);
      mesh.name = `${holder.name}-${batch.role}-print`;
      mesh.userData.molenCockpitTextRole = batch.role;
      holder.add(mesh);
      for (const geometry of batch.geometries) geometry.dispose();
    }
  });
}

const materials = new WeakMap();
/** Centered printed text facing local -Z; height is the actual capital height in metres. */
export function cockpitText(
  parent,
  name,
  value,
  at,
  height,
  material,
  fontId = 'technical',
  maxWidth = Infinity,
) {
  const entry = fonts.get(fontId);
  if (!entry) throw Error(`Unknown cockpit font: ${fontId}`);
  const chars = [...value.toUpperCase()];
  if (!chars.length) return;
  const runs = [];
  let cursor = 0,
    previous;
  for (const char of chars) {
    const g = entry.glyphs.get(char);
    if (!g) throw Error(`Unsupported cockpit glyph: ${char}`);
    if (previous)
      cursor += (entry.font.getKerningValue(previous, g.glyph) * em) / entry.font.unitsPerEm;
    runs.push({ ...g, cursor, char });
    cursor += g.advance;
    previous = g.glyph;
  }
  // Fit uniformly: preserve the typeface's proportions even on narrow placards.
  const scale = Math.min(height / entry.capHeight, maxWidth / cursor);
  const positions = [],
    normals = [],
    uv = [],
    indices = [];
  for (const {
    rect: [l, t, r, b],
    origin: [ox, oy],
    cursor: x,
    char,
  } of runs) {
    if (char === ' ') continue;
    const index = positions.length / 3;
    for (const [px, py] of [
      [l, t],
      [r, t],
      [r, b],
      [l, b],
    ]) {
      positions.push((cursor / 2 - x - px) * scale, (-py - entry.capHeight / 2) * scale, 0);
      normals.push(0, 0, -1);
      // glTF image coordinates start at the top, unlike a three.js CanvasTexture.
      uv.push((ox + px) / size[0], (oy + py) / size[1]);
    }
    indices.push(index, index + 2, index + 1, index, index + 3, index + 2);
  }
  if (!positions.length) return;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  let variants = materials.get(material);
  if (!variants) {
    variants = new Map();
    materials.set(material, variants);
  }
  if (!variants.has(fontId)) {
    const print = material.clone();
    print.name += `-${fontId}-font`;
    print.userData[letteringTag] = fontId;
    print.transparent = true;
    print.depthWrite = false;
    variants.set(fontId, print);
  }
  const mesh = new Mesh(geometry, variants.get(fontId));
  mesh.name = name;
  mesh.position.fromArray(at);
  parent.add(mesh);
  return mesh;
}
