# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Host-driven regeneration** — the answer-row icon now POSTs to `POST /api/dsh-regenerate/regenerate`, which analyses the target turn and injects a frozen `cordis-host-runner` continuation through `agent.followup()` that explicitly asks the model to disregard its previous final response. The instruction adapts to the turn's end reason and to committed assistant/tool progress, and the original attachments are rebuilt into the continuation host-side. The client falls back to the legacy append-prompt flow when the route is unavailable.
- **Paste and drag-drop attachments in the editor** — Ctrl/Cmd+V anywhere in
  the editor card and file drops onto it feed the same draft pipeline as the
  add button (local previews, per-session receipts, removable before submit).
  Folder members are skipped via the entry API; a mixed paste still inserts
  its text. Capture-phase guards keep the host's document-level paste router
  and attachment drop listeners from duplicating the intake into the bottom
  composer.

### Fixed

- **Editor image cache is now bounded** — thumbnail data URLs are capped at 64 entries with least-recently-used eviction, and failed reads are no longer cached, so a long-lived session cannot retain every image it has rendered and transient read failures can recover.
- **User-row click listener no longer rebinds on every keystroke** — the editor's row effect is scoped to `editing` / `node` changes instead of running after every render.
- **Model picking failed with "expected 1 argument(s), got 2"** — the editor's
  model seat passed an `AbortSignal` to `session/selectModel`, whose remote
  takes the request only; the client api's argument-count validation rejected
  every pick. Found by driving the real app: changing the model in the editor
  surfaced "修改失败 — client api: session/selectModel expected 1
  argument(s), got 2". A session whose selected model no longer exists (for
  example after the model was removed from its provider) shows the raw
  `provider/model` fallback on the chip and hides the effort seat until a
  catalogued model is picked — picking now succeeds in exactly that state.

- **Model menu opens downward** — the picker dropdown now drops below the
  chip (matching common dropdown intuition inside the message flow) and
  flips above it only when the viewport space below is too short.

- **Model picker menu redesign** — the dropdown now matches the host
  composer's ModelSelect card: prominent elevation, 34px option rows with a
  trailing selection check (a pulsing dot while a pick is in flight), sticky
  provider headings, two-line-clamped model descriptions, right-aligned
  current values and SVG chevrons on the drill cells, and a quieter back
  row. A drilled list opens centered on the selected entry instead of the
  top of the catalog.

- **Editor action row and keymap** — the toolbar now reads as explicit
  actions: a borderless **+ Add attachments** chip with a text label and the
  model chip on the left; a ghost **Cancel** and a solid info-fill
  **Resubmit** pill on the right (replacing the circular ↑ send button).
  **Enter** submits and **Shift+Enter** inserts a newline, matching the
  bottom composer (Ctrl/Cmd+Enter still works; an IME composition commit
  never submits). A caption-tone keymap line under the card shows
  `Enter to resubmit · Shift+Enter for a new line · Esc to cancel`. The model
  chip keeps its two-level menu with the reasoning-effort pane.

- **Editor visual polish** — the in-place editor card now uses the bottom
  composer's actual surface treatment instead of a flat bordered box: the
  elevated input fill (`--dsw-specific-input-major`), the design-system
  hairline stroke drawn inside the soft elevation shadow (`border: 0`), the
  28px panel radius, and the composer's vertical rhythm. The draft area takes
  the composer's text insets, one-line floor, shared 14-line height cap
  (`--dsh-composer-text-max-height`), business-blue caret, themed l2 scrollbar
  pair, and a focus-within hairline accent. The model picker menu moves from a
  translucent wash with a hard drop shadow to the menu elevation face.
  Attachment remove badges follow the host rail: an inset contrast-fill circle
  revealed on hover or keyboard focus (always visible on touch) instead of an
  overhanging badge the rail's scrollport could clip.

### Removed

- Dead code: the unused `TextButton` component and its CSS, a superseded
  duplicate `+`-button rule, an unused toolbar selector, and the now-unused
  `SendGlyph` send-arrow icon.

## [1.0.1] - 2026-11-16

A refinement release: the in-place editor now matches the bottom composer, and
adding attachments or switching model/effort no longer requires leaving the
editor. No host-side API changes; no migration needed.

### Added

- **Add attachments while editing** — a **+** button in the editor toolbar opens
  the file picker. Picked images and files are uploaded through DSH's own
  browser intake (`POST /api/session/uploadFileBinary`, with `mediaType` for
  PNG/JPEG/WebP/GIF), previewed locally, and removable before submit. Receipts
  are cached per session and a failed upload surfaces an explicit warning
  instead of silently dropping the attachment.
- **Model chip with reasoning effort** — the editor's model seat mirrors the
  bottom composer: a trigger showing the model name plus its reasoning level,
  and a two-level menu with **Model ›** / **Reasoning effort ›** drill rows, a
  provider-grouped model list, and an effort list (including the
  provider-default option). Selections go through `session.selectModel`, so the
  editor and the composer stay in sync.

### Changed

- **Editor layout matches the bottom composer** — one toolbar row with the
  **+** button on the left and the model chip plus a 34px blue circular
  **Regenerate** button on the right, using the same design tokens as the
  composer (info-fill send button, selector-fill add button, chip typography).
  The textarea auto-fits its content (one line minimum, capped at half the
  viewport) with no manual resize handle.
- **One submit mode** — the "Branch to a new chat and regenerate" action and its
  fork logic were removed. **Regenerate** always resubmits in the current chat,
  keeping the earlier exchange in context. The editor's run-mode chip was
  removed too; session permissions remain configurable in the composer.

### Fixed

- The editor could flash open and immediately close: a React hooks-order
  violation in the model seat (an effect registered after an early return)
  unmounted the editor as soon as the model catalog arrived. All hooks are now
  registered unconditionally.
- The model menu now closes after a successful model or effort selection, like
  the composer's menu.

## [1.0.0] - 2026-11-15

Initial release of **dsh-regenerate** — a DSH Web UI plugin that lets users
regenerate an assistant answer and edit/resend a sent user prompt without
rewriting the append-only session log.

### Added

- **Regenerate below an answer** — icon action in the finalized assistant
  message's action row that resubmits the prompt that produced the answer in
  the current chat, so the model answers again with the earlier exchange kept
  in context.
- **Edit and resend** for a sent user prompt — an in-place, Cursor-style editor
  that takes the bubble's exact position, with a read-only attachment rail and
  **Cancel** / **Branch** / **Regenerate** actions. Escape, an outside click, or
  a click on another user message closes it and restores the original bubble.
- **Attachments** — the original prompt's image/file attachments are rebuilt
  for the receiving session (images inlined as base64, files re-staged through
  a narrow Host route); a failed rebuild surfaces an explicit warning instead
  of dropping silently.
- **Localization** — English and Chinese display metadata and UI labels, plus
  an original circular-arrow SVG plugin icon.
- **Plugin market index** (`index.json`, format 1) for the Discover tab, with
  the 1.0.0 entry pinned to the publication commit so in-place updates work.

### Changed

- Package prepared for publication: the `private` flag was removed,
  repository and MIT license metadata were added, the GitHub / plugin-index /
  local install channels were documented, and `npm install` of the published
  package is listed.
- DSH version compatibility is declared via `engines.dsh >= 0.2.0` (mirrored
  in the market index entry) so incompatible runtimes are rejected before
  install.

[1.0.1]: https://github.com/Yellster/dsh-regenerate/releases/tag/1.0.1
[1.0.0]: https://github.com/Yellster/dsh-regenerate/releases/tag/1.0.0
