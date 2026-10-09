#!/usr/bin/env python3
"""Apply owner-selected take 2, lower whispers, raise original horn, extend laugh."""
from pathlib import Path
import argparse,subprocess,json,hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,default=Path.cwd());root=p.parse_args().workspace.resolve()
v2=root/'homer-sync/audience-v2';out=root/'homer-sync/audience-v3';sr=48000;nbody=3070*2000;extra=24*2000
def decode(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ar','48000','-ac','2','-f','f32le','-']),np.float32).reshape(-1,2).copy()
def active_rms(x):
 r=np.sqrt(np.mean(x*x,axis=1));r=r[r>max(r.max()*.04,1e-5)];return float(np.sqrt(np.mean(r*r)))
def fade(x,a=.012,b=.08):
 x=x.copy();na=round(a*sr);nb=round(b*sr)
 if na:x[:na]*=np.linspace(0,1,na)[:,None]
 if nb:x[-nb:]*=np.linspace(1,0,nb)[:,None]
 return x
_,original=wavfile.read(v2/'GARAGE-DREAM-REVISED-BASE.wav');base=original.copy()
_,stem=wavfile.read(v2/'GARAGE-DREAM-AUDIENCE-V2-STEM.wav');oldstem=stem.copy()
# Owner explicitly selected second take and clarified last phrase belongs to Homer.
take=decode(out/'raw/vE8jPBJSsmGwAQivR7x9.mp3')[:round(4.80*sr)]
take=fade(take*active_rms(base[round(41.2*sr):round(46.04*sr)])/active_rms(take),.005,.06)
lo=round(41.2*sr);hi=round(46.04*sr);repl=np.zeros((hi-lo,2));repl[:len(take)]=take
blend=np.ones(hi-lo);blend[:240]=np.linspace(0,1,240);blend[-480:]=np.linspace(1,0,480)
base[lo:hi]=base[lo:hi]*(1-blend[:,None])+repl*blend[:,None]
# Original short horn transient precedes the greeting. Raise it without raising Apu's voice.
horn_lo=round(84.635*sr);horn_hi=round(84.75*sr)
env=np.ones(horn_hi-horn_lo);edge=round(.008*sr);env[:edge]=np.linspace(0,1,edge);env[-edge:]=np.linspace(1,0,edge)
base[horn_lo:horn_hi]*=10**((8*env[:,None])/20)
wh_lo=round(78.13*sr);wh_hi=round(80.18*sr);stem[wh_lo:wh_hi]*=10**(-8/20)
# Extend the existing performance, not a repeated laugh. One-second final picture hold.
base=np.pad(base,((0,extra),(0,0)));stem=np.pad(stem,((0,extra),(0,0)))
laugh_start=3002*2000;stem[laugh_start:]=0
laugh=decode(root/'homer-sync/audience-final/raw/oAKlGkhVTj41oEaVedSL.mp3')[:90*2000]
laugh=sosfilt(butter(2,[110,7200],btype='bandpass',fs=sr,output='sos'),laugh,axis=0)
laugh=fade(laugh*10**(-21/20)/active_rms(laugh),.012,.90)
stem[laugh_start:laugh_start+len(laugh)]+=laugh
_,oldfull=wavfile.read(v2/'GARAGE-DREAM-FULL-AUDIO-V2.wav')
full=np.concatenate([oldfull[:10*sr],base+stem])
assert len(full)==3334*2000 and np.max(abs(full))<.94
mask=np.ones(nbody,bool);mask[lo:hi]=False;mask[horn_lo:horn_hi]=False
checks={'other_base_audio_unchanged':bool(np.array_equal(base[:nbody][mask],original[mask])), 'homers_following_line_preserved':bool(np.array_equal(base[round(46.04*sr):round(49.9*sr)],original[round(46.04*sr):round(49.9*sr)])), 'apus_greeting_preserved':bool(np.array_equal(base[round(84.75*sr):round(88.4*sr)],original[round(84.75*sr):round(88.4*sr)])), 'first_bart_laugh_preserved':bool(np.array_equal(base[round(83.3*sr):round(84.635*sr)],original[round(83.3*sr):round(84.635*sr)]))}
assert all(checks.values())
for name,x in [('GARAGE-DREAM-FULL-AUDIO-V3.wav',full),('GARAGE-DREAM-AUDIENCE-V3-STEM.wav',stem)]:wavfile.write(out/name,sr,x.astype(np.float32))
receipt={'voice_name':'namesrexx','voice_id':'omTQvsWgoQBrcTuWdttm','model':'eleven_v3','selected_take':2,'generation_id':'vE8jPBJSsmGwAQivR7x9','included_script':'Homer, this is like a scene from Storage Wars. You got a Bugatti in here.','excluded_generated_homer_dialogue':'Oh, wait. What is that? Look over there.','source_start':0,'source_end':4.8,'tempo_change':False,'full_rexx_start':51.2,'full_rexx_end':56.0,'bugatti_whispers_gain_change_db':-8,'horn_gain_change_db':8,'full_horn_window':[94.635,94.75],'ending_laugh_extension_seconds':1,'picture_hold_frames':24,'full_frames':3334,'full_seconds':3334/24,'peak_dbfs':float(20*np.log10(np.max(abs(full)))),'checks':checks,'audio_sha256':hashlib.sha256((out/'GARAGE-DREAM-FULL-AUDIO-V3.wav').read_bytes()).hexdigest(),'selected_source_sha256':hashlib.sha256((out/'raw/vE8jPBJSsmGwAQivR7x9.mp3').read_bytes()).hexdigest(),'review_limit':'User chose second take. Automated verification checks words, timing, preservation and levels; does not certify human listening.'}
(out/'AUDIO-V3-CUE-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
