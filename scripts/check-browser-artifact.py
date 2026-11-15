"""Run an existing URL-driven browser check against an isolated Pages artifact."""
import argparse,os,runpy,sys,threading
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
p=argparse.ArgumentParser();p.add_argument('script',type=Path);p.add_argument('--dist',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
PREFIX='/patrol-retest-demo/'
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not urlsplit(self.path).path.startswith(PREFIX):self.send_error(404);return
  self.path='/'+self.path[len(PREFIX):]
  try:super().do_GET()
  except(BrokenPipeError,ConnectionResetError):pass
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(args.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
args.output.mkdir(parents=True,exist_ok=True)
os.environ.update(HITORI_QA_URL=f'http://127.0.0.1:{server.server_port}'+PREFIX,HITORI_QA_OUTPUT=str(args.output.resolve()),HITORI_CHROMIUM='/usr/bin/chromium',HITORI_CHROMIUM_EXECUTABLE='/usr/bin/chromium')
sys.argv=[str(args.script)]
try:runpy.run_path(str(args.script),run_name='__main__')
finally:server.shutdown()
