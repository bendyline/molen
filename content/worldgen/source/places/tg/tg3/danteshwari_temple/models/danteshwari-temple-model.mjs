import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireGeometry = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireGeometry('earcut');
const read = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const d = plan.dimensions;
const color = {
  walls: rgb('d6d0bf'),
  ledge: rgb('e0dbcc'),
  roofTier: rgb('c9c6b8'),
  worn: rgb('bdb9a8'),
  red: rgb('984e35'),
  roof: rgb('a0633c'),
  roofStripe: rgb('865135'),
  wood: rgb('a36b3c'),
  woodLight: rgb('b27b46'),
  darkWood: rgb('745132'),
  shadow: rgb('4c3427'),
  court: rgb('9f9d89'),
  stone: rgb('61635a'),
  carved: rgb('414747'),
  flag: rgb('a6382b'),
};
const surfaces = {
  masonry: { slot: 'wall', graph: 'plaster_lime', roughness: .92, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: .9, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: .88, metallic: 0 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: .92, metallic: 0 },
  band: { slot: 'trim', localRef: 'palette:#fffffe', roughness: .85, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: .94, metallic: 0 },
};

function panel(out, slot, points, tint) {
  const normal = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, p => [p[0], p[1] + p[2]], tint);
}

function ground([x, z]) {
  const a = (x - terrain.origin[0]) / terrain.stepMeters;
  const b = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(a), j = Math.floor(b), u = a - i, v = b - j;
  const row = k => terrain.heightsMeters[k][i] * (1 - u) + terrain.heightsMeters[k][i + 1] * u;
  return row(j) * (1 - v) + row(j + 1) * v - terrain.modelDatumElevationMeters;
}

function rect([x, z], rx, rz) {
  return [[x - rx, z - rz], [x + rx, z - rz], [x + rx, z + rz], [x - rx, z + rz]];
}

function center(ring) {
  return [0, 1].map(axis => ring.reduce((sum, p) => sum + p[axis], 0) / ring.length);
}

function oriented(ring) {
  const signed = ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  return signed >= 0 ? ring : ring.toReversed();
}

function cap(out, slot, ring, height, tint, direction = 1) {
  const at = ([x, z]) => [x, typeof height === 'number' ? height : height([x, z]), z];
  const indices = earcut(ring.flat(), null, 2);
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map(j => at(ring[j]));
    panel(out, slot, normalFor(...points)[1] * direction > 0 ? points : points.toReversed(), tint);
  }
}

function loft(out, slot, ring, next, bottom, top, tint) {
  const floor = typeof bottom === 'number' ? () => bottom : bottom;
  const roof = typeof top === 'number' ? () => top : top;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i], b = ring[j], c = next[i], e = next[j];
    panel(out, slot, [[b[0], floor(b), b[1]], [a[0], floor(a), a[1]], [c[0], roof(c), c[1]], [e[0], roof(e), e[1]]], tint);
  }
}

function block(out, slot, points, bottom, top, tint) {
  const ring = oriented(points);
  loft(out, slot, ring, ring, bottom, top, tint);
  cap(out, slot, ring, top, tint);
  cap(out, slot, ring, bottom, tint, -1);
}

function edgeDetail(out, ring, top, lod, base) {
  if (lod === 0) return;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 3) continue;
    const dx = (bx - ax) / length, dz = (bz - az) / length;
    const at = (t, y, offset) => [ax + dx * t + dz * offset, y, az + dz * t - dx * offset];
    const strip = (slot, start, end, y0, y1, depth, color) => panel(out, slot,
      [at(end, y0, depth), at(start, y0, depth), at(start, y1, depth), at(end, y1, depth)], color);
    strip('band', 0, length, base, base + .19, .032, color.red);
    strip('masonry', 0, length, top - .28, top - .08, .055, color.ledge);
    if (lod < 2 || length < 7) continue;
    for (const fraction of length > 23 ? [.24,.43,.63,.84] : [.41,.72]) {
      const x = length * fraction;
      strip('masonry', x - .35, x + .35, top - 1.65, top - .46, .09, color.ledge);
      strip('dark', x - .21, x + .21, top - 1.46, top - .59, .113, color.shadow);
      if (lod === 3) {
        strip('wood', x - .031, x + .031, top - 1.46, top - .59, .13, color.darkWood);
      }
    }
  }
}

function coneProfile(out, slot, [x, z], profile, sides, tint) {
  const ring = ([y, r]) => Array.from({ length: sides }, (_, i) => {
    const angle = 2 * Math.PI * i / sides;
    return [x + r * Math.cos(angle), y, z + r * Math.sin(angle)];
  });
  for (let k = 1; k < profile.length; k++) {
    const before = ring(profile[k - 1]), next = ring(profile[k]);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      panel(out, slot, [before[i], next[i], next[j], before[j]], tint);
    }
  }
}

function flag(out, [x,z], height, scale) {
  const width = .94 * scale;
  const path = [
    [x, height + .15 * scale, z],
    [x, height + .83 * scale, z],
    [x + width * .52, height + .79 * scale, z + .09],
    [x + width, height + .64 * scale, z + .19],
  ];
  for (let i = 1; i + 1 < path.length; i++) {
    const facet = [path[0], path[i], path[i + 1]];
    panel(out, 'band', facet, color.flag);
    panel(out, 'band', facet.toReversed(), color.flag);
  }
  beam(out, 'band', [x, height - .14, z], [x, height + .88 * scale, z], .046, .046, color.carved);
}

function shrine(out, ring, peak, courses, lod, adjacent) {
  const c = center(ring);
  const width = Math.max(...ring.map(p => Math.abs(p[0] - c[0])));
  const depth = Math.max(...ring.map(p => Math.abs(p[1] - c[1])));
  const y0 = d.floor, cornice = d.floor + (adjacent ? 2.85 : 3.72), top = d.floor + peak;
  block(out, 'masonry', ring, d.foundation, cornice, color.walls);
  const normRing = oriented(ring);
  edgeDetail(out, normRing, cornice, lod, y0 - .03);
  const courseCount = lod === 0 ? Math.ceil(courses / 2) : courses;
  const scaleAt = t => 1.045 - .72 * t + .035 * t * t;
  const outlineAt = (f, offset = 0) => rect(c, (width + offset) * f, (depth + offset) * f);
  for (let i = 0; i < courseCount; i++) {
    const t = i / courseCount, next = (i + 1) / courseCount, factor = scaleAt(t);
    const y = cornice + (top - cornice - .43) * t;
    const upper = cornice + (top - cornice - .43) * next;
    const rim = outlineAt(factor, .08);
    const shoulder = outlineAt(scaleAt(next) + .024);
    loft(out, 'masonry', rim, rim, y, y + (upper - y) * .21, color.ledge);
    loft(out, 'masonry', rim, shoulder, y + (upper - y) * .21, upper, i % 3 === 1 ? color.worn : color.roofTier);
    if (i === courseCount - 1) cap(out, 'masonry', shoulder, upper, color.ledge);
  }
  const sides = [6,8,12,18][lod];
  coneProfile(out, 'band', c, [[top - .49,.23],[top - .37,.26],[top - .17,.14],[top,.055]], sides, color.stone);
  flag(out, c, top + .03, adjacent ? .84 : 1.18);
}

function middleHalls(out, lod) {
  const sections = [
    { from: -20.41, to: -7.3, half: 6.84, y: 3.39 },
    { from: -7.3, to: 2.5, half: 6.82, y: 3.56 },
    { from: 2.5, to: 8.34, half: 6.82, y: 3.71 },
  ];
  for (const { from, to, half, y } of sections) {
    const at = [(from + to) / 2, -.427];
    const ring = rect(at, (to - from) * .5, half);
    const eave = d.floor + y;
    block(out, 'masonry', ring, d.foundation, eave, color.walls);
    const header = rect(at, (to - from) * .5 + .16, half + .21);
    block(out, 'masonry', header, eave -.24, eave + .16, color.ledge);
    edgeDetail(out, ring, eave, lod, Math.max(d.floor - .6, d.entrance.floor));
  }
  const adjacentHall = oriented(d.adjacent);
  block(out, 'masonry', adjacentHall, d.foundation, d.floor + 2.76, color.walls);
  edgeDetail(out, adjacentHall, d.floor + 2.76, lod, d.floor - .11);
}

function gable(out, lod) {
  const { front, backX, eave: wallHeight, ridge: ridgeHeight, floor } = d.entrance;
  const x = center(front)[0], z0 = front[0][1], z1 = front[1][1], mid = (z0 + z1) / 2;
  const eave = floor + wallHeight, ridge = floor + ridgeHeight;
  const eavesZ = [z0 - .31,z1 + .31];
  const roofAt = z => eave + (ridge - eave) * Math.max(0, 1 - Math.abs(z - mid) / (eavesZ[1] - mid));
  for (const outerZ of eavesZ) {
    const a = [backX - .33, ridge, mid], b = [x + .43, ridge, mid];
    const c = [x + .43, eave, outerZ], e = [backX - .33, eave, outerZ];
    const roof = [a, b, c, e];
    if (normalFor(...roof)[1] < 0) roof.reverse();
    panel(out, 'tile', roof, color.roof);
    panel(out, 'wood', roof.map(([x,y,z])=>[x,y-.12,z]).reverse(), color.darkWood);
    beam(out, 'wood', b, c, .23, .18, color.woodLight);
    beam(out, 'wood', e, c, .16, .24, color.wood);
    if (lod > 1) {
      const rows = lod === 3 ? 14 : 8;
      for (let i = 1; i < rows; i++) {
        const t = i / rows;
        const z = mid + (outerZ - mid) * t;
        const y = roofAt(z) + .021;
        panel(out, 'tile', [[backX - .26,y,z+.032],[x+.37,y,z+.032],
          [x+.37,y,z-.032],[backX-.26,y,z-.032]], color.roofStripe);
      }
    }
  }
  const frontX = x + .03, openingWidth = 1.99;
  const facing = (slot, a, b, tint, bottom = floor + .26) => {
    panel(out, slot, [[frontX,bottom,a],[frontX,Math.min(roofAt(a),roofAt(b))-.12,a],
      [frontX,Math.min(roofAt(a),roofAt(b))-.12,b],[frontX,bottom,b]], tint);
  };
  box(out, 'granite', [backX, d.foundation, z0], [x + .16, floor + .25, z1], color.red);
  for (const z of [z0+.18,z0+3.21,mid-1.04,mid+1.04,z1-3.25,z1-.18]) {
    box(out, 'wood', [x-.37,floor+.25,z-.115],[x+.16,roofAt(z)-.11,z+.115], color.woodLight);
  }
  if (lod < 2) {
    facing('wood',z0+.18,mid-openingWidth*.5,color.wood);
    facing('wood',mid+openingWidth*.5,z1-.18,color.wood);
    panel(out,'wood',[[frontX,eave-.08,z0],[frontX,ridge-.12,mid],[frontX,eave-.08,z1]],color.wood);
  } else {
    const bays = lod === 3 ? 66 : 39;
    for (let k = 1; k < bays; k++) {
      const z = z0 + (z1 - z0) * k / bays;
      const bottom = Math.abs(z-mid)<openingWidth*.5 ? floor+2.75 : floor+.25;
      box(out,'wood',[x-.14,bottom,z-.032],[x+.08,roofAt(z)-.12,z+.032],k%6===0?color.darkWood:color.wood);
    }
  }
  beam(out,'wood',[x+.065,floor+2.72,mid-1.05],[x+.065,floor+2.72,mid+1.05],.12,.22,color.woodLight);
  for (const y of [floor+.83,floor+1.83,floor+3.24]) {
    for (const [a,b] of [[z0,mid-1.04],[mid+1.04,z1]]) {
      beam(out,'wood',[x+.069,y,a],[x+.069,y,b],.13,.11,color.woodLight);
    }
  }
  for (const [z,depth] of [[z0,1],[z1,-1]]) {
    const side = [[backX,floor+.26,z],[x,floor+.26,z],[x,eave-.12,z],[backX,eave-.12,z]];
    panel(out,'wood',depth===1?side.toReversed():side,color.darkWood);
    if (lod < 1) continue;
    const posts = lod === 3 ? 12 : 6;
    for (let k = 0; k <= posts; k++) {
      const a = backX + .07 + (x-backX-.14)*k/posts;
      box(out,'wood',[a-.056,floor+.25,z-.052],[a+.056,eave-.15,z+.052],color.woodLight);
    }
  }
  for (let k = 1; k <= 4; k++) {
    const y = floor - .2 + .116 * k;
    box(out,'granite',[x,d.foundation,mid-1.28],[x+1.68-.25*k,y,mid+1.28],color.court);
  }
  flag(out,[x-.53,mid],ridge+.17,1.05);
}

function garuda(out, lod) {
  const [x,z] = d.court.garuda;
  const low = ground([x,z])+.13;
  const high = low+d.court.garudaHeight;
  box(out,'granite',[x-1.31,low-.26,z-1.33],[x+1.31,low+.31,z+1.33],color.worn);
  box(out,'granite',[x-.237,low+.31,z-.24],[x+.237,low+1.19,z+.24],color.stone);
  const rings = lod === 0 ? 8 : 12;
  coneProfile(out,'granite',[x,z],[[low+1.11,.258],[low+1.19,.263],[low+1.29,.229],
    [high-.65,.211],[high-.62,.298],[high-.48,.299],[high-.4,.224]],rings,color.carved);
  box(out,'granite',[x-.31,high-.44,z-.32],[x+.31,high-.24,z+.32],color.carved);
  coneProfile(out,'granite',[x,z],[[high-.27,.14],[high-.17,.221],[high+.11,.197],[high+.23,.09]],rings,color.carved);
  if (lod < 2) return;
  for (const direction of [-1,1]) {
    beam(out,'granite',[x-.018,high-.25,z+.03*direction],
      [x-.07,high+.045,z+.245*direction],.106,.14,color.carved);
    beam(out,'band',[x-1.03,low+.86,z+direction*1.016],[x+1.03,low+.86,z+direction*1.016],.046,.046,color.worn);
    for (const a of [-1.01,1.01]) {
      beam(out,'band',[x+a,low+.29,z+direction*1.016],[x+a,low+.88,z+direction*1.016],.046,.046,color.worn);
    }
  }
}

function court(out, lod) {
  const ring = oriented(d.court.plinthOuter);
  const at = ([x, z]) => [x, ground([x, z]) + .105, z];
  const limit = (points, axis, edge, direction) => {
    const kept = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const da = (a[axis] - edge) * direction, db = (b[axis] - edge) * direction;
      if (da >= 0) kept.push(a);
      if (da * db < 0) kept.push(a.map((v, j) => v + (b[j] - v) * da / (da - db)));
    }
    return kept;
  };
  const spacing = [12, 8, 5.4, 4][lod];
  const triangles = earcut(ring.flat(), null, 2);
  for (let i = 0; i < triangles.length; i += 3) {
    const triangle = triangles.slice(i, i + 3).map(index => ring[index]);
    for (let x = -33; x < 48; x += spacing) {
      const strip = limit(limit(triangle, 0, x, 1), 0, x + spacing, -1);
      if (strip.length < 3) continue;
      for (let z = -23; z < 14; z += spacing) {
        const clipped = limit(limit(strip, 1, z, 1), 1, z + spacing, -1);
        for (let j = 1; j + 1 < clipped.length; j++) {
          const [a, b, c] = [clipped[0], clipped[j], clipped[j + 1]];
          const area = (a[0] - b[0]) * (c[1] - b[1]) - (a[1] - b[1]) * (c[0] - b[0]);
          if (Math.abs(area) < .0001) continue;
          panel(out, 'granite', (area > 0 ? [a, b, c] : [c, b, a]).map(at), color.court);
        }
      }
    }
  }
}

function build(out, lod) {
  middleHalls(out,lod);
  const west = d.westSanctuary;
  shrine(out,west.ring,west.heightAboveFloor,west.courses,lod,false);
  const north = d.northSanctuary;
  shrine(out,rect(north.center,...north.radius),north.heightAboveFloor,north.courses,lod,true);
  gable(out,lod);
  court(out,lod);
  garuda(out,lod);
}

export const skyline = out => build(out,0);
export const district = out => build(out,1);
export const street = out => build(out,2);
export const closeup = out => build(out,3);

const recipe='danteshwari-temple-model.mjs';
const camera=[79,34,-60],lookAt=[-1,3.62,-3.7];
const field={descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'};
export const danteshwariModel = {
  id:plan.model,
  key:plan.model,
  title:plan.title,
  cell:plan.cell,
  recipe,
  sourceDocuments:plan.requiredSourceDocuments,
  surfaces,
  wikidataId:plan.wikidataId,
  category:'landmark',
  build:closeup,
  quality:'medium-fi-exterior',
  reviewStatus:'review-in-qa.json',
  geographicStatus:'geographic-preview',
  orientationPolicy:'mapped-exterior',
  groundContactBasis:'Original local elevation field samples the open courtyard. The approach and temple sill are modeled as approximate contacts.',
  brief:'East-facing historic Danteshwari Temple with terracotta timber hall, two white stepped shrine roofs and the Garuda pillar.',
  camera,
  lookAt,
  sunDirection:[54,57,-41],
  embeddedCanonicalGraphs:Object.values(surfaces).map(s=>s.graph).filter(Boolean),
  buildingCutout:{
    outline:d.outline,
    outlines:[d.outline,d.adjacent],
    minimumCoverage:.89,
    basis:'Exact separate mapped polygons for the axial temple and adjoining shrine.',
  },
  mediumFiContext:{scale:1,groundY:-.15,terrain:field},
  qaCameras:[
    {name:'east-forecourt-and-garuda-pillar',position:[58,7.9,2],lookAt:[23,3.23,-.37]},
    {name:'white-shrines-and-courtyard',position:[-46,15,-30],lookAt:[-15,6.3,-5]},
    {name:'terracotta-hall-and-west-sanctuary',position:[-41,22,38],lookAt:[-3,5.9,-.6]},
    {name:'temple-plan-and-axial-roofs',position:[36,63,-43],lookAt:[-1,4,-4]},
  ],
  qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({
    name:'danteshwari-'+reviewLod,position:camera,lookAt,reviewLod,
  })),
  runtimeLodOverlay:{
    module:'content/worldgen/source/places/'+plan.cell+'/'+plan.model+'/models/'+recipe,
    level:'skyline',export:'skyline',errorMeters:1.84,surfaces,
    authoredLevels:{
      district:{export:'district',errorMeters:.79,surfaces},
      street:{export:'street',errorMeters:.32,surfaces},
      closeup:{export:'closeup',errorMeters:.13,surfaces},
    },
  },
  limitations:plan.limitations,
  sourceLicense:'Original Molen model under the repository license. Uses factual written sources, original creator CC0 photographs and OpenStreetMap controls under ODbL 1.0.',
};
