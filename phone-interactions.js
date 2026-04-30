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
    let searchMatches = [];
    let searchIndex = -1;

    function toggleSearch(phoneId) {
        const bar = document.getElementById(`search_${phoneId}`);
        if (!bar) return;
        bar.classList.toggle('active');
        if (bar.classList.contains('active')) {
            bar.querySelector('input').focus();
        } else {
            bar.querySelector('input').value = '';
            clearSearchHighlights(phoneId);
        }
    }

    function handleSearch(phoneId, query) {
        clearSearchHighlights(phoneId);
        searchMatches = [];
        searchIndex = -1;
        updateSearchCounter(phoneId);
        if (!query.trim()) return;

        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        const rows = phone.querySelectorAll('[data-searchable]');

        rows.forEach(row => {
            const bubble = row.querySelector('.st-phone-bubble');
            if (!bubble) return;
            const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent;
                const idx = text.toLowerCase().indexOf(query.toLowerCase());
                if (idx !== -1) {
                    const span = document.createElement('span');
                    span.appendChild(document.createTextNode(text.substring(0, idx)));
                    const hl = document.createElement('span');
                    hl.className = 'search-highlight';
                    hl.textContent = text.substring(idx, idx + query.length);
                    span.appendChild(hl);
                    span.appendChild(document.createTextNode(text.substring(idx + query.length)));
                    node.parentNode.replaceChild(span, node);
                    searchMatches.push(hl);
                }
            }
        });

        if (searchMatches.length) {
            searchIndex = 0;
            searchMatches[0].classList.add('search-highlight-active');
            searchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        updateSearchCounter(phoneId);
    }

    function navigateSearch(phoneId, dir) {
        if (!searchMatches.length) return;
        searchMatches[searchIndex]?.classList.remove('search-highlight-active');
        searchIndex = (searchIndex + dir + searchMatches.length) % searchMatches.length;
        searchMatches[searchIndex].classList.add('search-highlight-active');
        searchMatches[searchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        updateSearchCounter(phoneId);
    }

    function updateSearchCounter(phoneId) {
        const el = document.getElementById(`search_count_${phoneId}`);
        if (el) el.textContent = searchMatches.length ? `${searchIndex + 1}/${searchMatches.length}` : '';
    }

    function clearSearchHighlights(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        phone.querySelectorAll('.search-highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });
        searchMatches = [];
        searchIndex = -1;
    }

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
        toggleSearch, handleSearch, navigateSearch, clearSearchHighlights,
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
