# Forkscape Project Log

Last updated: 2026-05-18

## Project Summary

Forkscape is a local HTML/CSS/JavaScript prototype for branching AI conversations. It turns Gemini chat into a mind-map-style canvas where each AI answer can be selected, forked, explored, dragged, and saved into persistent local history.

Suggested positioning:

> Forkscape: a branching canvas for AI conversations.

Chinese name idea:

> 分境

Core value:

> Ordinary AI chat becomes messy when conversations get long. Forkscape preserves each thinking path as a visual, forkable conversation map.

## Workspace

Project folder:

```text
C:\Users\SEU-SN\Documents\Codex\2026-05-18\html-app-gemini
```

Main files:

```text
index.html
styles.css
app.js
server.mjs
open-app.cmd
README.md
LICENSE
.gitignore
docs/PROJECT_LOG.md
```

Local-only ignored files:

```text
.gemini-branch-sessions.json
server.log
server.err
node_modules/
.env
```

## Current App Features

- Static frontend app with local Node server.
- Gemini conversation shown as a branching mind-map canvas.
- Click any answer or question node to select it.
- Ask a follow-up from the selected node to create a new branch.
- Gemini API key input in the UI.
- Gemini model list refreshes through the Gemini `models` endpoint.
- Model dropdown filters to models that support `generateContent`.
- Non-chat-like models are filtered out, including robotics, computer-use, customtools, image, TTS, and embedding models.
- Local draft mode exists for trying the interface without an API key.
- Canvas supports:
  - left-button panning on empty canvas
  - middle-button panning
  - mouse-wheel zoom
  - zoom buttons
  - reset view button
- Conversation cards support:
  - automatic height growth based on content
  - left-button drag to reposition individual nodes
  - connection lines update while nodes are dragged
- Import/export JSON for conversation trees.
- Left collapsible history sidebar.
- New sessions can be created from the history sidebar.
- The previous "new tree" button now creates a new history session instead of overwriting old work.
- Local history is persisted by `server.mjs` to `.gemini-branch-sessions.json`.
- If server persistence is unavailable, app falls back to browser storage where possible.

## Important Security Notes

- A Gemini API key was pasted during development and was temporarily added to the prototype.
- The hardcoded key has since been removed from `app.js`.
- A search confirmed the exact pasted key was no longer present in the tracked source files.
- The user should rotate/delete that Gemini API key in Google AI Studio because it appeared in chat history.
- Do not commit:
  - `.gemini-branch-sessions.json`
  - logs
  - `.env`
  - API keys

Current `.gitignore` includes those files.

## GitHub Target

Repository:

```text
https://github.com/Alexxxlee/forkscape
```

Recommended repo name:

```text
forkscape
```

Recommended license:

```text
MIT
```

## Git Status / Upload Blocker

The project was initialized with `git init` inside the Codex sandbox, but the current sandbox denies writes inside the hidden `.git` directory. This prevents:

```text
git add
git commit
git config
git remote add
git push
```

Observed failure:

```text
fatal: Unable to create '.git/index.lock': Permission denied
```

PowerShell also could not create a test file inside `.git`.

The practical solution is to run Git commands from the user's own PowerShell outside the sandbox, or start a new Codex session with broader filesystem/Git permissions.

Recommended commands from normal PowerShell:

```powershell
cd "C:\Users\SEU-SN\Documents\Codex\2026-05-18\html-app-gemini"

git init
git config user.name "Alexxxlee"
git config user.email "Alexxxlee@users.noreply.github.com"

git add .
git commit -m "Initial Forkscape prototype"

git remote add origin https://github.com/Alexxxlee/forkscape.git
git branch -M main
git push -u origin main
```

Before committing, verify ignored files:

```powershell
git status --short --ignored
```

Expected ignored files include:

```text
!! .gemini-branch-sessions.json
!! server.err
!! server.log
```

## Browser / Server Notes

The app is intended to be opened through:

```text
http://localhost:4173
```

Windows helper:

```text
open-app.cmd
```

Manual server command:

```powershell
node server.mjs
```

Earlier issue:

- `server.mjs` initially returned 404 on Windows because path resolution treated `/index.html` incorrectly.
- Fixed by resolving request paths as `resolve(root, ".${pathname}")`.

Another issue:

- Codex in-app browser initially showed "site cannot be reached" because no persistent server was listening.
- The local server was restarted in the Node runtime during development.
- In a normal user terminal, `open-app.cmd` or `node server.mjs` should keep the server alive.

## GitHub / Similar Project Research

The app name chosen:

```text
Forkscape
```

Reason:

- "Fork" means branching or forking from any answer.
- "scape" suggests a landscape/workspace.
- Short, memorable, product-like, and aligned with the canvas experience.

Similar or adjacent projects found:

- `tldraw/branching-chat-template`: closest match; branching chat on a canvas, Gemini/API integration, Cloudflare Worker.
- ChatRoutes SDK: branching/forkable AI conversation infrastructure.
- LobeChat branching conversations: branch support inside a larger chat product.
- Neurite: graph-style AI workspace, broader and more complex.
- PromptMap: AI-generated mind maps, adjacent but not the same.
- DeepDiagram: AI diagram/mind-map generation, adjacent but more diagram-focused.

Conclusion:

Forkscape has a real niche if it stays focused on lightweight branching AI conversation maps rather than becoming a generic chat UI.

## Recommended Roadmap

Phase 1: Safety and packaging

- Keep API key out of source.
- Keep `.gitignore` current.
- Improve README screenshots and startup instructions.
- Push to GitHub.

Phase 2: History memory

- Rename sessions.
- Delete sessions.
- Search sessions.
- Archive sessions.
- Sort by update time.
- Optional tags.

Phase 3: Canvas experience

- Collapse/expand branches.
- Auto-layout reset.
- Minimap.
- Multi-select node drag.
- Better overlap avoidance.

Phase 4: Export

- Export Markdown.
- Export Mermaid.
- Export SVG.
- Export PNG.

Phase 5: Production architecture

- Move Gemini calls behind a backend proxy for deployed versions.
- Store API keys in environment variables for server deployments.
- Add optional user-auth/session persistence for hosted app.

## Suggested Prompt For A New Session

Paste this into a new Codex session to continue:

```text
Continue the Forkscape project in:
C:\Users\SEU-SN\Documents\Codex\2026-05-18\html-app-gemini

Read docs/PROJECT_LOG.md first. The goal is to finish packaging, initialize Git, commit, and push to:
https://github.com/Alexxxlee/forkscape

The app is a Gemini branching conversation mind-map with draggable nodes, zoom/pan canvas, model filtering, and persistent local history.
```

