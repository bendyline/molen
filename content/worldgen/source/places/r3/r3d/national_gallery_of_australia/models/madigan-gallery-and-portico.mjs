import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude, fbox, lathe, outwardRing, quad4, rgb, tri, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: .95 },
  panel: { slot: 'wall', graph: 'concrete_panel', roughness: .94 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: .94 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: .83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: .59 },
};

const body=rgb('c6bfae'), wall=rgb('d3d0c5'), bright=rgb('e3ded0'), reveal=rgb('aaa69a');
const roof=rgb('9e9b8d'), paver=rgb('bcb8ae'), post=rgb('babfb8'), frame=rgb('646f70');
const glazing=['506870','526e70','5b7778','53636b'].map(rgb);
const [ax,az]=site.along, [bx,bz]=site.across;
const xz=(u,v)=>[u*ax+v*bx,u*az+v*bz];
const along=([x,z])=>x*ax+z*az;
const across=([x,z])=>x*bx+z*bz;
const edges=ring=>ring.map((p,i)=>wallFace(p,ring[(i+1)%ring.length]));
const rectangle=(a,b,c,d)=>[xz(a,b),xz(c,b),xz(c,d),xz(a,d)];

function withCaps(out) {
  return {
    ...out,
    addCap(slot,ref,outline,holes,height,normal,uv,color) {
      const cap = new MeshBufferBuilder();
      if (!cap.addCap(slot,ref,outline,holes,height,normal,uv,color)) return false;
      const {positions,indices} = cap.finalize();
      for (let i=0;i<indices.length;i+=3) {
        const points = Array.from(indices.slice(i,i+3),j=>positions.slice(j*3,j*3+3));
        out.addTriangle(slot,ref,points,normal,points.map(p=>[p[0],p[2]]),color);
      }
      return true;
    },
  };
}

function band(out,slot,f,a,b,lo,hi,depth,color) {
  quad4(out,slot,f.P(a,lo,depth),f.P(b,lo,depth),f.P(b,hi,depth),f.P(a,hi,depth),color);
}

function glazingWall(out,f,top,detail,entry) {
  const w=f.length, low=entry ? .22 : 1.46, sill=top-.76, frameDepth=.075;
  const n=detail===0?1:Math.ceil(w/(detail===1?5.0:2.24));
  const m=detail===0?1:detail===1?2:3;
  band(out,'panel',f,0,w,site.lowerLevel,low,0,wall);
  band(out,'panel',f,0,w,sill,top,0,bright);
  for (let i=0;i<n;i++) {
    const a=i*w/n,b=(i+1)*w/n;
    band(out,'glass',f,a,b,low,sill,-.17,glazing[i%glazing.length]);
    if (i>0) fbox(out,'frame',f,a-.042,a+.042,low,sill,-.17,frameDepth,frame);
    if (entry&&detail>1&&i>0&&i<n-1) {
      band(out,'glass',f,a+.12,b-.12,.25,2.75,-.144,glazing[3]);
    }
  }
  for(let j=1;j<m;j++){
    const y=low+(sill-low)*j/m;
    fbox(out,'frame',f,0,w,y-.044,y+.044,-.17,frameDepth,frame);
  }
  fbox(out,'panel',f,0,.27,low,sill,-.18,.13,bright);
  fbox(out,'panel',f,w-.27,w,low,sill,-.18,.13,bright);
}

function upperWindows(out,f,top,detail) {
  const low=top-4.85, high=top-1.47;
  const w=f.length, count=Math.max(1,Math.round(w/(detail===0?12:4.1)));
  band(out,'concrete',f,0,w,site.lowerLevel,low,0,body);
  band(out,'concrete',f,0,w,high,top,0,body);
  for(let i=0;i<count;i++){
    const cell=w/count, a=i*cell,b=(i+1)*cell, inset=cell*.22;
    band(out,'concrete',f,a,a+inset,low,high,0,body);
    band(out,'concrete',f,b-inset,b,low,high,0,body);
    band(out,'glass',f,a+inset,b-inset,low,high,-.45,glazing[0]);
    fbox(out,'panel',f,a+inset-.14,a+inset,low,high,-.45,.25,reveal);
    fbox(out,'panel',f,b-inset,b-inset+.14,low,high,-.45,.25,wall);
  }
}

function walls(out,zone,detail) {
  const ring=outwardRing(zone.outline);
  const top=zone.roof;
  edges(ring).forEach((f,i)=>{
    const a=ring[i],b=ring[(i+1)%ring.length];
    const u=(along(a)+along(b))/2,v=(across(a)+across(b))/2;
    const towardsPlaza=f.normal[0]*bx+f.normal[1]*bz<-.53;
    const entry=zone.id==='west-entry'&&u>-65.3&&u<-41.0&&Math.abs(v-3.85)<.08;
    const westGlazing=(zone.id==='west-entry'||zone.id==='western-galleries')&&v<-.8&&f.length>3.6;
    const terraceGlazing=zone.id==='sculpture-garden-wing'&&v>67&&f.length>8&&u>-3;
    if(f.length>1&&((towardsPlaza&&(entry||westGlazing))||terraceGlazing)){
      glazingWall(out,f,top,detail,entry);
    } else if(f.length>7&&towardsPlaza&&u>-21&&u<53&&v<25){
      upperWindows(out,f,top,detail);
    } else {
      band(out,'concrete',f,0,f.length,site.lowerLevel,top,0,body);
    }
  });
  for(const hole of zone.holes){
    for(const f of edges(outwardRing(hole).reverse()))
      band(out,'concrete',f,0,f.length,site.lowerLevel,top,0,body);
  }
  if (!out.addCap('concrete','palette:#ffffff',ring,zone.holes,()=>top,[0,1,0],p=>p,roof))
    throw new Error('Could not triangulate the gallery roof');
}
function oculus(out,detail) {
  const [x,z]=site.porchEye, y=site.porchRoof;
  const n=[10,14,18,24][detail], radius=1.46;
  const inner=Array.from({length:n},(_,i)=>{
    const theta=2*Math.PI*i/n;
    return [x+radius*Math.cos(theta),z+radius*Math.sin(theta)];
  });
  extrude(out,'panel',site.porch[0],y-.48,y,bright,{holes:[inner],bottom:true});
  lathe(out,'frame',[x,z],[[.05,.42,.42],[y-.76,.42,.42]],n,post,{capTop:true});
  if(detail>0){
    for(const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius]]){
      beam(out,'frame',[x,y-1.46,z],[x+dx,y-.29,z+dz],.105,.135,post);
    }
  }
}

function rooftop(out,detail) {
  const corner=[xz(27,-12.6),xz(49,-12.1),xz(49,9.8)];
  extrude(out,'concrete',corner,18.64,22.68,wall,{topColor:bright});
  const shaft=rectangle(7.1,-10.3,14.0,-1.1);
  extrude(out,'panel',shaft,18.64,24.06,wall);
  const courtyardSteps=rectangle(-41.2,30.12,-29.12,39.85);
  extrude(out,'paving',courtyardSteps,-1.54,-.22,paver);
  if(detail===0)return;
  for(const [u,v] of [[-19.7,9.25],[-8.12,34],[9.15,42],[29.0,37.2]]){
    extrude(out,'panel',rectangle(u,v,u+6.3,v+3.8),18.68,19.32,reveal);
  }
  if(detail===1)return;
  const roofFace=wallFace(...corner);
  for(let i=0;i<5;i++){
    const w=roofFace.length/6;
    band(out,'concrete',roofFace,w*(i+1),w*(i+1)+.035,18.69,22.665,.008,reveal);
  }
  // The projecting triangular stair and skylight forms follow the original structural grid.
  for(const u of [-17.4,-9.2,19.1]){
    const a=xz(u,13),b=xz(u+5.2,13.8),c=xz(u+4,18.6);
    const low=18.68, high=19.88;
    tri(out,'panel',[a[0],low,a[1]],[c[0],high,c[1]],[b[0],low,b[1]],bright);
    tri(out,'glass',[b[0],low,b[1]],[c[0],high,c[1]],[c[0],low,c[1]],glazing[1]);
    tri(out,'panel',[c[0],low,c[1]],[c[0],high,c[1]],[a[0],low,a[1]],reveal);
  }
}

function build(out,detail){
  out=withCaps(out);
  extrude(out,'paving',site.patio,-1.34,.047,paver);
  for(const zone of site.zones)walls(out,zone,detail);
  oculus(out,detail);
  rooftop(out,detail);
}

export const buildSkyline=out=>build(out,0);
export const buildDistrict=out=>build(out,1);
export const buildStreet=out=>build(out,2);
export const buildCloseup=out=>build(out,3);
export const buildMaster=buildCloseup;
