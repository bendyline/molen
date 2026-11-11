/** The octagonal hall and four double-eaved wings in the May 2013 photographs. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const native = frame.geometry.polygons[0];
const { entryDeck, lowerWingEaves, upperWingEaves, drumBase, topEaves, upperRoofCrown, finialTop } = plan.section;
const parts = JSON.parse(fs.readFileSync(new URL('../native-map/roof-and-portico-controls.json',import.meta.url))).parts;
const outlineFor = id => parts.find(part=>part.id===id).local;
const crown = outlineFor(1521795697);
const drumOutline = outlineFor(1521795699);
const center = crown.reduce(([x,z],[a,b])=>[x+a/crown.length,z+b/crown.length],[0,0]);
const octagon = plan.centralOctagon.map(([x,z])=>[x+0.45,z]);
const foundation = native.map(([x,z])=>[0.45+(x-0.45)*1.014,z*1.013]);
const apron = native.map(([x,z])=>[0.45+(x-0.45)*1.13,z*(z>0?1.17:1.075)]);
const southColumns = parts.filter(part=>part.id>=1521795689&&part.id<=1521795696)
  .map(part=>part.local.reduce(([x,z],[a,b])=>[x+a/part.local.length,z+b/part.local.length],[0,0]));

const surfaces = {
  stone: {slot:'foundation',graph:'stone_granite',roughness:0.9,metallic:0},
  wall: {slot:'wall',graph:'stucco',roughness:0.91,metallic:0},
  roof: {slot:'roof',graph:'tile_glazed',roughness:0.75,metallic:0.02,doubleSided:true},
  wood: {slot:'trim',graph:'metal_painted',roughness:0.79,metallic:0},
  dark: {slot:'window',localRef:'palette:#ffffff',roughness:0.42,metallic:0},
};
const tone = Object.fromEntries(Object.entries({
  stone:'aba798', footing:'9d998d', wall:'dbc58a', pale:'e2d4af', red:'944638', door:'6c342c',
  roof:'446a92', edge:'345578', bright:'547ca1', rafter:'465f62', gold:'c7a558', dark:'38332e',
}).map(([key,value])=>[key,rgb(value)]));

function face(out,slot,points,desired,color=tone[slot]) {
  let n=normalFor(...points);
  if(n.reduce((s,v,i)=>s+v*desired[i],0)<0) {
    points=[...points].reverse();
    n=normalFor(...points);
  }
  if(points.length===4) quad(out,slot,points,n,color);
  else out.addTriangle(slot,'palette:#ffffff',points,n,[[0,0],[1,0],[0,1]],color);
}

function cap(out,slot,ring,y,color=tone[slot]) {
  const b=new MeshBufferBuilder();
  if(!b.addCap(slot,'palette:#ffffff',ring,[],()=>y,[0,1,0],p=>p,color)) throw Error('Hall cap');
  const mesh=b.finalize();
  for(let i=0;i<mesh.indices.length;i+=3){
    const p=Array.from(mesh.indices.slice(i,i+3),j=>Array.from(mesh.positions.slice(j*3,j*3+3)));
    face(out,slot,p,[0,1,0],color);
  }
}

const at=(p,y)=>[p[0],y,p[1]];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const scale=(ring,r)=>ring.map(p=>mix(center,p,r));
function wallRing(out,slot,ring,y0,y1,color) {
  for(let i=0;i<ring.length;i++){
    const a=ring[i], b=ring[(i+1)%ring.length];
    face(out,slot,[at(a,y0),at(b,y0),at(b,y1),at(a,y1)],[b[1]-a[1],0,a[0]-b[0]],color);
  }
}

function facade(a,b){
  const span=Math.hypot(b[0]-a[0],b[1]-a[1]), x=(b[0]-a[0])/span, z=(b[1]-a[1])/span;
  return {span, normal:[z,0,-x], p:(u,y,d=0)=>[a[0]+u*x+d*z,y,a[1]+u*z-d*x]};
}

function panel(out,slot,f,l,r,y0,y1,d,color) {
  if(r-l<0.001||y1-y0<0.001) return;
  const {p,normal}=f;
  face(out,slot,[p(l,y0,d),p(r,y0,d),p(r,y1,d),p(l,y1,d)],normal,color);
}

function band(out,slot,f,l,r,y0,y1,d0,d1,color) {
  const {p,normal}=f;
  panel(out,slot,f,l,r,y0,y1,d1,color);
  for(const [y,sign] of [[y0,-1],[y1,1]])
    face(out,slot,[p(l,y,d0),p(r,y,d0),p(r,y,d1),p(l,y,d1)],[0,sign,0],color);
  for(const [u,sign] of [[l,-1],[r,1]])
    face(out,slot,[p(u,y0,d0),p(u,y0,d1),p(u,y1,d1),p(u,y1,d0)],[-normal[2]*sign,0,normal[0]*sign],color);
}

function lathe(out,slot,[x,z],levels,sides,color) {
  const p=(j,[y,r])=>[x+r*Math.cos(2*Math.PI*j/sides),y,z+r*Math.sin(2*Math.PI*j/sides)];
  for(let k=1;k<levels.length;k++){
    for(let j=0;j<sides;j++){
      const a=p(j,levels[k-1]),b=p(j+1,levels[k-1]),c=p(j+1,levels[k]),d=p(j,levels[k]);
      const angle=2*Math.PI*(j+0.5)/sides, n=[Math.cos(angle),0,Math.sin(angle)];
      if(levels[k][1]===0) face(out,slot,[a,b,c],n,color);
      else face(out,slot,[a,b,c,d],n,color);
    }
  }
}

const ranges = [
  {side:'south',points:[15,0],back:-13.8,bays:7},
  {side:'west',points:[3,4],back:-11.6,bays:5},
  {side:'north',points:[7,8],back:-13.7,bays:5},
  {side:'east',points:[11,12],back:-11.6,bays:5},
];

function lowerWalls(out,lod) {
  wallRing(out,'stone',apron,-12.6,0.02,tone.footing);
  cap(out,'stone',apron,0.02,tone.stone);
  wallRing(out,'stone',foundation,0.02,entryDeck,tone.stone);
  cap(out,'stone',foundation,entryDeck,tone.stone);
  const faces=new Set([3,7,11,15]);
  for(let i=0;i<native.length;i++){
    const j=(i+1)%native.length;
    if(faces.has(i)) continue;
    const f=facade(native[i],native[j]);
    panel(out,'wall',f,0,f.span,entryDeck,lowerWingEaves,0,tone.wall);
    panel(out,'wood',f,0,f.span,10.92,11.68,0.045,tone.rafter);
    if(lod>=1&&f.span>6.4) panel(out,'dark',f,f.span*0.25,f.span*0.75,4.2,8.1,0.075,tone.dark);
  }
}

function doorBays(out,f,l,r,bottom,top,depth,lod) {
  if(lod<2){
    panel(out,'dark',f,l,r,bottom,top,depth,tone.door);
    if(lod===1) panel(out,'wood',f,(l+r)/2-0.11,(l+r)/2+0.11,bottom,top,depth+0.03,tone.red);
    return;
  }
  panel(out,'wood',f,l,r,bottom,top,depth,tone.red);
  const count=4;
  const w=(r-l)/count;
  for(let i=0;i<count;i++){
    const x=l+i*w;
    panel(out,'dark',f,x+0.12,x+w-0.12,bottom+0.38,top-0.24,depth+0.04,tone.dark);
    if(lod>=1) panel(out,'wood',f,x+0.11,x+w-0.11,(bottom+top)/2-0.055,(bottom+top)/2+0.055,depth+0.06,tone.red);
    if(lod>=2) panel(out,'wood',f,x+w/2-0.035,x+w/2+0.035,bottom+0.28,top-0.23,depth+0.065,tone.red);
  }
}

function brackets(out,f,depth,y,lod) {
  panel(out,'wood',f,-0.24,f.span+0.24,y-0.52,y+0.17,depth,tone.rafter);
  if(lod<2) return;
  const pitch=1.28;
  for(let u=0.43;u<f.span-0.3;u+=pitch) {
    const p=f.p(u,y-0.32,depth),q=f.p(u,y+0.27,depth+0.46);
    beam(out,'wood',p,q,0.18,0.19,tone.gold);
    if(lod>=2) panel(out,'wood',f,u-0.35,u+0.35,y-0.7,y-0.55,depth+0.032,tone.bright);
  }
}

function wingFacade(out,f,south,bays,lod) {
  const depth=south?-2.55:-0.05;
  panel(out,'wall',f,0,f.span,entryDeck,lowerWingEaves,depth,tone.wall);
  const step=f.span/bays;
  for(let j=0;j<bays;j++){
    const left=j*step+0.65,right=(j+1)*step-0.65;
    doorBays(out,f,left,right,2.67,6.12,depth+0.06,lod);
    doorBays(out,f,left,right,6.68,10.33,depth+0.06,lod);
  }
  panel(out,'wood',f,0,f.span,6.08,6.59,depth+0.095,tone.pale);
  if(lod||south) for(let j=0;j<=bays;j++){
    const [x,,z]=f.p(0.4+j*(f.span-0.8)/bays,0,0.1);
    const location=south?southColumns[j]:[x,z];
    const rows=lod<2?[[entryDeck,0.36],[11.42,0.31]]:[[entryDeck,0.48],[2.63,0.48],[2.84,0.36],[10.87,0.31],[11.42,0.45]];
    lathe(out,'wood',location,rows,lod>=2?10:lod===1?6:4,tone.red);
  }
  if(lod) band(out,'wood',f,-0.27,f.span+0.27,10.99,11.65,-0.24,0.36,tone.bright);
  else panel(out,'wood',f,-0.27,f.span+0.27,10.99,11.65,0.36,tone.bright);
  brackets(out,f,0.55,12.04,lod);
  if(south&&lod) {
    const mid=f.span/2;
    band(out,'wood',f,mid-3.36,mid+3.36,11.02,11.62,0.36,0.44,tone.edge);
    for(let j=-1;j<=1;j++) panel(out,'wood',f,mid+j*1.45-0.29,mid+j*1.45+0.29,11.18,11.42,0.46,tone.gold);
  }
}

function wingRoof(out,f,back,y,rise,lod,gabled) {
  // The lower eave is swept upward at both ends. Side ranges have a
  // triangular red window set into their upper roof.
  const rows=lod===0?[{t:0,h:0},{t:1,h:1}]:[{t:0,h:0},{t:0.36,h:0.26},{t:0.72,h:0.61},{t:1,h:1}];
  const segments=lod===0?3:lod===1?6:13;
  const p=(j,{t,h},sign)=>{
    const s=j/segments, v=Math.abs(2*s-1), turn=v*v*v*v;
    const left=-1.38+t*2.05, right=f.span+1.38-t*2.05;
    const d=sign===1?1.63+(back/2-1.63)*t:back-0.8+(back/2-back+0.8)*t;
    const ridge=gabled?1.86*(1-v)*t:0;
    return f.p(left+(right-left)*s,y+rise*h+0.88*turn*(1-t)+ridge,d);
  };
  for(const sign of [-1,1]){
    for(let k=1;k<rows.length;k++) for(let j=0;j<segments;j++)
      face(out,'roof',[p(j,rows[k-1],sign),p(j+1,rows[k-1],sign),p(j+1,rows[k],sign),p(j,rows[k],sign)],[0,1,0],k===1?tone.bright:tone.roof);
    if(lod>=2) for(let j=0;j<segments;j++)
      beam(out,'wood',p(j,rows[0],sign),p(j+1,rows[0],sign),0.17,0.22,tone.edge);
  }
  for(const j of [0,segments]){
    const sign=j===0?-1:1;
    const normal=[-f.normal[2]*sign,0,f.normal[0]*sign];
    for(let k=1;k<rows.length;k++){
      if(k===rows.length-1) face(out,'roof',[p(j,rows[k-1],1),p(j,rows[k-1],-1),p(j,rows[k],1)],normal,tone.roof);
      else face(out,'roof',[p(j,rows[k-1],1),p(j,rows[k-1],-1),p(j,rows[k],-1),p(j,rows[k],1)],normal,tone.roof);
    }
  }
}

function attachedRanges(out,lod) {
  for(const range of ranges){
    const f=facade(...range.points.map(i=>native[i]));
    const south=range.side==='south';
    wingFacade(out,f,south,range.bays,lod);
    wingRoof(out,f,range.back,lowerWingEaves,4.6,lod,false);
    const [a,b]=[f.p(2.5,0,-4.05),f.p(f.span-2.5,0,-4.05)];
    const upper=facade([a[0],a[2]],[b[0],b[2]]);
    panel(out,'wall',upper,-0.2,upper.span+0.2,15.75,upperWingEaves,0,tone.wall);
    if(!south){
      const p=upper.p, x=upper.span/2;
      face(out,'wall',[p(x-12.8,18.55,0.22),p(x+12.8,18.55,0.22),p(x,24.06,0.22)],upper.normal,tone.pale);
      doorBays(out,upper,x-5.1,x+5.1,18.86,20.59,0.27,lod);
      beam(out,'roof',p(x-12.8,18.58,0.25),p(x,24.06,0.25),0.27,0.29,tone.edge);
      beam(out,'roof',p(x,24.06,0.25),p(x+12.8,18.58,0.25),0.27,0.29,tone.edge);
    } else brackets(out,upper,0.08,17.89,lod);
    wingRoof(out,upper,range.back-1.5,upperWingEaves,4.5,lod,!south);
    if(south) for(let i=0;i<(lod?6:3);i++){
      const w=f.span-7.2;
      const ratio=i/(lod?5:2);
      const d=3.4-ratio*2.4;
      band(out,'stone',f,(f.span-w)/2,(f.span+w)/2,-0.22,0.34+ratio*1.685,0,d,tone.stone);
    }
  }
}

function drum(out,lod){
  const upper=drumOutline;
  wallRing(out,'wall',octagon,14.6,drumBase,tone.wall);
  wallRing(out,'wood',scale(octagon,1.013),drumBase-1.18,drumBase+0.02,tone.bright);
  cap(out,'wall',octagon,drumBase,tone.pale);
  wallRing(out,'wall',upper,drumBase,topEaves-0.02,tone.wall);
  for(let i=0;i<upper.length;i++){
    const f=facade(upper[i],upper[(i+1)%upper.length]), count=5, cell=f.span/count;
    for(let j=0;j<count;j++){
      const u=j*cell;
      doorBays(out,f,u+0.45,u+cell-0.45,26.23,32.3,0.07,lod);
      if(lod>=1) panel(out,'wall',f,u+0.18,u+0.38,26.1,32.75,0.09,tone.pale);
    }
    brackets(out,f,0.075,33.41,lod);
  }
}

function octagonalRoof(out,lod) {
  const rows=lod===0?[[0,1.005],[0.24,0.59],[0.58,0.25],[1,0.027]]:[[0,1.005],[0.18,0.69],[0.4,0.43],[0.66,0.23],[0.85,0.10],[1,0.027]];
  const n=[3,5,12,16][lod];
  const roof=(i,j,[h,r])=>{
    const t=j/n, v=Math.abs(t*2-1), lift=v*v*v*v;
    const a=crown[i],b=crown[(i+1)%crown.length];
    return at(mix(center,mix(a,b,t),r),topEaves+(upperRoofCrown-topEaves)*h+1.1*lift*(1-h));
  };
  for(let i=0;i<octagon.length;i++){
    for(let k=1;k<rows.length;k++){
      for(let j=0;j<n;j++){
        const p=[roof(i,j,rows[k-1]),roof(i,j+1,rows[k-1]),roof(i,j+1,rows[k]),roof(i,j,rows[k])];
        face(out,'roof',p,[0,1,0],k===1?tone.bright:tone.roof);
      }
      if(lod) beam(out,'wood',roof(i,0,rows[k-1]),roof(i,0,rows[k]),0.24,0.27,tone.edge);
    }
    if(lod>=2) for(let j=0;j<n;j++) beam(out,'wood',roof(i,j,rows[0]),roof(i,j+1,rows[0]),0.18,0.26,tone.edge);
    if(lod>=2){
      for(let j=0;j<3;j++){
        const [x,y,z]=roof(i,j,rows[0]);
        lathe(out,'wood',[x,z],[[y,0.17],[y+0.29-j*0.055,0.13],[y+0.54-j*0.1,0]],4,tone.gold);
      }
    }
  }
  cap(out,'roof',scale(crown,0.027),upperRoofCrown,tone.roof);
  lathe(out,'wood',center,[[46.48,0.61],[46.83,0.69],[47.13,0.43],[47.43,0.48],[47.94,0.59],[48.34,0.48],[finialTop,0]],lod>=2?12:8,tone.gold);
}

function build(out,_frame,lod=3){
  lowerWalls(out,lod);
  attachedRanges(out,lod);
  drum(out,lod);
  octagonalRoof(out,lod);
}
export const memorialSkyline=(out,frame)=>build(out,frame,0);
export const memorialDistrict=(out,frame)=>build(out,frame,1);
export const memorialStreet=(out,frame)=>build(out,frame,2);
export const memorialCloseup=(out,frame)=>build(out,frame,3);

const recipe='memorial-model.mjs';
const camera=[55,38,111],lookAt=[0,21,7];
export const memorialModel={
  id:plan.model,key:plan.model,title:plan.title,cell:plan.cell,wikidataId:plan.wikidataId,
  recipe,surfaces,build,quality:'medium-fi-exterior',reviewStatus:'review-in-qa.json',
  geographicStatus:'historical-proposal',orientationPolicy:'approximate-visualization',progressLedger:'qualla-003.PROGRESS.md',
  brief:'Sun Yat-sen Memorial Hall in Guangzhou with its octagonal blue roof, gold finial, and four glazed double-eaved ranges.',
  appearance:{kind:'historical',representedDate:plan.representedDate,validFrom:plan.validFrom,validUntil:plan.validUntil,currentWorldEligible:false},
  camera,lookAt,portableGroundY:-0.18,
  groundCutout:{outline:apron,basis:'Limit the display opening to the estimated granite platform and attached entrance stair apron. This prevents the independent surface from rising through the hall and steps while preserving its original samples.'},
  buildingCutout:{outline:native,minimumCoverage:0.96,basis:'Suppress only the generic shape matching the mapped memorial hall footprint.'},
  mediumFiContext:{scale:1.65,groundY:-0.15,terrain:{descriptor:'terrain-review.terrain.json',heightmap:'terrain-review.height.png'}},
  embeddedCanonicalGraphs:['stone_granite','stucco','tile_glazed','metal_painted'],
  qaCameras:[
    {name:'south-portico-and-octagonal-crown',position:[6,21,114],lookAt:[0,23,6]},
    {name:'gabled-range-and-painted-brackets',position:[82,24,25],lookAt:[12,20,3]},
    {name:'blue-glazed-eaves-and-finial',position:[47,51,63],lookAt:[1,33,6]},
  ],
  qaLodCameras:['skyline','district','street','closeup'].map(reviewLod=>({name:'whole-guangzhou-memorial-hall-'+reviewLod,position:camera,lookAt,reviewLod})),
  runtimeLodOverlay:{
    module:'content/worldgen/source/places/'+plan.cell+'/'+plan.model+'/models/'+recipe,
    level:'skyline',export:'memorialSkyline',errorMeters:0.48,surfaces,
    authoredLevels:Object.fromEntries([
      ['district','memorialDistrict',0.24],['street','memorialStreet',0.085],['closeup','memorialCloseup',0.03],
    ].map(([name,exportName,errorMeters])=>[name,{export:exportName,errorMeters,surfaces}])),
  },
  limitations:plan.limitations,
  sourceLicense:'Original deterministic geometry under the repository license. Huangdan2060 released the cited original photographs under CC0. OpenStreetMap contributors supply the mapped controls under ODbL.',
};
