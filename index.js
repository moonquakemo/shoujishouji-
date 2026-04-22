/**
 * SillyTavern Phone UI Extension — 主入口
 * 绑定事件、渲染管线、generate_interceptor
 */

// 加载依赖模块（通过 <script> 标签顺序加载）
// phone-parser.js, phone-renderer.js, phone-aggregator.js, phone-interactions.js
// 都挂在 window 上

(function () {
    const MODULE_NAME = 'phone_ui';

    // ========== 初始化 ==========
    function init() {
        try {
            const ctx = SillyTavern.getContext();
            const { eventSource, eventTypes } = ctx;

            // 监听消息渲染事件
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
            eventSource.on(eventTypes.USER_MESSAGE_RENDERED, onMessageRendered);

            // 聊天切换时重置
            eventSource.on(eventTypes.CHAT_CHANGED, onChatChanged);

            // 初次加载：渲染已有消息
            renderAllExistingMessages();

            console.log('[Phone UI] Extension initialized');
        } catch (e) {
            console.warn('[Phone UI] Not in SillyTavern environment, standalone mode');
        }
    }

    // ========== 消息渲染钩子 ==========
    function onMessageRendered(msgIndex) {
        const ctx = SillyTavern.getContext();
        const chatMsg = ctx.chat[msgIndex];
        if (!chatMsg || !chatMsg.mes) return;

        // 检查是否包含 [phone] 标记
        const blocks = PhoneParser.extractPhoneBlocks(chatMsg.mes);
        if (!blocks.length) return;

        // 找到对应的 DOM 元素
        const mesEl = document.querySelector(`.mes[mesid="${msgIndex}"]`);
        if (!mesEl) return;
        const mesTextEl = mesEl.querySelector('.mes_text');
        if (!mesTextEl) return;

        // 对每个 phone block 进行跨层聚合 + 渲染
        for (const block of blocks) {
            const aggregated = PhoneAggregator.aggregate(ctx.chat, msgIndex, block.contact);
            const phoneId = `p_${msgIndex}_${block.contact.replace(/\s/g, '_')}`;
            const html = PhoneRenderer.render(aggregated, phoneId);

            // 替换原始标记文本为渲染后的 HTML
            const rawEscaped = escapeRegExp(block.raw);
            // 在 mes_text 中找到并替换
            const currentHtml = mesTextEl.innerHTML;
            // 找到标记对应的文本（可能被 ST 的 messageFormatting 处理过）
            // 最安全的方式：在 innerHTML 末尾追加手机 UI，并隐藏原始标记
            mesTextEl.innerHTML = currentHtml + html;

            // 渲染后自动滚到底部
            setTimeout(() => PhoneInteractions.scrollToBottom(phoneId), 50);
        }
    }

    // ========== 渲染已有消息 ==========
    function renderAllExistingMessages() {
        try {
            const ctx = SillyTavern.getContext();
            for (let i = 0; i < ctx.chat.length; i++) {
                onMessageRendered(i);
            }
        } catch (e) {
            // 忽略
        }
    }

    // ========== 聊天切换 ==========
    function onChatChanged() {
        // 重新渲染新聊天中的手机 UI
        setTimeout(renderAllExistingMessages, 200);
    }

    // ========== generate_interceptor ==========
    // 在 AI 生成前注入用户的手机交互操作
    globalThis.phoneUIInterceptor = async function (chat, contextSize, abort, type) {
        const pending = PhoneInteractions.consumePendingActions();
        if (!pending.length) return;

        // 构建注入文本
        const injectionText = pending.map(a => `[用户手机操作: ${a.desc}]`).join('\n');

        // 作为系统消息插入到最后一条用户消息之前
        const systemNote = {
            is_user: false,
            name: 'System',
            mes: injectionText,
            is_system: true,
            extra: { type: 'phone_ui_injection' },
        };

        // 找到最后一条用户消息的位置
        let insertIdx = chat.length - 1;
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) {
                insertIdx = i;
                break;
            }
        }

        // 使用 structuredClone 避免永久修改
        // 实际上我们希望这个注入是临时的，不保存到聊天记录
        // 但 generate_interceptor 的修改会反映到 chat[]
        // 所以我们在生成结束后需要移除它
        chat.splice(insertIdx, 0, systemNote);

        // 标记以便后续清理
        systemNote._phoneUIInjection = true;

        // 监听生成结束后清理
        try {
            const ctx = SillyTavern.getContext();
            const cleanup = () => {
                const idx = chat.findIndex(m => m._phoneUIInjection);
                if (idx !== -1) chat.splice(idx, 1);
                ctx.eventSource.removeListener(ctx.eventTypes.GENERATION_ENDED, cleanup);
            };
            ctx.eventSource.on(ctx.eventTypes.GENERATION_ENDED, cleanup);
        } catch (e) {
            // fallback: 不清理（消息会留在 chat 中）
        }
    };

    // ========== 工具函数 ==========
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ========== 启动 ==========
    if (typeof jQuery !== 'undefined') {
        jQuery(async () => { init(); });
    } else if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
