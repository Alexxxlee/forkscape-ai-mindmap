# Forkscape

Forkscape is a branching canvas for AI conversations. It turns a Gemini chat into a mind-map-like workspace where every answer can be forked, explored, dragged, and saved as part of your thinking history.

Current version: `v0.2.0`

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

`v0.2.0` improves Forkscape as a daily-use canvas:

- Added a large canvas with minimap navigation.
- Added collapsible answer cards with hover preview and double-click pinning.
- Added manual history ordering, session rename, and session delete.
- Added small operation hints on the canvas.
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

- Rename, delete, and search history sessions.
- Collapse and expand branches.
- Export to Markdown, SVG, and PNG.
- Add a minimap and auto-layout reset.
- Move API calls behind a backend proxy for production use.

## License

MIT
