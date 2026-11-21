# dsh-regenerate

A DSH Web UI plugin that adds regeneration and prompt editing to the conversation.

## What it adds

1. **Regenerate below an answer** — an icon button in the finalized assistant message's action row, next to the built-in Copy / Branch buttons. It asks the host to analyse that turn and inject a hidden continuation through `agent.followup()`, explicitly telling the model to disregard its previous final answer and produce a fresh one. The old exchange stays in the append-only log, but no user chat bubble is added and no title is changed. If the host route is unavailable (older bundle), the button falls back to re-issuing the original prompt in the current chat.
2. **Edit and resend** for a sent user prompt:
   - clicking the user message bubble turns it into an edit box **in place** (Cursor-style) — the original bubble is hidden and the editor takes its exact position, rather than opening a separate panel below the buttons;
   - an **Edit** icon next to the Copy button opens the same editor (ChatGPT-style).
   - **Resubmit** (solid blue text button; **Enter**, or Ctrl/Cmd+Enter) sends the edited text as a new prompt in the *current* chat, so the model answers again here. The earlier question and answer stay in context. **Shift+Enter** inserts a newline; an IME composition commit never submits. A keymap hint line under the card spells the shortcuts out.
   - The **Cancel** button or Escape closes the editor and restores the bubble. Clicking anywhere outside the editor also closes it (a submit in progress is not interrupted); clicking another user message switches the editor to that message.
   - The editor's card **mirrors the composer's surface**: the elevated input fill (`--dsw-specific-input-major`), the design-system hairline + soft elevation shadow (no flat 1px border), the 28px panel radius, the composer's text insets and 14-line height cap, a business-blue caret and focus hairline, and attachment remove badges styled after the host rail (inset contrast circle, hover/focus reveal, always visible on touch).
   - The control row under the textarea groups **+ Add attachments** (borderless chip with a text label) and the model chip (model name + reasoning effort, like the composer trigger) on the left, and a ghost **Cancel** plus the solid blue **Resubmit** pill (`--dsw-alias-button-info-fill`) on the right. The model picker reads the same session projection and catalog as the composer and writes through `session.selectModel`, so both surfaces stay in sync — including the reasoning-effort drill pane. The seat hides for addressed subagent sessions or when the catalog is unavailable.

### Icon style

The two message actions are **icon-only** buttons (`28px + font delta`, matching the host's `.action` size), consistent with DSH's built-in Copy / Branch actions: no label text sits beside the glyph. Labels live in the hover tooltip (`title`) and `aria-label`; busy state spins the icon and a failed operation turns it red with the reason in the tooltip. The editor's actions are text buttons: a solid info-fill **Resubmit** pill (the composer send pair), a ghost **Cancel**, and borderless **+ Add attachments** / model chips reusing the composer's toolbar chrome. The plugin's own icon is a single circular arrow on a blue gradient — a clean mark with no lettering.

**Regenerate** in the editor stays in the current chat: it calls `session/prompt` on the same session with the edited text, so the earlier exchange remains in context. The **answer-row icon** uses a different path — the host-driven continuation described below — because there is no edited text to send.

**Regenerate semantics (answer-row icon):** it POSTs `{sessionId, turn?, note?}` to `POST /api/dsh-regenerate/regenerate`. The host resolves the live Agent, refuses a running session, finds the requested (or last) `turn/end` and the opening `user/message` of that turn, then injects one frozen `cordis-host-runner` user message via `agent.followup()`. Its `<system-reminder>` tells the model to disregard the previous final response of that turn and generate a fresh, complete answer. The wording adapts to the end reason (`error`, `interrupted`, `aborted`, `max-tokens`, `blocked`) and to whether assistant messages or tool calls were already committed, so successful side effects are not repeated. The original prompt's attachments are rebuilt into the continuation host-side. Nothing is forked, no user bubble is added, and the session title is untouched.

**Fallback:** if the regenerate route is missing or fails (for example an older Host bundle is still installed), the icon falls back to the legacy behaviour of re-issuing the original prompt through `session/prompt` in the current chat. In that mode the model sees its earlier answer and may extend it rather than start over; reload the bundle to get the host-driven semantics.

**Attachments are carried over, and shown in the editor.** The original prompt's `image` / `file` content blocks are rebuilt into the new `session/prompt` content: images are read back as bytes through the built-in `session/attachment` remote and inlined as base64; files are re-streamed into the receiving Session's upload intake by a narrow Host route, because `session/prompt` accepts files only as a `receiptId` staged on the *target* Agent and there is no Client-side endpoint for reading stored file bytes.

**New attachments can be added while editing.** Paste (Ctrl/Cmd+V) or drag files onto the editor card — pasted screenshots and copied files go through the same draft pipeline, folder members are skipped, and a paste that also carries text still inserts the text. The editor's **+ Add attachments** chip opens a file picker; picked files are uploaded through DSH's own browser intake (`POST /api/session/uploadFileBinary`, with `mediaType` for PNG/JPEG/WebP/GIF images), so they become staged receipts on the receiving Session's Agent exactly like composer drafts. Drafts show local previews and a hover **Remove** chip; a failed upload counts as a missing attachment and surfaces the carry-over warning. A prompt with attachments but no text is valid, matching the composer.

The editor renders an **attachment rail** above the textarea, mirroring the composer's draft previews: 64×64 image thumbnails (`object-fit:cover`, `--dsw-radius-xl`) and 240×64 file cards with a file glyph, name, extension and size. Image data URLs are cached by content-addressed `attachmentId`; a failed read falls back to a placeholder glyph rather than a broken image. The rail lives inside `[data-rg-editor]`, so clicking a thumbnail does not count as an outside click. The answer-row icon button's tooltip still reports attachment counts. If an attachment cannot be rebuilt (e.g. the Host route is unavailable), the operation still succeeds but the button/editor surfaces an explicit warning instead of silently dropping it.

## Files

| File | Purpose |
| --- | --- |
| `package.json` | Bundle manifest with `dsh.client` browser half |
| `cordis.patch.yml` | Inserts the plugin row into the profile |
| `index.js` | Host half: `POST /api/dsh-regenerate` re-stages original file attachments; `POST /api/dsh-regenerate/regenerate` analyses the turn and injects a hidden `agent.followup()` continuation |
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
- **Attachments:** images are re-submitted inline (base64) and files are re-staged into the receiving Session via the Host route, so edits/regenerations of prompts with pictures or files keep them. The editor rebuilds attachments client-side; the answer-row icon rebuilds them host-side into the injected continuation. Both routes are same-origin guarded and sit behind DSH's own `/api` authentication. The Host half is no longer a no-op: after editing `index.js`, reload the bundle (`set_bundle` off/on) or restart Harness so the routes are registered; until then the Client falls back to images only and warns about files.

## Development

Run `npm test` for the dependency-free suite (`node --test`, with stubs for React/DOM). It covers the Host routes and helpers plus the client bundle's slot / locale / helper contract. No build step and no `node_modules` are required.

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

Releases are published to npm automatically by
[`.github/workflows/publish.yml`](.github/workflows/publish.yml).

One-time setup — configure npm trusted publishing (OIDC), so no `NPM_TOKEN` is
stored in GitHub:

1. On npmjs.com, open the package settings for `dsh-regenerate` →
   **Trusted publishing** → **Add trusted publisher**.
2. Use GitHub Actions with owner `Yellster`, repository `dsh-regenerate`,
   workflow `publish.yml`, and environment `npm`; allow publishing.
3. Pushing a version tag, publishing a GitHub Release, or running the workflow
   manually with a tag triggers the publish. The workflow checks out that tag,
   verifies its version matches `package.json`, runs `npm test`, skips versions
   already on npm, and publishes with OIDC/provenance.

For a manual release:

1. Bump `version` in `package.json`, then commit and push.
2. Create the GitHub Release (or push the matching tag); the workflow publishes it.
3. Prepend a new entry to `versions` in `index.json` with the new version, the
   release commit's full 40-character SHA, and its publish time in Unix seconds,
   then commit and push. Git entries must stay pinned to a full commit SHA.

If trusted publishing is not available, `npm login` followed by `npm publish`
still works locally (account 2FA applies).
