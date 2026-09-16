// paths.mjs — where the tools find media and write pages. One place, set by environment variables.
//
// On Rexx's PC nothing needs setting: the defaults are the PC folders the tools always used.
// On the shared cloud server (Docker) the compose file sets them to the mounted volumes.
//
//   LYFE_MEDIA_ROOT   video/audio working media        PC: D:/REXX/AI_Video/BizBox-Garage-Dream      server: /data/media
//   LYFE_EDITOR_DIR   built page + sheets + proxies    PC: Claude scratchpad film/editor              server: /data/editor
//   LYFE_PC_SOURCE    legacy PC copy of the storyboard  PC: Documents/Codex/...                        server: (unset → repo only)
import os from 'node:os';

const onPC = os.platform() === 'win32';
const env = (k, pcDefault) => process.env[k] || (onPC ? pcDefault : '');

export const MEDIA_ROOT = env('LYFE_MEDIA_ROOT', 'D:/REXX/AI_Video/BizBox-Garage-Dream') || '/data/media';
export const EDITOR_DIR = env('LYFE_EDITOR_DIR', 'C:/Users/16263/AppData/Local/Temp/claude/C--Users-16263-Desktop-Claude-Code-Build/9d00f0c5-975e-4197-b36d-8f1eb6052b13/scratchpad/film/editor') || '/data/editor';
export const PC_SOURCE = env('LYFE_PC_SOURCE', 'C:/Users/16263/Documents/Codex/2026-09-04/referenced-chatgpt-conversation-this-is-an-2');
