from pathlib import Path
import json,base64,subprocess,os,math,shutil
from PIL import ImageFont
from xml.sax.saxutils import escape
P=Path(__file__).resolve().parents[1]
C=json.loads((P/'source/config.json').read_text())
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SHARP=Path(os.getenv('CODEX_PRIMARY_RUNTIME_NODE_MODULES','/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules'))/'sharp'
PHOTO='data:image/png;base64,'+base64.b64encode((P/'references/CENTERED-PHOTO-TEMPLATE.png').read_bytes()).decode()
TEAL='#073B42';CREAM='#F6F2E9';YELLOW='#F2ED36'
def run(args):return subprocess.run(list(map(str,args)),check=True,capture_output=True,text=True)
def wrap(s,size,w):
 f=ImageFont.truetype(FONT,size);rows=[];cur=''
 for word in s.split():
  test=(cur+' '+word).strip()
  if cur and f.getlength(test)>w:rows.append(cur);cur=word
  else:cur=test
 if cur:rows.append(cur)
 return rows
def txt(s,y,size=72,w=916,color=CREAM,maxh=None):
 rows=wrap(s,size,w)
 while maxh and len(rows)*size*1.15>maxh:
  size-=2;rows=wrap(s,size,w)
 return ''.join(f'<text x="540" y="{y+i*size*1.15:.1f}" text-anchor="middle" font-family="DejaVu Sans" font-weight="700" font-size="{size}" fill="{color}">{escape(t)}</text>' for i,t in enumerate(rows))
def picture(y=100,w=1000):return f'<image x="{(1080-w)/2}" y="{y}" width="{w}" height="{w*1.25}" preserveAspectRatio="xMidYMid meet" xlink:href="{PHOTO}"/>'
def save(body,path,w=1080,h=1350):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}">{body}</svg>')
 run(['node','-e',"require(process.argv[1])(process.argv[2],{limitInputPixels:false}).png().toFile(process.argv[3]);",SHARP,path,path.with_suffix('.png')])
def card(a,body,i=None):
 v=f'<rect width="1080" height="1350" fill="{TEAL}"/>'+picture()
 v+='<rect x="504" y="52" width="72" height="7" rx="3" fill="#F2ED36"/>'
 v+=txt(body,138,78,maxh=255)
 if i is not None:v+=f'<text x="986" y="65" text-anchor="end" font-family="DejaVu Sans" font-size="23" font-weight="700" fill="{YELLOW}">{i+1} / {len(a['cards'])}</text>'
 v+=f'<rect x="0" y="1265" width="1080" height="85" fill="{TEAL}"/>'
 v+=txt(a['cta'],1300,29,975,YELLOW)
 return v
def cards():
 for a in C['angles'][:1]:
  save(card(a,a['hook']),P/'cards'/f'POST-{a["id"]}-{a["slug"]}.svg')
  for i,t in enumerate(a['cards']):save(card(a,t,i),P/'carousel'/f'{i+1:02d}.svg')

if __name__ == "__main__": cards()
