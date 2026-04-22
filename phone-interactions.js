/**
 * SillyTavern Phone UI Extension — 交互处理
 * 处理搜索、语音展开、翻译展开、撤回查看、转账领取/退回
 */

const PhoneInteractions = (() => {

    // 待注入 AI 上下文的操作队列
    let pendingActions = [];

    /**
     * 搜索
     */
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
        if (!query.trim()) return;

        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;

        const rows = phone.querySelectorAll('[data-searchable]');
        let firstMatch = null;

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
                    if (!firstMatch) firstMatch = hl;
                }
            }
        });

        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function clearSearchHighlights(phoneId) {
        const phone = document.querySelector(`[data-phone-id="${phoneId}"]`);
        if (!phone) return;
        phone.querySelectorAll('.search-highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });
    }

    /**
     * 语音转文字
     */
    function toggleVoiceText(toggleEl) {
        const textEl = toggleEl.nextElementSibling;
        textEl.classList.toggle('expanded');
        toggleEl.textContent = textEl.classList.contains('expanded') ? '📝 收起' : '📝 转文字';
    }

    /**
     * 翻译
     */
    function toggleTranslation(toggleEl) {
        const contentEl = toggleEl.nextElementSibling;
        contentEl.classList.toggle('expanded');
        toggleEl.textContent = contentEl.classList.contains('expanded') ? '🌐 收起翻译' : '🌐 查看翻译';
    }

    /**
     * 撤回消息查看
     */
    function toggleRecall(viewEl) {
        const group = viewEl.closest('.st-phone-recall-group');
        const revealed = group.querySelector('.st-phone-recall-revealed');
        revealed.classList.toggle('visible');
        viewEl.textContent = revealed.classList.contains('visible') ? '收起' : '查看';
    }

    /**
     * 转账领取/退回
     */
    function handleTransfer(phoneId, transferId, action, fromName) {
        const card = document.querySelector(`[data-transfer-id="${transferId}"]`);
        if (!card) return;

        const statusEl = card.querySelector('.transfer-status');

        if (action === 'accept') {
            card.classList.add('accepted');
            statusEl.textContent = '✅ 已领取';
        } else {
            card.classList.add('declined');
            statusEl.textContent = '已退回';
        }

        // 在转账卡片后插入通知
        const msgRow = card.closest('.st-phone-msg-row');
        if (msgRow) {
            const notice = document.createElement('div');
            notice.className = 'st-phone-time-sep';
            const actionText = action === 'accept' ? '领取' : '退回';
            notice.innerHTML = `<span>你已${actionText}${fromName}的转账</span>`;
            msgRow.parentNode.insertBefore(notice, msgRow.nextSibling);
        }

        // 记录操作到 pending，等待 generate_interceptor 注入
        const actionDesc = action === 'accept'
            ? `用户已领取${fromName}的转账（¥${card.querySelector('.transfer-amount')?.textContent || ''}）`
            : `用户已退回${fromName}的转账`;

        pendingActions.push({
            type: 'transfer',
            transferId,
            action,
            from: fromName,
            desc: actionDesc,
        });

        // 也保存到 chatMetadata（如果在 ST 环境中）
        saveToChatMetadata(transferId, action);
    }

    /**
     * 保存到 chatMetadata
     */
    function saveToChatMetadata(transferId, action) {
        try {
            const ctx = SillyTavern.getContext();
            if (!ctx.chatMetadata.phone_actions) {
                ctx.chatMetadata.phone_actions = {};
            }
            ctx.chatMetadata.phone_actions[transferId] = action;
            ctx.saveMetadataDebounced();
        } catch (e) {
            // 非 ST 环境，忽略
        }
    }

    /**
     * 获取并清除待注入的操作
     */
    function consumePendingActions() {
        const actions = [...pendingActions];
        pendingActions = [];
        return actions;
    }

    /**
     * 获取 pending（不清除）
     */
    function getPendingActions() {
        return pendingActions;
    }

    /**
     * 自动滚动到底部
     */
    function scrollToBottom(phoneId) {
        const chat = document.getElementById(`chat_${phoneId}`);
        if (chat) {
            chat.scrollTop = chat.scrollHeight;
        }
    }

    /**
     * 所有手机自动滚底
     */
    function scrollAllToBottom() {
        document.querySelectorAll('.st-phone-chat').forEach(chat => {
            chat.scrollTop = chat.scrollHeight;
        });
    }

    return {
        toggleSearch, handleSearch,
        toggleVoiceText, toggleTranslation, toggleRecall,
        handleTransfer,
        consumePendingActions, getPendingActions,
        scrollToBottom, scrollAllToBottom,
    };
})();

if (typeof window !== 'undefined') {
    window.PhoneInteractions = PhoneInteractions;
}
