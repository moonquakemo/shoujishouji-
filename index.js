/**
 * SillyTavern Phone UI Extension — 主入口
 * 绑定事件、渲染管线、generate_interceptor
 */

(function () {
    const MODULE_NAME = 'phone_ui';
    
    // ⚠️ 宝贝，把这里换成你 GitHub 仓库的真实名字！(比如 'my-st-phone-test')
    const FOLDER_NAME = 'shoujishouji-'; 

    // ========== 初始化 ==========
    async function init() {
        try {
            const ctx = SillyTavern.getContext();
            const { eventSource, eventTypes } = ctx;

            // 1. 初始化或读取持久化设置
            if (!ctx.extensionSettings[MODULE_NAME]) {
                ctx.extensionSettings[MODULE_NAME] = { enabled: true, aggregate: true, inject: true, stickers: "{}" };
            }
            const settings = ctx.extensionSettings[MODULE_NAME];

            // 2. 加载设置面板 HTML (暴力拉取大法)
            const extensionFolderPath = `scripts/extensions/third-party/${FOLDER_NAME}`;
            try {
                const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
                $('#extensions_settings').append(settingsHtml);
                bindSettingsUI(settings, ctx);
                console.log('[Phone UI] 设置面板挂载成功！');
            } catch (htmlErr) {
                console.error(`[Phone UI] 设置面板加载失败！路径: ${extensionFolderPath}/settings.html`, htmlErr);
            }

            // 3. 监听事件
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
            eventSource.on(eventTypes.USER_MESSAGE_RENDERED, onMessageRendered);
            eventSource.on(eventTypes.CHAT_CHANGED, onChatChanged);

            // 初次加载：渲染已有消息
            renderAllExistingMessages();
            console.log('[Phone UI] Extension initialized');
        } catch (e) {
            console.warn('[Phone UI] Not in SillyTavern environment, standalone mode', e);
        }
    }

    // ========== 设置面板 UI 绑定 ==========
    function bindSettingsUI(settings, ctx) {
        const $enabled = $('#phone_ui_enabled');
        $enabled.prop('checked', settings.enabled);
        $enabled.on('change', function () {
            settings.enabled = !!$(this).prop('checked');
            ctx.saveSettingsDebounced();
            renderAllExistingMessages();
        });

        const $aggregate = $('#phone_ui_aggregate');
        $aggregate.prop('checked', settings.aggregate);
        $aggregate.on('change', function () {
            settings.aggregate = !!$(this).prop('checked');
            ctx.saveSettingsDebounced();
            renderAllExistingMessages();
        });

        const $inject = $('#phone_ui_inject');
        $inject.prop('checked', settings.inject);
        $inject.on('change', function () {
            settings.inject = !!$(this).prop('checked');
            ctx.saveSettingsDebounced();
        });

        const $stickers = $('#phone_ui_stickers');
        $stickers.val(settings.stickers || "");
        $('#phone_ui_save_stickers').on('click', function () {
            settings.stickers = $stickers.val();
            ctx.saveSettingsDebounced();
            if (typeof toastr !== 'undefined') toastr.success("表情包配置已保存", "Phone UI");
        });
    }

    // ========== 消息渲染钩子 ==========
    function onMessageRendered(msgIndex) {
        const ctx = SillyTavern.getContext();
        const settings = ctx.extensionSettings[MODULE_NAME];
        
        // 检查开关
        if (settings && !settings.enabled) return;

        const chatMsg = ctx.chat[msgIndex];
        if (!chatMsg || !chatMsg.mes) return;

        const blocks = PhoneParser.extractPhoneBlocks(chatMsg.mes);
        if (!blocks.length) return;

        const mesEl = document.querySelector(`.mes[mesid="${msgIndex}"]`);
        if (!mesEl) return;
        const mesTextEl = mesEl.querySelector('.mes_text');
        if (!mesTextEl) return;

        for (const block of blocks) {
            const aggregated = PhoneAggregator.aggregate(ctx.chat, msgIndex, block.contact);
            const phoneId = `p_${msgIndex}_${block.contact.replace(/\s/g, '_')}`;
            const html = PhoneRenderer.render(aggregated, phoneId);

            const rawEscaped = escapeRegExp(block.raw);
            const currentHtml = mesTextEl.innerHTML;
            mesTextEl.innerHTML = currentHtml + html;

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
        } catch (e) {}
    }

    // ========== 聊天切换 ==========
    function onChatChanged() {
        setTimeout(renderAllExistingMessages, 200);
    }

    // ========== generate_interceptor ==========
    globalThis.phoneUIInterceptor = async function (chat, contextSize, abort, type) {
        const pending = PhoneInteractions.consumePendingActions();
        if (!pending.length) return;

        const injectionText = pending.map(a => `[用户手机操作: ${a.desc}]`).join('\n');
        const systemNote = {
            is_user: false,
            name: 'System',
            mes: injectionText,
            is_system: true,
            extra: { type: 'phone_ui_injection' },
        };

        let insertIdx = chat.length - 1;
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) {
                insertIdx = i;
                break;
            }
        }

        chat.splice(insertIdx, 0, systemNote);
        systemNote._phoneUIInjection = true;

        try {
            const ctx = SillyTavern.getContext();
            const cleanup = () => {
                const idx = chat.findIndex(m => m._phoneUIInjection);
                if (idx !== -1) chat.splice(idx, 1);
                ctx.eventSource.removeListener(ctx.eventTypes.GENERATION_ENDED, cleanup);
            };
            ctx.eventSource.on(ctx.eventTypes.GENERATION_ENDED, cleanup);
        } catch (e) {}
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
