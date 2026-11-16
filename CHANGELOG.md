# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
