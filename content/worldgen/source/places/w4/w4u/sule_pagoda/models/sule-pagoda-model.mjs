import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign, at, block, cap, closed, edge, face, floorSampler, mix, opening, palette, pairs,
  panel, planarMid, rect, ring, shell, surface, up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = name => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const y = d.floor;
const colors = palette({
  gold:'d0ab47', goldBright:'e0bc5c', goldDeep:'b38c39', goldTop:'b9963b',
  stone:'d2c6a3', plaster:'dbd3b8', foot:'b3a386', paved:'b4aa93', red:'855442',
  roof:'648074', roofSide:'65736a', roofDeep:'516b61', opening:'524f40',
});
const surfaces = {
  gold: surface('roof','metal_painted',.52,.43),
  masonry: surface('wall','plaster_lime',.94),
  court: surface('foundation','stone_limestone',.92),
  roof: surface('trim','tile_flat',.84),
  trim: surface('door','wood_painted_lap',.9),
  shadow: {slot:'window',localRef:'palette:#ffffff',roughness:.94,metallic:0},
};
const [sx,sz] = d.stupa.center;

function mass(out, slot, outline, floor, height, tint, roof = slot, roofTint = tint) {
  shell(out,outline,()=>floor,height,{wall:slot,color:tint,roof,roofColor:roofTint});
}

function loft(out, slot, center, footprint, levels, tint) {
  const s = areaSign(footprint);
  const local = ([x,z],radius,y) => [mix(center[0],x,radius),y,mix(center[1],z,radius)];
  for (const [[y,r],[h,rr]] of pairs(levels)) {
    for (let i=0;i<footprint.length;i++){
      const a=footprint[i],b=footprint[(i+1)%footprint.length];
      const contact=edge(a,b,s).normal;
      const target=[contact[0],Math.abs(y-h)<.012?1:0,contact[2]];
      face(out,slot,[local(a,r,y),local(b,r,y),local(b,rr,h),local(a,rr,h)],target,tint);
    }
  }
}

const bands = [
  [0,1],[.47,1],[.66,.986],[1.17,.985],[1.43,.961],[1.62,.909],
  [2.03,.903],[2.26,.934],[2.57,.933],[2.74,.898],[3.0,.844],
  [3.26,.832],[3.52,.853],[3.81,.851],[3.98,.81],[4.3,.758],
  [4.75,.744],[4.99,.763],[5.26,.761],[5.42,.718],[5.96,.687],
  [6.28,.685],[6.51,.697],[6.78,.69],[7.12,.631],[7.63,.617],
  [8,.602],[8.16,.625],[8.41,.625],[8.69,.592],[9.16,.573],
  [9.53,.587],[9.75,.583],[10.08,.551],
];
const bell = [
  [10.08,.551],[10.4,.545],[10.68,.567],[11.06,.555],[11.68,.516],
  [13.03,.5],[14.57,.479],[16.12,.451],[17.8,.407],[19.6,.356],
  [21.36,.314],[23.08,.275],[25.04,.237],[27.3,.202],[29.53,.176],
  [31.47,.149],[33.89,.122],[36.11,.098],[38.37,.074],[39.42,.065],
];
const hti = [
  [39.41,.064],[39.67,.083],[39.99,.083],[40.3,.069],
  [40.84,.078],[41.02,.076],[41.27,.064],[41.83,.069],
  [42.07,.067],[42.37,.053],[42.66,.061],[42.95,.057],
  [43.23,.046],[43.6,.048],[43.96,.039],[44.27,.033],
  [44.7,.026],[45.07,.018],[45.41,.026],[45.67,.018],
  [46.0248,.005],
];

function stupa(out,lod) {
  const center=d.stupa.center,foot=d.core;
  const subset = (values, interval) =>
    values.filter((_,i)=>i%interval===0||i===values.length-1).map(([h,r])=>[y+h,r]);
  mass(out,'court',foot,Math.min(...foot.map(grade),y)-.38,y+.42,colors.foot);
  loft(out,'gold',center,foot,subset(bands,[4,2,1,1][lod]),colors.goldDeep);
  loft(out,'gold',center,foot,subset(bell,[3,2,1,1][lod]),colors.gold);
  loft(out,'gold',center,foot,subset(hti,[4,2,1,1][lod]),colors.goldBright);
  if (lod===0) return;
  const trims=[
    [1.42,.964],[2.4,.936],[3.65,.855],[5.12,.767],[6.66,.703],[8.3,.634],
    [9.63,.593],[10.83,.568],[17.46,.421],[19.42,.367],[21.31,.323],
    [23.05,.284],[25.02,.249],[26.98,.215],[29.42,.186],[31.42,.157],
    [33.75,.133],[35.94,.11],[38.08,.087],
  ];
  for (const [index,[height,radius]] of trims.entries()) {
    if (lod===1 && index%2===1) continue;
    loft(out,'gold',center,foot,[[y+height-.105,radius-.008],[y+height+.013,radius+.002],[y+height+.123,radius-.009]],colors.goldBright);
  }
  if (lod<2) return;
  for (const [index,[h,r]] of hti.entries()) {
    if (index===0||index>17||index%3!==0) continue;
    const radius=r*18.9;
    for (let spoke=0;spoke<8;spoke++) {
      const a=spoke*Math.PI/4;
      const x=sx+radius*Math.cos(a),z=sz+radius*Math.sin(a);
      const n=lod===2?4:6;
      ring(out,'gold',[x,z],[[y+h-.37,.052],[y+h-.23,.11],[y+h-.1,.061]],n,colors.goldDeep);
    }
  }
}

function facade(out, outline, floor, eave, lod, inward) {
  const signed = areaSign(outline);
  for (const [a,b] of pairs(closed(outline))) {
    const w=edge(a,b,signed);
    if (w.length<3.9) continue;
    const mid=at(planarMid([a,b]),0),r=Math.hypot(mid[0]-sx,mid[2]-sz);
    if (inward && r>31) continue;
    const count=Math.max(1,Math.round(w.length/(lod<2?6.2:4.05)));
    panel(out,'trim',w,0,w.length,floor+.06,floor+.37,.05,colors.red);
    for (let i=0;i<count;i++) {
      const u=(i+.5)*w.length/count;
      const half=Math.min(.89,w.length/count*.28);
      opening(out,w,u-half,u+half,floor+.37,Math.min(floor+2.74,eave-.55),'trim',colors.opening,'shadow',colors.stone,lod,.055);
      if (lod===3) {
        for (const dx of [-.34,.34]) {
          panel(out,'trim',w,u+dx-.028,u+dx+.028,floor+.41,floor+2.72,.087,colors.foot);
        }
      }
    }
  }
}

function ranges(out,lod) {
  for (const part of d.ranges) {
    const outline=part.ring,ceiling=d.courtFloor+part.wallHeight;
    mass(out,'masonry',outline,part.foundation,ceiling,colors.plaster,'roof',colors.roofSide);
    if (lod<2) continue;
    const midpoint=planarMid(outline);
    const inner=outline.map(([x,z])=>[mix(midpoint[0],x,.9),mix(midpoint[1],z,.9)]);
    const orientation=areaSign(outline);
    const y1=ceiling+.56;
    for (let i=0;i<outline.length;i++) {
      const j=(i+1)%outline.length;
      const direction=edge(outline[i],outline[j],orientation).normal;
      face(out,'roof',[at(outline[i],ceiling),at(outline[j],ceiling),at(inner[j],y1),at(inner[i],y1)],
        [direction[0],1,direction[2]],colors.roofSide);
    }
    cap(out,'roof',inner,y1,colors.roofSide);
    facade(out,outline,d.courtFloor,ceiling,lod,false);
  }
}

function pavilionRoof(out, xf, bounds, eave, crest, lod, i, tint) {
  const [a,b,c,d]=bounds;
  const center=(a+b)*.5;
  const line=[[center,crest,c-.035],[center,crest,d+.036]];
  for (const side of [a,b]) {
    const target=side===a?-1:1;
    const flat=[xf(line[0]),xf(line[1]),xf([side,eave,d]),xf([side,eave,c])];
    face(out,'roof',flat,up,tint);
    if (lod===0) continue;
    const trimFront=xf([side,eave,c-.026]),trimBack=xf([side,eave,d+.026]);
    beamPath(out,'gold',[trimFront,trimBack],.14,.12,colors.goldDeep);
    const t=(v)=>xf([mix(center,side,v),mix(crest,eave,v)+.049,d+.018]);
    beamPath(out,'gold',[t(0),t(.35),t(.73),t(1)],.15,.13,colors.goldBright);
    const corner=xf([side,eave+.075,d+.029]);
    if (lod>1&&i<3) {
      const rise=xf([side+target*.19,eave+.45,d+.055]);
      beamPath(out,'gold',[corner,rise],.11,.095,colors.gold);
    }
  }
  const front=xf([center,0,d+1]);
  const back=xf([center,0,d]);
  const outward=[front[0]-back[0],0,front[2]-back[2]];
  for (const [z,sign] of [[d,1],[c,-1]]) {
    const points=[xf([a,eave,z]),xf([center,crest,z]),xf([b,eave,z])];
    face(out,'trim',points,outward.map(v=>v*sign),colors.red);
    if (lod>1) {
      const mid=xf([center,(eave+crest)*.5,z+sign*.032]);
      const dx=xf([center+1,0,z]).map((v,k)=>v-xf([center,0,z])[k]);
      const radius=Math.min(.54,(crest-eave)*.32);
      const leaf=Array.from({length:9},(_,j)=>{
        const t=j*2*Math.PI/9;
        return [mid[0]+dx[0]*radius*Math.cos(t),mid[1]+radius*Math.sin(t),mid[2]+dx[2]*radius*Math.cos(t)];
      });
      face(out,'gold',leaf,outward.map(v=>v*sign),colors.goldBright);
    }
  }
}

function ringDecor(out,xf,u,v,floor,peak,lod) {
  const [x,,z]=xf([u,0,v]);
  const span=peak-floor;
  const shape=lod===0?[[0,.68],[.55,.53],[.78,.32],[1,.026]]:
    [[0,.7],[.14,.73],[.22,.57],[.36,.59],[.48,.49],[.61,.39],[.75,.25],[.86,.17],[1,.022]];
  ring(out,'gold',[x,z],shape.map(([h,r])=>[mix(floor,peak,h),r*span*.33]),lod===0?6:lod===1?8:12,colors.gold);
}

function pavilions(out,lod) {
  const rotations={north:[-1,-1],east:[1,1],south:[1,1],west:[-1,-1]};
  for (const p of d.hallControls) {
    const origin=planarMid(p.ring),center=origin;
    const [a,b]=rotations[p.direction],vertical=p.direction==='north'||p.direction==='south';
    const local=([x,z])=>vertical?[(x-center[0])*a,(z-center[1])*b]:[(z-center[1])*a,(x-center[0])*b];
    const xf=([u,h,v])=>vertical?[center[0]+a*u,h,center[1]+b*v]:
      [center[0]+b*v,h,center[1]+a*u];
    const samples=p.ring.map(local);
    const low=Math.min(...samples.map(q=>q[0])), high=Math.max(...samples.map(q=>q[0]));
    const inner=Math.min(...samples.map(q=>q[1])), outer=Math.max(...samples.map(q=>q[1]));
    const w=high-low,l=outer-inner,middle=(low+high)*.5,ridge=(inner+outer)*.5;
    const eave=p.floor+p.wallHeight;
    mass(out,'masonry',p.ring,p.foundation,eave,colors.stone);
    if (lod>0) facade(out,p.ring,p.floor,eave,lod,true);
    pavilionRoof(out,xf,[low-.38,high+.38,inner-.31,outer+.59],eave-.01,eave+2.72,lod,0,colors.roof);
    const towerStart=eave+2.12;
    pavilionRoof(out,xf,[middle-w*.34,middle+w*.34,ridge-l*.33,ridge+l*.44],
      towerStart,towerStart+2.12,lod,1,colors.roofDeep);
    pavilionRoof(out,xf,[middle-w*.225,middle+w*.225,ridge-l*.18,ridge+l*.31],
      towerStart+1.85,towerStart+3.22,lod,2,colors.roof);
    ringDecor(out,xf,middle,ridge+l*.15,towerStart+2.94,p.floor+p.towerHeight,lod);

    if (lod===0) continue;
    for (const across of [-1,1]) {
      const u=middle+across*w*.28;
      const [x,,z]=xf([u,0,outer-.075]);
      const top=eave-.03;
      block(out,'trim',x-.16,p.floor,z-.16,.32,top-p.floor,.32,colors.red);
      if (lod>1) ringDecor(out,xf,u,outer+.15,top-.1,top+1.11,lod);
    }
    const gateZ=outer+.045,floor=p.floor,head=floor+3.02;
    const front=xf([0,0,outer+1]).map((v,i)=>v-xf([0,0,outer])[i]);
    const recess=[xf([middle-1.45,floor,gateZ]),xf([middle-1.45,head,gateZ]),
      xf([middle,head+.82,gateZ]),xf([middle+1.45,head,gateZ]),xf([middle+1.45,floor,gateZ])];
    face(out,'shadow',recess,front,colors.opening);
    if (lod>1)
      beamPath(out,'gold',recess.map(([x,y,z])=>[x+.042*front[0],y,z+.042*front[2]]),.125,.108,colors.goldDeep);
  }
}

function precinct(out,lod) {
  mass(out,'court',d.outline,d.foundation,d.courtFloor-.07,colors.paved);
  if (lod===0) return;
  const bands = [0, 4, 8, 12][lod];
  const contact = (point, fraction) => {
    const xz = [mix(sx, point[0], fraction), mix(sz, point[1], fraction)];
    return at(xz, Math.max(d.courtFloor, grade(xz) + .105));
  };
  for (const [a, b] of pairs(closed(d.outline))) {
    face(out,'court',[contact(a,0),contact(a,1/bands),contact(b,1/bands)],up,colors.paved);
    for (let i=1;i<bands;i++) {
      const innerA=contact(a,i/bands), innerB=contact(b,i/bands);
      const outerA=contact(a,(i+1)/bands), outerB=contact(b,(i+1)/bands);
      face(out,'court',[innerA,outerA,outerB],up,colors.paved);
      face(out,'court',[innerA,outerB,innerB],up,colors.paved);
    }
  }
  const r=18;
  for (const angle of [0,Math.PI*.5,Math.PI,Math.PI*1.5]) {
    const [x,z]=[sx+r*Math.cos(angle),sz+r*Math.sin(angle)];
    const plinthTop=Math.max(d.courtFloor+.14,grade([x,z])+.13);
    const from=rect(x-1.44,z-1.44,x+1.44,z+1.44);
    mass(out,'court',from,Math.min(d.courtFloor,plinthTop-.3),plinthTop+.08,colors.stone);
  }
}

function build(out,lod) {
  precinct(out,lod);
  stupa(out,lod);
  ranges(out,lod);
  pavilions(out,lod);
}

export const skyline=out=>build(out,0);
export const district=out=>build(out,1);
export const street=out=>build(out,2);
export const closeup=out=>build(out,3);
const recipe='sule-pagoda-model.mjs';
const camera=[101,59,107],lookAt=[0,14,0];
const field={descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'};
export const suleModel={
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
  groundContactBasis:'The sample in the north court fixes the vertical datum. Foundations use independent grade samples around the outer precinct and stupa.',
  brief:'The gilt octagonal Sule stupa, 151 feet high, with the four cardinal worship halls and mapped perimeter ranges in central Yangon.',
  camera,
  lookAt,
  sunDirection:[-45,71,39],
  embeddedCanonicalGraphs:Object.values(surfaces).map(s=>s.graph).filter(Boolean),
  buildingCutout:{
    outline:d.outline,
    outlines:[d.core,...d.hallControls.map(s=>s.ring),...d.ranges.map(s=>s.ring)],
    minimumCoverage:.9,
    basis:'Native stupa and eight building outlines suppress generic volumes within the mapped roadside precinct.',
  },
  mediumFiContext:{scale:1,groundY:-.15,terrain:field},
  qaCameras:[
    {name:'octagonal-stupa-and-hti',position:[50,38,-49],lookAt:[0,24,0]},
    {name:'east-worship-hall-and-gilded-terraces',position:[78,11,8],lookAt:[13,9,0]},
    {name:'four-cardinal-worship-halls',position:[91,78,-84],lookAt:[0,12,0]},
    {name:'sule-pagoda-and-precinct',position:[-104,63,112],lookAt:[0,14,0]},
  ],
  qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({
    name:'sule-pagoda-'+reviewLod,position:camera,lookAt,reviewLod,
  })),
  runtimeLodOverlay:{
    module:'content/worldgen/source/places/'+plan.cell+'/'+plan.model+'/models/'+recipe,
    level:'skyline',export:'skyline',errorMeters:2.37,surfaces,
    authoredLevels:{
      district:{export:'district',errorMeters:1.05,surfaces},
      street:{export:'street',errorMeters:.43,surfaces},
      closeup:{export:'closeup',errorMeters:.16,surfaces},
    },
  },
  limitations:plan.limitations,
  sourceLicense:'Original model under the repository license. Two published Qualla photographs are public-domain archival originals. Native map controls are ODbL 1.0.',
};
