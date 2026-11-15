/* dsh-regenerate — browser half.
 *
 * Registers three contributions through the Web UI slots:
 *   - conversation.chat.assistant-actions : "Regenerate" icon action in the
 *     assistant message's action row (below DSH's answer).
 *   - conversation.chat.user.before      : an "Edit" icon action attached to a
 *     sent user prompt, plus a click handler on the user message row that
 *     expands the prompt into an inline editor (Cursor-style).
 *
 * Both operations branch the conversation at the user message with the
 * framework's own session/fork + session/prompt remotes, so the original
 * history is never rewritten (the DSH session log is append-only).
 */
window.__ModuleLoader__.load({
  id: 'dsh-regenerate',
  factory: (require) => {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const h = React.createElement;

    const NS = 'dshRegenerate';

    const en = {
      'regenerate': 'Regenerate',
      'regenerating': 'Regenerating…',
      'regenerateHint': 'Regenerate the answer in this chat; the earlier exchange stays in context',
      'edit': 'Edit',
      'editHint': 'Edit this prompt',
      'cancel': 'Cancel',
      'failed': 'Operation failed',
      'emptyPrompt': 'The prompt cannot be empty',
      'noPrompt': 'Could not find the original prompt',
      'editorHint': 'Ctrl/⌘ + Enter to regenerate · Esc to cancel',
      'attachments': 'Attachments: {0} image(s), {1} file(s)',
      'attachmentsMissing': 'Sent, but some attachments could not be carried over — add them again',
      'addAttachment': 'Add attachments',
      'removeAttachment': 'Remove',
      'permission': 'Mode',
      'model': 'Model',
      'menuModel': 'Model',
      'menuEffort': 'Reasoning effort',
      'effortDefault': 'Provider default',
      'knobFailed': 'Change failed',
      'sessionBusy': 'The chat is busy — try again after the current turn finishes',
      'confirmEnable': 'Enable',
      'confirmCancel': 'Cancel',
      'fullAccessTitle': 'Enable full access?',
      'fullAccessBody': 'The agent may run commands and modify files outside the workspace without asking.',
      'autoTitle': 'Enable auto review?',
      'autoBody': 'Permission decisions are decided automatically without asking.',
    };
    const zh = {
      'regenerate': '重新生成',
      'regenerating': '正在重新生成…',
      'regenerateHint': '在当前对话重新生成回答，原有问答会保留在上下文里',
      'edit': '编辑',
      'editHint': '编辑这条提问',
      'cancel': '取消',
      'failed': '操作失败',
      'emptyPrompt': '提问内容不能为空',
      'noPrompt': '找不到原始提问',
      'editorHint': 'Ctrl/⌘ + Enter 重新生成 · Esc 取消',
      'attachments': '附件：{0} 张图片、{1} 个文件',
      'attachmentsMissing': '已发送，但部分附件未能携带，请重新添加',
      'addAttachment': '添加附件',
      'removeAttachment': '移除',
      'permission': '运行模式',
      'model': '模型',
      'menuModel': '模型',
      'menuEffort': '推理级别',
      'effortDefault': '模型默认',
      'knobFailed': '修改失败',
      'sessionBusy': '对话正在运行，请等当前回合结束后再试',
      'confirmEnable': '启用',
      'confirmCancel': '取消',
      'fullAccessTitle': '启用完整访问？',
      'fullAccessBody': '代理可以在工作区之外执行命令、修改文件，且不再询问。',
      'autoTitle': '启用自动审阅？',
      'autoBody': '权限决策将自动进行，不再逐项询问。',
    };

    const CSS = `
[data-rg-row]{display:none;}
[data-rg-row][data-rg-editing]{display:block;align-self:center;width:calc(100% + 32px);max-width:var(--dsh-composer-card-max-width,calc(100% + 32px));padding:0;box-sizing:border-box;}
[data-rg-row][data-rg-fallback]{display:flex;justify-content:flex-end;width:100%;padding:0;order:3;box-sizing:border-box;}
[data-rg-action]{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));padding:0;border:1px solid transparent;border-radius:var(--dsw-radius-sm,7px);background:transparent;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background .12s,color .12s;}
[data-rg-action]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary,inherit));}
[data-rg-action]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4c8dff);outline-offset:1px;}
[data-rg-action][disabled]{opacity:.45;cursor:default;}
[data-rg-icon]{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px));display:block;flex:none;}
[data-rg-action][data-rg-text]{width:auto;height:auto;padding:3px 9px;font-size:11.5px;border-color:var(--dsw-alias-border-l1,rgba(127,127,127,.3));}
[data-rg-action][data-rg-primary]{background:var(--dsw-alias-brand-primary,#4c8dff);border-color:var(--dsw-alias-brand-primary,#4c8dff);color:#fff;}
[data-rg-action][data-rg-primary]:hover:not([disabled]){background:var(--dsw-alias-brand-primary,#4c8dff);color:#fff;opacity:.88;}
[data-rg-action][data-rg-busy] [data-rg-icon]{animation:rg-spin .9s linear infinite;}
[data-rg-action][data-rg-failed]{color:var(--dsw-alias-state-error-primary,#e5534b);}
@keyframes rg-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){[data-rg-action][data-rg-busy] [data-rg-icon]{animation:none;}}
[data-rg-editor]{display:flex;flex-direction:column;gap:8px;box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));border-radius:var(--dsw-radius-panel,var(--dsw-radius-lg,14px));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,inherit);}
[data-rg-editor] textarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;padding:0;border:none;background:transparent;color:inherit;font:inherit;font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));outline:none;}
[data-rg-editor] textarea:focus{outline:none;}
[data-rg-attachments]{display:flex;align-items:stretch;gap:10px;min-width:0;max-width:100%;padding:2px 0;overflow:auto hidden;scrollbar-width:none;}
[data-rg-attachments]::-webkit-scrollbar{display:none;}
[data-rg-attach-item]{position:relative;flex:none;width:64px;height:64px;}
[data-rg-thumb]{box-sizing:border-box;width:64px;height:64px;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:var(--dsw-radius-xl,var(--dsw-radius-lg,14px));background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));overflow:hidden;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
[data-rg-thumb] img{object-fit:cover;width:100%;height:100%;display:block;}
[data-rg-file]{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;gap:10px;width:240px;max-width:100%;height:64px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));overflow:hidden;}
[data-rg-file-icon]{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary,inherit);}
[data-rg-file-icon] svg{width:24px;height:24px;display:block;}
[data-rg-file-body]{display:flex;flex-direction:column;min-width:0;gap:2px;}
[data-rg-file-name]{font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-rg-file-meta]{font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
[data-rg-attach-item] [data-rg-remove]{position:absolute;top:-6px;right:-6px;width:18px;height:18px;padding:0;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));border-radius:50%;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,inherit);font-size:11px;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center;}
[data-rg-attach-item][data-rg-own]:hover [data-rg-remove]{display:inline-flex;}
[data-rg-attach-item][data-rg-uploading]::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--dsw-alias-brand-primary,#4c8dff);border-top-color:transparent;animation:rg-spin .9s linear infinite;}
[data-rg-add]{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;cursor:pointer;}
[data-rg-add]:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));color:var(--dsw-alias-label-primary,inherit);}
[data-rg-add] svg{width:16px;height:16px;display:block;}
[data-rg-controls]{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
[data-rg-controls] [data-rg-left]{display:flex;align-items:center;gap:12px;min-width:0;}
[data-rg-controls] [data-rg-right]{display:flex;align-items:center;gap:12px;margin-left:auto;min-width:0;}
[data-rg-knob]{position:relative;}
[data-rg-knob-trigger]{display:inline-flex;align-items:center;max-width:220px;height:28px;padding:0 20px 0 8px;border:none;border-radius:var(--dsw-radius-sm,7px);outline:none;background-color:transparent;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 4px center;background-size:12px 12px;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;appearance:none;}
[data-rg-knob-trigger]:hover:not([disabled]){background-color:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));}
[data-rg-knob-trigger][disabled]{opacity:.5;cursor:default;}
[data-rg-knob-trigger] [data-rg-effort]{margin-left:4px;font-weight:600;}
[data-rg-knob-menu]{position:absolute;bottom:calc(100% + 6px);right:0;z-index:40;min-width:230px;max-width:320px;max-height:300px;overflow:auto;padding:4px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));box-shadow:0 8px 24px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:1px;}
[data-rg-knob-item]{display:flex;flex-direction:column;gap:1px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-sm,7px);background:transparent;color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:12px;line-height:16px;text-align:left;cursor:pointer;}
[data-rg-knob-item]:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));}
[data-rg-knob-item][data-rg-active]{color:var(--dsw-alias-brand-primary,#4c8dff);}
[data-rg-knob-cell]{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;border-radius:var(--dsw-radius-sm,7px);background:transparent;color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:12.5px;line-height:18px;text-align:left;cursor:pointer;}
[data-rg-knob-cell]:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));}
[data-rg-knob-cell-label]{flex:1;min-width:0;color:var(--dsw-alias-label-secondary,inherit);}
[data-rg-knob-cell-value]{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,inherit);}
[data-rg-knob-cell-chevron]{flex:none;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
[data-rg-knob-back]{display:flex;align-items:center;gap:6px;width:100%;padding:6px 8px;border:none;border-radius:var(--dsw-radius-sm,7px);background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:12px;line-height:16px;text-align:left;cursor:pointer;}
[data-rg-knob-back]:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));}
[data-rg-knob-back-arrow]{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
[data-rg-knob-detail]{font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
[data-rg-knob-head]{padding:6px 8px 2px;font-size:10.5px;line-height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));text-transform:uppercase;letter-spacing:.04em;}
[data-rg-add]{display:grid;place-items:center;flex:none;width:28px;height:28px;padding:0;border:none;border-radius:999px;background:var(--dsw-specific-selector,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));color:var(--dsw-alias-label-primary,inherit);font:inherit;cursor:pointer;}
[data-rg-add]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.2))));}
[data-rg-add][disabled]{opacity:.5;cursor:default;}
[data-rg-add] svg{width:16px;height:16px;display:block;}
[data-rg-send]{display:grid;place-items:center;flex:none;width:34px;height:34px;padding:0;border:none;border-radius:999px;background:var(--dsw-alias-button-info-fill,#3964FE);color:var(--dsw-alias-label-on-color,#fff);cursor:pointer;transition:background-color 100ms ease;transform:translateY(-2px);}
[data-rg-send]:hover:not([disabled]){background:var(--dsw-alias-button-info-hover,#679EFE);}
[data-rg-send]:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#3964FE);outline-offset:1px;}
[data-rg-send][disabled]{opacity:.4;cursor:default;}
[data-rg-send][data-rg-busy]{opacity:1;cursor:progress;}
[data-rg-send][data-rg-busy] svg{animation:rg-spin 800ms linear infinite;}
[data-rg-send] svg{width:16px;height:16px;display:block;}
@media (prefers-reduced-motion:reduce){[data-rg-send][data-rg-busy] svg{animation-duration:2400ms;}}
[data-rg-errorline]{font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#e5534b);}
[data-rg-error]{font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#e5534b);}
`;

    function Icon({ kind }) {
      const common = {
        'data-rg-icon': '', viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', 'stroke-width': 1.9,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': true,
      };
      if (kind === 'edit') {
        return h('svg', common,
          h('path', { d: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }));
      }
      return h('svg', common,
        h('path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }),
        h('path', { d: 'M21 3v5h-5' }));
    }

    /** Icon-only action matching the host Copy/Branch buttons. The label is a
     * tooltip (title) and an accessible name, never text beside the glyph. */
    function ActionButton({ label, icon, onClick, disabled, busy, error }) {
      const tip = error || label;
      return h('button', {
        type: 'button', 'data-rg-action': '',
        'data-rg-busy': busy ? '' : undefined,
        'data-rg-failed': error ? '' : undefined,
        disabled: Boolean(disabled),
        title: tip, 'aria-label': tip, 'aria-busy': busy ? 'true' : undefined,
        onClick: (event) => { event.preventDefault(); event.stopPropagation(); if (!disabled) onClick(); },
      }, h(Icon, { kind: icon }));
    }

    /** Text-only form button for the inline editor (no icon beside the label).
     * `hint` carries the action's full meaning in a hover tooltip. */
    function TextButton({ label, hint, onClick, disabled, primary }) {
      return h('button', {
        type: 'button', 'data-rg-action': '', 'data-rg-text': '',
        'data-rg-primary': primary ? '' : undefined,
        disabled: Boolean(disabled),
        title: hint || undefined,
        onClick: (event) => { event.preventDefault(); event.stopPropagation(); if (!disabled) onClick(); },
      }, label);
    }

    function fileExtension(name) {
      const dot = String(name || '').lastIndexOf('.');
      return dot > 0 ? String(name).slice(dot + 1) : '';
    }

    function fileSizeText(bytes) {
      const size = Number(bytes) || 0;
      if (size < 1024) return size + ' B';
      if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
      return (size / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /** Read a durable image attachment back as a data URL for the thumbnail. */
    async function readImageUrl(ctx, sessionId, attachment) {
      const result = await ctx.remote.session.attachment({ sessionId, attachment });
      if (!result || result.ok !== true) throw new Error('image read failed');
      return 'data:' + result.value.attachment.mediaType + ';base64,' + result.value.data;
    }

    // Data URLs are stable for content-addressed attachments; reuse them when
    // the same prompt is edited again.
    const thumbnailCache = new Map();

    function FileGlyph() {
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        h('path', { d: 'M14 2v6h6' }));
    }

    function ImageGlyph() {
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': true, style: { width: 22, height: 22 },
      },
        h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
        h('circle', { cx: 8.5, cy: 8.5, r: 1.5 }),
        h('path', { d: 'm21 15-5-5L5 21' }));
    }

    function PlusGlyph() {
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': true, style: { width: 16, height: 16 },
      },
        h('path', { d: 'M12 5v14' }),
        h('path', { d: 'M5 12h14' }));
    }

    function SendGlyph() {
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': 2.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M12 19V5' }),
        h('path', { d: 'm5 12 7-7 7 7' }));
    }

    const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    function imageMediaTypeOf(file) {
      return IMAGE_MEDIA_TYPES.includes(file.type) ? file.type : null;
    }

    /** Read one File's bytes for the authenticated raw-byte upload route. */
    function readBytes(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = () => reject(reader.error || new Error('file read failed'));
        reader.readAsArrayBuffer(file);
      });
    }

    // DSH's own browser upload intake (dsh-client-file-upload): a staged receipt
    // is minted for the target Session's Agent and consumed by the next
    // session/prompt there. With mediaType the body becomes a prompt image,
    // without it the bytes are stored verbatim as a file.
    async function uploadDraft(sessionId, file) {
      const mediaType = imageMediaTypeOf(file);
      const query = new URLSearchParams({ sessionId });
      if (file.name) query.set('name', file.name);
      if (mediaType) query.set('mediaType', mediaType);
      const bytes = await readBytes(file);
      const response = await fetch('/api/session/uploadFileBinary?' + query.toString(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/octet-stream' },
        body: bytes,
      });
      if (!response.ok) throw new Error('upload failed: HTTP ' + response.status);
      const result = await response.json();
      if (!result || result.ok !== true || !result.value || typeof result.value.receiptId !== 'string') {
        const error = result && result.error;
        throw new Error((error && error.message) || 'upload rejected');
      }
      return { receiptId: result.value.receiptId, mediaType, file };
    }

    /** Attachment rail: original attachments (read-only, carried over) plus
     * added drafts (removable chips with local previews) and the add button. */
    function AttachmentRail({ blocks, sessionId, drafts, uploading, onRemove, t }) {
      const images = blocks.filter((block) => block.type === 'image');
      const files = blocks.filter((block) => block.type === 'file');
      const [, setRevision] = React.useState(0);
      const imageKey = images.map((block) => block.attachment && block.attachment.attachmentId).join('|');

      React.useEffect(() => {
        let alive = true;
        const pending = images.filter((block) => {
          const id = block.attachment && block.attachment.attachmentId;
          return id && !thumbnailCache.has(id);
        });
        if (pending.length) {
          (async () => {
            for (const block of pending) {
              const ref = block.attachment;
              try {
                thumbnailCache.set(ref.attachmentId, await readImageUrl(CTX, sessionId, ref));
              } catch (_error) {
                thumbnailCache.set(ref.attachmentId, null);
              }
              if (alive) setRevision((value) => value + 1);
            }
          })();
        }
        return () => { alive = false; };
      }, [imageKey, sessionId]);

      const removeChip = (id) => (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (onRemove) onRemove(id);
      };
      const empty = !images.length && !files.length && !drafts.length;
      if (empty) return null;
      return h('div', {
        'data-rg-attachments': '',
        'aria-label': format(t('attachments'), images.length + imageDrafts(drafts).length, files.length + fileDrafts(drafts).length),
      },
        images.map((block) => {
          const ref = block.attachment;
          const url = thumbnailCache.get(ref.attachmentId);
          return h('div', {
            'data-rg-attach-item': '', key: ref.attachmentId,
            title: ref.name || undefined,
          }, h('div', { 'data-rg-thumb': '' },
            url ? h('img', { src: url, alt: ref.name || '' }) : h(ImageGlyph)));
        }),
        files.map((block) => {
          const ref = block.attachment;
          const ext = fileExtension(ref.name).toUpperCase().slice(0, 8);
          const meta = [ext, fileSizeText(ref.bytes)].filter(Boolean).join(' · ');
          return h('div', { 'data-rg-file': '', key: ref.attachmentId, title: ref.name },
            h('span', { 'data-rg-file-icon': '' }, h(FileGlyph)),
            h('span', { 'data-rg-file-body': '' },
              h('span', { 'data-rg-file-name': '' }, ref.name),
              h('span', { 'data-rg-file-meta': '' }, meta)));
        }),
        imageDrafts(drafts).map((draft) => h('div', {
          'data-rg-attach-item': '', 'data-rg-own': '', key: draft.id,
          'data-rg-uploading': uploading ? '' : undefined,
        },
          h('div', { 'data-rg-thumb': '' },
            h('img', { src: draft.previewUrl, alt: draft.file.name || '' })),
          h('button', {
            type: 'button', 'data-rg-remove': '', 'aria-label': t('removeAttachment'),
            title: t('removeAttachment'), disabled: uploading, onClick: removeChip(draft.id),
          }, '×'))),
        fileDrafts(drafts).map((draft) => {
          const ext = fileExtension(draft.file.name).toUpperCase().slice(0, 8);
          const meta = [ext, fileSizeText(draft.file.size)].filter(Boolean).join(' · ');
          return h('div', {
            'data-rg-file': '', 'data-rg-own': '', key: draft.id,
            'data-rg-uploading': uploading ? '' : undefined,
          },
            h('span', { 'data-rg-file-icon': '' }, h(FileGlyph)),
            h('span', { 'data-rg-file-body': '' },
              h('span', { 'data-rg-file-name': '' }, draft.file.name),
              h('span', { 'data-rg-file-meta': '' }, meta)),
            h('button', {
              type: 'button', 'data-rg-remove': '', 'aria-label': t('removeAttachment'),
              title: t('removeAttachment'), disabled: uploading, onClick: removeChip(draft.id),
            }, '×'));
        }));
    }

    function imageDrafts(drafts) {
      return drafts.filter((draft) => draft.mediaType);
    }

    function fileDrafts(drafts) {
      return drafts.filter((draft) => !draft.mediaType);
    }

    // ---- Session knobs: permission preset and model selection ----------------
    // The inline editor shows the same two composer seats over the same data:
    // the session's permissions / modelSelection projections for the current
    // value, and the process catalogs for the options. A pick writes through
    // the same channels the bottom bar uses (/permission command, session
    // selectModel), so both surfaces stay in sync and a "Branch" fork
    // inherits whatever is selected here at submit time.

    const FULL_ACCESS_PRESET = 'danger-full-access';
    const AUTO_REVIEW_PRESET = 'auto';

    /** One session projection as React state (undefined while absent). */
    function useProjection(sessionId, key) {
      const face = React.useMemo(() => {
        try {
          const binding = CTX.sessions && CTX.sessions.binding(sessionId);
          const session = binding && binding.session;
          return session ? session.projections.faceOf(key) : undefined;
        } catch (_error) { return undefined; }
      }, [sessionId]);
      const subscribe = React.useCallback((notify) => (
        face ? face.subscribe(notify) : () => {}
      ), [face]);
      const getSnapshot = React.useCallback(() => (
        face ? face.getSnapshot() : undefined
      ), [face]);
      return React.useSyncExternalStore(subscribe, getSnapshot);
    }

    function ChevronGlyph() {
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': true,
      }, h('path', { d: 'm6 9 6 6 6-6' }));
    }

    /** Whether the picker seats apply to this session (retained, not a subagent). */
    function knobsAvailable(sessionId) {
      try {
        if (!CTX.sessions || CTX.sessions.subagentAddress(sessionId) !== undefined) return false;
        return CTX.sessions.binding(sessionId) !== undefined;
      } catch (_error) { return false; }
    }

    function KnobError({ error }) {
      return error ? h('span', { 'data-rg-error': '', role: 'status' }, error) : null;
    }

    function describeKnobError(cause, t) {
      const message = cause && cause.message ? String(cause.message) : '';
      return /writer-held/i.test(message) ? t('sessionBusy') : t('knobFailed') + (message ? ' — ' + message : '');
    }

    /** Model seat: the composer's conversation.input.model — a root pane with
     * Model / Effort drill rows, the model list, and the effort list. */
    function ModelPicker({ sessionId, busy, t }) {
      const selection = useProjection(sessionId, 'modelSelection');
      const [catalog, setCatalog] = React.useState(null);
      const [error, setError] = React.useState('');
      const [pending, setPending] = React.useState(null);
      const [open, setOpen] = React.useState(false);
      const [pane, setPane] = React.useState('root');
      const current = selection && selection.next ? selection.next : null;
      React.useEffect(() => {
        let alive = true;
        CTX.remote.session.modelCatalog().then((result) => {
          if (alive && result && result.ok) setCatalog(result.value);
        }).catch(() => { /* no catalog: seat stays hidden */ });
        return () => { alive = false; };
      }, []);
      const groups = catalog && Array.isArray(catalog.groups) ? catalog.groups : [];
      if (!groups.length || !selection) return null;
      const currentGroup = current ? groups.find((entry) => entry.id === current.provider) : undefined;
      const currentModel = currentGroup
        ? currentGroup.models.find((entry) => entry.id === current.model)
        : undefined;
      const reasoning = currentModel && currentModel.reasoning;
      const effectiveEffort = current && current.reasoningEffort !== undefined
        ? current.reasoningEffort
        : (reasoning && reasoning.defaultEffort !== undefined ? reasoning.defaultEffort : undefined);
      const effortLabelOf = () => {
        if (!reasoning) return undefined;
        if (effectiveEffort === undefined) return t('effortDefault');
        const level = (reasoning.efforts || []).find((item) => item.id === effectiveEffort);
        return level ? level.name : (effectiveEffort.charAt(0).toUpperCase() + effectiveEffort.slice(1));
      };
      const submitModel = async (route, reasoningEffort) => {
        setPending(route);
        setError('');
        try {
          const request = { sessionId, provider: route.providerId, model: route.modelId };
          if (reasoningEffort !== undefined) request.reasoningEffort = reasoningEffort;
          const result = await CTX.remote.session.selectModel(request, new AbortController().signal);
          if (!result || result.ok !== true) {
            throw new Error(result && result.error ? result.error.message : 'rejected');
          }
        } catch (cause) {
          setError(describeKnobError(cause, t));
        } finally {
          setPending(null);
        }
      };
      const pickModel = (item) => {
        if (current && current.provider === item.providerId && current.model === item.modelId) {
          setOpen(false);
          return;
        }
        submitModel({ providerId: item.providerId, modelId: item.modelId }, item.defaultEffort);
      };
      const pickEffort = (item) => {
        if (!current) return;
        if (effectiveEffort === item.effort) {
          setOpen(false);
          return;
        }
        submitModel({ providerId: current.provider, modelId: current.model }, item.effort);
      };
      // Outside clicks close; Escape backs out of a drilled pane first, then
      // closes — the same discipline as the composer's model seat.
      React.useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
          const target = event.target;
          if (target && typeof target.closest === 'function'
            && target.closest('[data-rg-knob]')) return;
          setOpen(false);
          setPane('root');
        };
        const keys = (event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          if (pane !== 'root') setPane('root');
          else setOpen(false);
        };
        document.addEventListener('click', close, true);
        document.addEventListener('keydown', keys, true);
        return () => {
          document.removeEventListener('click', close, true);
          document.removeEventListener('keydown', keys, true);
        };
      }, [open, pane]);
      const modelItems = [];
      for (const group of groups) {
        modelItems.push({ id: 'h-' + group.id, heading: true, label: group.name || group.id });
        for (const model of group.models) {
          modelItems.push({
            id: group.id + '/' + model.id,
            providerId: group.id,
            modelId: model.id,
            defaultEffort: model.reasoning && model.reasoning.defaultEffort,
            label: model.name,
            detail: model.description || undefined,
          });
        }
      }
      const effortItems = reasoning ? [
        ...(reasoning.defaultEffort === undefined
          ? [{ id: 'effort-default', effort: undefined, label: t('effortDefault') }]
          : []),
        ...(reasoning.efforts || []).map((level) => ({
          id: 'effort-' + level.id,
          effort: level.id,
          label: level.name,
          detail: level.description || undefined,
        })),
      ] : [];
      const activeModelId = current ? current.provider + '/' + current.model : undefined;
      const activeEffortId = effectiveEffort === undefined ? 'effort-default' : 'effort-' + effectiveEffort;
      const modelLabel = pending ? '\u2026 ' + (pending.label || '')
        : (currentModel ? currentModel.name : (current ? current.provider + '/' + current.model : t('model')));
      const effortText = effortLabelOf();
      const knobRow = (item, activeId) => h('button', {
        type: 'button', 'data-rg-knob-item': '', role: 'menuitemradio',
        'data-rg-active': item.id === activeId ? '' : undefined,
        'aria-checked': item.id === activeId ? 'true' : 'false',
        key: item.id, title: item.detail || undefined,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (item.heading) return;
          if (pane === 'model') pickModel(item);
          else pickEffort(item);
        },
      },
        h('span', null, item.label),
        item.detail ? h('span', { 'data-rg-knob-detail': '' }, item.detail) : null);
      return h('div', { 'data-rg-knob': '' },
        h('button', {
          type: 'button', 'data-rg-knob-trigger': '', 'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          disabled: Boolean(busy) || pending !== null,
          title: t('model'), onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            setPane('root');
            setOpen(!open);
          },
        },
          pending ? '\u2026 ' + (pending.label || '') : modelLabel,
          !pending && effortText ? h('span', { 'data-rg-effort': '' }, effortText) : null),
        open ? h('div', { 'data-rg-knob-menu': '', role: 'menu' },
          pane === 'root'
            ? [
                h('button', {
                  type: 'button', 'data-rg-knob-cell': '', role: 'menuitem', key: 'cell-model',
                  onClick: (event) => { event.preventDefault(); event.stopPropagation(); setPane('model'); },
                },
                  h('span', { 'data-rg-knob-cell-label': '' }, t('menuModel')),
                  h('span', { 'data-rg-knob-cell-value': '' }, modelLabel),
                  h('span', { 'data-rg-knob-cell-chevron': '' }, '\u203a')),
                reasoning
                  ? h('button', {
                      type: 'button', 'data-rg-knob-cell': '', role: 'menuitem', key: 'cell-effort',
                      onClick: (event) => { event.preventDefault(); event.stopPropagation(); setPane('effort'); },
                    },
                      h('span', { 'data-rg-knob-cell-label': '' }, t('menuEffort')),
                      h('span', { 'data-rg-knob-cell-value': '' }, effortText || ''),
                      h('span', { 'data-rg-knob-cell-chevron': '' }, '\u203a'))
                  : null,
              ]
            : [
                h('button', {
                  type: 'button', 'data-rg-knob-back': '', key: 'back',
                  onClick: (event) => { event.preventDefault(); event.stopPropagation(); setPane('root'); },
                },
                  h('span', { 'data-rg-knob-back-arrow': '' }, '\u2039'),
                  pane === 'model' ? t('menuModel') : t('menuEffort')),
                pane === 'model'
                  ? modelItems.map((item) => knobRow(item, activeModelId))
                  : effortItems.map((item) => knobRow(item, activeEffortId)),
              ])
          : null,
        h(KnobError, { error }));
    }
    /** Ordered ChatNode list from a `useChat` snapshot. */
    function nodeList(snapshot) {
      if (!snapshot) return [];
      const nodes = snapshot.nodes;
      const order = snapshot.order;
      if (Array.isArray(order) && nodes && typeof nodes.get === 'function') {
        return order.map((key) => nodes.get(key)).filter(Boolean);
      }
      if (nodes && typeof nodes.values === 'function') return Array.from(nodes.values());
      return [];
    }

    /** Text of a durable user message, as content parts or a plain string. */
    function textOf(node) {
      const content = node && node.data && node.data.content;
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content
        .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n');
    }

    function format(template, ...args) {
      return String(template).replace(/\{(\d+)\}/g, (match, index) =>
        args[Number(index)] === undefined ? match : String(args[Number(index)]));
    }

    /** Image and file blocks of a durable user message. */
    function attachmentBlocksOf(node) {
      const content = node && node.data && node.data.content;
      if (!Array.isArray(content)) return [];
      return content.filter((block) => block
        && (block.type === 'image' || block.type === 'file')
        && block.attachment);
    }

    function attachmentCounts(blocks) {
      let images = 0;
      let files = 0;
      for (const block of blocks) {
        if (block.type === 'image') images += 1;
        else files += 1;
      }
      return { images, files, total: images + files };
    }

    /** Read original image bytes back through the built-in Session Remote and
     * inline them as base64 prompt parts. */
    async function imageParts(ctx, sessionId, blocks) {
      const parts = [];
      let missing = 0;
      for (const block of blocks) {
        if (block.type !== 'image') continue;
        try {
          const result = await ctx.remote.session.attachment({ sessionId, attachment: block.attachment });
          if (result && result.ok) {
            const ref = result.value.attachment;
            parts.push({
              type: 'image',
              mediaType: ref.mediaType,
              data: result.value.data,
              ...(ref.name ? { name: ref.name } : {}),
            });
          } else missing += 1;
        } catch (_error) { missing += 1; }
      }
      return { parts, missing };
    }

    /** File receipts are staged per Agent, so the originals cannot be reused in
     * a different Session. The Host bridge re-streams the stored files into the
     * receiving Session's upload intake and returns fresh receipt ids. */
    async function fileParts(targetSessionId, blocks) {
      const refs = blocks.filter((block) => block.type === 'file').map((block) => block.attachment);
      if (!refs.length) return { parts: [], missing: 0 };
      try {
        const response = await fetch('/api/dsh-regenerate', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          // `childSessionId` is the route's field name; it means the Session
          // whose Agent receives the staged uploads — the fork in Regenerate
          // mode, or the current Session in Append-prompt mode.
          body: JSON.stringify({ childSessionId: targetSessionId, files: refs }),
        });
        if (response.ok) {
          const data = await response.json();
          const ids = Array.isArray(data.receiptIds) ? data.receiptIds : [];
          return {
            parts: ids.map((receiptId) => ({ type: 'file', receiptId })),
            missing: refs.length - ids.length,
          };
        }
      } catch (_error) { /* Host bridge unavailable: report files as missing */ }
      return { parts: [], missing: refs.length };
    }

    /** The user message that produced a finalized assistant message. */
    function userNodeFor(snapshot, messageId) {
      const list = nodeList(snapshot);
      let tail = -1;
      if (messageId) {
        for (let i = 0; i < list.length; i++) {
          const node = list[i];
          const closing = node && node.data && node.data.closing;
          const final = (closing && closing.finalNode) || (node && node.data && node.data.finalNode);
          if (final && final.messageId === messageId) { tail = i; break; }
        }
      }
      const start = tail >= 0 ? tail - 1 : list.length - 1;
      for (let i = start; i >= 0; i--) if (list[i] && list[i].kind === 'user') return list[i];
      return null;
    }

    /** The user message owning a `conversation.chat.user.before` source object. */
    function userNodeBySource(snapshot, source) {
      const list = nodeList(snapshot);
      for (const node of list) {
        if (node && node.kind === 'user' && node.data && node.data.source === source) return node;
      }
      return null;
    }

    function newRequestId() {
      try { return crypto.randomUUID(); } catch (_error) { /* older browser */ }
      return 'rg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    }

    /** Added drafts become staged receipts on the receiving Session's Agent,
     * mirroring how the composer uploads its own drafts. */
    async function draftParts(targetSessionId, drafts) {
      const parts = [];
      let missing = 0;
      for (const draft of drafts) {
        try {
          parts.push({ type: 'file', receiptId: draft.receipts[targetSessionId]
            || (draft.receipts[targetSessionId] = (await uploadDraft(targetSessionId, draft.file)).receiptId) });
        } catch (_error) { missing += 1; }
      }
      return { parts, missing };
    }

    /** Build the regenerated prompt: edited text, the original attachments read
     * back, and added drafts uploaded for the receiving Session. */
    async function buildContent(ctx, sourceSessionId, targetSessionId, node, text, drafts) {
      const blocks = attachmentBlocksOf(node);
      const [images, files, added] = await Promise.all([
        imageParts(ctx, sourceSessionId, blocks),
        fileParts(targetSessionId, blocks),
        draftParts(targetSessionId, drafts || []),
      ]);
      return {
        content: [
          ...(text ? [{ type: 'text', text }] : []),
          ...images.parts,
          ...files.parts,
          ...added.parts,
        ],
        missing: images.missing + files.missing + added.missing,
      };
    }

    function promptPayload(sessionId, content) {
      const payload = { requestId: newRequestId(), sessionId, mode: 'queue', content };
      try {
        const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) payload.clientTimeZone = tz;
      } catch (_e) { /* ignore */ }
      return payload;
    }

    async function sendPrompt(ctx, sessionId, content) {
      const result = await ctx.remote.session.prompt(
        promptPayload(sessionId, content), new AbortController().signal);
      if (!result || result.ok !== true) {
        const error = result && result.error;
        throw new Error((error && error.message) || String(error || 'prompt rejected'));
      }
    }

    /** Regenerate: append the original or edited prompt in this Session, so the
     * model answers again here. The session log stays append-only. */
    async function appendInSession(ctx, sessionId, node, text, drafts) {
      const prompt = String(text == null ? '' : text);
      const hasAttachments = attachmentBlocksOf(node).length > 0 || (drafts && drafts.length > 0);
      if (!prompt.trim() && !hasAttachments) throw new Error('empty');
      const built = await buildContent(ctx, sessionId, sessionId, node, prompt, drafts);
      await sendPrompt(ctx, sessionId, built.content);
      return { childId: sessionId, missing: built.missing };
    }

    /** Regenerate action, registered into conversation.chat.assistant-actions. */
    function RegenerateButton(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => en[key] || key;
      const snapshot = typeof props.useChat === 'function' ? props.useChat((s) => s) : null;
      const node = React.useMemo(
        () => userNodeFor(snapshot, props.messageId),
        [snapshot, props.messageId],
      );
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const counts = attachmentCounts(attachmentBlocksOf(node));

      const run = async () => {
        if (busy) return;
        if (!node) { setError(t('noPrompt')); return; }
        setBusy(true);
        setError('');
        try {
          const outcome = await appendInSession(CTX, props.sessionId, node, textOf(node));
          if (outcome.missing) setError(t('attachmentsMissing'));
        } catch (cause) {
          setError((cause && cause.message) || t('failed'));
        } finally {
          setBusy(false);
        }
      };

      const label = busy ? t('regenerating')
        : counts.total > 0 ? format(t('attachments'), counts.images, counts.files) : t('regenerate');
      return h(ActionButton, {
        label, icon: 'regenerate', disabled: busy, busy, error, onClick: run,
      });
    }

    /** Sent-prompt decoration: Edit action + click-to-expand inline editor. */
    function UserPromptEdit(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => en[key] || key;
      const source = props.matched && props.matched.source;
      const snapshot = typeof props.useChat === 'function' ? props.useChat((s) => s) : null;
      const node = React.useMemo(
        () => userNodeBySource(snapshot, source),
        [snapshot, source],
      );
      const [editing, setEditing] = React.useState(false);
      const [text, setText] = React.useState('');
      const [busyMode, setBusyMode] = React.useState('');
      const busy = busyMode !== '';
      const [error, setError] = React.useState('');
      const [actionsRow, setActionsRow] = React.useState(null);
      const ref = React.useRef(null);
      const contentRef = React.useRef([]);
      // Events already consumed as "outside" by the dismiss listener. An
      // instance-local set avoids one message's editor affecting another's.
      const dismissedRef = React.useRef(new WeakSet());

      // The user message row is a flex column (gap:6px), so a decoration of
      // its own always becomes a separate, wrapped line. Portal the Edit icon
      // into the row that already holds the built-in Copy button instead; the
      // chain seat stays out of flow until the editor is open.
      React.useEffect(() => {
        const el = ref.current;
        let row = el && el.parentElement;
        if (!row) return undefined;
        const findActions = (node) => Array.from(node.children).find((child) =>
          child !== el && !child.contains(el) && typeof child.hasAttribute === 'function'
          && child.hasAttribute('data-clock')) || null;
        let actions = findActions(row);
        // The chain seat may be wrapped in its own single-child container.
        if (!actions && row.children.length === 1 && row.parentElement) {
          row = row.parentElement;
          actions = findActions(row);
        }
        if (!actions) actions = row.lastElementChild;
        // The remaining children are the original prompt content (bubble,
        // attachments, references). Hide them while editing so the editor
        // takes their exact place in the flex column instead of opening a
        // separate panel below the action buttons.
        contentRef.current = Array.from(row.children).filter((child) =>
          child !== el && !child.contains(el) && child !== actions
          && !child.hasAttribute('data-clock'));
        if (actions && actions !== el && !actions.contains(el)) {
          setActionsRow((prev) => (prev === actions ? prev : actions));
        }
        // A click on the surrounding user message expands the editor (Cursor-style).
        const handler = (event) => {
          if (dismissedRef.current.has(event)) {
            dismissedRef.current.delete(event);
            return;
          }
          if (editing) return;
          const target = event.target;
          if (target && typeof target.closest === 'function' && target.closest(
            'button, a, input, textarea, [contenteditable="true"], [data-rg-editor]')) return;
          try {
            const selection = document.getSelection();
            if (selection && String(selection).length > 0) return;
          } catch (_e) { /* ignore */ }
          setText(textOf(node));
          setError('');
          setEditing(true);
        };
        row.addEventListener('click', handler);
        return () => row.removeEventListener('click', handler);
      });

      // Dismiss on any click outside the editor. Capture phase runs before the
      // row's bubble-phase "click to open" handler; marking the event keeps
      // that handler from immediately re-opening the editor in the same click.
      React.useEffect(() => {
        if (!editing) return undefined;
        const dismiss = (event) => {
          if (busy) return;
          const target = event.target;
          if (target && typeof target.closest === 'function'
            && target.closest('[data-rg-editor]')) return;
          dismissedRef.current.add(event);
          setEditing(false);
          setError('');
        };
        document.addEventListener('click', dismiss, true);
        return () => document.removeEventListener('click', dismiss, true);
      }, [editing, busy]);

      // While editing, hide the original prompt bubble and let the editor take
      // its place. Width comes from the stylesheet (full content width, capped
      // like the composer card), not from the bubble, so there is no measuring.
      React.useEffect(() => {
        if (!editing) return undefined;
        const siblings = contentRef.current;
        if (!siblings.length) return undefined;
        const previous = siblings.map((item) => item.style.display);
        siblings.forEach((item) => { item.style.display = 'none'; });
        return () => siblings.forEach((item, index) => {
          item.style.display = previous[index];
        });
      }, [editing]);

      const blocks = attachmentBlocksOf(node);
      const [drafts, setDrafts] = React.useState([]);
      const inputRef = React.useRef(null);
      // Mirror for unmount cleanup: revoke object URLs without a state update.
      const draftsRef = React.useRef(drafts);
      draftsRef.current = drafts;
      const releaseDrafts = (list) => {
        list.forEach((draft) => { if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl); });
      };
      React.useEffect(() => () => releaseDrafts(draftsRef.current), []);
      const addFiles = (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        setDrafts((current) => [
          ...current,
          ...files.map((file) => ({
            id: newRequestId(),
            file,
            mediaType: imageMediaTypeOf(file),
            previewUrl: imageMediaTypeOf(file) ? URL.createObjectURL(file) : null,
            receipts: {},
          })),
        ]);
      };
      const removeDraft = (id) => {
        setDrafts((current) => {
          releaseDrafts(current.filter((item) => item.id === id));
          return current.filter((item) => item.id !== id);
        });
      };
      const openEditor = () => {
        setText(textOf(node));
        setError('');
        setEditing(true);
      };
      const cancel = () => {
        setDrafts((current) => {
          releaseDrafts(current);
          return [];
        });
        setEditing(false);
        setError('');
      };
      const submit = async () => {
        if (busy) return;
        if (!text.trim() && !blocks.length && !drafts.length) { setError(t('emptyPrompt')); return; }
        if (!node) { setError(t('noPrompt')); return; }
        setBusyMode('append');
        setError('');
        try {
          const outcome = await appendInSession(CTX, props.sessionId, node, text, drafts);
          if (outcome.missing) setError(t('attachmentsMissing'));
          else {
            setDrafts((current) => {
              releaseDrafts(current);
              return [];
            });
            setEditing(false);
          }
        } catch (cause) {
          setError((cause && cause.message) || t('failed'));
        } finally {
          setBusyMode('');
        }
      };

      const editor = editing
        ? h('div', { 'data-rg-editor': '' },
            h(AttachmentRail, {
              blocks, sessionId: props.sessionId, t,
              drafts,
              uploading: busy,
              onRemove: removeDraft,
            }),
            h('input', {
              ref: inputRef, type: 'file', multiple: true, hidden: true,
              'aria-hidden': true, tabIndex: -1,
              onChange: (event) => { addFiles(event.target.files); event.target.value = ''; },
            }),
            h('textarea', {
              value: text, 'aria-label': t('editHint'), spellCheck: false, autoFocus: true,
              onChange: (event) => setText(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Escape') { event.preventDefault(); cancel(); }
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); }
              },
            }),
            h('div', { 'data-rg-controls': '', 'aria-label': t('editorHint') },
              h('button', {
                type: 'button', 'data-rg-add': '', 'aria-label': t('addAttachment'),
                title: t('addAttachment'), disabled: busy,
                onClick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (inputRef.current) inputRef.current.click();
                },
              }, h(PlusGlyph)),
              h('div', { 'data-rg-right': '' },
                error ? h('span', { 'data-rg-errorline': '', role: 'status' }, error) : null,
                knobsAvailable(props.sessionId)
                  ? h(ModelPicker, { sessionId: props.sessionId, busy, t })
                  : null,
                h('button', {
                  type: 'button', 'data-rg-send': '',
                  'data-rg-busy': busy ? '' : undefined,
                  'aria-label': busy ? t('regenerating') : t('regenerate'),
                  title: busy ? t('regenerating') : t('regenerateHint'),
                  disabled: busy,
                  onClick: (event) => { event.preventDefault(); event.stopPropagation(); submit(); },
                }, h(SendGlyph)))))
        : null;


      const showFallback = !editing && !actionsRow;
      const editAction = h(ActionButton, { label: t('edit'), icon: 'edit', onClick: openEditor });

      return h(React.Fragment, null,
        h('div', {
          'data-rg-row': '',
          'data-rg-editing': editing ? '' : undefined,
          'data-rg-fallback': showFallback ? '' : undefined,
          ref,
        }, editor || (showFallback ? editAction : null)),
        (!editing && actionsRow)
          ? ReactDOM.createPortal(editAction, actionsRow)
          : null);
    }

    let CTX = null;

    return {
      name: 'dsh-regenerate',
      inject: ['slots', 'locale', 'sessions', 'uiConversation', 'uiWorkspace', 'remote', 'remote.session'],
      apply(ctx) {
        CTX = ctx;
        ctx.effect(() => ctx.locale.register(NS, {
          zh, en,
          ja: en, es: en, fr: en, de: en, ru: en, pt: en,
        }), 'dsh-regenerate: dictionaries');
        ctx.effect(() => {
          const style = document.createElement('style');
          style.setAttribute('data-dsh-regenerate', '');
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => style.remove();
        }, 'dsh-regenerate: styles');

        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'dsh-regenerate.regenerate',
          order: 50,
          locale: NS,
        }, RegenerateButton));

        ctx.slots.inject('conversation.chat.user.before', () => ctx.slots.register({
          name: 'conversation.chat.user.before',
          locale: NS,
          select: (owner) => (owner && owner.kind === 'user' ? { source: owner.source } : null),
        }, UserPromptEdit));
      },
    };
  },
});
