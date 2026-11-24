import {
  facade, fbox, outwardRing, quad4, rgb, tri, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { beam, sphere } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with {type:'json'};

export const surfaces = {
  quartz:{slot:'wall',graph:'stone_limestone_raw',roughness:.99},
  rubble:{slot:'wall',graph:'stone_drywall',roughness:.99},
  rock:{slot:'foundation',graph:'stone_granite',roughness:.98},
  turf:{slot:'roof',localRef:'palette:#ffffff',roughness:1},
  engraving:{slot:'trim',localRef:'palette:#ffffff',roughness:.97},
};

const pale=rgb('e1dfd1'), light=rgb('eae6d7'), rock=rgb('9e9c8d'), dark=rgb('766f62');
const grass=['707f4c','71814d','73834f','72824d','74834f'].map(rgb);
const slate=rgb('665e4d'), passage=rgb('47463d'), marks=rgb('757366');
const roof=outwardRing(site.ringMound), [px,pz]=site.front, [cx,cz]=site.center;
const portal=facade(site.portal,[pz,-px]);
const pos=([x,z],y)=>[x,y,z];
const grade=([x,z])=>Math.min(2.49,Math.max(-.52,.012*x-.028*z+.62));
const exposure=([x,z])=>{
  const dx=x-cx,dz=z-cz;
  return (dx*px+dz*pz)/Math.hypot(dx,dz);
};
const edgeHeight=p=>grade(p)+1.05+(site.terrace-1.05)*Math.max(0,Math.min(1,1.92*(exposure(p)+.14)));
const edges=ring=>ring.map((p,i)=>wallFace(p,ring[(i+1)%ring.length]));
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

function turfMound(out,detail){
  const profiles=detail===0?[[1,0],[.73,.61],[.38,.92],[.08,1]]
    :[[1,0],[.91,.27],[.78,.53],[.61,.74],[.44,.88],[.27,.96],[.102,1]];
  const layers=profiles.map(([scale,t])=>roof.map(p=>pos(mix(site.center,p,scale),edgeHeight(p)+(site.topHeight-edgeHeight(p))*t)));
  for(let ring=0;ring<layers.length-1;ring++){
    const a=layers[ring], b=layers[ring+1];
    for(let i=0;i<a.length;i++){
      const n=(i+1)%a.length, color=grass[(i*11+ring*3)%grass.length];
      tri(out,'turf',a[i],a[n],b[n],color);
      tri(out,'turf',a[i],b[n],b[i],color);
    }
  }
  cap(out,'turf',layers.at(-1).map(([x,,z])=>[x,z]),site.topHeight,grass[1]);
}
function retaining(out){
  for(const [i,a] of roof.entries()){
    const b=roof[(i+1)%roof.length];
    const f=wallFace(a,b);
    const open=Math.hypot(a[0]-site.edge[0][0],a[1]-site.edge[0][1])<.03;
    const spans=open?[[0,.10],[.90,1]]:[[0,1]];
    for(const [u,v] of spans){
      const A=mix(a,b,u), B=mix(a,b,v), quartz=exposure(mix(A,B,.5))>.042;
      quad4(out,quartz?'quartz':'rubble',pos(A,grade(A)-1.19),pos(B,grade(B)-1.19),
        pos(B,edgeHeight(B)),pos(A,edgeHeight(A)),quartz?(i%3===0?light:pale):dark);
    }
    if(open){
      for(const [t,side] of [[.10,-1],[.9,1]]){
        const q=mix(a,b,t), w=portal.P(side*1.31,0,-.05);
        const r=[w[0],w[2]];
        const points=[pos(q,grade(q)-.21),pos(r,.32),pos(r,3.12),pos(q,edgeHeight(q))];
        quad4(out,'rubble',...(side===-1?points:points.slice().reverse()),slate);
      }
      const A=mix(a,b,.10),B=mix(a,b,.90);
      const y=3.28;
      quad4(out,'quartz',pos(A,y),pos(B,y),pos(B,edgeHeight(B)),pos(A,edgeHeight(A)),pale);
    }
  }
}
function kerb(out,detail){
  const facades=edges(roof).filter(({origin})=>Math.hypot(origin[0]-site.edge[0][0],origin[1]-site.edge[0][1])>.03);
  const length=facades.reduce((sum,f)=>sum+f.length,0), n=detail===0?29:site.kerbstones-1;
  let offset=0,index=0;
  for(let i=0;i<n;i++){
    const distance=length*(i+.45)/n;
    while(distance-offset>facades[index].length)offset+=facades[index++].length;
    const f=facades[index], u=distance-offset;
    const [x,,z]=f.P(u,0,.39);
    const h=.57+.16*(i%5)/4, w=Math.min(1.26,length/n*.448), y=grade([x,z]);
    fbox(out,'rock',f,u-w,u+w,y-.45,y+h,-.17,.72,i%3===0?dark:rock);
    if(detail>1){
      const a=f.P(u-w*.85,y+h-.026,.71), b=f.P(u+w*.83,y+h-.054,.71);
      const c=f.P(u+w*.67,y+h+.14,.29), d=f.P(u-w*.76,y+h+.15,.17);
      quad4(out,'rock',a,b,c,d,i%4===1?dark:rock);
    }
  }
}
function entrance(out,detail){
  const f=portal, {entryWidth:width, entryRise:top}=site, wallWidth=width*.5;
  const floor=.40, stoneTop=2.38;
  for(const side of [-1,1]){
    const a=side<0?-1.37:wallWidth, b=side<0?-wallWidth:1.37;
    fbox(out,'rock',f,a,b,.24,stoneTop,-1.28,.12,rock);
    fbox(out,'rubble',f,a,b,.24,top,-3.58,-1.23,slate);
  }
  fbox(out,'rock',f,-1.45,1.4,top,2.19,-2.52,.19,rock,{bottom:true});
  // The smaller roofbox is recessed above the main lintel.
  for(const [a,b] of [[-1.09,-.46],[.46,1.1]])fbox(out,'rubble',f,a,b,2.19,2.62,-1.85,.02,slate);
  fbox(out,'rock',f,-1.31,1.27,2.62,2.95,-1.91,.13,rock,{bottom:true});
  quad4(out,'engraving',f.P(-wallWidth,floor,-3.49),f.P(wallWidth,floor,-3.49),
    f.P(wallWidth,2.62,-3.49),f.P(-wallWidth,2.62,-3.49),passage);
  const stairs=detail===0?3:5;
  for(let i=1;i<=stairs;i++){
    const t=i/stairs;
    fbox(out,'rock',f,-1.18,1.25,-1.12,-.17+t*.57,-3.52,4.72-3.85*t,dark);
  }
  const stone=f.P(.43,-.07,4.18);
  sphere(out,'rock',[stone[0],.55,stone[2]],[1.52,.67,.66],rock,detail===0?8:12,5);
  if(detail===3){
    for(const offset of [-.56,.10,.75]){
      const angle=Math.atan2(f.along[1],f.along[0]);
      const normal=[-Math.sin(angle),Math.cos(angle)], axis=[Math.cos(angle),Math.sin(angle)];
      const stroke=(i)=>{
        const t=i*.39, r=.022+t*.033, u=offset+r*Math.cos(t);
        const y=.63+r*.77*Math.sin(t), dx=u*axis[0], dz=u*axis[1];
        const a=(normal[0]/1.52)**2+(normal[1]/.66)**2;
        const b=2*(dx*normal[0]/1.52**2+dz*normal[1]/.66**2);
        const c=(dx/1.52)**2+(dz/.66)**2+((y-.55)/.67)**2-1;
        const d=(-b+Math.sqrt(b*b-4*a*c))/(2*a)+.008;
        return [stone[0]+dx+d*normal[0],y,stone[2]+dz+d*normal[1]];
      };
      for(let i=1;i<=22;i++)beam(out,'engraving',stroke(i-1),stroke(i),.022,.022,marks);
    }
  }
}
function standingStones(out,detail){
  for(const {point:[x,z],height} of site.fieldstones){
    const y=grade([x,z]);
    sphere(out,'rock',[x,y+.35*height,z],[.61,.65*height,.42],dark,detail===0?6:8,detail===0?4:5);
  }
}
function build(out,detail){
  turfMound(out,detail);
  retaining(out);
  kerb(out,detail);
  entrance(out,detail);
  standingStones(out,detail);
}
export const buildSkyline=out=>build(out,0);
export const buildDistrict=out=>build(out,1);
export const buildStreet=out=>build(out,2);
export const buildCloseup=out=>build(out,3);
export const buildMaster=buildCloseup;
