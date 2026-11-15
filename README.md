# dsh-regenerate

A DSH Web UI plugin that adds regeneration and prompt editing to the conversation.

## What it adds

1. **Regenerate below an answer** — an icon button in the finalized assistant message's action row, next to the built-in Copy / Branch buttons. It resubmits the prompt that produced the answer in the *current* chat, so the model answers again here; the earlier exchange stays in context.
2. **Edit and resend** for a sent user prompt:
   - clicking the user message bubble turns it into an edit box **in place** (Cursor-style) — the original bubble is hidden and the editor takes its exact position, rather than opening a separate panel below the buttons;
   - an **Edit** icon next to the Copy button opens the same editor (ChatGPT-style).
   - **Regenerate** (circular send button, also Ctrl/Cmd+Enter) sends the edited text as a new prompt in the *current* chat, so the model answers again here. The earlier question and answer stay in context.
   - `Cancel` or Escape closes the editor and restores the bubble. Clicking anywhere outside the editor also closes it (a submit in progress is not interrupted); clicking another user message switches the editor to that message.
   - The editor **mirrors the bottom composer's layout**: the control row under the textarea holds, left to right, an add-attachment **+** button, the permission-preset chip (read-only / workspace-write / …), and on the right the model chip and the circular **Regenerate** send button with `Cancel` beside it. The two pickers read the same session projections and catalogs as the composer and write through the same channels (the `/permission <preset>` command and `session.selectModel`), so both surfaces stay in sync; risky presets (full access, auto review) keep the host's confirmation gate. The seats hide for addressed subagent sessions or when the catalogs are unavailable.

### Icon style

The two message actions are **icon-only** buttons (`28px + font delta`, matching the host's `.action` size), consistent with DSH's built-in Copy / Branch actions: no label text sits beside the glyph. Labels live in the hover tooltip (`title`) and `aria-label`; busy state spins the icon and a failed operation turns it red with the reason in the tooltip. The editor's send button is a circular **↑** glyph matching the composer's submit button; `Cancel` is the only text button. The plugin's own icon is a single circular arrow on a blue gradient — a clean mark with no lettering.

**Regenerate** stays in the current chat: it calls `session/prompt` on the same session with the edited text, so the earlier exchange remains in context. This is the least surprising action and matches the label.

**Attachments are carried over, and shown in the editor.** The original prompt's `image` / `file` content blocks are rebuilt into the new `session/prompt` content: images are read back as bytes through the built-in `session/attachment` remote and inlined as base64; files are re-streamed into the receiving Session's upload intake by a narrow Host route, because `session/prompt` accepts files only as a `receiptId` staged on the *target* Agent and there is no Client-side endpoint for reading stored file bytes.

**New attachments can be added while editing.** The editor's **+** button opens a file picker; picked files are uploaded through DSH's own browser intake (`POST /api/session/uploadFileBinary`, with `mediaType` for PNG/JPEG/WebP/GIF images), so they become staged receipts on the receiving Session's Agent exactly like composer drafts. Drafts show local previews and a hover **Remove** chip; a failed upload counts as a missing attachment and surfaces the carry-over warning. A prompt with attachments but no text is valid, matching the composer.

The editor renders an **attachment rail** above the textarea, mirroring the composer's draft previews: 64×64 image thumbnails (`object-fit:cover`, `--dsw-radius-xl`) and 240×64 file cards with a file glyph, name, extension and size. Image data URLs are cached by content-addressed `attachmentId`; a failed read falls back to a placeholder glyph rather than a broken image. The rail lives inside `[data-rg-editor]`, so clicking a thumbnail does not count as an outside click. The answer-row icon button's tooltip still reports attachment counts. If an attachment cannot be rebuilt (e.g. the Host route is unavailable), the operation still succeeds but the button/editor surfaces an explicit warning instead of silently dropping it.

## Files

| File | Purpose |
| --- | --- |
| `package.json` | Bundle manifest with `dsh.client` browser half |
| `cordis.patch.yml` | Inserts the plugin row into the profile |
| `index.js` | Host half: `POST /api/dsh-regenerate` re-stages original file attachments into the receiving Session and returns fresh receipt ids |
| `client.js` | Browser half: slot registrations, buttons, inline editor, styles |
| `locale/*.json` | Display metadata and UI labels (English / Chinese) |
| `icon.svg` | Original plugin icon |
| `index.json` | Plugin market index (format 1) for the Discover tab |
| `LICENSE` | MIT license |

## Platform notes / known limitations

- **Assistant actions** use the `conversation.chat.assistant-actions` list slot (owner prop `messageId`, plus `sessionId`, `useChat`, `t`, …). The user prompt's text and event seq are resolved from the `useChat` snapshot.
- **User messages have no action-row slot.** DSH hardcodes the user row's Copy button in `MessageIconActions` and does not pass `extraActions` to it; the complete chat slot set contains no `conversation.chat.user.actions`. The user row is a flex column with a 6px gap, so anything rendered directly in `conversation.chat.user.before` wraps onto its own line. To avoid that, the plugin keeps that chain seat out of flow (`display:none`) while idle and **portals the Edit icon into the built-in action row** — the flex row holding the timestamp and Copy button — so the icon sits right next to Copy on the same line. While editing, the chain seat becomes the editor and the original prompt content siblings (bubble / attachments / references) are temporarily hidden, so the editor sits in the bubble's place in the flex column. It fills the full content width rather than the bubble's width: the editing row is centred with `width:calc(100% + 32px)` capped by `--dsh-composer-card-max-width`, the same value the bottom composer card uses, so the editor is exactly as wide as the input box. The bubble is restored on close or unmount. Avoiding the `user` chat-node renderer keeps the shipped bubble intact (`replaceRisk: shadows-shipped-ui`). The action row is found by its `data-clock` attribute with a last-child fallback.
- **Outside-click dismissal** uses a document-level `click` listener in the capture phase, active only while the editor is open. It checks `closest('[data-rg-editor]')` and marks the event in a per-instance `WeakSet`, so the user row's bubble-phase "click to open" handler cannot immediately re-open the editor from the same click. Per-instance marking is deliberate: clicking a different user message closes this editor and opens that message's editor in one click. While a submit is in flight the listener does nothing, so a failure still lands in a visible editor.
- `conversation.chat.user.before` is a chain: only the first non-null `select` result renders. If another plugin (e.g. LiveShare) claims that seat for a message, our decoration is skipped there.
- **Attachments:** images are re-submitted inline (base64) and files are re-staged into the receiving Session via the Host route, so edits/regenerations of prompts with pictures or files keep them. The route is same-origin guarded and sits behind DSH's own `/api` authentication. This means the Host half is no longer a no-op: after editing `index.js`, reload the bundle (`set_bundle` off/on) or restart Harness so the route is registered; until then the Client falls back to images only and warns about files.
- **Regenerate** appends the prompt to the current Session instead of forking, so the original question and answer remain in the model's context — that is the intended trade-off, not a bug.

## Install

In DSH, open **Plugins → Add plugin** and use any of these sources:

- **npm** — type the package name `dsh-regenerate` and install.
- **GitHub** — paste `https://github.com/Yellster/dsh-regenerate` and install.
- **Plugin index** — with the *Custom plugin indexes* plugin enabled, add
  `https://raw.githubusercontent.com/Yellster/dsh-regenerate/main/index.json`
  under **Plugins → Discover** and install *Regenerate and edit prompts* from
  there. Versions pinned to a commit support in-place updates.
- **Local directory** — paste the absolute path of a checkout of this repository,
  or call `plugin_manager` → `install_bundle` with that path.

After installation a page refresh loads the new browser module.

## Publishing

Maintainer notes for releasing a new version:

1. Bump `version` in `package.json`, then commit and push.
2. **npm** — `npm login` once, then `npm publish`; the `files` whitelist is
   already configured and no build step is needed.
3. **Plugin index** — prepend a new entry to `versions` in `index.json` with the
   new version, the release commit's full 40-character SHA, and its publish time
   in Unix seconds, then commit and push. Git entries must stay pinned to a full
   commit SHA to remain updatable.
