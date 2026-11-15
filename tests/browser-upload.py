"""兼容上传验收入口：旧单文件表单已升级为批量队列与管理工作台。

用显式 fixture 配置构建隔离目录后运行：
  python tests/browser-upload.py --dist /tmp/hitori-galleryadmin-dist

此入口执行 browser-gallery-admin-upgrade.py 的真实 Chromium 操作和图片生成检查。
所有 Supabase 请求均由隔离夹具处理；不登录、不上传到生产服务。
旧 HITORI_UPLOAD_QA_URL 预览服务器约定改为 --dist，由测试自行启动临时本机服务器。
"""
from pathlib import Path
import runpy

if __name__ == '__main__':
    print('上传验收入口：执行批量队列、工作台、合集与真实图片生成检查（隔离夹具）。', flush=True)
    runpy.run_path(str(Path(__file__).with_name('browser-gallery-admin-upgrade.py')), run_name='__main__')
