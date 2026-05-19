# Changelog

All notable changes to Forkscape are documented here.

## v0.2.0 - 2026-05-19

### Added

- Large 24000 x 24000 canvas workspace for broader branching maps.
- Minimap in the lower-left corner, showing conversation cards as scaled rectangles and the current viewport.
- Collapsible answer cards:
  - Newly generated answers stay full size briefly, then collapse.
  - Hover previews the full answer.
  - Double-click pins an answer open or collapses it again.
- Manual history ordering with drag-and-drop reordering animation.
- Session rename and delete controls in the history sidebar.
- Lightweight canvas operation guide.
- Redirect protection for accidentally opening `/app.js` directly in the browser.

### Changed

- Hidden horizontal and vertical canvas scrollbars while preserving drag, zoom, and minimap navigation.
- History sidebar now keeps manual order instead of auto-sorting by update time.
- New sessions are added to the end of the history list.
- Minimap scales to the visible conversation area rather than the entire oversized canvas.

### Security

- No Gemini API keys are included in source code.
- Local session data, logs, `.env`, and API keys remain ignored by Git.

## v0.1.0 - 2026-05-18

### Added

- Initial Forkscape prototype.
- Branching Gemini conversation canvas.
- Draggable conversation nodes with connection lines.
- Local session persistence through the bundled Node server.
- Gemini model discovery and generateContent model filtering.
- JSON import and export.
- README, MIT license, and GitHub repository setup.
