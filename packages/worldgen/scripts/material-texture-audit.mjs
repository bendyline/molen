/** Pure baked-image accounting. Estimates texel storage, never a graphics driver's allocation. */
import { createHash } from 'node:crypto';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const sampledChannels = { roughness: 1, metalness: 2 };

function validateImage(image) {
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    !ArrayBuffer.isView(image.data) ||
    image.data.BYTES_PER_ELEMENT !== 1 ||
    image.data.length !== image.width * image.height * 4
  )
    throw new Error('Material audit requires positive integer dimensions and RGBA8 pixels');
}

/** Three samples roughness from G and metalness from B; unrelated channels do not matter. */
export function constantResponseByte(image, slot) {
  validateImage(image);
  const channel = sampledChannels[slot];
  if (channel === undefined) return undefined;
  const value = image.data[channel];
  for (let index = channel + 4; index < image.data.length; index += 4)
    if (image.data[index] !== value) return undefined;
  return value;
}

function mipBytes(width, height) {
  let bytes = 0;
  while (true) {
    bytes += width * height * 4;
    if (width === 1 && height === 1) return bytes;
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
}

const storage = (images) => ({
  textures: images.length,
  baseLevelRgba8Bytes: images.reduce((sum, image) => sum + image.bytes, 0),
  fullMipChainRgba8Bytes: images.reduce((sum, image) => sum + image.fullMipChainBytes, 0),
});

export function auditBakedMaterialTextures(materials) {
  const ids = new Set();
  const images = [];
  const entries = materials.map(({ id, graphHash, repeatMeters, uvMode, baked }) => {
    if (ids.has(id)) throw new Error(`Duplicate audited material identity: ${id}`);
    ids.add(id);
    if (!['linear', 'nearest'].includes(baked.meta.filter))
      throw new Error(`Unsupported baked filter for ${id}`);
    const channels = Object.entries(baked.slots).map(([slot, image]) => {
      validateImage(image);
      const value = constantResponseByte(image, slot);
      const record = {
        material: id,
        slot,
        width: image.width,
        height: image.height,
        colorSpace: ['baseColor', 'emissive'].includes(slot) ? 'srgb' : 'linear',
        filter: baked.meta.filter,
        sha256: hash(image.data),
        bytes: image.data.byteLength,
        fullMipChainBytes: mipBytes(image.width, image.height),
        ...(value === undefined
          ? {}
          : {
              constantResponse: {
                channel: slot === 'roughness' ? 'G' : 'B',
                byte: value,
                scalar: value / 255,
              },
            }),
      };
      images.push(record);
      return record;
    });
    return {
      id,
      graphHash,
      repeatMeters,
      uvMode,
      ...(baked.meta.alphaTest === undefined ? {} : { alphaTest: baked.meta.alphaTest }),
      channels,
    };
  });
  const grouped = new Map();
  for (const image of images) {
    // Sampler and color-space differences prevent safe texture-object reuse.
    const key = [image.width, image.height, image.colorSpace, image.filter, image.sha256].join(':');
    const group = grouped.get(key) ?? [];
    group.push(image);
    grouped.set(key, group);
  }
  const constants = images.filter((image) => image.constantResponse);
  const uploaded = images.filter((image) => !image.constantResponse);
  const unique = [...grouped.values()].map(([image]) => image);
  return {
    format: 'molen/material-texture-audit@1',
    policy: {
      identity:
        'Material IDs remain distinct. Duplicate channels require matching RGBA8 bytes, dimensions, color space and baked filter.',
      scalarFolding:
        'Only exactly constant sampled roughness G or metalness B is replaced by its byte / 255 scalar; other maps remain textures.',
      memory:
        'Base-level and full-mip-chain RGBA8 texel estimates exclude driver overhead, compression and copies. Full mip chains are a separate estimate, not measured GPU memory or an assertion that every client enables mipmaps.',
      cutouts:
        'Alpha-test base-color maps remain textures. Audit records alphaTest but does not infer a no-mipmap policy from it.',
    },
    summary: {
      materials: entries.length,
      baked: storage(images),
      constantResponseChannels: constants.length,
      constantResponseChannelsBySlot: Object.fromEntries(
        Object.keys(sampledChannels).map((slot) => [
          slot,
          constants.filter((image) => image.slot === slot).length,
        ]),
      ),
      afterConstantResponseFolding: storage(uploaded),
      allChannelsAfterTheoreticalExactDeduplication: storage(unique),
      duplicateChannelGroups: [...grouped.values()].filter((group) => group.length > 1).length,
    },
    duplicateChannels: [...grouped.values()]
      .filter((group) => group.length > 1)
      .map((group) => ({
        sha256: group[0].sha256,
        dimensions: [group[0].width, group[0].height],
        colorSpace: group[0].colorSpace,
        filter: group[0].filter,
        copies: group.map((image) => `${image.material}#${image.slot}`),
      })),
    materials: entries,
  };
}
