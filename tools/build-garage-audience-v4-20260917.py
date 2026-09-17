#!/usr/bin/env python3
"""One continuous nonchalant Rexx sentence and a distinct Apu horn cue."""
from pathlib import Path
import argparse,json,hashlib,subprocess
import numpy as np
from scipy.io import wavfile
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,default=Path.cwd());root=p.parse_args().workspace.resolve()
out=root/'homer-sync/audience-v4';sr=48000
def decode(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ar','48000','-ac','2','-f','f32le','-']),np.float32).reshape(-1,2).copy()
def rms(x):
 r=np.sqrt(np.mean(x*x,axis=1));r=r[r>max(r.max()*.04,1e-5)];return float(np.sqrt(np.mean(r*r)))
def fade(x,a,b):
 x=x.copy();na=round(a*sr);nb=round(b*sr)
 if na:x[:na]*=np.linspace(0,1,na)[:,None]
 if nb:x[-nb:]*=np.linspace(1,0,nb)[:,None]
 return x
_,original=wavfile.read(root/'homer-sync/audience-v3/GARAGE-DREAM-FULL-AUDIO-V3.wav');full=original.copy()
take=decode(out/'raw/YFqW5hoGJn4A03YtVJys.mp3')
lo=round(47.15*sr);hi=round(50.25*sr);at=round(47.24*sr)
take=fade(take*rms(original[round(47.24*sr):round(50.12*sr)])/rms(take),.005,.06)
assert at+len(take)<=hi
replacement=np.zeros((hi-lo,2));replacement[at-lo:at-lo+len(take)]=take
blend=np.ones(hi-lo);blend[:240]=np.linspace(0,1,240);blend[-480:]=np.linspace(1,0,480)
full[lo:hi]=full[lo:hi]*(1-blend[:,None])+replacement*blend[:,None]
# Complete isolated horn, ending in the pause before Apu's Hey Rexx greeting.
horn=decode(out/'raw/k3kvRBS7uY3vshh4ixEi.mp3')[:round(.5*sr)]
horn=fade(horn,.008,.065)
horn*=10**(-9/20)/np.max(abs(horn))
hat=round(94.49*sr);hend=hat+len(horn);assert hend<=95*sr
full[hat:hend]+=horn
assert len(full)==3334*2000 and np.max(abs(full))<.94
mask=np.ones(len(full),bool);mask[lo:hi]=False;mask[hat:hend]=False
checks={'all_audio_outside_two_requested_windows_unchanged':bool(np.array_equal(full[mask],original[mask])),'apu_greeting_unchanged':bool(np.array_equal(full[95*sr:98*sr],original[95*sr:98*sr])),'approved_garage_take_unchanged':bool(np.array_equal(full[51*sr:60*sr],original[51*sr:60*sr])),'ending_laugh_unchanged':bool(np.array_equal(full[134*sr:],original[134*sr:]))}
assert all(checks.values())
wavfile.write(out/'GARAGE-DREAM-FULL-AUDIO-V4.wav',sr,full.astype(np.float32));wavfile.write(out/'APU-HORN-CUE.wav',sr,horn.astype(np.float32))
receipt={'voice_name':'namesrexx','voice_id':'omTQvsWgoQBrcTuWdttm','model':'eleven_v3','emotion_tag':'[nonchalant]','script':"Yeah, let me have it, it can't be that bad.",'voice_generation':'YFqW5hoGJn4A03YtVJys','full_voice_start':at/sr,'full_voice_end':(at+len(take))/sr,'voice_internal_cuts':0,'tempo_change':False,'horn_generation':'k3kvRBS7uY3vshh4ixEi','horn_model':'eleven_text_to_sound_v2','full_horn_start':hat/sr,'full_horn_end':hend/sr,'horn_stem_peak_dbfs':-9,'full_frames':3334,'full_seconds':3334/24,'full_peak_dbfs':float(20*np.log10(np.max(abs(full)))),'checks':checks,'source_v3_audio_sha256':hashlib.sha256((root/'homer-sync/audience-v3/GARAGE-DREAM-FULL-AUDIO-V3.wav').read_bytes()).hexdigest(),'full_audio_sha256':hashlib.sha256((out/'GARAGE-DREAM-FULL-AUDIO-V4.wav').read_bytes()).hexdigest()}
(out/'AUDIO-V4-CUE-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
