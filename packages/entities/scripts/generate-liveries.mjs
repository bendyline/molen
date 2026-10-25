/** Author the fleet's data-only livery catalog. Never rewrites a GLB. */

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liverySchema } from '@bendyline/molen-schema';
import { buildTextMesh } from '../../materials/dist/text.mjs';

const root = fileURLToPath(new URL('../../../content/entities/', import.meta.url));
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const project = await read('project.json');
const font = await read('../earth/fonts/overpass.semibold.json');
const library = { defaultFont: font.id, fonts: { [font.id]: font } };
const provenance = (kind, note, references = []) => ({ kind, note, references });
const original = provenance(
  'original',
  'Original alternate palette; no claim of factory color or a particular operator, serial number or service era.',
);
const rvReference = [
  {
    title: 'Winnebago 2022 View brochure, exterior graphics on page 11',
    url: 'https://www.winnebago.com/Files/Images/Winnebago/brochures/2022/2022_View_Digital.X.pdf',
  },
];
const aggressorReference = [
  {
    title: 'USAF: Flying colors, 64th Aggressor Squadron, Robert W. Valenca, 2005',
    url: 'https://www.af.mil/News/Photos/igphoto/2000580051/',
  },
];
const mustangReference = [
  {
    title: 'Ford: 2024 Mustang, Race Red and Vapor Blue photographs',
    url: 'https://www.ford.com.ph/showroom/performance/all-new-mustang/',
  },
];
const f4Reference = [
  {
    title: 'USAF Museum: Air-to-Air Combat Over North Vietnam, gray and camouflage F-4s',
    url: 'https://www.nationalmuseum.af.mil/Upcoming/Photos/igphoto/2000271009/',
  },
];
const shape = (color, points) => ({ color, points });
const circle = (color, radius) =>
  shape(
    color,
    Array.from({ length: 48 }, (_, i) => [
      0.5 + radius * Math.cos((i * Math.PI) / 24),
      0.5 + radius * Math.sin((i * Math.PI) / 24),
    ]),
  );
const starsBars = {
  label: 'US national star and bars, simplified',
  shapes: [
    shape('#293d55', [
      [0.03, 0.33],
      [0.97, 0.33],
      [0.97, 0.67],
      [0.03, 0.67],
    ]),
    circle('#293d55', 0.45),
    shape('#eeeae0', [
      [0.07, 0.4],
      [0.93, 0.4],
      [0.93, 0.6],
      [0.07, 0.6],
    ]),
    circle('#293d55', 0.37),
    shape(
      '#eeeae0',
      Array.from({ length: 10 }, (_, i) => {
        const a = Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 0.16 : 0.35;
        return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)];
      }),
    ),
  ],
};
function lettering(value, color = '#303a42') {
  const mesh = buildTextMesh(value, library, {
    maxWidth: 0.96,
    maxHeight: 0.9,
    align: 'center',
    verticalAlign: 'center',
  });
  return {
    label: value,
    shapes: Array.from({ length: mesh.indices.length / 3 }, (_, t) =>
      shape(
        color,
        [0, 1, 2].map((i) => {
          const k = mesh.indices[t * 3 + i] * 3;
          return [
            Math.round(Math.max(0, Math.min(1, mesh.positions[k] + 0.5)) * 10000) / 10000,
            Math.round(Math.max(0, Math.min(1, mesh.positions[k + 1] + 0.5)) * 10000) / 10000,
          ];
        }),
      ),
    ),
  };
}
function swoop(dark, accent, style) {
  const rise = style === 1 ? 0.2 : 0.1;
  return {
    label: 'Original coach sweep',
    shapes: [
      shape(dark, [
        [0, 0.12],
        [0.23, 0.18],
        [0.5, 0.4 + rise],
        [0.77, 0.64],
        [1, 0.71],
        [1, 0.91],
        [0.75, 0.85],
        [0.46, 0.61],
        [0.2, 0.27],
      ]),
      shape(accent, [
        [0, 0.04],
        [0.23, 0.1],
        [0.52, 0.32],
        [0.8, 0.5],
        [1, 0.55],
        [1, 0.63],
        [0.78, 0.58],
        [0.5, 0.4],
        [0.2, 0.17],
      ]),
    ],
  };
}

// Stable material bindings reviewed against the fleet. Never select by glTF material index.
const aircraftPaint = {
  p51d: ['natural-metal', 'natural-metal-panel', 'aluminium-lacquer'],
  oh6: ['olive-drab-enamel'],
  airliner: ['airliner-white', 'airliner-belly'],
  f_16b: ['F16-light-gray', 'F16-upper-gray'],
  f_14d: ['F14-gray', 'F14-upper'],
  f_15c: ['F15-gray', 'F15-upper'],
  fa_18c: ['FA18-gray', 'FA18-upper'],
  f_22a: ['F22-light-gray', 'F22-gray'],
  f_35a: ['F35-gray'],
  typhoon: ['Typhoon-gray'],
  rafale_c: ['Rafale-gray'],
  gripen_c: ['Gripen-gray'],
  mig_29a: ['MiG29-gray-green', 'MiG29-upper'],
  av_8b: ['AV8-gray', 'AV8-upper'],
  dc_3: ['DC3-aluminium', 'DC3-fabric-controls'],
};
const military = new Set([
  'p51d',
  'oh6',
  'uh_1h',
  'uh_60m',
  'ch_47f',
  'f_16b',
  'f_14d',
  'f_15c',
  'fa_18c',
  'f_22a',
  'f_35a',
  'typhoon',
  'rafale_c',
  'gripen_c',
  'mig_29a',
  'c_130j',
  'c_17a',
  'a400m',
  'c_5m',
  'mv_22b',
  'av_8b',
]);
const catalog = {};
for (const typePath of project.types) {
  for (const [id, definition] of Object.entries((await read(typePath)).types)) {
    const components = definition.components;
    if (!components?.vehicle && !components?.aircraft && !components?.boat) continue;
    const key = id.split('.').at(-1),
      aircraft = Boolean(components.aircraft);
    const sidecar = await read(project.assets[id]);
    const bytes = await readFile(resolve(root, project.assets[id], '..', sidecar.files.main));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    const names = [...new Set(gltf.materials.map((m) => m.name))];
    const baseNames = aircraft
      ? (aircraftPaint[key] ?? [names[0]])
      : [(components.vehicle ?? components.boat).visual.paintMaterial];
    if (baseNames.some((name) => !names.includes(name))) throw Error(`Missing paint binding ${id}`);
    const slots = { body: { materials: baseNames } };
    const accent = aircraft
      ? names.find(
          (n) =>
            /-(blue|navy|wine-red|red|green|teal|burgundy|graphite|accent|livery)$/.test(n) &&
            !/detail|nav|instrument|roundel/.test(n),
        )
      : names.includes('contrast-roof')
        ? 'contrast-roof'
        : undefined;
    if (accent && !baseNames.includes(accent)) slots.accent = { materials: [accent] };
    const rv = names.includes('coach-graphics');
    if (rv) {
      slots.graphics = { materials: ['coach-graphics'] };
      if (names.includes('coach-accent')) slots.trim = { materials: ['coach-accent'] };
    }
    const variants = [
      {
        id: 'authored',
        label: 'Authored finish',
        provenance: provenance(
          'original',
          'Preserves the model author’s existing materials and markings; see the model source bundle for its references.',
        ),
        paints: {},
      },
    ];
    const paint = (id, label, body, accentColor, evidence = original) => ({
      id,
      label,
      provenance: evidence,
      paints: {
        body: { color: body, roughness: aircraft ? 0.58 : 0.36, metalness: aircraft ? 0.12 : 0.3 },
        ...(slots.accent ? { accent: { color: accentColor } } : {}),
      },
    });
    const anchors = {};
    if (rv) {
      anchors['side-left'] = {
        slot: 'body',
        position: [1, 0.52, 0.42],
        size: [0.69, 0.18, 0.06],
        rotation: [0, Math.PI / 2, 0],
      };
      anchors['side-right'] = {
        slot: 'body',
        position: [0, 0.52, 0.42],
        size: [0.69, 0.18, 0.06],
        rotation: [0, -Math.PI / 2, 0],
      };
      for (const [i, [name, body, stripe, accentColor]] of [
        ['Mineral II', '#c9c6be', '#474f56', '#a8a79c'],
        ['Bay Mist II', '#d6d8cf', '#4c6666', '#9ca8a2'],
        ['Tuscan', '#cabb9f', '#534c46', '#a67855'],
      ].entries()) {
        const variant = paint(
          name.toLowerCase().replaceAll(' ', '-'),
          `${name} inspired`,
          body,
          stripe,
          provenance(
            'inspired',
            'Palette and sweeping graphics inspired by the 2022 View brochure. Original simplified paths, not a factory template; Bendy coaches adapt the scheme to fictional bodies.',
            rvReference,
          ),
        );
        variant.paints.graphics = { color: body };
        if (slots.trim) variant.paints.trim = { color: body };
        variant.markings = ['side-left', 'side-right'].map((anchor) => ({
          anchor,
          graphic: swoop(stripe, accentColor, i),
        }));
        variants.push(variant);
      }
    } else if (military.has(key)) {
      variants.push(paint('service-gray', 'Service gray study', '#939da4', '#586974'));
      const camo = paint(
        'field-camouflage',
        'Field camouflage study',
        '#6a7458',
        '#635d4b',
        provenance(
          'inspired',
          'Original medium-fi green/tan pattern inspired by historical camouflage photographs; not a verified operator scheme for this airframe.',
          f4Reference,
        ),
      );
      camo.paints.body.camouflage = {
        colors: ['#4f5e49', '#79815a', '#ac9973'],
        scale: 1,
        seed: 17,
      };
      variants.push(camo);
      if (key === 'f_16b') {
        // Fuselage-side bounds are narrower than the wing span; bind the same paint by subtree.
        // Projector depth reaches the fuselage while remaining material-restricted.
        anchors['badge-left'] = {
          slot: 'body',
          position: [0.56, 0.3, 0.45],
          size: [0.085, 0.06, 0.18],
          rotation: [0, Math.PI / 2, 0],
        };
        anchors['badge-right'] = {
          slot: 'body',
          position: [0.44, 0.3, 0.45],
          size: [0.085, 0.06, 0.18],
          rotation: [0, -Math.PI / 2, 0],
        };
        anchors['unit-left'] = {
          slot: 'body',
          position: [0.51, 0.73, 0.15],
          size: [0.12, 0.035, 0.08],
          rotation: [0, Math.PI / 2, 0],
        };
        anchors['unit-right'] = {
          slot: 'body',
          position: [0.49, 0.73, 0.15],
          size: [0.12, 0.035, 0.08],
          rotation: [0, -Math.PI / 2, 0],
        };
        const evidence = provenance(
          'inspired',
          '64th AGRS photograph adapted to the library’s F-16B. Approximate camouflage boundaries and placement; not a serial-specific replica.',
          aggressorReference,
        );
        camo.id = 'aggressor-desert';
        camo.label = '64th AGRS desert inspired';
        camo.provenance = evidence;
        camo.paints.body.camouflage = {
          colors: ['#ac9776', '#665d4d', '#d2c5a8'],
          scale: 1,
          seed: 29,
        };
        const blue = paint(
          'aggressor-blue',
          '64th AGRS blue inspired',
          '#7391a3',
          '#506778',
          evidence,
        );
        blue.paints.body.camouflage = {
          colors: ['#48647d', '#7f9fad', '#bdc6c5'],
          scale: 1,
          seed: 23,
        };
        for (const variant of [camo, blue])
          variant.markings = [
            ...['badge-left', 'badge-right'].map((anchor) => ({ anchor, graphic: starsBars })),
            ...['unit-left', 'unit-right'].map((anchor) => ({
              anchor,
              graphic: lettering('64 AGRS'),
            })),
          ];
        variants.push(blue);
      }
      if (key === 'rafale_c') {
        slots.roundel = {
          materials: ['Rafale-roundel-red', 'Rafale-roundel-white', 'Rafale-roundel-blue'],
        };
        variants[1].paints.roundel = { color: '#596771' };
      }
    } else {
      variants.push(paint('crimson', 'Crimson', '#a94b43', '#763f3b'));
      variants.push(paint('ocean-blue', 'Ocean blue', '#557990', '#314e6a'));
      if (aircraft) {
        variants[1].paints.body.color = '#e5e1d5';
        variants[1].label = 'Ivory / crimson';
        variants[2].paints.body.color = '#c9d0cd';
        variants[2].label = 'Silver / ocean blue';
      }
      if (key === 'ford_mustang_2024') {
        variants[1].id = 'race-red';
        variants[1].label = 'Race Red inspired';
        variants[1].paints.body.color = '#b63532';
        variants[2].id = 'vapor-blue';
        variants[2].label = 'Vapor Blue inspired';
        variants[2].paints.body.color = '#6e899b';
        for (const variant of variants.slice(1))
          variant.provenance = provenance(
            'inspired',
            'Ford product photographs establish the color choices; sRGB colors are visual approximations, not paint-code measurements.',
            mustangReference,
          );
      }
    }
    catalog[id] = liverySchema.parse({
      selected: 'authored',
      slots,
      ...(Object.keys(anchors).length ? { anchors } : {}),
      variants,
    });
  }
}
const output = `${JSON.stringify({ format: 'molen/fleet-liveries@1', models: catalog }, null, 2)}\n`;
const path = resolve(root, 'source/liveries.json');
if (process.argv.includes('--check')) {
  if (
    JSON.stringify(JSON.parse(await readFile(path, 'utf8'))) !== JSON.stringify(JSON.parse(output))
  )
    throw Error('Regenerate fleet liveries');
} else {
  const formatted = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/@biomejs/biome/bin/biome', import.meta.url)),
      'format',
      '--files-max-size=16777216',
      '--stdin-file-path=liveries.json',
    ],
    { input: output, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (!formatted.trim()) throw new Error('Livery formatter produced no output');
  await writeFile(path, formatted);
}
console.log(
  `${Object.keys(catalog).length} vehicles, ${Object.values(catalog).reduce((n, c) => n + c.variants.length, 0)} liveries`,
);
