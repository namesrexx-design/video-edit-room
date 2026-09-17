# ONE COPY. Everybody works on the same one.

**Rexx, 2026-09-17:** *"Everybody's working on the same thing, but they're all
working on a different same thing. Then we get lost when nothing's on the same
page. There should be just one copy that everybody works on of everything we do."*

This is the rule. It is not a preference and it is not a workflow suggestion. It
is the thing that cost a full day on 2026-09-17, and here is exactly how:

| What happened | What it cost |
|---|---|
| The real work went into `V75.1`, `V76`, `V77-CANDIDATE` while the watched cut stayed at pass 15 | The server rendered pass 15 for a day and everyone read it as progress |
| The finished master lived only in an agent's sandbox | A cut pointed at a file that was not there, so nothing changed and nothing errored |
| Three previews came out byte-identical | Nobody noticed until the hashes were compared |
| Two agents shared a repo but not reality | One reported files as delivered that were never on the server |

## There is exactly one of each of these

| Thing | The one copy | How to check it |
|---|---|---|
| **Code** | `github.com/namesrexx-design/video-edit-room`, branch `main` | A branch is a proposal, not a second copy. Merge it or close it |
| **The film** | The watched cut `projects/garage-dream/cuts/STORYBOARD-FINAL.json` | `GET /state` shows its name, frames and every file it references |
| **The master** | `/srv/lyfe/media/team/garage-dream/FILM/` on the server | `GET /state` → `film_folder` |
| **All media** | `/srv/lyfe/media` on the server | Upload with `POST /upload?film=…&sha256=…` |
| **The storyboard** | `projects/garage-dream/STORYBOARD-BOARD.json` | It says what the current cut is. Update it when that changes |
| **Post copy** | `projects/garage-dream/content/post-plan.json` | One file. Not a doc, not a message |
| **The posting queue** | The scheduler on the server | One board, one approval, one place that knows what went out |
| **Anything for Rexx to read** | Drive, `00_PROJECTS/` | Old versions to `_superseded/`, never deleted |

## The four rules that keep it one copy

| # | Rule |
|---|---|
| 1 | **A new version replaces the old one in place.** The old one moves to `_superseded/`. You do not leave `-V2`, `-FINAL`, `-CANDIDATE` beside it and call the new one current |
| 2 | **If it is not on the server, it does not exist.** Not delivered, not done, not approved. `GET /state` is the proof, not a message saying it shipped |
| 3 | **The board says what is current.** If the board and a render disagree, the render is wrong and must fail loudly rather than quietly building the last thing that worked |
| 4 | **Check before you claim.** Hashes, frame counts, file sizes. "I delivered it" is not evidence; `/state` showing the file is |

## The two doors, so nobody is stuck outside

| Door | For |
|---|---|
| `POST https://mcp.biz-box.io/upload?film=<name>&sha256=<HEX>` | Handing over a file too big for GitHub. The server checks the hash and refuses a mismatch |
| `GET https://mcp.biz-box.io/state` | Asking the machine what it actually has, instead of asking each other |

Both use the studio password. Ask Rexx for it. Nobody needs SSH, and an agent
sandbox cannot reach port 22 anyway.

## Why this is worth the discipline

He is running this with a handful of agents who cannot see each other's chats.
The repo, the server and the board are the only shared memory that exists. Every
side copy is a place where two of us quietly start building different films.
