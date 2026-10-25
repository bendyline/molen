"""Read-only reproduction from original uncompressed F32 GeoTIFF, with stdlib only."""
from pathlib import Path
import hashlib,json,math,struct
BASE=Path(__file__).resolve().parent.parent

def digest(p):return 'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()

def raster(path):
 b=path.read_bytes();order='<' if b[:2]==b'II' else '>' if b[:2]==b'MM' else None
 assert order and struct.unpack_from(order+'H',b,2)[0]==42
 offset=struct.unpack_from(order+'I',b,4)[0];count=struct.unpack_from(order+'H',b,offset)[0];tags={}
 formats={1:'B',2:'c',3:'H',4:'I',5:'I',11:'f',12:'d'};sizes={1:1,2:1,3:2,4:4,5:8,11:4,12:8}
 for i in range(count):
  at=offset+2+i*12;tag,typ,n=struct.unpack_from(order+'HHI',b,at)
  if typ not in sizes:continue
  loc=at+8 if sizes[typ]*n<=4 else struct.unpack_from(order+'I',b,at+8)[0]
  if typ==5:continue
  tags[tag]=struct.unpack_from(order+str(n)+formats[typ],b,loc)
 w,h=tags[256][0],tags[257][0];tw,th=tags[322][0],tags[323][0];tile_offsets=tags[324]
 assert tags[258]==(32,) and tags[259]==(1,) and tags[277]==(1,) and tags[339]==(3,)
 assert tags[33550][0]>0 and tags[33550][1]>0
 keys=tags[34735];assert any(keys[i:i+4]==(3072,0,1,3979) for i in range(4,len(keys),4))
 cols=math.ceil(w/tw)
 def sample(x,y):
  assert 0<=x<w and 0<=y<h
  at=tile_offsets[(y//th)*cols+x//tw]+((y%th)*tw+x%tw)*4
  v=struct.unpack_from(order+'f',b,at)[0];assert math.isfinite(v) and abs(v)<10000
  return v
 return {'width':w,'height':h,'origin':(tags[33922][3],tags[33922][4]),'step':tags[33550][:2],'sample':sample}

def project(lon,lat):
 # EPSG3979 Lambert conformal conic on GRS80; formula independent of acquisition PROJ.
 rad=math.pi/180;a=6378137;wf=1/298.257223563;we2=wf*(2-wf);phi=lat*rad;lam=lon*rad;N=a/math.sqrt(1-we2*math.sin(phi)**2)
 X=N*math.cos(phi)*math.cos(lam)+.991;Y=N*math.cos(phi)*math.sin(lam)-1.9072;Z=N*(1-we2)*math.sin(phi)-.5129
 # Inverse EPSG1946 coordinate-frame rotation,1m published transformation accuracy.
 rx=-1.25033e-7;ry=-4.6785e-8;rz=-5.6529e-8;x=X-rz*Y+ry*Z;y=rz*X+Y-rx*Z;z=-ry*X+rx*Y+Z
 f=1/298.257222101;e=math.sqrt(f*(2-f));p=math.hypot(x,y);phi=math.atan2(z,p*(1-e*e))
 for _ in range(8):
  N=a/math.sqrt(1-e*e*math.sin(phi)**2);phi=math.atan2(z+e*e*N*math.sin(phi),p)
 lon=math.atan2(y,x)/rad;lat=phi/rad;p1=49*rad;p2=77*rad;p0=49*rad
 def m(p):return math.cos(p)/math.sqrt(1-e*e*math.sin(p)**2)
 def t(p):return math.tan(math.pi/4-p/2)/((1-e*math.sin(p))/(1+e*math.sin(p)))**(e/2)
 n=math.log(m(p1)/m(p2))/math.log(t(p1)/t(p2));F=m(p1)/(n*t(p1)**n);rho=a*F*t(lat*rad)**n;rho0=a*F*t(p0)**n;theta=n*(lon+95)*rad
 return rho*math.sin(theta),rho0-rho*math.cos(theta)

def sampler(r,frame):
 lon,lat=frame['anchor'];rad=math.pi/180;R=6378137;cos=math.cos(lat*rad);c=math.cos(frame['heading']);s=math.sin(frame['heading'])
 def sample(x,z):
  east=c*x+s*z;south=-s*x+c*z;ex,ny=project(lon+east/(R*rad*cos),lat-south/(R*rad));px=(ex-r['origin'][0])/r['step'][0]-.5;pz=(r['origin'][1]-ny)/r['step'][1]-.5
  i=math.floor(px);j=math.floor(pz);u=px-i;v=pz-j;get=r['sample']
  return (get(i,j)*(1-u)+get(i+1,j)*u)*(1-v)+(get(i,j+1)*(1-u)+get(i+1,j+1)*u)*v
 return sample

def verify():
 grid=json.loads((BASE/'terrain-grid.json').read_text());frame=json.loads((BASE/'map-frame.json').read_text());sources=grid['sources']
 for source in sources:assert digest(BASE/source['path'])==source['sha256'],source['path']
 assert digest(BASE/'terrain-review.height.png')==grid['reviewHeightfieldHash']
 r=raster(BASE/sources[0]['path']);original=[r['sample'](x,y)for y in range(r['height'])for x in range(r['width'])];assert len(original)==160000;sample=sampler(r,frame);error=0;values=0
 for j,row in enumerate(grid['heightsMeters']):
  for i,h in enumerate(row):
   x=grid['origin'][0]+i*grid['stepMeters'];z=grid['origin'][1]+j*grid['stepMeters'];error=max(error,abs(h-sample(x,z)));values+=1
 assert error<=.000050001,error
 datum_error=abs(sample(*frame['terrainContact']['local'])-grid['modelDatumElevationMeters']);assert datum_error<.00005
 print(json.dumps({'originalFilesVerified':1,'metadataFilesVerified':len(sources)-1,'originalRasterPixels':r['width']*r['height'],'gridValuesVerified':values,'maximumRoundingErrorMeters':error,'nativeDatumErrorMeters':datum_error,'groundUnchanged':True},indent=2))
if __name__=='__main__':verify()
