/**
 * SillyTavern Phone UI Extension — 交互处理
 * 搜索导航、语音/翻译/撤回展开、转账、用户操作面板、表情包选择器
 */

const PhoneInteractions = (() => {

    let pendingActions = [];

    // ========== 表情包 ==========
    let currentCharStickers = {};
    let globalStickers = {};

    function setStickers(c, g) { currentCharStickers = c || {}; globalStickers = g || {}; }
    function resolveSticker(key) {
        if (!key) return null;
        if (key.startsWith('http://') || key.startsWith('https://')) return key;
        return currentCharStickers[key] || globalStickers[key] || null;
    }
    function getAllStickers() { return { ...globalStickers, ...currentCharStickers }; }

    // ========== 配置（头像/背景）==========
    let phoneConfig = { charAvatar: '', userAvatar: '', chatBackground: '' };
    function setConfig(cfg) { phoneConfig = { ...phoneConfig, ...cfg }; }
    function getConfig() { return phoneConfig; }

    // ========== 搜索 ==========
    function toggleSearch(phoneId) {
        const bar = document.getElementById(`search_${phoneId}`);
        if (!bar) return;
        bar.classList.toggle('active');
        if (bar.classList.contains('active')) {
            bar.querySelector('input').focus();
        } else {
            bar.querySelector('input').value = '';
            closeSearchResults(phoneId);
        }
    }

    function handleSearch(phoneId, query) {
        closeSearchResults(phoneId);
        if (!query.trim()) return;
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        const chat = phone.querySelector('.st-phone-chat');
        const rows = chat.querySelectorAll('[data-searchable]');
        const lq = query.toLowerCase();
        const results = [];

        rows.forEach(row => {
            const el = row.querySelector('.st-phone-bubble') || row.querySelector('.st-phone-sticker') || row.querySelector('.st-phone-transfer');
            if (!el) return;
            const text = el.textContent;
            if (!text.toLowerCase().includes(lq)) return;
            const sender = row.querySelector('.st-phone-avatar')?.textContent?.trim() || '?';
            const time = row.querySelector('.st-phone-msg-time')?.textContent || '';
            const idx = text.toLowerCase().indexOf(lq);
            const s = Math.max(0, idx - 20);
            const e = Math.min(text.length, idx + query.length + 20);
            results.push({ row, sender, time,
                pre: (s > 0 ? '...' : '') + text.substring(s, idx),
                match: text.substring(idx, idx + query.length),
                post: text.substring(idx + query.length, e) + (e < text.length ? '...' : '')
            });
        });

        if (!results.length) return;
        const panel = document.createElement('div');
        panel.className = 'st-phone-search-results';
        const header = document.createElement('div');
        header.className = 'search-results-header';
        header.textContent = `\u627e\u5230 ${results.length} \u6761\u6d88\u606f`;
        panel.appendChild(header);

        results.forEach(r => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `<div class="result-avatar">${esc(r.sender)}</div><div class="result-body"><div class="result-snippet">${esc(r.pre)}<b>${esc(r.match)}</b>${esc(r.post)}</div><div class="result-time">${esc(r.time)}</div></div>`;
            item.onclick = () => {
                closeSearchResults(phoneId);
                r.row.classList.add('search-result-flash');
                r.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => r.row.classList.remove('search-result-flash'), 2000);
            };
            panel.appendChild(item);
        });

        chat.style.display = 'none';
        chat.parentNode.insertBefore(panel, chat);
    }

    function closeSearchResults(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        const p = phone.querySelector('.st-phone-search-results');
        if (p) p.remove();
        const chat = phone.querySelector('.st-phone-chat');
        if (chat) chat.style.display = '';
    }

    function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    // ========== 基础交互 ==========
    function toggleVoiceText(el) {
        const t = el.nextElementSibling;
        t.classList.toggle('expanded');
        el.textContent = t.classList.contains('expanded') ? '📝 收起' : '📝 转文字';
    }
    function toggleTranslation(el) {
        const c = el.nextElementSibling;
        c.classList.toggle('expanded');
        el.textContent = c.classList.contains('expanded') ? '🌐 收起翻译' : '🌐 查看翻译';
    }
    function toggleRecall(el) {
        const g = el.closest('.st-phone-recall-group');
        const r = g.querySelector('.st-phone-recall-revealed');
        r.classList.toggle('visible');
        el.textContent = r.classList.contains('visible') ? '收起' : '查看';
    }

    // ========== 转账处理 ==========
    function handleTransfer(phoneId, transferId, action, fromName) {
        const card = document.querySelector(`[data-transfer-id="${transferId}"]`);
        if (!card) return;
        if (card.classList.contains('accepted') || card.classList.contains('declined')) return;

        const statusEl = card.querySelector('.transfer-status');
        if (action === 'accept') {
            card.classList.add('accepted');
            statusEl.textContent = '✅ 已领取';
        } else {
            card.classList.add('declined');
            statusEl.textContent = '已退回';
        }

        const msgRow = card.closest('.st-phone-msg-row');
        if (msgRow) {
            const notice = document.createElement('div');
            notice.className = 'st-phone-time-sep';
            notice.innerHTML = `<span>你已${action === 'accept' ? '领取' : '退回'}${fromName}的转账</span>`;
            msgRow.parentNode.insertBefore(notice, msgRow.nextSibling);
        }

        if (pendingActions.some(a => a.transferId === transferId)) return;
        const desc = action === 'accept'
            ? `用户已领取${fromName}的转账（¥${card.querySelector('.transfer-amount')?.textContent || ''}）`
            : `用户已退回${fromName}的转账`;
        pendingActions.push({ type: 'transfer', transferId, action, from: fromName, desc });
        updatePendingCount();
        saveToChatMetadata(transferId, action);
    }

    // ========== 用户主动操作 ==========
    function toggleStickerPicker(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        closeActionPanel(phoneId);
        const existing = phone.querySelector('.st-phone-sticker-picker');
        if (existing) { existing.remove(); return; }

        const all = getAllStickers();
        if (!Object.keys(all).length) {
            if (typeof toastr !== 'undefined') toastr.warning('还没有配置表情包哦~', 'Phone UI');
            return;
        }

        const grid = Object.entries(all).map(([key, url]) =>
            `<div class="sticker-picker-item" onclick="PhoneInteractions.sendUserSticker('${phoneId}','${key.replace(/'/g, "\\'")}')">
                <img src="${url}" alt="${key}" title="${key}" onerror="this.outerHTML='<span>${key}</span>'">
            </div>`
        ).join('');

        const picker = document.createElement('div');
        picker.className = 'st-phone-sticker-picker';
        picker.innerHTML = `<div class="sticker-picker-header"><span>表情包</span><span class="sticker-picker-close" onclick="PhoneInteractions.closeStickerPicker('${phoneId}')">✕</span></div><div class="sticker-picker-grid">${grid}</div>`;
        const inputbar = phone.querySelector('.st-phone-inputbar');
        inputbar.parentNode.insertBefore(picker, inputbar);
    }

    function closeStickerPicker(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (phone) phone.querySelector('.st-phone-sticker-picker')?.remove();
    }

    function sendUserSticker(phoneId, key) {
        pendingActions.push({ type: 'sticker', desc: `用户发送了表情包「${key}」` });
        updatePendingCount();
        closeStickerPicker(phoneId);
        if (typeof toastr !== 'undefined') toastr.info(`已发送表情包: ${key}`, 'Phone UI');
    }

    function toggleActionPanel(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        closeStickerPicker(phoneId);
        const existing = phone.querySelector('.st-phone-action-panel');
        if (existing) { existing.remove(); return; }

        const panel = document.createElement('div');
        panel.className = 'st-phone-action-panel';
        panel.innerHTML = `
            <div class="action-item" onclick="PhoneInteractions.showForm('${phoneId}','transfer')"><div class="action-icon">💰</div><span>转账</span></div>
            <div class="action-item" onclick="PhoneInteractions.showForm('${phoneId}','location')"><div class="action-icon">📍</div><span>位置</span></div>
            <div class="action-item" onclick="PhoneInteractions.showForm('${phoneId}','voice')"><div class="action-icon">🎤</div><span>语音</span></div>
        `;
        const inputbar = phone.querySelector('.st-phone-inputbar');
        inputbar.parentNode.insertBefore(panel, inputbar);
    }

    function closeActionPanel(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (phone) phone.querySelector('.st-phone-action-panel')?.remove();
    }

    function showForm(phoneId, type) {
        closeActionPanel(phoneId);
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        phone.querySelector('.st-phone-form-overlay')?.remove();

        let formHtml = '';
        if (type === 'transfer') {
            formHtml = `<div class="form-title">发送转账</div>
                <input type="number" id="pf_amount_${phoneId}" placeholder="金额" class="phone-form-input">
                <input type="text" id="pf_note_${phoneId}" placeholder="备注（选填）" class="phone-form-input">`;
        } else if (type === 'location') {
            formHtml = `<div class="form-title">发送位置</div>
                <input type="text" id="pf_locname_${phoneId}" placeholder="地点名称" class="phone-form-input">
                <input type="text" id="pf_locaddr_${phoneId}" placeholder="详细地址（选填）" class="phone-form-input">`;
        } else if (type === 'voice') {
            formHtml = `<div class="form-title">发送语音</div>
                <textarea id="pf_voice_${phoneId}" placeholder="输入语音内容（AI会将其作为你发的语音消息）" class="phone-form-input" rows="3"></textarea>`;
        }

        const overlay = document.createElement('div');
        overlay.className = 'st-phone-form-overlay';
        overlay.innerHTML = `${formHtml}
            <div class="form-btns">
                <div class="form-btn send" onclick="PhoneInteractions.submitForm('${phoneId}','${type}')">发送</div>
                <div class="form-btn cancel" onclick="PhoneInteractions.closeForm('${phoneId}')">取消</div>
            </div>`;
        const chat = phone.querySelector('.st-phone-chat');
        chat.parentNode.insertBefore(overlay, chat.nextSibling);
    }

    function submitForm(phoneId, type) {
        if (type === 'transfer') {
            const amount = document.getElementById(`pf_amount_${phoneId}`)?.value;
            const note = document.getElementById(`pf_note_${phoneId}`)?.value || '';
            if (!amount) return;
            pendingActions.push({ type: 'transfer', desc: `用户向对方发送了转账 ¥${amount}${note ? '（' + note + '）' : ''}` });
        } else if (type === 'location') {
            const name = document.getElementById(`pf_locname_${phoneId}`)?.value;
            const addr = document.getElementById(`pf_locaddr_${phoneId}`)?.value || '';
            if (!name) return;
            pendingActions.push({ type: 'location', desc: `用户发送了位置「${name}」${addr ? '(' + addr + ')' : ''}` });
        } else if (type === 'voice') {
            const text = document.getElementById(`pf_voice_${phoneId}`)?.value;
            if (!text) return;
            pendingActions.push({ type: 'voice', desc: `用户发送了语音消息，内容为："${text}"` });
        }
        updatePendingCount();
        closeForm(phoneId);
        if (typeof toastr !== 'undefined') toastr.info('操作已记录，发送消息后 AI 将收到通知', 'Phone UI');
    }

    function closeForm(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (phone) phone.querySelector('.st-phone-form-overlay')?.remove();
    }

    // ========== 工具函数 ==========
    function saveToChatMetadata(transferId, action) {
        try {
            const ctx = SillyTavern.getContext();
            if (!ctx.chatMetadata.phone_actions) ctx.chatMetadata.phone_actions = {};
            ctx.chatMetadata.phone_actions[transferId] = action;
            ctx.saveMetadataDebounced();
        } catch (e) { }
    }

    function consumePendingActions() {
        const a = [...pendingActions]; pendingActions = []; updatePendingCount(); return a;
    }
    function getPendingActions() { return pendingActions; }

    function updatePendingCount() {
        const el = document.getElementById('phone_ui_pending_count');
        if (el) el.textContent = pendingActions.length;
    }

    function scrollToBottom(phoneId) {
        const c = document.getElementById(`chat_${phoneId}`);
        if (c) c.scrollTop = c.scrollHeight;
    }
    function scrollAllToBottom() {
        document.querySelectorAll('.st-phone-chat').forEach(c => { c.scrollTop = c.scrollHeight; });
    }

    return {
        toggleSearch, handleSearch, closeSearchResults,
        toggleVoiceText, toggleTranslation, toggleRecall,
        handleTransfer,
        toggleStickerPicker, closeStickerPicker, sendUserSticker,
        toggleActionPanel, closeActionPanel,
        showForm, submitForm, closeForm,
        consumePendingActions, getPendingActions,
        scrollToBottom, scrollAllToBottom,
        setStickers, resolveSticker, getAllStickers,
        setConfig, getConfig,
    };
})();

if (typeof window !== 'undefined') { window.PhoneInteractions = PhoneInteractions; }
