import { fbox, lathe, outwardRing, quad4, rgb, tri, wallFace } from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  quartz: { slot: 'wall', graph: 'concrete_panel', roughness: .94 },
  platform: { slot: 'foundation', graph: 'stone_granite', roughness: .97 },
  fins: { slot: 'trim', graph: 'metal_painted', roughness: .89 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: .8 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: .55 },
};
const limestone=rgb('d0cec0'), pale=rgb('dedbd0'), grey=rgb('babbb0'), mortar=rgb('a9ab9e');
const stone=rgb('9b9b89'), dark=rgb('666d69'), glazing=rgb('444e4d'), bronze=rgb('998368');
const edges=ring=>outwardRing(ring).map((a,i,r)=>wallFace(a,r[(i+1)%r.length]));

function panel(out,slot,f,u,v,y,Y,d,color) {
  const p=f.P;
  quad4(out,slot,p(u,y,d),p(v,y,d),p(v,Y,d),p(u,Y,d),color);
}
function band(out,slot,f,y,Y,d,color){
  panel(out,slot,f,0,f.length,y,Y,d,color);
}

function shaft(out,detail,part,index) {
  const order=outwardRing(part.outline);
  const height=order.map(p=>part.crowns[part.outline.indexOf(p)]);
  const shade=[limestone,pale,grey][index];
  for(const [i,a] of order.entries()){
    const j=(i+1)%order.length, f=wallFace(a,order[j]), p=f.P;
    const low=29.32, high=39.28, width=.66;
    const left=f.length*.32-width*.5,right=left+width;
    const slit=i===0;
    band(out,'quartz',f,site.foundation,slit?low:43.15,0,shade);
    if(slit){
      panel(out,'quartz',f,0,left,low,high,0,shade);
      panel(out,'quartz',f,right,f.length,low,high,0,shade);
      panel(out,'glass',f,left,right,low,high,-.26,glazing);
      fbox(out,'fins',f,left-.022,left+.036,low,high,-.26,.017,dark);
      fbox(out,'fins',f,right-.036,right+.022,low,high,-.26,.017,dark);
      band(out,'quartz',f,high,43.15,0,shade);
    }
    quad4(out,'quartz',p(0,43.15),p(f.length,43.15),p(f.length,height[j]),p(0,height[i]),shade);
    if(!detail)continue;
    const spacing=detail===1?3.3:1.63;
    for(let y=1.16;y<Math.min(height[i],height[j])-.15;y+=spacing){
      if(slit&&y>=low-.04&&y<high){
        panel(out,'quartz',f,0,left,y,y+.024,.009,mortar);
        panel(out,'quartz',f,right,f.length,y,y+.024,.009,mortar);
      }else band(out,'quartz',f,y,y+.024,.01,mortar);
      if(detail===3){
        const u=f.length*(Math.floor(y/spacing)%2?.49:.73);
        panel(out,'quartz',f,u,u+.028,y-Math.min(1.39,y),y,.014,mortar);
      }
    }
  }
  tri(out,'quartz',...order.map(([x,z],i)=>[x,height[i],z]),pale);
}

function scale(ring,f){
  const [x,z]=site.hub;
  return ring.map(([a,b])=>[x+(a-x)*f,z+(b-z)*f]);
}

function belfry(out,detail){
  const room=scale(site.chamber,1.16);
  for(const f of edges(room)){
    band(out,'quartz',f,23.22,24.25,0,grey);
    band(out,'glass',f,24.25,26.83,-.026,glazing);
    band(out,'fins',f,26.83,27.83,.019,dark);
    band(out,'fins',f,36.48,37.1,.025,dark);
    const n=detail===0?4:detail===1?6:9;
    for(let i=0;i<n;i++){
      const u=f.length*(i+.5)/n;
      fbox(out,'fins',f,u-.076,u+.076,27.83,36.48,-.19,.115,dark);
      if(detail>1)panel(out,'fins',f,u-.076,u+.076,24.28,26.83,.009,dark);
    }
  }
  for(const y of [23.23,27.83,37.1])cap(out,'quartz',room,y,grey);
  const [x,z]=site.hub;
  const tiers=[28.26,30.12,32.39,34.67];
  const radius=[.43,.31,.225,.174];
  for(const [i,n] of site.bellCounts.entries()){
    const step=detail===0?6:detail===1?3:detail===2?2:1;
    for(let j=0;j<n;j+=step){
      const theta=2*Math.PI*j/n+.31*i;
      const r=detail===0?radius[i]*1.16:radius[i]*(j%4===0?1.21:1);
      const row=1.33+i*.045;
      const location=[x+row*Math.cos(theta),z+row*Math.sin(theta)];
      const y=tiers[i]+.07*Math.sin(j);
      const profile=[[y,r,r],[y+r*.24,r*.8,r*.8],[y+r*.99,r*.58,r*.58],[y+r*1.43,r*.19,r*.19]];
      lathe(out,'bronze',location,profile,detail>1?8:5,bronze,{capTop:true,capBottom:false});
    }
  }
}

function build(out,detail){
  cap(out,'platform',site.platform,site.ground,stone);
  for(const f of edges(site.platform))band(out,'platform',f,site.ground-.24,site.ground,0,stone);
  site.shafts.forEach((v,i)=>shaft(out,detail,v,i));
  belfry(out,detail);
}

export const buildSkyline=out=>build(out,0);
export const buildDistrict=out=>build(out,1);
export const buildStreet=out=>build(out,2);
export const buildCloseup=out=>build(out,3);
export const buildMaster=buildCloseup;
