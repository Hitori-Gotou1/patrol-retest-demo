"""上传页面契约测试（模拟 Supabase 响应，不代表真实项目 RLS 已验证）。
先用示例配置构建独立预览，命令见 docs/gallery-upload-setup.md。
HITORI_UPLOAD_QA_URL 默认 http://127.0.0.1:4325/patrol-retest-demo/
"""
import base64, json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('HITORI_UPLOAD_QA_URL', 'http://127.0.0.1:4325/patrol-retest-demo/')
UID = '11111111-1111-4111-8111-111111111111'
FIXTURE = ROOT / 'public/assets/gallery/2026-10-29/originals/collection-01.jpg'
OUTPUT = Path('/tmp/hitori-upload-qa'); OUTPUT.mkdir(exist_ok=True)
errors=[];results=[]
def encode(value): return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
token=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':UID,'role':'authenticated','exp':int(time.time())+3600,'aud':'authenticated'})+'.signature'
user={'id':UID,'email':'owner@example.com','aud':'authenticated','role':'authenticated','created_at':'2026-10-30T00:00:00Z','app_metadata':{},'user_metadata':{}}
class Service:
 def __init__(self,admin=True,fail=''):self.admin=admin;self.fail=fail;self.rows=[];self.uploads=[];self.removed=[]
 def handle(self,route):
  req=route.request;url=req.url;method=req.method
  def reply(data,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'})
  if method=='OPTIONS':reply({});return
  if '/auth/v1/token' in url:reply({'access_token':token,'refresh_token':'test-refresh','expires_in':3600,'token_type':'bearer','user':user});return
  if '/auth/v1/user' in url:reply(user);return
  if '/auth/v1/logout' in url:reply({});return
  if '/rest/v1/gallery_admins' in url:reply([{'user_id':UID}] if self.admin else []);return
  if '/rest/v1/gallery_uploads' in url:
   if self.fail=='read':reply({'message':'offline'},503);return
   if method=='POST':
    row=req.post_data_json
    if self.fail=='insert':reply({'message':'denied','code':'42501'},403);return
    self.rows.append(row)
    if self.fail=='lost':reply({'message':'response lost'},500);return
    reply({},201);return
   reply([{'id':self.rows[-1]['id']}] if 'id=eq.' in url and self.rows else self.rows);return
  if '/storage/v1/object/public/' in url:route.fulfill(content_type='image/jpeg',body=FIXTURE.read_bytes());return
  if '/storage/v1/object/gallery-uploads' in url:
   if method=='DELETE':self.removed.append(req.post_data_json);reply([]);return
   self.uploads.append(url)
   if self.fail=='thumbnail' and '-thumb.' in url:reply({'message':'failed'},503);return
   reply({'Key':url.split('/gallery-uploads/')[-1]},200);return
  reply({'message':'Unexpected test request'},404)

def page_for(browser, service, mobile=False):
 context=browser.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},reduced_motion='reduce')
 context.route('https://gallery-test.supabase.co/**',service.handle)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));return context,page

def login(page):
 page.goto(BASE+'#/manage-gallery',wait_until='networkidle')
 page.locator('#owner-email').fill('owner@example.com');page.locator('#owner-password').fill('test-password')
 page.locator('.admin-login button').click()

def upload(page):
 expect(page.locator('.admin-upload')).to_be_visible()
 page.locator('#gallery-upload-file').set_input_files(str(FIXTURE))
 page.locator('#gallery-upload-title').fill('测试上传的心动')
 page.locator('.admin-upload button[type=submit]').click()

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for failure in ['', 'thumbnail','insert','lost']:
  service=Service(fail=failure);context,page=page_for(browser,service,mobile=failure=='')
  login(page);upload(page)
  if failure in ('thumbnail','insert'):
   expect(page.locator('.admin-feedback.is-error')).to_contain_text('上传未完成',timeout=30000)
   assert service.removed and not service.rows
   expect(page.locator('#gallery-upload-title')).to_have_value('测试上传的心动')
  else:
   expect(page.locator('.admin-feedback[role=status]')).to_contain_text('已发布',timeout=30000)
   assert len(service.rows)==1 and len(service.uploads)==2 and not service.removed
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
   page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
   page.screenshot(path=str(OUTPUT/f'uploaded-{page.viewport_size["width"]}.png'),full_page=True)
   page.goto(BASE+'#/#gallery',wait_until='networkidle')
   expect(page.locator('[data-filter=all] span')).to_have_text('55')
   expect(page.locator('.gallery-card h3').first).to_have_text('测试上传的心动')
   page.locator('.gallery-image-button').first.click()
   page.locator('#lightbox-image').evaluate('e=>e.decode()')
   page.locator('#lightbox-close').click()
   page.locator('.favorite').first.click();page.reload(wait_until='networkidle')
   expect(page.locator('.favorite').first).to_have_attribute('aria-pressed','true')
   # 新访客不登录，也能看见同一条已发布收藏。
   guest,other=page_for(browser,service);other.goto(BASE+'#/#gallery',wait_until='networkidle')
   expect(other.locator('.gallery-card h3').first).to_have_text('测试上传的心动');guest.close()
  results.append(failure or 'publish/public/favorites/mobile');context.close()
 service=Service(admin=False);context,page=page_for(browser,service);login(page)
 expect(page.get_by_role('heading',name='这个账号没有上传权限')).to_be_visible()
 expect(page.locator('.admin-upload')).to_have_count(0)
 assert not service.uploads
 page.get_by_role('button',name='退出并更换账号').click();expect(page.locator('.admin-login')).to_be_visible()
 results.append('non-owner denied, logout');context.close()
 service=Service();context,page=page_for(browser,service);login(page)
 expect(page.locator('.admin-upload')).to_be_visible()
 page.locator('#gallery-upload-file').set_input_files({'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg></svg>'})
 expect(page.locator('.admin-feedback.is-error')).to_contain_text('JPG')
 assert not service.uploads
 results.append('invalid file rejected');context.close()
 service=Service(fail='read');context,page=page_for(browser,service)
 page.goto(BASE+'#/#gallery',wait_until='networkidle')
 expect(page.locator('[data-filter=all] span')).to_have_text('54')
 expect(page.locator('.gallery-cloud-notice')).to_contain_text('原有收藏仍可浏览')
 service.fail='';page.locator('.gallery-cloud-notice button').click()
 expect(page.locator('.gallery-cloud-notice')).to_have_count(0)
 results.append('cloud failure preserves baseline, retry');context.close();browser.close()
assert not errors,errors
print(json.dumps({'result':'PASS','cases':results,'pageErrors':errors},ensure_ascii=False,indent=2))
