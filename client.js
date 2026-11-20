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
      'editorHint': 'Enter to resubmit · Shift+Enter for a new line · Esc to cancel',
      'resubmit': 'Resubmit',
      'resubmitting': 'Resubmitting…',
      'resubmitHint': 'Send the edited prompt in this chat; the earlier exchange stays in context',
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
      'editorHint': 'Enter 重新提交 · Shift+Enter 换行 · Esc 取消',
      'resubmit': '重新提交',
      'resubmitting': '正在提交…',
      'resubmitHint': '在当前对话发送编辑后的提问，原有问答会保留在上下文里',
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
[data-rg-row][data-rg-editing]{display:flex;flex-direction:column;align-self:center;width:calc(100% + 32px);max-width:var(--dsh-composer-card-max-width,calc(100% + 32px));padding:0;box-sizing:border-box;}
[data-rg-row][data-rg-fallback]{display:flex;justify-content:flex-end;width:100%;padding:0;order:3;box-sizing:border-box;}
[data-rg-action]{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));padding:0;border:1px solid transparent;border-radius:var(--dsw-radius-sm,7px);background:transparent;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background .12s,color .12s;}
[data-rg-action]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary,inherit));}
[data-rg-action]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4c8dff);outline-offset:1px;}
[data-rg-action][disabled]{opacity:.45;cursor:default;}
[data-rg-icon]{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px));display:block;flex:none;}
[data-rg-action][data-rg-busy] [data-rg-icon]{animation:rg-spin .9s linear infinite;}
[data-rg-action][data-rg-failed]{color:var(--dsw-alias-state-error-primary,#e5534b);}
@keyframes rg-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){[data-rg-action][data-rg-busy] [data-rg-icon]{animation:none;}}
/* Editor card mirrors the host composer card (ui-conversation InputBar
 * .card): zero layout border with the l2 hairline drawn inside the soft
 * elevation shadow, the elevated input surface fill, panel radius, and the
 * composer's vertical rhythm (8px top pad, 12px gap, toolbar-owned bottom). */
[data-rg-editor]{display:flex;flex-direction:column;gap:12px;box-sizing:border-box;width:100%;padding:8px 0 0;border:0;--dsw-elevation-stroke-color:var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:var(--dsw-radius-panel,28px);background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08)));box-shadow:var(--dsw-elevation-soft,0 0 0 .5px var(--dsw-alias-border-l2,rgba(127,127,127,.3)),0 4px 16px rgba(0,0,0,.03),0 0 24px rgba(0,0,0,.03));color:var(--dsw-alias-label-primary,inherit);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));transition:box-shadow .15s ease;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}
/* Focus ring: the hairline step brightens to the business blue while the
 * soft shadow stays — the same accent the composer caret uses. */
[data-rg-editor]:focus-within{--dsw-elevation-stroke-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary,#4c8dff));}
@media (pointer:coarse){[data-rg-editor]{font-size:max(16px,var(--dsh-content-font-size,14px));}}
/* Draft surface mirrors the composer's .scroll + .input pair: the 14px
 * left inset and 4px top pad, one-line floor, the shared 14-line height cap,
 * and the 4px right inset that keeps the scrollbar off the card's arc. */
[data-rg-editor] textarea{width:100%;box-sizing:border-box;min-height:28px;max-height:min(var(--dsh-composer-text-max-height,336px),50vh);resize:none;overflow-y:auto;padding:4px 12px 0 14px;border:none;background:transparent;color:inherit;font:inherit;font-size:inherit;line-height:inherit;caret-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary,#4c8dff));outline:none;}
[data-rg-editor] textarea::-webkit-scrollbar-track{margin-top:8px;}
[data-rg-editor] textarea:focus{outline:none;}
/* Accessory strip: the composer's 10px/12px top inset above the draft. */
[data-rg-attachments]{display:flex;align-items:stretch;gap:10px;min-width:0;max-width:100%;padding:10px 12px 0;overflow:auto hidden;scrollbar-width:none;}
[data-rg-attachments]::-webkit-scrollbar{display:none;}
[data-rg-attach-item]{position:relative;flex:none;width:64px;height:64px;}
[data-rg-thumb]{box-sizing:border-box;width:64px;height:64px;border:.5px solid var(--dsw-alias-border-l2-darkmode-thin,var(--dsw-alias-border-l2,rgba(127,127,127,.3)));border-radius:var(--dsw-radius-xl,20px);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));overflow:hidden;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
[data-rg-thumb] img{object-fit:cover;width:100%;height:100%;display:block;}
[data-rg-file]{position:relative;box-sizing:border-box;flex:none;display:inline-flex;align-items:center;gap:10px;width:240px;max-width:100%;height:64px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));overflow:hidden;}
[data-rg-file-icon]{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary,inherit);}
[data-rg-file-icon] svg{width:24px;height:24px;display:block;}
[data-rg-file-body]{display:flex;flex-direction:column;min-width:0;gap:2px;}
[data-rg-file-name]{font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-rg-file-meta]{font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
/* Remove control mirrors the host rail: an 18px contrast-fill circle inset
 * 4px into the chip (the rail's hidden scrollbar would clip an overhanging
 * badge), revealed on hover or keyboard focus and always shown on touch. */
[data-rg-attach-item] [data-rg-remove],[data-rg-file] [data-rg-remove]{position:absolute;top:4px;right:4px;z-index:1;display:grid;place-items:center;width:18px;height:18px;padding:0;border:none;border-radius:50%;background:var(--dsw-alias-button-contrast-fill,rgba(0,0,0,.65));color:var(--dsw-alias-label-primary-inverted,#fff);font-size:11px;line-height:1;cursor:pointer;opacity:0;transition:opacity .2s ease-in-out;}
[data-rg-own]:hover [data-rg-remove],[data-rg-remove]:focus-visible{opacity:1;}
@media (hover:none),(pointer:coarse){[data-rg-remove]{opacity:1;}}
@media (prefers-reduced-motion:reduce){[data-rg-remove]{transition:none;}}
[data-rg-attach-item][data-rg-uploading]::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--dsw-alias-brand-primary,#4c8dff);border-top-color:transparent;animation:rg-spin .9s linear infinite;}
/* Toolbar row mirrors the composer's .row: space-between with the trailing
 * group re-anchoring right on its own wrapped line. */
[data-rg-controls]{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:2px 8px 6px;min-width:0;}
[data-rg-controls] [data-rg-left]{display:flex;align-items:center;gap:8px;min-width:0;}
[data-rg-controls] [data-rg-right]{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0;}
[data-rg-knob]{position:relative;}
[data-rg-knob-trigger]{display:inline-flex;align-items:center;max-width:220px;height:28px;padding:0 20px 0 8px;border:none;border-radius:var(--dsw-radius-sm,8px);outline:none;background-color:transparent;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 4px center;background-size:12px 12px;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;appearance:none;}
[data-rg-knob-trigger]:hover:not([disabled]){background-color:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));}
[data-rg-knob-trigger]:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-state-business-primary,#4c8dff);}
[data-rg-knob-trigger][disabled]{opacity:.5;cursor:default;}
[data-rg-knob-trigger] [data-rg-effort]{margin-left:4px;font-weight:400;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary,inherit));}
/* Picker menu mirrors the host ModelSelect card: prominent elevation over
 * the l1 hairline, 4px pad, 12px item radius, capped height with the l2
 * scrollbar pair. Opens downward from the chip, right-aligned to it. */
[data-rg-knob-menu]{position:absolute;top:calc(100% + 8px);right:0;z-index:40;box-sizing:border-box;min-width:240px;max-width:min(360px,80vw);max-height:min(360px,50vh);overflow:hidden auto;padding:4px;border:0;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1,rgba(127,127,127,.28));border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1,#fff));box-shadow:var(--dsw-elevation-prominent,0 0 0 .5px var(--dsw-alias-border-l1,rgba(127,127,127,.28)),0 3px 8px rgba(0,0,0,.04),0 0 20px rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,inherit);display:flex;flex-direction:column;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}
/* Option row: 34px min height, name + optional detail copy on the left and
 * a trailing 14px selection check — the host Menu primitive's treatment. */
[data-rg-knob-item]{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:5px 7px;border:none;border-radius:var(--dsw-radius-md,12px);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;flex:none;}
[data-rg-knob-item]:hover,[data-rg-knob-item]:focus-visible{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));outline:none;}
[data-rg-knob-copy]{display:flex;flex:1;flex-direction:column;min-width:0;gap:1px;}
[data-rg-knob-name]{font-size:13px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
[data-rg-knob-check]{display:grid;place-items:center;flex:0 0 14px;color:var(--dsw-alias-label-primary,inherit);}
[data-rg-knob-check] svg{width:14px;height:14px;display:block;}
[data-rg-knob-pending]{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4c8dff);animation:rg-pulse 1s ease-in-out infinite alternate;}
@keyframes rg-pulse{from{opacity:.35;}to{opacity:1;}}
@media (prefers-reduced-motion:reduce){[data-rg-knob-pending]{animation:none;}}
/* Root drill cells: 34px rows, label left, current value right in tertiary
 * tone, 12px chevron — same rhythm as the option rows. */
[data-rg-knob-menu][data-rg-flip=""]{top:auto;bottom:calc(100% + 8px);}
[data-rg-knob-cell]{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;height:34px;padding:0 8px;border:none;border-radius:var(--dsw-radius-md,12px);background:transparent;color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer;flex:none;}
[data-rg-knob-cell]:hover,[data-rg-knob-cell]:focus-visible{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));outline:none;}
[data-rg-knob-cell-label]{flex:none;white-space:nowrap;}
[data-rg-knob-cell-value]{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));}
[data-rg-knob-cell-chevron]{flex:none;width:12px;height:12px;color:var(--dsw-alias-menu-icon,var(--dsw-alias-label-tertiary,inherit));transform:rotate(-90deg);}
[data-rg-knob-cell-chevron] svg{width:12px;height:12px;display:block;}
/* Back row: caption-weight header with a left chevron, quieter than options. */
[data-rg-knob-back]{display:flex;align-items:center;gap:4px;width:100%;height:30px;padding:0 7px;border:none;border-radius:var(--dsw-radius-md,12px);background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:12px;line-height:16px;font-weight:500;text-align:left;cursor:pointer;flex:none;}
[data-rg-knob-back]:hover,[data-rg-knob-back]:focus-visible{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));outline:none;}
[data-rg-knob-back-arrow]{flex:none;width:12px;height:12px;color:var(--dsw-alias-label-tertiary,inherit);transform:rotate(90deg);}
[data-rg-knob-back-arrow] svg{width:12px;height:12px;display:block;}
[data-rg-knob-detail]{font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}
/* Provider heading: sticky caption label pinned while its group scrolls. */
[data-rg-knob-head]{position:sticky;top:-4px;z-index:1;margin:0 -4px;padding:8px 11px 4px;font-size:11px;line-height:14px;font-weight:500;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1,#fff));letter-spacing:.02em;flex:none;}
/* Add control: the composer chip chrome (borderless, hover fill) with a
 * text label — a labeled + reads clearer than the bare circle. */
[data-rg-add]{display:inline-flex;align-items:center;gap:5px;flex:none;height:28px;padding:0 8px;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;}
[data-rg-add]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));color:var(--dsw-alias-label-primary,inherit);}
[data-rg-add]:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4c8dff);outline-offset:1px;}
[data-rg-add][disabled]{opacity:.5;cursor:default;}
[data-rg-add] svg{width:14px;height:14px;display:block;flex:none;}
/* Ghost Cancel: quiet secondary text button beside the primary action. */
[data-rg-cancel]{display:inline-flex;align-items:center;flex:none;height:28px;padding:0 10px;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;}
[data-rg-cancel]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12)));color:var(--dsw-alias-label-primary,inherit);}
[data-rg-cancel]:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4c8dff);outline-offset:1px;}
[data-rg-cancel][disabled]{opacity:.5;cursor:default;}
/* Primary Resubmit: solid info-fill pill — the composer send pair as a text
 * button, the highest-weight element in the row. */
[data-rg-submit]{display:inline-flex;align-items:center;justify-content:center;flex:none;height:28px;padding:0 14px;border:none;border-radius:999px;background:var(--dsw-alias-button-info-fill,#3964FE);color:var(--dsw-alias-label-on-color,#fff);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background-color 100ms ease;}
[data-rg-submit]:hover:not([disabled]){background:var(--dsw-alias-button-info-hover,#679EFE);}
[data-rg-submit]:focus-visible{outline:2px solid var(--dsw-alias-button-info-fill,#3964FE);outline-offset:1px;}
[data-rg-submit][disabled]{opacity:.4;cursor:default;}
[data-rg-submit][data-rg-busy]{opacity:1;cursor:progress;}
/* Keymap line under the card: caption tone, right-aligned like the
 * composer's readings row. */
[data-rg-hint]{padding:6px 12px 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary,inherit));text-align:right;}
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
    // the same prompt is edited again. Keep the cache bounded so a long-lived
    // session cannot retain every image it has ever rendered.
    const THUMBNAIL_CACHE_LIMIT = 64;
    const thumbnailCache = new Map();

    function rememberThumbnail(id, url) {
      thumbnailCache.delete(id);
      thumbnailCache.set(id, url);
      if (thumbnailCache.size > THUMBNAIL_CACHE_LIMIT) {
        thumbnailCache.delete(thumbnailCache.keys().next().value);
      }
    }

    function getThumbnail(id) {
      if (!thumbnailCache.has(id)) return undefined;
      const url = thumbnailCache.get(id);
      thumbnailCache.delete(id);
      thumbnailCache.set(id, url);
      return url;
    }

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
        'aria-hidden': true,
      },
        h('path', { d: 'M12 5v14' }),
        h('path', { d: 'M5 12h14' }));
    }

    /** Files of a clipboard/drop payload in transfer order, skipping folder
     * members (the entry API marks them; a folder has no uploadable bytes).
     * Mirrors the host composer's clipboardFiles intake. */
    function transferFiles(transfer) {
      if (!transfer) return [];
      const files = [];
      for (const item of Array.from(transfer.items || [])) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry && entry.isDirectory) continue;
        }
        files.push(file);
      }
      // Engines without an item list (some test/older paths) still carry files.
      if (!files.length && transfer.files) return Array.from(transfer.files);
      return files;
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
                rememberThumbnail(ref.attachmentId, await readImageUrl(CTX, sessionId, ref));
              } catch (_error) {
                // Do not cache failures: a transient read may succeed later.
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
          const url = getThumbnail(ref.attachmentId);
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

    /** Trailing selection check, matching the host menu's 14px mark. */
    function CheckGlyph() {
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': true,
      }, h('path', { d: 'M20 6 9 17l-5-5' }));
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
      const menuRef = React.useRef(null);
      const knobRef = React.useRef(null);
      // Downward by default; near the viewport floor the menu flips above the
      // chip so it never opens off-screen. Measured once per open; the menu
      // is chip-anchored, so page scroll carries it along correctly.
      React.useEffect(() => {
        if (!open) return;
        const knob = knobRef.current;
        const menu = menuRef.current;
        if (!knob || !menu) return;
        const rect = knob.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom - 8;
        const above = rect.top - 8;
        const wanted = Math.min(360, window.innerHeight * 0.5);
        menu.setAttribute('data-rg-flip', below < Math.min(wanted, 240) && above > below ? '' : 'off');
      }, [open]);
      // A drilled list opens at its selected row, not scrolled to the top.
      React.useEffect(() => {
        if (!open || pane === 'root') return;
        const menu = menuRef.current;
        const active = menu && menu.querySelector('[data-rg-active]');
        if (active) {
          // Manual offset keeps the page itself from scrolling: only the
          // menu's own scrollport moves.
          menu.scrollTop = active.offsetTop - menu.clientHeight / 2 + active.clientHeight / 2;
        }
      }, [open, pane]);
      const current = selection && selection.next ? selection.next : null;
      React.useEffect(() => {
        let alive = true;
        CTX.remote.session.modelCatalog().then((result) => {
          if (alive && result && result.ok) setCatalog(result.value);
        }).catch(() => { /* no catalog: seat stays hidden */ });
        return () => { alive = false; };
      }, []);
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
      const submitModel = async (route, reasoningEffort, label) => {
        setPending({ ...route, label });
        setError('');
        try {
          const request = { sessionId, provider: route.providerId, model: route.modelId };
          if (reasoningEffort !== undefined) request.reasoningEffort = reasoningEffort;
          // The remote takes the request only — the client api validates
          // argument counts, and an extra signal fails the call entirely.
          const result = await CTX.remote.session.selectModel(request);
          if (!result || result.ok !== true) {
            throw new Error(result && result.error ? result.error.message : 'rejected');
          }
          setOpen(false);
          setPane('root');
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
        submitModel({ providerId: item.providerId, modelId: item.modelId }, item.defaultEffort, item.label);
      };
      const pickEffort = (item) => {
        if (!current) return;
        if (effectiveEffort === item.effort) {
          setOpen(false);
          return;
        }
        submitModel({ providerId: current.provider, modelId: current.model }, item.effort, item.label);
      };
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
      const knobRow = (item, activeId) => {
        // Provider headings are sticky non-interactive labels, not buttons.
        if (item.heading) {
          return h('div', { 'data-rg-knob-head': '', role: 'presentation', key: item.id }, item.label);
        }
        const active = item.id === activeId;
        const isPending = pending && pane === 'model'
          && item.providerId === pending.providerId && item.modelId === pending.modelId;
        return h('button', {
          type: 'button', 'data-rg-knob-item': '', role: 'menuitemradio',
          'data-rg-active': active ? '' : undefined,
          'aria-checked': active ? 'true' : 'false',
          key: item.id, title: item.detail || undefined,
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (pane === 'model') pickModel(item);
            else pickEffort(item);
          },
        },
          h('span', { 'data-rg-knob-copy': '' },
            h('span', { 'data-rg-knob-name': '' }, item.label),
            item.detail ? h('span', { 'data-rg-knob-detail': '' }, item.detail) : null),
          h('span', { 'data-rg-knob-check': '' },
            isPending ? h('span', { 'data-rg-knob-pending': '' }) : active ? h(CheckGlyph) : null));
      };
      return h('div', { ref: knobRef, 'data-rg-knob': '' },
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
        open ? h('div', { ref: menuRef, 'data-rg-knob-menu': '', role: 'menu' },
          pane === 'root'
            ? [
                h('button', {
                  type: 'button', 'data-rg-knob-cell': '', role: 'menuitem', key: 'cell-model',
                  onClick: (event) => { event.preventDefault(); event.stopPropagation(); setPane('model'); },
                },
                  h('span', { 'data-rg-knob-cell-label': '' }, t('menuModel')),
                  h('span', { 'data-rg-knob-cell-value': '' }, modelLabel),
                  h('span', { 'data-rg-knob-cell-chevron': '' }, h(ChevronGlyph))),
                reasoning
                  ? h('button', {
                      type: 'button', 'data-rg-knob-cell': '', role: 'menuitem', key: 'cell-effort',
                      onClick: (event) => { event.preventDefault(); event.stopPropagation(); setPane('effort'); },
                    },
                      h('span', { 'data-rg-knob-cell-label': '' }, t('menuEffort')),
                      h('span', { 'data-rg-knob-cell-value': '' }, effortText || ''),
                      h('span', { 'data-rg-knob-cell-chevron': '' }, h(ChevronGlyph)))
                  : null,
              ]
            : [
                h('button', {
                  type: 'button', 'data-rg-knob-back': '', key: 'back',
                  onClick: (event) => { event.preventDefault(); event.stopPropagation(); setPane('root'); },
                },
                  h('span', { 'data-rg-knob-back-arrow': '' }, h(ChevronGlyph)),
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

    /** Ask the host to analyse the turn and inject a hidden continuation that
     * tells the model to disregard its previous final answer. Falls back to
     * the legacy append-prompt flow when an older host bundle is installed. */
    async function callRegenerateApi(ctx, sessionId, turn) {
      try {
        const response = await fetch('/api/dsh-regenerate/regenerate', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            ...(Number.isSafeInteger(turn) && turn > 0 ? { turn } : {}),
          }),
        });
        const data = await response.json();
        if (response.ok && data && data.ok === true) return { ok: true, value: data.value };
      } catch (_error) { /* older host bundle: use the client fallback */ }
      return { ok: false };
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
          const turn = Number.isSafeInteger(props.turn) ? props.turn
            : (node && node.data && Number.isSafeInteger(node.data.turn) ? node.data.turn : undefined);
          const outcome = await callRegenerateApi(CTX, props.sessionId, turn);
          if (outcome.ok) return;
          const fallback = await appendInSession(CTX, props.sessionId, node, textOf(node));
          if (fallback.missing) setError(t('attachmentsMissing'));
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
      }, [editing, node]);

      // The host's attachment view listens for document-level 'drop' in the
      // bubble phase and would duplicate an editor-addressed drop into the
      // bottom composer. React's synthetic stopPropagation does not reach
      // those native listeners (React 17+ roots at its own container), so a
      // native capture-phase guard on the card claims the drop first.
      const editorRef = React.useRef(null);
      React.useEffect(() => {
        if (!editing) return undefined;
        const card = editorRef.current;
        if (!card) return undefined;
        const claim = (event) => {
          const types = event.dataTransfer && event.dataTransfer.types;
          if (types && Array.from(types).includes('Files')) event.stopPropagation();
        };
        card.addEventListener('drop', claim, true);
        return () => card.removeEventListener('drop', claim, true);
      }, [editing]);

      // Dismiss on any click outside the editor. Capture phase runs before the
      // row's bubble-phase "click to open" handler; marking the event keeps
      // that handler from immediately re-opening the editor in the same click.
      React.useEffect(() => {
        if (!editing) return undefined;
        const dismiss = (event) => {
          if (busy) return;
          const target = event.target;
          if (target && typeof target.closest === 'function'
            && target.closest('[data-rg-editor],[data-rg-hint]')) return;
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
      const textareaRef = React.useRef(null);
      // IME tail guard: some engines fire the candidate-confirm Enter AFTER
      // compositionend with isComposing already false (keyCode 229 absent).
      // The host composer keeps the same recently-composing window.
      const composingRef = React.useRef(false);
      const composedAtRef = React.useRef(0);
      // Auto-fit: the editor starts one line tall and grows with its content.
      const fitTextarea = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      };
      React.useEffect(() => {
        if (editing) fitTextarea();
      }, [editing, text]);
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
        ? h(React.Fragment, null,
            h('div', {
              ref: editorRef,
              'data-rg-editor': '',
              onPasteCapture: (event) => {
                if (busy) return;
                const files = transferFiles(event.clipboardData);
                if (!files.length) return;
                event.stopPropagation();
                addFiles(files);
                // A file-only paste is fully consumed; when text rides along
                // (e.g. a copied image with alt text) let it insert natively.
                if (!event.clipboardData.getData('text/plain')) event.preventDefault();
              },
              onDragOver: (event) => {
                if (busy) return;
                if (Array.from(event.dataTransfer.types || []).includes('Files')) {
                  // No stopPropagation here: the host's document dragover keeps
                  // the drop alive page-wide; stopping it outside a droppable
                  // zone would let the browser cancel the drag before drop.
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }
              },
              onDrop: (event) => {
                if (busy) return;
                const files = transferFiles(event.dataTransfer);
                if (!files.length) return;
                event.preventDefault();
                event.stopPropagation();
                addFiles(files);
              },
            },
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
              ref: textareaRef,
              value: text, 'aria-label': t('editHint'), spellCheck: false, autoFocus: true,
              onChange: (event) => setText(event.target.value),
              onCompositionStart: () => { composingRef.current = true; },
              onCompositionEnd: () => { composingRef.current = false; composedAtRef.current = Date.now(); },
              onKeyDown: (event) => {
                if (event.key === 'Escape') { event.preventDefault(); cancel(); }
                if (event.key !== 'Enter') return;
                // Shift+Enter keeps the newline.
                if (event.shiftKey) return;
                // An IME candidate pick never submits: live composition, the
                // legacy keyCode 229 signal, or an Enter landing right after
                // compositionend (engine order varies; same guard as the host).
                if (event.isComposing || event.keyCode === 229 || composingRef.current
                  || Date.now() - composedAtRef.current < 100) return;
                // Plain Enter matches the composer; Ctrl/Cmd+Enter still works.
                event.preventDefault();
                submit();
              },
            }),
            h('div', { 'data-rg-controls': '' },
              h('div', { 'data-rg-left': '' },
                h('button', {
                  type: 'button', 'data-rg-add': '', 'aria-label': t('addAttachment'),
                  title: t('addAttachment'), disabled: busy,
                  onClick: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (inputRef.current) inputRef.current.click();
                  },
                }, h(PlusGlyph), h('span', null, t('addAttachment'))),
                knobsAvailable(props.sessionId)
                  ? h(ModelPicker, { sessionId: props.sessionId, busy, t })
                  : null),
              h('div', { 'data-rg-right': '' },
                error ? h('span', { 'data-rg-errorline': '', role: 'status' }, error) : null,
                h('button', {
                  type: 'button', 'data-rg-cancel': '', disabled: busy,
                  title: t('cancel'),
                  onClick: (event) => { event.preventDefault(); event.stopPropagation(); cancel(); },
                }, t('cancel')),
                h('button', {
                  type: 'button', 'data-rg-submit': '',
                  'data-rg-busy': busy ? '' : undefined,
                  'aria-label': busy ? t('resubmitting') : t('resubmit'),
                  title: busy ? t('resubmitting') : t('resubmitHint'),
                  disabled: busy,
                  onClick: (event) => { event.preventDefault(); event.stopPropagation(); submit(); },
                }, busy ? t('resubmitting') : t('resubmit'))))),
            // Visible keymap line under the card, right-aligned like the
            // composer's readings row.
            h('div', { 'data-rg-hint': '' }, t('editorHint')))
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
