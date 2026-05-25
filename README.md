# Forkscape

Forkscape 是一个面向 AI 对话的分支画布工具。它把 Gemini 对话整理成类似脑图的工作区，让每一次回答都可以继续追问、分叉探索、拖动画布整理，并保存成自己的思考历史。

我是一个业余小白，这个项目是我根据自己的日常需求一点点做出来的。它不是一个成熟商业产品，而是一个为了让 AI 对话更容易回看、分支和整理的小型个人项目。

Forkscape is a branching canvas for AI conversations. It turns a Gemini chat into a mind-map-like workspace where every answer can be forked, explored, dragged, and saved as part of your thinking history.

Current version: `v0.3.1`

## Background

I am a hobbyist beginner, and I built Forkscape around my own everyday needs. It is a small personal project made to make AI conversations easier for me to explore, branch, and revisit.

## Features

- Branch from any AI answer instead of continuing in one linear chat.
- Visual mind-map canvas with draggable nodes and connection lines.
- Mouse wheel zoom, left/middle-button canvas panning, and draggable conversation cards.
- Auto-growing cards for longer answers.
- Long answers can collapse, expand on hover, and pin open with a double click.
- Persistent local conversation history via the bundled local server.
- History sessions can be manually reordered, renamed, and deleted.
- Large canvas navigation with a minimap and hidden scrollbars.
- Gemini model discovery that only shows models supporting `generateContent`.
- JSON import/export for backing up conversation trees.

## Latest Update

`v0.3.0` improves Forkscape's canvas workflow:

- Cleaner Gemini model selector with common model options.
- Better answer placement to reduce overlap around question cards.
- Triple-click group selection, group dragging, Delete removal, and Esc cancel.
- Double-Space auto-arrange for selected conversation groups.
- Restored reliable double-click expand and collapse behavior.
- Kept API keys and local session data out of Git.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Quick Start

On Windows, double-click:

```text
open-app.cmd
```

Then open:

```text
http://localhost:4173
```

You can also run the server manually:

```bash
node server.mjs
```

## Gemini API Key

Forkscape does not ship with an API key. Paste your own Gemini API key in the app. For this local prototype, the key is stored only in your browser/local runtime.

Do not commit API keys, `.env` files, logs, or local session history.

## Local Data

Local conversation history is stored in:

```text
.gemini-branch-sessions.json
```

That file is ignored by Git.

## Project Status

Forkscape is an early prototype. Good next steps:

- Search history sessions.
- Collapse and expand entire branches.
- Export to Markdown, SVG, and PNG.
- Move API calls behind a backend proxy for production use.

## License

MIT
