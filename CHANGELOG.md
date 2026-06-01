# Changelog

All notable changes to Forkscape are documented here.

## v0.4.0 - 2026-06-01

### Added

- History search across session titles and conversation node text.
- Branch collapse and expand controls on cards with child branches.
- Double-middle-click canvas overview to show all conversation cards.
- Markdown export for readable conversation notes.
- PNG export for sharing the current conversation map as an image.
- SVG export for scalable, editable conversation map graphics.

### Changed

- Moved the grid background onto the canvas so it pans and zooms with the conversation map.
- Split JSON export from document/image exports in the toolbar.
- Updated the canvas operation guide with the overview shortcut.
- Reorganized the README into a Chinese-first bilingual introduction.

## v0.3.3 - 2026-05-27

### Added

- Added a real product screenshot to the top of the README.
- Added a Chinese audience section explaining who Forkscape is useful for.
- Added GitHub repository topics for better discovery.

## v0.3.2 - 2026-05-25

### Changed

- Updated the README title to `Forkscape - AI 对话脑图` so the project purpose is clear at a glance.

## v0.3.1 - 2026-05-25

### Changed

- Added a Chinese project introduction before the English README introduction.
- Clarified that Forkscape is a personal project built by a hobbyist beginner around everyday needs.

## v0.3.0 - 2026-05-25

### Added

- Common Gemini model list for a cleaner model selector.
- Answer placement rules that put replies to the right of the current question and stack multiple answers vertically.
- Ctrl+Enter send hint in the focused follow-up composer.
- Triple-click selection for the current card and its downstream conversation cards.
- Group dragging and Delete key removal for selected conversation groups.
- Esc key and blank-canvas click actions to cancel the current selection.
- Double-Space auto-arrange for selected conversation groups.

### Changed

- Improved card selection responsiveness.
- Restored direct double-click expand and collapse behavior for cards, including when they are not already selected.
- Prevented generated cards from overlapping during layout updates.
- Updated the canvas operation guide with the newer keyboard and mouse actions.

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
