/** Whole mapped MRO water tank, with explicitly estimated exterior section and date. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export function inspectMroWaterPrimaryFacts({dir,proof,controls:P,frame:f}){
 const fail=reason=>({status:'needs-review',reason});
 try{
  const safe=p=>typeof p==='string'&&!path.isAbsolute(p)&&!p.split(/[\\/]/).includes('..');
  const source=proof.primarySources?.find(s=>s.key==='tank'),native=proof.nativeIdentity;
  if(!safe(source?.path)||!safe(native?.path))return fail('mro-water-source-path-invalid');
  const text=fs.readFileSync(path.join(dir,source.path)),bytes=fs.readFileSync(path.join(dir,native.path)),data=JSON.parse(bytes),w=data.feature;
  if(source.url!=='https://www.openstreetmap.org/way/618004590'||source.use!=='factual-text-only'||hash(text)!==source.sha256||!['19 unique corners','water-storage','Height, roof, material, finish and2013survival are estimates','All imagery unused'].every(t=>text.toString().includes(t)))return fail('mro-water-primary-facts-unbound');
  if(hash(bytes)!==native.sha256||native.featureId!=='way/618004590'||w.id!=='618004590'||w.type!=='way'||w.tags.man_made!=='storage_tank'||w.tags.content!=='water'||w.coordinates.length!==20)return fail('mro-water-original-tank-record-unbound');
  if(P.model!=='murchison_western_water_tank'||P.parentModelIdentity!=='murchison_radio_astronomy_observatory'||P.kind!=='whole-native-water-tank'||proof.case!=='mro-primary-whole-water-tank-way618004590-2013'||P.nativeRing.length!==19||P.estimatedHeightUncertaintyMeters<1.5||P.estimatedComponentUncertaintyMeters<.5||P.roofApex<=P.eave||P.floor<=P.foundationBottom)return fail('mro-water-whole-tank-scope-or-estimates-disagree');
  const ring=w.coordinates.slice(0,-1),anchor=[0,1].map(k=>ring.reduce((s,p)=>s+p[k]/19,0)),rad=Math.PI/180,D=6378137*rad,co=Math.cos(anchor[1]*rad);
  if(f.heading!==0||anchor.some((v,k)=>Math.abs(v-f.anchor[k])>1e-10))return fail('mro-water-tank-moved');
  for(const [i,p]of ring.entries()){
   const local=[(p[0]-anchor[0])*D*co,-6378137*(Math.asinh(Math.tan(p[1]*rad))-Math.asinh(Math.tan(anchor[1]*rad)))*co];
   if(local.some((v,k)=>Math.abs(v-P.nativeRing[i][k])>1e-7||Math.abs(v-f.geometry.polygons[0][i][k])>1e-7))return fail('mro-water-original-tank-outline-changed');
  }
  return {status:'passed',method:'primary-facts-only',imageryUsed:false,evidenceHash:hash(Buffer.from(JSON.stringify(proof))),notes:'Entire independently positioned original19corner water-storage tank. Numerical footprint and water/storage tags retained; height, shallow closed roof, metal finish, accesslid/service pipe and2013survival explicitly estimated. No imagery, exact capacity or surveyed grade asserted. Parent observatory unfinished.'};
 }catch{return fail('mro-water-evidence-unreadable');}
}
