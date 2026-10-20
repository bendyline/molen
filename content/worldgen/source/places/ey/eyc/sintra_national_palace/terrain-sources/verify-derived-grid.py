#!/usr/bin/env python3
"""Read-only Sintra terrain derivation verification; Python3+NumPy.

Uses only retained provider ground data and the signed map frame. It does not
read model geometry, fit terrain to a building, download data, or change files.
Original viewer point-range bytes are retained with their SHA256 and HTTP headers.
"""
from pathlib import Path
import json,math,numpy as np,gzip,hashlib,time
root=Path(__file__).resolve().parent.parent;frame=json.loads((root/'map-frame.json').read_text());source=root/'terrain-sources/dgt-class2-ground.xyz-f32le.gz';raw=gzip.decompress(source.read_bytes());points=np.frombuffer(raw,dtype='<f4').reshape(-1,3).astype(float);assert len(points)==911745
sha=lambda p:'sha256:'+hashlib.sha256(Path(p).read_bytes()).hexdigest()
bucketSize=2;bucket={}
for i,p in enumerate(points):bucket.setdefault((math.floor(p[0]/bucketSize),math.floor(p[1]/bucketSize)),[]).append(i)
bucket={k:np.array(v,dtype=np.int32)for k,v in bucket.items()}
# Fixed horizontal projection and interpolation selected before model geometry exists.
def tm(lon,lat):
 a=6378137;f=1/298.257222101;e=f*(2-f);ep=e/(1-e);p=math.radians(lat);l=math.radians(lon+8.13310833333333);p0=math.radians(39.6682583333333)
 def M(p):return a*((1-e/4-3*e**2/64-5*e**3/256)*p-(3*e/8+3*e**2/32+45*e**3/1024)*math.sin(2*p)+(15*e**2/256+45*e**3/1024)*math.sin(4*p)-35*e**3/3072*math.sin(6*p))
 N=a/math.sqrt(1-e*math.sin(p)**2);T=math.tan(p)**2;C=ep*math.cos(p)**2;A=math.cos(p)*l
 return N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120),M(p)-M(p0)+N*math.tan(p)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720)
lon0,lat0=frame['anchor'];h=frame['heading'];c=math.cos(h);s=math.sin(h)
def projected(x,z):return tm(lon0+(c*x+s*z)/111320/math.cos(math.radians(lat0)),lat0+(s*x-c*z)/111320)
def sample(x,z):
 E,N=projected(x,z);ix=math.floor(E/bucketSize);iy=math.floor(N/bucketSize);r=1
 while True:
  arrays=[bucket[(i,j)]for i in range(ix-r,ix+r+1)for j in range(iy-r,iy+r+1)if(i,j)in bucket]
  if arrays:
   ids=np.concatenate(arrays);ds=(points[ids,0]-E)**2+(points[ids,1]-N)**2
   if len(ds)>=12:
    ii=np.argpartition(ds,11)[:12];limit=min(E-(ix-r)*2,(ix+r+1)*2-E,N-(iy-r)*2,(iy+r+1)*2-N)
    if math.sqrt(float(ds[ii].max()))<limit:
     ii=np.flatnonzero(ds<=float(ds[ii].max()));ii=ii[np.lexsort((ids[ii],ds[ii]))][:12];ds=ds[ii];ids=ids[ii]
     if ds[0]<1e-18:value=float(points[ids[0],2])
     else:
      weights=1/ds;value=float(np.dot(weights,points[ids,2])/weights.sum())
     return value,math.sqrt(float(ds[0])),math.sqrt(float(ds[-1])),ids.tolist()
  r*=2
  assert r<=128,(x,z,r)
contact=frame['terrainContact']['local'];nativeDatum,nearDatum,farDatum,datumIds=sample(*contact);datum=round(nativeDatum,4)
heights=[];nearest=[];farthest=[]
for iz,z in enumerate(range(-124,125,2)):
 row=[];nr=[];fr=[]
 for x in range(-124,125,2):
  y,n,f,_=sample(x,z);row.append(round(y,4));nr.append(round(n,4));fr.append(round(f,4))
 heights.append(row);nearest.append(nr);farthest.append(fr)
 if iz%25==0:print('row',iz,'of125',flush=True)
assert len(heights)==125 and all(len(r)==125 for r in heights)
grid=json.loads((root/'terrain-grid.json').read_text());support=json.loads((root/'terrain-interpolation-support.json').read_text());evidence=json.loads((root/'terrain-source-review.json').read_text())
assert heights==grid['heightsMeters'],'Review height grid differs from fixed class2 derivation'
assert nearest==support['nearestDistancesMeters'] and farthest==support['twelfthNearestDistancesMeters']
assert datum==grid['modelDatumElevationMeters']
assert 'sha256:'+hashlib.sha256(raw).hexdigest()==evidence['decodedGround']['decodedSha256']
for rec in evidence['originalFiles']+evidence['originalIndexFiles']:
 p=root/rec['path'];assert p.stat().st_size==rec['bytes'];assert sha(p)==rec['sha256']
print('PASS: all15625 grid values and support distances rederived;911745 original decoded class2 points and10 compressed provider responses hash verified; no files changed.')
