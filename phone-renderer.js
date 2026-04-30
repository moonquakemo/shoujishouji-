/**
 * SillyTavern Phone UI Extension — HTML 渲染器
 * 将解析后的结构化数据渲染为手机 UI HTML
 */

const PhoneRenderer = (() => {

    // SVG 图标常量
    const ICONS = {
        back: '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
        search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
        signal: '<svg viewBox="0 0 24 24"><path d="M2 22h20V2L2 22zm18-2H6.83L20 6.83V20z" opacity=".3"/><path d="M2 22h20V2L2 22zm18-2H6.83L20 6.83V20zM20 2v20L2 22z"/></svg>',
        wifi: '<svg viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>',
        battery: '<svg viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zM15 18H9V6h6v12z"/></svg>',
        volume: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
        dollar: '<svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
        location: '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>',
        emoji: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
        plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    };

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 渲染头像（支持图片URL）
     */
    function renderAvatar(name, isMe) {
        const cfg = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getConfig) ? PhoneInteractions.getConfig() : {};
        const url = isMe ? cfg.userAvatar : cfg.charAvatar;
        const letter = escapeHtml(name ? name.charAt(0) : '?');
        if (url) {
            return `<div class="st-phone-avatar"><img src="${escapeHtml(url)}" alt="${letter}" onerror="this.remove()"><span class="avatar-fallback">${letter}</span></div>`;
        }
        return `<div class="st-phone-avatar">${letter}</div>`;
    }

    /**
     * 渲染完整手机 UI
     * @param {object} phoneData - { contact, messages, actions }
     * @param {string} phoneId - 唯一标识
     */
    function render(phoneData, phoneId) {
        const { contact, messages, actions = {} } = phoneData;
        const id = phoneId || `phone_${Date.now()}`;
        const cfg = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getConfig) ? PhoneInteractions.getConfig() : {};
        const bgStyle = cfg.chatBackground ? `background-image:url('${escapeHtml(cfg.chatBackground)}');background-size:cover;` : '';

        return `
<div class="st-phone" data-phone-id="${id}">
  ${renderStatusBar()}
  ${renderNavBar(contact, id)}
  ${renderSearchBar(id)}
  <div class="st-phone-chat" id="chat_${id}" style="${bgStyle}">
    <div class="st-phone-chat-spacer"></div>
    ${messages.map((msg, i) => renderMessage(msg, contact, actions, id, i)).join('\n')}
  </div>
  ${renderInputBar(id)}
  <div class="st-phone-bottom-safe"></div>
</div>`;
    }

    function renderStatusBar() {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return `
<div class="st-phone-statusbar">
  <span class="status-left">${timeStr}</span>
  <div class="status-right">${ICONS.signal}${ICONS.wifi}${ICONS.battery}</div>
</div>`;
    }

    function renderNavBar(contact, id) {
        return `
<div class="st-phone-navbar">
  <div class="nav-back">${ICONS.back}</div>
  <div class="nav-title">${escapeHtml(contact)}</div>
  <div class="nav-search-btn" onclick="PhoneInteractions.toggleSearch('${id}')">${ICONS.search}</div>
</div>`;
    }

    function renderSearchBar(id) {
        return `
<div class="st-phone-search" id="search_${id}">
  <input type="text" placeholder="搜索聊天记录..." oninput="PhoneInteractions.handleSearch('${id}', this.value)">
  <span id="search_count_${id}" class="search-counter"></span>
  <span class="search-nav-btn" onclick="PhoneInteractions.navigateSearch('${id}',-1)">◀</span>
  <span class="search-nav-btn" onclick="PhoneInteractions.navigateSearch('${id}',1)">▶</span>
  <span class="search-close" onclick="PhoneInteractions.toggleSearch('${id}')">取消</span>
</div>`;
    }

    function renderInputBar(phoneId) {
        return `
<div class="st-phone-inputbar">
  <div class="input-voice-btn" onclick="PhoneInteractions.showForm('${phoneId}','voice')" title="发送语音">${ICONS.mic}</div>
  <div class="input-field">输入消息...</div>
  <div class="input-actions">
    <div class="input-action-btn" onclick="PhoneInteractions.toggleStickerPicker('${phoneId}')" title="表情包">${ICONS.emoji}</div>
    <div class="input-action-btn" onclick="PhoneInteractions.toggleActionPanel('${phoneId}')" title="更多">${ICONS.plus}</div>
  </div>
</div>`;
    }

    /**
     * 渲染单条消息
     */
    function renderMessage(msg, contact, actions, phoneId, index) {
        switch (msg.type) {
            case 'msg': return renderTextMsg(msg, contact, phoneId);
            case 'voice': return renderVoiceMsg(msg, contact, phoneId);
            case 'sticker': return renderStickerMsg(msg, contact);
            case 'transfer': return renderTransferMsg(msg, contact, actions, phoneId);
            case 'location': return renderLocationMsg(msg, contact);
            case 'recall': return renderRecallMsg(msg, contact, phoneId, index);
            case 'time-sep': return renderTimeSep(msg);
            default: return '';
        }
    }

    function renderTextMsg(msg, contact, phoneId) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const avatarName = msg.isMe ? 'Me' : contact;
        const from = msg.from || contact;

        let quoteHtml = '';
        if (msg.quote) {
            const qSide = msg.isMe ? 'quote-right' : 'quote-left';
            quoteHtml = `<div class="st-phone-quote ${qSide}"><span class="quote-from">${escapeHtml(msg.quoteFrom || from)}:</span> ${escapeHtml(msg.quote)}</div>`;
        }

        let transHtml = '';
        if (msg.trans) {
            transHtml = `
<div class="st-phone-translation">
  <div class="st-phone-trans-toggle" onclick="PhoneInteractions.toggleTranslation(this)">🌐 查看翻译</div>
  <div class="st-phone-trans-content">${escapeHtml(msg.trans)}</div>
</div>`;
        }

        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        return `${quoteHtml}
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe)}
  <div>
    <div class="st-phone-bubble">${escapeHtml(msg.content)}${transHtml}</div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderVoiceMsg(msg, contact, phoneId) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const avatarName = msg.isMe ? 'Me' : contact;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe)}
  <div>
    <div class="st-phone-bubble">
      <div class="st-phone-voice">
        <div class="voice-icon">${ICONS.volume}</div>
        <div class="voice-waves"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <span class="voice-duration">${escapeHtml(msg.duration)}</span>
      </div>
      <div class="st-phone-voice-toggle" onclick="PhoneInteractions.toggleVoiceText(this)">📝 转文字</div>
      <div class="st-phone-voice-text">${escapeHtml(msg.content)}</div>
    </div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderStickerMsg(msg, contact) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const avatarName = msg.isMe ? 'Me' : contact;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        // 表情包解析：key → URL（角色专属 → 全局 → 回退）
        let imgSrc = null;
        if (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.resolveSticker) {
            imgSrc = PhoneInteractions.resolveSticker(msg.src);
        } else if (msg.src && msg.src.startsWith('http')) {
            imgSrc = msg.src;
        }

        const fallbackText = msg.content || '😊';
        const stickerInner = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(msg.content)}" onerror="this.outerHTML='<span class=st-phone-sticker-fallback>${escapeHtml(fallbackText)}</span>'">`
            : `<span class="st-phone-sticker-fallback">${escapeHtml(fallbackText)}</span>`;

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe)}
  <div>
    <div class="st-phone-sticker">${stickerInner}</div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderTransferMsg(msg, contact, actions, phoneId) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const avatarName = msg.isMe ? 'Me' : contact;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';
        const transferId = msg.id;

        // 检查是否已有操作（来自标记的 status 或 chatMetadata）
        const status = msg.status || (actions[transferId] || '');
        let statusClass = '';
        let statusHtml = '';
        let actionsHtml = '';

        if (status === 'accepted') {
            statusClass = 'accepted';
            statusHtml = '<div class="transfer-status">✅ 已领取</div>';
        } else if (status === 'declined') {
            statusClass = 'declined';
            statusHtml = '<div class="transfer-status">已退回</div>';
        } else if (!msg.isMe) {
            // 只有别人发给你的转账才有领取/退回按钮
            actionsHtml = `
<div class="transfer-actions">
  <div class="transfer-btn accept" onclick="PhoneInteractions.handleTransfer('${phoneId}','${transferId}','accept','${escapeHtml(msg.from || contact)}')">领取</div>
  <div class="transfer-btn decline" onclick="PhoneInteractions.handleTransfer('${phoneId}','${transferId}','decline','${escapeHtml(msg.from || contact)}')">退回</div>
</div>`;
            statusHtml = '<div class="transfer-status"></div>';
        }

        let noticeHtml = '';
        if (status === 'accepted') {
            noticeHtml = `<div class="st-phone-time-sep"><span>你已领取${escapeHtml(msg.from || contact)}的转账</span></div>`;
        } else if (status === 'declined') {
            noticeHtml = `<div class="st-phone-time-sep"><span>你已退回${escapeHtml(msg.from || contact)}的转账</span></div>`;
        }

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe)}
  <div>
    <div class="st-phone-transfer ${statusClass}" data-transfer-id="${transferId}">
      <div class="transfer-header">
        <div class="transfer-icon">${ICONS.dollar}</div>
        <span class="transfer-label">转账</span>
      </div>
      <div class="transfer-amount">${escapeHtml(msg.amount)}</div>
      <div class="transfer-note">${escapeHtml(msg.note)}</div>
      ${actionsHtml}
      ${statusHtml}
    </div>
    ${timeHtml}
  </div>
</div>
${noticeHtml}`;
    }

    function renderLocationMsg(msg, contact) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const avatarName = msg.isMe ? 'Me' : contact;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe)}
  <div>
    <div class="st-phone-location">
      <div class="location-map">${ICONS.location}</div>
      <div class="location-info">
        <div class="location-name">${escapeHtml(msg.name)}</div>
        <div class="location-addr">${escapeHtml(msg.addr)}</div>
      </div>
    </div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderRecallMsg(msg, contact, phoneId, index) {
        const from = msg.from || contact;
        return `
<div class="st-phone-recall-group">
  <div class="st-phone-recall">
    <span class="recall-text">"${escapeHtml(from)}" 撤回了一条消息</span>
    <span class="recall-view" onclick="PhoneInteractions.toggleRecall(this)">查看</span>
  </div>
  <div class="st-phone-recall-revealed">
    <div class="recall-bubble">
      <div class="recall-label">已撤回的消息</div>
      <div class="recall-original">${escapeHtml(msg.content)}</div>
    </div>
  </div>
</div>`;
    }

    function renderTimeSep(msg) {
        return `<div class="st-phone-time-sep"><span>${escapeHtml(msg.time)}</span></div>`;
    }

    return { render, escapeHtml };
})();

if (typeof window !== 'undefined') {
    window.PhoneRenderer = PhoneRenderer;
}
