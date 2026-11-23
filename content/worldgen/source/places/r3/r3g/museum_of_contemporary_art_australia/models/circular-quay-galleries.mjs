import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fan, fbox, opening, outwardRing, quad4, rgb, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap, clock } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  sand: { slot: 'wall', graph: 'stone_sandstone', roughness: .94 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: .91 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: .95 },
  panels: { slot: 'wall', graph: 'concrete_panel', roughness: .91 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: .91 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: .85 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: .57 },
};
const sand=rgb('b29a74'), cream=rgb('c1ac89'), aged=rgb('93836b'), masonry=rgb('9d9c8f');
const glass=rgb('547786'), deep=rgb('425960'), roof=rgb('9e9c8e'), steel=rgb('657271');
const tones={white:rgb('cbc9bf'),charcoal:rgb('676966'),umber:rgb('665654')};
const {old,modern,apron}=site;
const edges=ring=>outwardRing(ring).map((a,i,r)=>wallFace(a,r[(i+1)%r.length])).filter(f=>f.length>.025);
const middle=ring=>ring.reduce(([x,z],[a,b])=>[x+a/ring.length,z+b/ring.length],[0,0]);

function panel(out,slot,f,from,to,bottom,top,d,color) {
  const p=f.P;
  quad4(out,slot,p(from,bottom,d),p(to,bottom,d),p(to,top,d),p(from,top,d),color);
}
function band(out,slot,f,bottom,top,d,color) {
  panel(out,slot,f,0,f.length,bottom,top,d,color);
}

function historicBlock(out,detail) {
  for(const plan of old.footprints){
    for(const [i,f] of edges(plan).entries()){
      band(out,'base',f,site.foundation,.64,0,masonry);
      band(out,'sand',f,.64,old.eave,0,i%5===1?cream:sand);
      band(out,'trim',f,old.eave-.54,old.eave,.076,aged);
      band(out,'trim',f,18.11,18.31,.053,aged);
      if(!detail) continue;
      const count=Math.round(f.length/[4.52,4.52,3.67,3.32][detail]);
      for(let j=0;j<count;j++){
        const u=(j+.5)*f.length/count;
        const span=Math.min(1.51,.52*f.length/count);
        for(const y of [1.24,4.41,7.68,10.91,14.21,17.12]){
          opening(out,f,u,y,span,y===17.12?1.2:1.77,{
            glassSlot:'glazing',frameSlot:'trim',glass:(j+Math.round(y))%3?glass:deep,
            frame:aged,frameWidth:detail>1?.074:0,sill:detail>1,
            transoms:detail===3?1:0,d:.024,
          });
        }
        if(detail>1 && j) {
          const x=j*f.length/count;
          fbox(out,'sand',f,x-.113,x+.113,3.83,16.87,.009,.08,cream);
        }
      }
    }
    cap(out,'roof',plan,old.eave,roof);
  }
  for(const terrace of old.terraces){
    const c=middle(terrace.outline);
    const ring=terrace.outline.map(([x,z])=>[c[0]+(x-c[0])*.89,c[1]+(z-c[1])*.918]);
    for(const f of edges(ring)){
      band(out,'glazing',f,old.eave,terrace.eave-.46,0,glass);
      band(out,'roof',f,terrace.eave-.46,terrace.eave,.025,steel);
      if(detail){
        const n=Math.ceil(f.length/(detail>1?2.11:5.95));
        for(let j=1;j<n;j++){
          const u=j*f.length/n;
          panel(out,'metal',f,u-.029,u+.029,old.eave+.03,terrace.eave-.46,.018,steel);
        }
      }
    }
    cap(out,'roof',ring,terrace.eave,roof);
  }
}

function clockBay(out,detail) {
  const {outline,height,finial}=old.clock;
  for(const f of edges(outline)){
    band(out,'sand',f,old.eave,height,0,sand);
    band(out,'trim',f,height-.87,height-.45,.119,aged);
    band(out,'trim',f,height-.26,height+.011,.158,cream);
    if(detail===0||f.length<5)continue;
    for(const u of [f.length*.28,f.length*.5,f.length*.72])
      opening(out,f,u,old.eave+.61,1.14,2.73,{glassSlot:'glazing',frameSlot:'trim',
        frame:aged,glass:deep,frameWidth:detail>1?.09:0,d:.029});
    if(detail>1)for(const u of [.61,f.length-.61])
      fbox(out,'trim',f,u-.16,u+.16,old.eave,height-.45,.015,.179,cream);
  }
  cap(out,'roof',outline,height,roof);
  const f=wallFace(...old.clock.face),center=f.length*.5;
  if(detail){
    clock(out,f,center,height-2.58,.86,detail,.198);
  }else{
    fan(out,'metal',Array.from({length:10},(_,i)=>{
      const a=2*Math.PI*i/10;
      return f.P(center+.89*Math.cos(a),height-2.58+.89*Math.sin(a),.205);
    }),aged);
  }
  const [x,z]=middle(outline);
  fbox(out,'sand',f,center-.7,center+.7,height,finial-.07,-7.81,-6.41,cream);
  beam(out,'metal',[x,finial-.2,z],[x,finial+1.67,z],.037,.037,steel);
}

function mordantWing(out,detail) {
  for(const ring of modern){
    for(const f of edges(ring)){
      band(out,'base',f,site.foundation,.69,0,masonry);
      const entry=f.normal[0]>.82&&Math.hypot(f.origin[0]-site.entry[0],f.origin[1]-site.entry[1])<16.9;
      band(out,entry?'glazing':'panels',f,.69,6.82,0,entry?glass:tones.white);
      if(detail && entry){
        const n=Math.ceil(f.length/(detail>1?1.61:3.1));
        for(let j=1;j<n;j++){
          const u=j*f.length/n;
          panel(out,'metal',f,u-.038,u+.038,.69,6.82,.018,steel);
        }
        band(out,'metal',f,3.62,3.71,.019,steel);
      }
    }
    cap(out,'panels',ring,6.82,tones.white);
  }
  for(const {footprints,bottom,top,tone} of site.cubes){
    for(const ring of footprints){
      for(const f of edges(ring)){
        const window=f.normal[0]>.7&&tone!=='white'&&f.length>1.44&&top>16.8;
        const head=window?top-.67:bottom;
        band(out,'panels',f,bottom,window?bottom+.54:top,0,tones[tone]);
        if(window){
          band(out,'glazing',f,bottom+.54,head,-.036,deep);
          band(out,'panels',f,head,top,0,tones[tone]);
          if(detail>1){
            const n=Math.max(1,Math.round(f.length/2.34));
            for(let i=1;i<n;i++){
              const u=i*f.length/n;
              panel(out,'metal',f,u-.037,u+.037,bottom+.54,head,.02,steel);
            }
          }
        }else if(detail>1&&f.length>3.45){
          const n=Math.ceil(f.length/4.1);
          for(let i=1;i<n;i++){
            const u=i*f.length/n;
            panel(out,'panels',f,u-.016,u+.016,bottom+.005,top-.005,.007,tones.charcoal);
          }
          if(detail===3)band(out,'panels',f,bottom+(top-bottom)*.45,bottom+(top-bottom)*.45+.027,.009,tones.charcoal);
        }
      }
      cap(out,'roof',ring,top,roof);
    }
  }
}

function approach(out,detail){
  cap(out,'base',apron,.115,masonry);
  const f=wallFace(...site.easternStairs.face),{height,projection}=site.easternStairs;
  const n=detail===0?3:9;
  for(let j=0;j<n;j++){
    const y=height*(1-j/n);
    const end=(j+1)*projection/n;
    fbox(out,'base',f,-.16,f.length+.16,.09,y,0,end,masonry);
  }
  if(detail>1){
    const p=f.P;
    for(const u of [.41,f.length*.54,f.length-.41]){
      beam(out,'metal',p(u,height+.9,0),p(u,1.03,projection),.041,.045,steel);
      for(const k of [.15,.52,.87]){
        const y=height*(1-k);
        beam(out,'metal',p(u,y,k*projection),p(u,y+.93,k*projection),.038,.041,steel);
      }
    }
  }
}

function build(out,detail){
  historicBlock(out,detail);
  clockBay(out,detail);
  mordantWing(out,detail);
  approach(out,detail);
}

export const buildSkyline=out=>build(out,0);
export const buildDistrict=out=>build(out,1);
export const buildStreet=out=>build(out,2);
export const buildCloseup=out=>build(out,3);
export const buildMaster=buildCloseup;
