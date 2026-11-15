"""Real browser image/management contract test using isolated HTTP fixtures.
No production login, upload or Supabase query is performed.
"""
import argparse, base64, io, json, threading, time, uuid
from email.parser import BytesParser
from email.policy import default
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
UID='11111111-1111-4111-8111-111111111111'
BASE='/patrol-retest-demo/'
OUT=ROOT/'evidence/gallery-admin'
OUT.mkdir(exist_ok=True,parents=True)
def encode(value):return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
token=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':UID,'role':'authenticated','exp':int(time.time())+3600,'aud':'authenticated'})+'.fixture'
user={'id':UID,'email':'owner@example.com','aud':'authenticated','role':'authenticated','created_at':'2026-10-30T00:00:00Z','app_metadata':{},'user_metadata':{}}
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not self.path.startswith(BASE):self.send_error(404);return
  self.path='/'+self.path[len(BASE):];super().do_GET()
 def log_message(self,*args):pass
class Service:
 def __init__(self):self.rows=[];self.files={};self.collections=[];self.fail_next=False
 def handle(self,route):
  req=route.request;url=urlsplit(req.url);path=url.path;params=parse_qs(url.query);method=req.method
  def reply(data,status=200,headers=None):route.fulfill(status=status,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'Content-Range',**(headers or {})})
  if method=='OPTIONS':reply({});return
  if path.endswith('/token'):reply({'access_token':token,'refresh_token':'fixture','expires_in':3600,'token_type':'bearer','user':user});return
  if path.endswith('/user'):reply(user);return
  if path.endswith('/logout'):reply({});return
  if path.endswith('/gallery_admins'):reply([{'user_id':UID}]);return
  if '/storage/v1/object/public/' in path:
   key=path.split('/gallery-uploads/')[-1];data=self.files.get(key)
   if data:route.fulfill(content_type=data[0],body=data[1]);return
   route.fulfill(status=404,body='missing');return
  if '/storage/v1/object/gallery-uploads' in path:
   if method=='DELETE':
    for key in req.post_data_json.get('prefixes',[]):self.files.pop(key,None)
    reply([]);return
   if self.fail_next:self.fail_next=False;reply({'message':'fixture upload failure'},503);return
   key=path.split('/gallery-uploads/')[-1];body=req.post_data_buffer;mime=req.headers.get('content-type','')
   if mime.startswith('multipart/'):
    parsed=BytesParser(policy=default).parsebytes(('Content-Type: '+mime+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+body)
    for item in parsed.iter_parts():
     if item.get_content_disposition()=='form-data' and item.get_filename() is not None:mime=item.get_content_type();body=item.get_payload(decode=True);break
   self.files[key]=(mime,body);reply({'Key':key});return
  if path.endswith('/gallery_uploads'):
   if method=='POST':
    row=req.post_data_json
    if isinstance(row,list):row=row[0]
    row['created_at']='2026-11-14T00:00:00Z';self.rows.append(row);reply({},201);return
   rows=self.rows[:]
   for field in ['id','content_sha256','owner_id','category','published']:
    value=params.get(field,[''])[0]
    if value.startswith('eq.'):
     target=value[3:];rows=[row for row in rows if str(row.get(field,'')).lower()==target.lower()]
   if method=='PATCH':
    for row in rows:row.update(req.post_data_json)
    reply(rows[0] if 'application/vnd.pgrst.object' in req.headers.get('accept','') else rows);return
   if 'or' in params:
    term=params['or'][0].split('%')[1];rows=[row for row in rows if term in json.dumps(row,ensure_ascii=False)]
   reply(rows,headers={'Content-Range':f'0-{max(0,len(rows)-1)}/{len(rows)}'});return
  if path.endswith('/gallery_collections'):
   if method=='DELETE':
    target=params['id'][0][3:];self.collections=[row for row in self.collections if row['id']!=target];reply([]);return
   reply(self.collections);return
  if path.endswith('/rpc/gallery_save_collection'):
   data=req.post_data_json;row={'id':data['collection_id'],'owner_id':UID,**data['details'],'created_at':'2026-11-14T00:00:00Z','gallery_collection_items':[{'image_id':value,'sort_order':index} for index,value in enumerate(data['image_ids'])]}
   self.collections=[item for item in self.collections if item['id']!=row['id']]+[row];reply(row['id']);return
  reply([])
def run(dist):
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(dist)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'+BASE
 image=Image.new('RGBA',(3000,2000),(0,0,0,0));ImageDraw.Draw(image).rectangle((500,300,2500,1700),fill=(240,100,150,128));buffer=io.BytesIO();image.save(buffer,format='PNG');payload=buffer.getvalue()
 service=Service();errors=[];checks=[];unexpected=[]
 def install_fixture(context):
  def intercept(route):
   destination=urlsplit(route.request.url).netloc
   if destination==urlsplit(base).netloc:route.continue_()
   elif destination=='gallery-test.supabase.co':service.handle(route)
   else:unexpected.append(route.request.method+' '+destination);route.abort()
  context.route('**/*',intercept)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [390,430,768,1440]:
   context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce',service_workers='block');install_fixture(context)
   page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
   page.goto(base+'#/manage-gallery');page.locator('#owner-email').fill('owner@example.com');page.locator('#owner-password').fill('fixture');page.locator('.admin-login button').first.click();expect(page.locator('.admin-tabs')).to_be_visible()
   if width==390:
    page.locator('#gallery-upload-file').set_input_files({'name':'alpha.png','mimeType':'image/png','buffer':payload})
    expect(page.locator('#gallery-upload-title')).to_be_visible();page.locator('#gallery-upload-title').fill('透明雨夜测试');page.locator('#gallery-upload-creator').fill('隔离测试');page.locator('#gallery-upload-category').select_option('illustration');page.locator('.character-checks').last.get_by_text('后藤一里',exact=True).click();page.locator('#gallery-upload-tags').fill('雨夜，透明')
    page.get_by_role('button',name='开始发布 1 张').click();expect(page.locator('.task-done')).to_have_count(1,timeout=30000)
    assert len(service.rows)==1,service.rows
    row=service.rows[0];assert row['characters']==['hitori'] and row['category']=='illustration' and row['tags']==['雨夜','透明']
    preview=Image.open(io.BytesIO(service.files[row['preview_path']][1]));thumb=Image.open(io.BytesIO(service.files[row['thumbnail_path']][1]));assert preview.size==(1920,1280) and thumb.size==(640,427)
    assert preview.mode=='RGBA' and preview.getpixel((0,0))[3]==0 and 120<=preview.getpixel((1000,700))[3]<=136
    preview.save(OUT/'actual-preview.png');thumb.save(OUT/'actual-thumbnail.png')
    checks.append('actual canvas WebP: 1920px long edge, 640px thumbnail, preserved transparent and translucent pixels')
    page.locator('#gallery-upload-file').set_input_files({'name':'same-content-different-name.png','mimeType':'image/png','buffer':payload});expect(page.locator('.queue-error')).to_contain_text('内容相同');assert len(service.rows)==1
    page.evaluate("document.activeElement?.blur();scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(OUT/'upload-mobile.png'),full_page=True)
   page.get_by_role('button',name='已发布图片',exact=True).click();expect(page.locator('.published-list h3')).to_contain_text(service.rows[0]['title']);page.get_by_role('button',name='编辑信息与顺序').click();page.locator('.edit-image input').first.fill('编辑后的透明雨夜');page.locator('.edit-image input[type=number]').fill('-2');page.get_by_role('button',name='保存修改',exact=True).click();expect(page.locator('.published-list h3')).to_contain_text('编辑后的透明雨夜');assert service.rows[0]['id']==row['id']
   if width==390:
    page.get_by_role('button',name='下架',exact=True).click();expect(page.get_by_role('button',name='恢复展示')).to_be_visible();assert service.rows[0]['published']==False
    page.get_by_role('button',name='恢复展示').click();expect(page.get_by_role('button',name='下架',exact=True)).to_be_visible();assert service.rows[0]['published']==True
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   page.evaluate("document.activeElement?.blur();scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(OUT/f'workbench-{width}.png'),full_page=True)
   if width==390:
    page.get_by_role('button',name='主题合集',exact=True).click();page.get_by_role('button',name='新建合集').click();page.get_by_label('合集标题',exact=True).fill('隔离测试合集');page.get_by_label('图片编号（每行一个，按展示顺序排列）').fill('live-ticket\ncloud-'+row['id']);page.get_by_role('button',name='保存合集',exact=True).click();expect(page.locator('.collection-list').first).to_contain_text('隔离测试合集');assert len(service.collections)==1
    checks.append('mobile upload, content duplicate reminder, metadata edit with stable ID, down/up restoration and atomic collection request')
   context.close()
  context=browser.new_context(viewport={'width':390,'height':844},service_workers='block');install_fixture(context);page=context.new_page();page.goto(base+'#/collections/four-friends');expect(page.get_by_role('heading',name='四个人的放学后')).to_be_visible();expect(page.locator('.collection-image-grid a')).to_have_count(2);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/'collection-mobile.png'),full_page=True);context.close()
  checks.append('public confirmed static collection route renders two sourced images at 390px')
  context=browser.new_context(viewport={'width':390,'height':844},service_workers='block');install_fixture(context);page=context.new_page();page.goto(base+'#/manage-gallery');page.locator('#owner-email').fill('owner@example.com');page.locator('#owner-password').fill('fixture');page.locator('.admin-login button').first.click();expect(page.locator('.admin-tabs')).to_be_visible()
  oriented=Image.new('RGB',(2600,1200),(120,40,180));exif=Image.Exif();exif[274]=6;ob=io.BytesIO();oriented.save(ob,format='JPEG',exif=exif)
  small=Image.new('RGBA',(80,120),(20,60,150,110));sb=io.BytesIO();small.save(sb,format='PNG')
  page.locator('#gallery-upload-file').set_input_files([{'name':'oriented.jpg','mimeType':'image/jpeg','buffer':ob.getvalue()},{'name':'small.png','mimeType':'image/png','buffer':sb.getvalue()}]);expect(page.locator('.queue-list>li')).to_have_count(2);page.locator('.queue-list>li').filter(has_text='small.png').get_by_role('button',name='取消这张').click();service.fail_next=True;page.get_by_role('button',name='开始发布 1 张').click();expect(page.locator('.task-failed')).to_have_count(1);page.get_by_role('button',name='重试这张').click();expect(page.locator('.task-done')).to_have_count(1,timeout=30000)
  rotated=service.rows[-1];assert (rotated['width'],rotated['height'])==(1200,2600);rotated_preview=Image.open(io.BytesIO(service.files[rotated['preview_path']][1]));assert rotated_preview.size==(886,1920);rotated_preview.save(OUT/'oriented-preview.jpg')
  page.locator('#gallery-upload-file').set_input_files({'name':'small.png','mimeType':'image/png','buffer':sb.getvalue()});expect(page.get_by_role('button',name='开始发布 1 张')).to_be_enabled();page.get_by_role('button',name='开始发布 1 张').click();expect(page.locator('.task-done')).to_have_count(2,timeout=30000)
  smallrow=service.rows[-1];assert smallrow['preview_path']==smallrow['object_path'];smallthumb=Image.open(io.BytesIO(service.files[smallrow['thumbnail_path']][1]));assert smallthumb.size==(80,120) and smallthumb.getpixel((20,20))[3]==110
  context.close();checks.append('EXIF orientation is applied, 80x120 transparent image is not upscaled; queued cancellation and isolated failed-upload retry complete')
  browser.close()
 server.shutdown();assert not errors,errors;assert not unexpected,unexpected
 result={'backend':'isolated HTTP contract fixture','productionVerified':False,'pageErrors':errors,'unexpectedRequests':unexpected,'checks':checks};(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--dist',type=Path,default=Path('/tmp/hitori-galleryadmin-dist'));run(parser.parse_args().dist)
