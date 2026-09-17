#!/usr/bin/env python3
"""Stage approved V6, trigger the deployed watcher, verify its real preview. No merge or publishing."""
import argparse,hashlib,json,os,shutil,subprocess,tempfile,time
from pathlib import Path
P=Path(__file__).resolve().parents[1]
BRANCH='agent/codex/v6-watched-cut-20260917'
CUT='projects/garage-dream/cuts/STORYBOARD-FINAL.json'
MASTER='GARAGE-DREAM-FINAL-AUDIO-V6-20260917.mp4'
MASTER_SHA='76135F02600B5770704AA7CCB35A1DFCE22F9A2269E325696539E0FF840C09B5'
a=argparse.ArgumentParser();a.add_argument('--repo',default='/srv/lyfe/repo');a.add_argument('--media',default='/srv/lyfe/media');a.add_argument('--editor',default='/srv/lyfe/editor');a.add_argument('--timeout',type=int,default=1800);args=a.parse_args()
repo=Path(args.repo);media=Path(args.media);editor=Path(args.editor);receipts=P/'receipts';receipts.mkdir(exist_ok=True)
def digest(p,kind='sha256'):
 h=hashlib.new(kind)
 with Path(p).open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest().upper()
def git(*cmd,cwd=repo):return subprocess.check_output(['git','-C',str(cwd),*cmd],stderr=subprocess.PIPE,timeout=120)
def check(condition,message):
 if not condition:raise RuntimeError(message)
def safe_editor_path(url):
 check(url.startswith('/editor/'),'Unexpected preview URL')
 p=(editor/url[len('/editor/'):]).resolve();check(p.is_relative_to(editor.resolve()),'Preview path escapes editor');return p
source=P/'inputs'/MASTER
check(source.is_file(),'Missing bundled approved V6 master')
check(digest(source)==MASTER_SHA,'Bundled V6 hash mismatch; stop')
target=media/'team/garage-dream/FILM'/MASTER;target.parent.mkdir(parents=True,exist_ok=True)
if target.exists():check(digest(target)==MASTER_SHA,'Different file occupies V6 target; archive it explicitly before continuing')
else:
 staging=target.with_suffix('.staging.mp4');check(not staging.exists(),'Incomplete prior staging file exists; inspect it before retrying');shutil.copyfile(source,staging);check(digest(staging)==MASTER_SHA,'Staged source hash mismatch');staging.rename(target)
check(digest(target)==MASTER_SHA,'Server source hash mismatch')
baselines=[]
for short in ['751bbc7','4346aac','a8a550e']:
 f=editor/'previews'/f'PREVIEW-agent-codex-garage-finalization-20260917-{short}.mp4'
 if f.is_file():baselines.append({'commit_short':short,'file':str(f),'bytes':f.stat().st_size,'sha256':digest(f),'md5':digest(f,'md5')})
check(bool(baselines),'No reported pass-17 preview found; cannot prove change against the reported artifact')
check(all(b['bytes']==73826175 for b in baselines),'Reported baseline size differs; investigate before promoting')
check(len({b['sha256'] for b in baselines})==1,'Reported baselines are not identical; investigate before promoting')
git('fetch','origin',f'+refs/heads/{BRANCH}:refs/remotes/origin/{BRANCH}')
oldbranch='agent/codex/garage-finalization-20260917'
git('fetch','origin',f'+refs/heads/{oldbranch}:refs/remotes/origin/{oldbranch}')
old_cut=git('show',baselines[0]['commit_short']+':'+CUT)
new_cut=git('show','origin/'+BRANCH+':'+CUT)
expected_cut_sha=hashlib.sha256(new_cut).hexdigest().upper()
check(expected_cut_sha==digest(P/'STORYBOARD-FINAL.json'),'Branch cut differs from reviewed handoff; stop')
old_cut_sha=hashlib.sha256(old_cut).hexdigest().upper()
check(old_cut_sha!=expected_cut_sha,'Watched cut did not change')
wt=Path(tempfile.mkdtemp(prefix='v6-preview-trigger-',dir=str(editor)))
git('worktree','add','--detach',str(wt),'origin/'+BRANCH)
try:
 # A prior attempt may have failed before media arrived. A new commit requests a clean watcher retry.
 git('-c','user.name=LYFE Studio server','-c','user.email=noreply@biz-box.io','commit','--allow-empty','-m','Request watched V6 preview after verified media staging',cwd=wt)
 requested_sha=git('rev-parse','HEAD',cwd=wt).decode().strip()
 git('push','origin','HEAD:refs/heads/'+BRANCH,cwd=wt)
finally:git('worktree','remove',str(wt))
request={'branch':BRANCH,'requested_commit':requested_sha,'source_path':str(target),'source_sha256':MASTER_SHA,'watched_cut_sha256':expected_cut_sha,'baseline_cut_sha256':old_cut_sha,'baselines':baselines,'state':'waiting_for_deployed_watcher'}
(receipts/'WATCHER-REQUEST.json').write_text(json.dumps(request,indent=2)+'\n')
print('V6 staged and verified. Waiting for deployed watcher commit '+requested_sha,flush=True)
deadline=time.monotonic()+args.timeout;record=None
while time.monotonic()<deadline:
 try:rows=json.loads((editor/'previews/previews.json').read_text())
 except (FileNotFoundError,json.JSONDecodeError):rows=[]
 record=next((r for r in rows if r.get('sha')==requested_sha),None)
 if record and record.get('state')=='failed':raise RuntimeError('Watcher failed: '+str(record.get('error')))
 if record and record.get('state')=='ready':break
 time.sleep(5)
else:raise TimeoutError('Watcher did not finish before timeout. Keep WATCHER-REQUEST.json; inspect studio logs. Do not render or release social clips.')
check(bool(record.get('receipt')),'Watcher returned no provenance receipt; confirm PR23 worker is running')
film=safe_editor_path(record['film']);rp=safe_editor_path(record['receipt']);r=json.loads(rp.read_text())
rendered_commit=record.get('renderedCommit',requested_sha)
check(r.get('commit')==rendered_commit,'Receipt does not match the watcher record rendered commit')
check(r.get('branch')==BRANCH,'Receipt belongs to a different branch')
check(r.get('serverVerified') is True,'Receipt is not server-verified')
check(r.get('fingerprint')==record.get('fingerprint'),'Watcher record fingerprint disagrees with receipt')
if rendered_commit!=requested_sha:
 check(bool(record.get('reusedFrom')),'Different rendered commit without explicit reuse provenance')
 check(hashlib.sha256(git('show',rendered_commit+':'+CUT)).hexdigest().upper()==expected_cut_sha,'Reused render was made from a different watched cut')
check(r.get('sourceTimeline')==CUT,'Watcher rendered a different cut path')
check(r.get('cutSha256')==expected_cut_sha,'Watcher receipt cut hash mismatch')
check(r.get('frames')==3334,'Wrong film duration/frame count; expected approved V6')
check(r.get('sourceVersions',{}).get('team/garage-dream/FILM/'+MASTER)=='sha256:'+MASTER_SHA,'Watcher did not read the exact approved V6 source')
actual=digest(film);check(actual==r.get('outputSha256')==record.get('outputSha256'),'Preview bytes disagree with receipt')
check(film.stat().st_size==r.get('bytes'),'Preview byte count differs from receipt')
check(all(actual!=b['sha256'] for b in baselines),'STALE PREVIEW: watched cut changed but film bytes did not')
proof={**request,'state':'passed','gate':'deployed watcher rendered changed watched cut and changed output bytes','watcher_record':record,'new_preview':{'file':str(film),'receipt':str(rp),'sha256':actual,'md5':digest(film,'md5'),'bytes':film.stat().st_size,'frames':r['frames'],'duration_s':r['seconds']},'social_clips_released':False,'posted':False}
shutil.copyfile(rp,receipts/'WATCHER-V6-RENDER.receipt.json')
(receipts/'WATCHER-V6-PROOF.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof,indent=2),flush=True)
print('Return WATCHER-V6-PROOF.json and WATCHER-V6-RENDER.receipt.json. No full-film merge or social delivery was performed.',flush=True)
