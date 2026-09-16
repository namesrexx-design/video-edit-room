// word-times.mjs — per-word timestamps from local Whisper (free, offline). 2026-09-16
//   node tools/word-times.mjs <audio-or-video> > words.json   (needs @huggingface/transformers; on the server: /srv/lyfe/tools-asr)
// Prints JSON [{ text, start, end }] (seconds). Used by the scrolling-caption renderer to time the
// highlight; the WORDS shown on screen still come from the script, never from this transcript.
import { pipeline, env } from '@huggingface/transformers';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

env.cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'models');
const file = process.argv[2];
if (!file) { console.error('usage: node word-times.mjs <audio-file>'); process.exit(1); }
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], { maxBuffer: 1 << 30 });
const audio = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const model = process.env.WORD_MODEL || 'onnx-community/whisper-base_timestamped';
console.error(`audio ${(audio.length / 16000).toFixed(1)}s · ${model}`);
const asr = await pipeline('automatic-speech-recognition', model, { dtype: 'fp32' });
const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: 'word' });
const words = (out.chunks || []).map((c) => ({ text: c.text.trim(), start: +(c.timestamp[0] ?? 0).toFixed(3), end: +(c.timestamp[1] ?? c.timestamp[0] ?? 0).toFixed(3) })).filter((w) => w.text);
console.log(JSON.stringify(words));
