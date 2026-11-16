# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-15

Initial release of **dsh-regenerate** — a DSH Web UI plugin that lets users
regenerate an assistant answer and edit/resend a sent user prompt without
rewriting the append-only session log.

### Added

- **Regenerate below an answer** — icon action in the finalized assistant
  message's action row that resubmits the prompt that produced the answer in
  the current chat, so the model answers again with the earlier exchange kept
  in context.
- **Edit and resend** for a sent user prompt — an in-place, Cursor-style
  editor that takes the bubble's exact position and mirrors the bottom
  composer: attachment rail with previews, model chip with reasoning effort,
  and the circular Regenerate send button. Escape, an outside click, or the
  row's own dismiss closes it and restores the original bubble.
- **Attachments** — the original prompt's image/file attachments are rebuilt
  for the receiving session (images inlined as base64, files re-staged through
  a narrow Host route), and new attachments can be added while editing; a
  failed rebuild surfaces an explicit warning instead of dropping silently.
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

[1.0.0]: https://github.com/Yellster/dsh-regenerate/releases/tag/1.0.0
