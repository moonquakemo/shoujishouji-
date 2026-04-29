/**
 * SillyTavern Phone UI Extension — 主入口
 * 绑定事件、渲染管线、generate_interceptor
 */

(function () {
    const MODULE_NAME = 'phone_ui';

    // ⚠️ 宝贝，记得这里填你真实的 GitHub 仓库名！
    const FOLDER_NAME = 'shoujishouji-';

    // ========== 初始化 ==========
    async function init() {
        try {
            const ctx = SillyTavern.getContext();
            const { eventSource, eventTypes } = ctx;

            if (!ctx.extensionSettings[MODULE_NAME]) {
                ctx.extensionSettings[MODULE_NAME] = { enabled: true, aggregate: true, inject: true, stickers: "{}" };
            }
            const settings = ctx.extensionSettings[MODULE_NAME];

            const extensionFolderPath = `scripts/extensions/third-party/${FOLDER_NAME}`;

            // 🚀 【关键修复 1】主动把躺在文件夹里睡大觉的四个核心组件加载进来！
            try {
                await $.getScript(`${extensionFolderPath}/phone-parser.js`);
                await $.getScript(`${extensionFolderPath}/phone-renderer.js`);
                await $.getScript(`${extensionFolderPath}/phone-aggregator.js`);
                await $.getScript(`${extensionFolderPath}/phone-interactions.js`);
                console.log('[Phone UI] 核心组件加载成功！');
            } catch (scriptErr) {
                console.error('[Phone UI] 核心组件加载失败，请检查文件是否都在仓库里:', scriptErr);
                return; // 如果加载失败，强行退出防报错
            }

            // 加载设置面板
            try {
                const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
                $('#extensions_settings').append(settingsHtml);
                bindSettingsUI(settings, ctx);
            } catch (htmlErr) {
                console.error(`[Phone UI] 设置面板加载失败`, htmlErr);
            }

            // 监听事件
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
            eventSource.on(eventTypes.USER_MESSAGE_RENDERED, onMessageRendered);

            // 🚀 【新增】：监听"编辑消息"和"重新生成/打分更新"事件！
            if (eventTypes.MESSAGE_EDITED) eventSource.on(eventTypes.MESSAGE_EDITED, onMessageRendered);
            if (eventTypes.MESSAGE_UPDATED) eventSource.on(eventTypes.MESSAGE_UPDATED, onMessageRendered);

            eventSource.on(eventTypes.CHAT_CHANGED, onChatChanged);

            renderAllExistingMessages();
            console.log('[Phone UI] Extension initialized');
        } catch (e) {
            console.warn('[Phone UI] Init error:', e);
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

        if (settings && !settings.enabled) return;

        const chatMsg = ctx.chat[msgIndex];
        if (!chatMsg || !chatMsg.mes) return;

        // 预防报错：确认大脑已上线
        if (typeof PhoneParser === 'undefined') return;

        // 检查有没有 [phone] 块
        const blocks = PhoneParser.extractPhoneBlocks(chatMsg.mes);
        if (!blocks.length) return;

        console.log(`[Phone UI] 成功在第 ${msgIndex} 条消息抓取到手机记录！`, blocks);

        const mesEl = document.querySelector(`.mes[mesid="${msgIndex}"]`);
        if (!mesEl) return;
        const mesTextEl = mesEl.querySelector('.mes_text');
        if (!mesTextEl) return;

        let currentHtml = mesTextEl.innerHTML;

        // 🚀 【关键修复 2】兼容酒馆把 [ ] 转义成了 &#91; 或包裹了 <br> 的情况，把它切掉隐身
        const phoneRegexHtml = /(?:\[|&#91;)phone(?::[^\]]*)?(?:\]|&#93;)[\s\S]*?(?:\[|&#91;)\/phone(?:\]|&#93;)/gi;
        currentHtml = currentHtml.replace(phoneRegexHtml, '<div class="st-phone-hidden" style="display:none;">[手机记录已渲染]</div>');

        let injectedPhonesHtml = '';

        // 不管聚合开不开，都从 chatMetadata 读取已有的交互状态
        let savedActions = {};
        try {
            savedActions = ctx.chatMetadata.phone_actions || {};
        } catch (e) { }

        for (const block of blocks) {
            let phoneData;
            // 判断是否跨层聚合
            if (settings && settings.aggregate) {
                phoneData = PhoneAggregator.aggregate(ctx.chat, msgIndex, block.contact);
            } else {
                phoneData = { contact: block.contact, messages: block.messages, actions: savedActions };
            }

            const phoneId = `p_${msgIndex}_${block.contact.replace(/\s/g, '_')}`;
            injectedPhonesHtml += PhoneRenderer.render(phoneData, phoneId);
        }

        // 把清理干净的正文和生成的小手机拼在一起
        mesTextEl.innerHTML = currentHtml + injectedPhonesHtml;

        // 让手机聊天框自动滚底
        setTimeout(() => {
            if (typeof PhoneInteractions !== 'undefined') PhoneInteractions.scrollAllToBottom();
        }, 100);
    }

    // ========== 渲染已有消息 ==========
    function renderAllExistingMessages() {
        try {
            const ctx = SillyTavern.getContext();
            for (let i = 0; i < ctx.chat.length; i++) {
                onMessageRendered(i);
            }
        } catch (e) { }
    }

    function onChatChanged() {
        setTimeout(renderAllExistingMessages, 200);
    }

    // ========== generate_interceptor ==========
    globalThis.phoneUIInterceptor = async function (chat, contextSize, abort, type) {
        if (typeof PhoneInteractions === 'undefined') return;

        // 检查注入开关
        try {
            const ctx = SillyTavern.getContext();
            const settings = ctx.extensionSettings[MODULE_NAME];
            if (settings && !settings.inject) return;
        } catch (e) { }

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
                if (ctx.eventTypes.GENERATION_STOPPED) {
                    ctx.eventSource.removeListener(ctx.eventTypes.GENERATION_STOPPED, cleanup);
                }
            };
            ctx.eventSource.on(ctx.eventTypes.GENERATION_ENDED, cleanup);
            // 生成被中断时也要清理，防止系统消息永久残留
            if (ctx.eventTypes.GENERATION_STOPPED) {
                ctx.eventSource.on(ctx.eventTypes.GENERATION_STOPPED, cleanup);
            }
        } catch (e) { }
    };

    if (typeof jQuery !== 'undefined') {
        jQuery(async () => { init(); });
    } else if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', init);
    }
})();