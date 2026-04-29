/**
 * SillyTavern Phone UI Extension — 主入口
 * 绑定事件、渲染管线、generate_interceptor、表情包管理
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
                ctx.extensionSettings[MODULE_NAME] = {
                    enabled: true,
                    aggregate: true,
                    inject: true,
                    char_stickers: {},
                    global_stickers: {},
                };
            }
            const settings = ctx.extensionSettings[MODULE_NAME];

            // 兼容旧版：如果还没有新字段就补上
            if (!settings.char_stickers) settings.char_stickers = {};
            if (!settings.global_stickers) settings.global_stickers = {};

            const extensionFolderPath = `scripts/extensions/third-party/${FOLDER_NAME}`;

            // 🚀 主动加载四个核心组件
            try {
                await $.getScript(`${extensionFolderPath}/phone-parser.js`);
                await $.getScript(`${extensionFolderPath}/phone-renderer.js`);
                await $.getScript(`${extensionFolderPath}/phone-aggregator.js`);
                await $.getScript(`${extensionFolderPath}/phone-interactions.js`);
                console.log('[Phone UI] 核心组件加载成功！');
            } catch (scriptErr) {
                console.error('[Phone UI] 核心组件加载失败，请检查文件是否都在仓库里:', scriptErr);
                return;
            }

            // 加载设置面板
            try {
                const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
                $('#extensions_settings').append(settingsHtml);
                bindSettingsUI(settings);
            } catch (htmlErr) {
                console.error(`[Phone UI] 设置面板加载失败`, htmlErr);
            }

            // 监听事件
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
            eventSource.on(eventTypes.USER_MESSAGE_RENDERED, onMessageRendered);

            // 监听"编辑消息"和"重新生成/打分更新"事件
            if (eventTypes.MESSAGE_EDITED) eventSource.on(eventTypes.MESSAGE_EDITED, onMessageRendered);
            if (eventTypes.MESSAGE_UPDATED) eventSource.on(eventTypes.MESSAGE_UPDATED, onMessageRendered);

            eventSource.on(eventTypes.CHAT_CHANGED, onChatChanged);

            // 初始化表情包
            loadStickersForCurrentCharacter();

            renderAllExistingMessages();
            console.log('[Phone UI] Extension initialized');
        } catch (e) {
            console.warn('[Phone UI] Init error:', e);
        }
    }

    // ========== 设置面板 UI 绑定 ==========
    function bindSettingsUI(settings) {
        // --- 基础开关 ---
        const $enabled = $('#phone_ui_enabled');
        $enabled.prop('checked', settings.enabled);
        $enabled.on('change', function () {
            settings.enabled = !!$(this).prop('checked');
            SillyTavern.getContext().saveSettingsDebounced();
            renderAllExistingMessages();
        });

        const $aggregate = $('#phone_ui_aggregate');
        $aggregate.prop('checked', settings.aggregate);
        $aggregate.on('change', function () {
            settings.aggregate = !!$(this).prop('checked');
            SillyTavern.getContext().saveSettingsDebounced();
            renderAllExistingMessages();
        });

        const $inject = $('#phone_ui_inject');
        $inject.prop('checked', settings.inject);
        $inject.on('change', function () {
            settings.inject = !!$(this).prop('checked');
            SillyTavern.getContext().saveSettingsDebounced();
        });

        // --- 角色专属表情包 ---
        $('#phone_ui_save_char_stickers').on('click', function () {
            try {
                const ctx = SillyTavern.getContext();
                const charName = ctx.name2 || '';
                if (!charName) {
                    if (typeof toastr !== 'undefined') toastr.warning("请先选择一个角色", "Phone UI");
                    return;
                }
                const raw = $('#phone_ui_char_stickers').val().trim();
                const parsed = raw ? JSON.parse(raw) : {};
                settings.char_stickers[charName] = parsed;
                ctx.saveSettingsDebounced();
                if (typeof PhoneInteractions !== 'undefined') {
                    PhoneInteractions.setStickers(parsed, settings.global_stickers || {});
                }
                renderAllExistingMessages();
                if (typeof toastr !== 'undefined') toastr.success(`「${charName}」的表情包已保存 (${Object.keys(parsed).length} 个)`, "Phone UI");
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error("JSON 格式有误，请检查！\n" + e.message, "Phone UI");
            }
        });

        // --- 写入角色卡 ---
        $('#phone_ui_export_char_stickers').on('click', async function () {
            try {
                const ctx = SillyTavern.getContext();
                const charName = ctx.name2 || '';
                if (!charName) {
                    if (typeof toastr !== 'undefined') toastr.warning("请先选择一个角色", "Phone UI");
                    return;
                }
                const raw = $('#phone_ui_char_stickers').val().trim();
                const parsed = raw ? JSON.parse(raw) : {};
                await ctx.writeExtensionField(ctx.characterId, 'phone_sticker_pack', parsed);
                if (typeof toastr !== 'undefined') toastr.success(`已写入「${charName}」的角色卡\n导出角色卡时会自带这套表情包`, "Phone UI");
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error("写入失败: " + e.message, "Phone UI");
            }
        });

        // --- 全局表情包 ---
        $('#phone_ui_save_global_stickers').on('click', function () {
            try {
                const ctx = SillyTavern.getContext();
                const raw = $('#phone_ui_global_stickers').val().trim();
                const parsed = raw ? JSON.parse(raw) : {};
                settings.global_stickers = parsed;
                ctx.saveSettingsDebounced();
                const charName = ctx.name2 || '';
                if (typeof PhoneInteractions !== 'undefined') {
                    PhoneInteractions.setStickers(settings.char_stickers[charName] || {}, parsed);
                }
                renderAllExistingMessages();
                if (typeof toastr !== 'undefined') toastr.success(`全局表情包已保存 (${Object.keys(parsed).length} 个)`, "Phone UI");
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error("JSON 格式有误，请检查！\n" + e.message, "Phone UI");
            }
        });
    }

    // ========== 表情包加载 ==========
    function loadStickersForCurrentCharacter() {
        try {
            const ctx = SillyTavern.getContext();
            const settings = ctx.extensionSettings[MODULE_NAME];
            const charName = ctx.name2 || '';

            // 1. 优先从角色卡的 extension data 读取
            let charStickers = {};
            try {
                const charData = ctx.characters[ctx.characterId];
                if (charData?.data?.extensions?.phone_sticker_pack) {
                    charStickers = charData.data.extensions.phone_sticker_pack;
                }
            } catch (e) { }

            // 2. 扩展设置中的角色配置覆盖角色卡数据
            if (settings.char_stickers[charName] && Object.keys(settings.char_stickers[charName]).length) {
                charStickers = settings.char_stickers[charName];
            }

            // 3. 全局表情包
            const globalStickerMap = settings.global_stickers || {};

            // 设置到 PhoneInteractions
            if (typeof PhoneInteractions !== 'undefined') {
                PhoneInteractions.setStickers(charStickers, globalStickerMap);
            }

            // 更新设置面板 UI
            updateStickerUI(charName, charStickers, globalStickerMap);
        } catch (e) {
            console.warn('[Phone UI] 表情包加载失败:', e);
        }
    }

    function updateStickerUI(charName, charStickers, globalStickers) {
        const $charName = $('#phone_ui_char_name');
        if ($charName.length) $charName.text(charName || '-');

        const $charArea = $('#phone_ui_char_stickers');
        if ($charArea.length) {
            $charArea.val(Object.keys(charStickers).length ? JSON.stringify(charStickers, null, 2) : '');
        }

        const $globalArea = $('#phone_ui_global_stickers');
        if ($globalArea.length) {
            $globalArea.val(Object.keys(globalStickers).length ? JSON.stringify(globalStickers, null, 2) : '');
        }
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

        // 兼容酒馆把 [ ] 转义成了 &#91; 或包裹了 <br> 的情况
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
            if (settings && settings.aggregate) {
                phoneData = PhoneAggregator.aggregate(ctx.chat, msgIndex, block.contact);
            } else {
                phoneData = { contact: block.contact, messages: block.messages, actions: savedActions };
            }

            const phoneId = `p_${msgIndex}_${block.contact.replace(/\s/g, '_')}`;
            injectedPhonesHtml += PhoneRenderer.render(phoneData, phoneId);
        }

        mesTextEl.innerHTML = currentHtml + injectedPhonesHtml;

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
        loadStickersForCurrentCharacter();
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