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
 keys=tags[34735];assert any(keys[i:i+4]==(3072,0,1,3857) for i in range(4,len(keys),4))
 cols=math.ceil(w/tw)
 def sample(x,y):
  assert 0<=x<w and 0<=y<h
  tile=tile_offsets[(y//th)*cols+x//tw];assert tile!=0,'Requested pixel is in an empty sparse source block'
  at=tile+((y%th)*tw+x%tw)*4
  v=struct.unpack_from(order+'f',b,at)[0];assert math.isfinite(v) and abs(v)<10000
  return v
 return {'tileOffsets':tile_offsets,'tileSize':(tw,th),'width':w,'height':h,'origin':(tags[33922][3],tags[33922][4]),'step':tags[33550][:2],'sample':sample}

def sampler(r,frame):
 lon,lat=frame['anchor'];rad=math.pi/180;R=6378137;cos=math.cos(lat*rad);cx=R*lon*rad;cy=R*math.asinh(math.tan(lat*rad));c=math.cos(frame['heading']);s=math.sin(frame['heading'])
 def sample(x,z):
  east=c*x+s*z;south=-s*x+c*z
  px=(cx+east/cos-r['origin'][0])/r['step'][0]-.5;pz=(r['origin'][1]-(cy-south/cos))/r['step'][1]-.5
  i=math.floor(px);j=math.floor(pz);u=px-i;v=pz-j;get=r['sample']
  return (get(i,j)*(1-u)+get(i+1,j)*u)*(1-v)+(get(i,j+1)*(1-u)+get(i+1,j+1)*u)*v
 return sample

def verify():
 grid=json.loads((BASE/'terrain-grid.json').read_text());frame=json.loads((BASE/'map-frame.json').read_text());sources=grid['sources']
 for source in sources:assert digest(BASE/source['path'])==source['sha256'],source['path']
 assert digest(BASE/'terrain-review.height.png')==grid['reviewHeightfieldHash']
 r=raster(BASE/sources[0]['path']);sample=sampler(r,frame);error=0;values=0
 for j,row in enumerate(grid['heightsMeters']):
  for i,h in enumerate(row):
   x=grid['origin'][0]+i*grid['stepMeters'];z=grid['origin'][1]+j*grid['stepMeters'];error=max(error,abs(h-sample(x,z)));values+=1
 assert error<=.000050001,error
 datum_error=abs(sample(*frame['terrainContact']['local'])-grid['modelDatumElevationMeters']);assert datum_error<.00005
 extra={}
 site_path=BASE/'terrain-site-grid.json'
 if site_path.exists():
  site=json.loads(site_path.read_text());assert site['sources']==sources
  assert site['baselineGridSha256']==digest(BASE/'terrain-grid.json')
  assert site['baselinePngSha256']==digest(BASE/'terrain-review.height.png')
  assert site['reviewHeightfieldHash']==digest(BASE/'terrain-site-review.height.png')
  assert site['origin']==[-140,-140] and site['size']==[281,281] and site['stepMeters']==1
  site_error=0;site_values=0
  for j,row in enumerate(site['heightsMeters']):
   for i,h in enumerate(row):
    site_error=max(site_error,abs(h-sample(i-140,j-140)));site_values+=1
  assert site_error<=.000050001,site_error
  assert all(site['heightsMeters'][j+12][i+12]==h for j,row in enumerate(grid['heightsMeters']) for i,h in enumerate(row))
  extra={'siteReviewValuesVerified':site_values,'originalValuesExactlyPreservedInSiteReview':values,'siteMaximumRoundingErrorMeters':site_error}
 print(json.dumps({'originalFilesVerified':1,'metadataFilesVerified':len(sources)-1,'originalRasterPixels':r['width']*r['height'],'gridValuesVerified':values,'maximumRoundingErrorMeters':error,'nativeDatumErrorMeters':datum_error,'groundUnchanged':True,**extra},indent=2))
if __name__=='__main__':verify()
