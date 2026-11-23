import { beam, beamPath, loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  outwardRing, quad4, rgb, tri, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: .93 },
  podium: { slot: 'foundation', graph: 'stone_granite', roughness: .96 },
  membrane: { slot: 'roof', graph: 'fabric_canvas', roughness: .9 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: .83 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: .91 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: .6 },
  halo: { slot: 'window', localRef: 'palette:#e8f2f6', roughness: .64,
    alphaMode: 'BLEND', baseColorFactor: [1,1,1,.79], doubleSided: true },
};

const bone=rgb('c8c5b8'), concrete=rgb('b8b6a9'), weathered=rgb('a6a79d'), base=rgb('8f9187');
const white=rgb('cdcfc7'), membrane=rgb('d9d9cf'), dark=rgb('606764'), steel=rgb('8c9495');
const glass=rgb('587885'), deep=rgb('496673'), halo=rgb('a5bcc1');
const {crown,tower}=site;
const [cx,cz]=crown.center,[ax,az]=crown.along;
const length=Math.hypot(ax,az), tangent=[ax/length,az/length], right=[az/length,-ax/length];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

function subdivide(ring,count) {
  const lengths=ring.map((a,i)=>Math.hypot(...ring[(i+1)%ring.length].map((v,j)=>v-a[j])));
  const total=lengths.reduce((a,b)=>a+b,0);
  let segment=0,start=0;
  return Array.from({length:count},(_,i)=>{
    const d=total*i/count;
    while(d>start+lengths[segment])start+=lengths[segment++];
    return mix(ring[segment],ring[(segment+1)%ring.length],(d-start)/lengths[segment]);
  });
}

function crownPoint(u,v,rx,rz,y) {
  return [cx+right[0]*rx*u+tangent[0]*rz*v,y,cz+right[1]*rx*u+tangent[1]*rz*v];
}

function directions(plan) {
  return plan.map(([x,z])=>{
    const u=(right[0]*(x-cx)+right[1]*(z-cz))/130;
    const v=(tangent[0]*(x-cx)+tangent[1]*(z-cz))/153;
    const d=Math.hypot(u,v);
    return [u/d,v/d];
  });
}

function ringBetween(plan, outer, t, y) {
  return plan.map(([x,z],i)=>mix([x,y,z],[outer[i][0],y,outer[i][2]],t));
}

function stadium(out,detail) {
  const plan=outwardRing(site.outline).filter(([x,z],i,r)=>Math.hypot(x-r[(i+1)%r.length][0],z-r[(i+1)%r.length][1])>.75);
  const bowl=detail===0?plan.filter((_,i)=>i%2===0):plan;
  const uv=directions(bowl);
  const rim=uv.map(([u,v])=>crownPoint(u,v,...crown.halo,crown.eave));
  const rings=[[site.foundation,0],[2.13,0],[6.73,.034],[17.55,.126],[31.08,.34],[40.42,.648],[crown.eave,1]];
  loft(out,'podium',rings.slice(0,2).map(([y,t])=>ringBetween(bowl,rim,t,y)),base,{cap:false});
  loft(out,'concrete',rings.slice(1).map(([y,t])=>ringBetween(bowl,rim,t,y)),concrete,{cap:false});
  loft(out,'roof',[rim,uv.map(([u,v])=>crownPoint(u,v,...crown.halo,crown.eave+.72))],steel,{cap:false});
  if(detail){
    const wings=subdivide(plan,site.bracketCount);
    const endpoints=directions(wings).map(([u,v])=>crownPoint(u,v,...crown.halo,crown.eave));
    const levels=detail===1?[[2.1,-.005],[17.5,.121],[32.6,.373],[42.1,.68],[47,1]]
      :[[1.8,-.008],[7.27,.025],[18.35,.121],[31.9,.338],[41.4,.624],[47.24,1]];
    for(const [i,[x,z]] of wings.entries()){
      const [a,,b]=endpoints[i];
      beamPath(out,'concrete',levels.map(([y,t])=>[x+(a-x)*t,y,z+(b-z)*t]),
        detail===1?2.45:2.89,detail===1?1.48:1.94,bone);
    }
    const foot=outwardRing(bowl);
    for(const [i,a] of foot.entries()){
      const f=wallFace(a,foot[(i+1)%foot.length]),p=f.P,w=f.length;
      if(w<3.5)continue;
      quad4(out,'glass',p(w*.15,3.11,-.51),p(w*.82,3.11,-.51),p(w*.82,5.3,-.73),p(w*.15,5.3,-.73),dark);
      if(detail>1) beam(out,'steel',p(w*.48,3.1,-.46),p(w*.48,5.28,-.67),.11,.12,steel);
    }
  }

  const strips=[rim,uv.map(([u,v])=>crownPoint(u,v,...crown.core,51.13))];
  loft(out,'halo',strips,halo,{cap:false});
  const core=uv.map(([u,v])=>crownPoint(u,v,...crown.core,51.13));
  const mid=uv.map(([u,v])=>crownPoint(u,v,crown.core[0]*.64,crown.core[1]*.64,56.95));
  loft(out,'membrane',[core,mid],membrane,{cap:false});
  const peak=[cx,crown.skyline,cz];
  for(const [i,a] of mid.entries()){
    const next=(i+1)%mid.length;
    tri(out,'membrane',a,mid[next],peak,i%2===0?white:membrane);
    if(detail>1){
      beam(out,'steel',rim[i],core[i],.16,.13,steel);
      if(detail===3&&i%2===0)beam(out,'membrane',core[i],mid[i],.14,.06,white);
    }
  }
  const slingCount=[5,8,14,19][detail];
  const [tx,tz]=tower.observatory;
  for(let i=0;i<slingCount;i++){
    const angle=-Math.PI+2*Math.PI*i/slingCount;
    const end=crownPoint(Math.cos(angle),Math.sin(angle),29.6,73.2,51.6);
    const width=detail<2?.145:.095;
    beam(out,'steel',[tx+(i/slingCount-.5)*22,155.43,tz+11.38],end,width,width,steel);
  }
}

const section=[[-1,-.57],[-1,.57],[-.73,1],[.73,1],[1,.57],[1,-.57],[.73,-1],[-.73,-1]];
function towerRing([y,cx,cz,x,z]) {
  return section.map(([a,b])=>[cx+right[0]*x*a+tangent[0]*z*b,y,cz+right[1]*x*a+tangent[1]*z*b]);
}

function buildTower(out,detail){
  const rings=tower.profiles.map(towerRing);
  loft(out,'concrete',rings,bone);
  for(const plan of tower.plinth){
    const outline=outwardRing(plan);
    for(const [i,a] of outline.entries()){
      const f=wallFace(a,outline[(i+1)%outline.length]),p=f.P,w=f.length;
      quad4(out,'podium',p(0,site.foundation),p(w,site.foundation),p(w,2.94),p(0,2.94),base);
      quad4(out,'concrete',p(0,2.94),p(w,2.94),p(w,9.3),p(0,9.3),concrete);
      if(detail&&w>4.5)quad4(out,'glass',p(w*.13,4.13,.023),p(w*.87,4.13,.023),p(w*.87,7.29,.023),p(w*.13,7.29,.023),deep);
    }
    cap(out,'roof',outline,9.3,weathered);
  }
  for(let level=1;level<rings.length-1;level++){
    const a=rings[level],b=rings[level+1];
    for(const side of [0,2,4]){
      const n=(side+1)%8, f=wallFace([a[side][0],a[side][2]],[a[n][0],a[n][2]]);
      const [nx,nz]=f.normal, point=(u,t,d=.055)=>{
        const p=mix(mix(a[side],a[n],u),mix(b[side],b[n],u),t);
        return [p[0]+d*nx,p[1],p[2]+d*nz];
      };
      if(side===2&&level<3)continue;
      const lo=side===2?.27:.21,hi=side===2?.77:.79;
      const low=level>7?.13:.03, high=level>7?.86:.976;
      quad4(out,'glass',point(lo,low),point(hi,low),point(hi,high),point(lo,high),side===2?deep:glass);
      if(detail>1){
        const count=detail===2?3:6;
        for(let j=1;j<count;j++){
          const t=low+(high-low)*j/count;
          quad4(out,'steel',point(lo,t,.084),point(hi,t,.084),point(hi,t+.009,.084),point(lo,t+.009,.084),steel);
        }
      }
    }
  }
}

function build(out,detail) {
  stadium(out,detail);
  buildTower(out,detail);
}

export const buildSkyline=out=>build(out,0);
export const buildDistrict=out=>build(out,1);
export const buildStreet=out=>build(out,2);
export const buildCloseup=out=>build(out,3);
export const buildMaster=buildCloseup;
