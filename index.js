/**
 * SillyTavern Phone UI Extension — 主入口
 * 绑定事件、渲染管线、generate_interceptor、表情包管理
 */

(function () {
    const MODULE_NAME = 'phone_ui';
    let themeLoadVersion = 0;
    let themeLoadPending = false;

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
                    show_composer_button: true,
                    char_stickers: {},
                    global_stickers: {},
                    char_avatars: {},
                    user_avatars: {},
                    chat_backgrounds: {},
                    char_themes: {},
                    global_theme_css: "",
                    char_avatar_map: {},
                    custom_themes: {},
                };
            }
            const settings = ctx.extensionSettings[MODULE_NAME];

            // 兼容旧版：如果还没有新字段就补上
            if (!settings.char_stickers) settings.char_stickers = {};
            if (!settings.global_stickers) settings.global_stickers = {};
            if (!settings.char_avatars) settings.char_avatars = {};
            if (!settings.chat_backgrounds) settings.chat_backgrounds = {};
            if (!settings.char_themes) settings.char_themes = {};
            if (!settings.char_avatar_map) settings.char_avatar_map = {};
            if (!settings.custom_themes) settings.custom_themes = {};
            if (typeof settings.global_theme_css !== 'string') settings.global_theme_css = "";
            if (settings.inject === undefined) settings.inject = true;
            if (settings.show_composer_button === undefined) settings.show_composer_button = true;

            const extensionFolderPath = `scripts/extensions/third-party/${FOLDER_NAME}`;

            try {
                await $.getScript(`${extensionFolderPath}/phone-parser.js`);
                await $.getScript(`${extensionFolderPath}/phone-renderer.js`);
                await $.getScript(`${extensionFolderPath}/phone-aggregator.js`);
                await $.getScript(`${extensionFolderPath}/phone-interactions.js`);
                await $.getScript(`${extensionFolderPath}/phone-live.js`);
                await $.getScript(`${extensionFolderPath}/phone-composer-layout.js`);
                await $.getScript(`${extensionFolderPath}/phone-composer.js`);
                await $.getScript(`${extensionFolderPath}/phone-themes.js`);
                PhoneThemes.configure(extensionFolderPath);
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

            // 监听酒馆发送与开始生成事件，自动清空小手机屏幕上的待发草稿气泡
            if (eventTypes.GENERATION_STARTED) {
                eventSource.on(eventTypes.GENERATION_STARTED, () => {
                    if (typeof PhoneComposer !== 'undefined' && PhoneComposer.clearDraft) {
                        PhoneComposer.clearDraft(false);
                    }
                });
            }
            $(document).on('click', '#send_but', () => {
                if (typeof PhoneComposer !== 'undefined' && PhoneComposer.clearDraft) {
                    PhoneComposer.clearDraft(false);
                }
            });

            // 初始化表情包与主题
            loadStickersForCurrentCharacter();
            loadThemeForCurrentCharacter();

            // 初始化输入伴侣
            if (typeof PhoneComposer !== 'undefined') {
                PhoneComposer.init(settings.show_composer_button);
            }

            renderAllExistingMessages();
            console.log('[Phone UI] Extension initialized');
        } catch (e) {
            console.warn('[Phone UI] Init error:', e);
        }
    }

    // ========== 设置面板 UI 绑定 ==========
    function bindSettingsUI(settings) {
        // 自适应明暗主题反色检测
        function updateSettingsThemeMode() {
            const $settings = $('#phone_ui_settings');
            if (!$settings.length) return;
            try {
                const target = $settings.closest('#extensions_settings, .inline-drawer, body')[0] || document.body;
                if (target) {
                    const comp = window.getComputedStyle(target);
                    const rgb = (comp.color || '').match(/\d+/g);
                    if (rgb && rgb.length >= 3) {
                        const lum = 0.299 * parseInt(rgb[0], 10) + 0.587 * parseInt(rgb[1], 10) + 0.114 * parseInt(rgb[2], 10);
                        if (lum < 128) {
                            $settings.addClass('pu-light-theme').removeClass('pu-dark-theme');
                            return;
                        }
                    }
                }
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                    $settings.addClass('pu-light-theme').removeClass('pu-dark-theme');
                } else {
                    $settings.addClass('pu-dark-theme').removeClass('pu-light-theme');
                }
            } catch (e) { }
        }

        updateSettingsThemeMode();
        $('#phone_ui_settings .inline-drawer-toggle').on('click', () => {
            setTimeout(updateSettingsThemeMode, 50);
        });

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

        const $showComposerButton = $('#phone_ui_show_composer_button');
        $showComposerButton.prop('checked', settings.show_composer_button);
        $showComposerButton.on('change', function () {
            settings.show_composer_button = !!$(this).prop('checked');
            PhoneComposer.setTriggerVisible(settings.show_composer_button);
            SillyTavern.getContext().saveSettingsDebounced();
        });

        // --- 头像和背景 ---
        $('#phone_ui_save_config').on('click', function () {
            const ctx = SillyTavern.getContext();
            const charName = ctx.name2 || '';
            if (!charName) { if (typeof toastr !== 'undefined') toastr.warning('请先选择角色', 'Phone UI'); return; }
            settings.char_avatars[charName] = $('#phone_ui_char_avatar').val().trim();
            if (!settings.user_avatars) settings.user_avatars = {};
            settings.user_avatars[charName] = $('#phone_ui_user_avatar').val().trim();
            settings.chat_backgrounds[charName] = $('#phone_ui_chat_bg').val().trim();
            ctx.saveSettingsDebounced();
            loadStickersForCurrentCharacter();
            renderAllExistingMessages();
            if (typeof toastr !== 'undefined') toastr.success('头像/背景配置已保存', 'Phone UI');
        });

        // --- 多角色头像映射 ---
        $('#phone_ui_save_avatar_map').on('click', function () {
            try {
                const ctx = SillyTavern.getContext();
                const charName = ctx.name2 || '';
                if (!charName) { if (typeof toastr !== 'undefined') toastr.warning('请先选择角色', 'Phone UI'); return; }
                const raw = $('#phone_ui_avatar_map').val().trim();
                const parsed = raw ? JSON.parse(raw) : {};
                settings.char_avatar_map[charName] = parsed;
                ctx.saveSettingsDebounced();
                loadStickersForCurrentCharacter();
                renderAllExistingMessages();
                if (typeof toastr !== 'undefined') toastr.success(`「${charName}」的多角色头像已保存 (${Object.keys(parsed).length} 个)`, 'Phone UI');
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error('JSON 格式有误，请检查！\n' + e.message, 'Phone UI');
            }
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

        // ========== 主题库与快捷切换 ==========
        updateThemeLibraryUI(settings);

        $('#phone_ui_theme_select').on('change', function () {
            cancelPendingThemeLoad();
            updateDeleteButtonState();
        });
        $('#phone_ui_char_theme_css, #phone_ui_global_theme_css').on('input', cancelPendingThemeLoad);

        // 快捷应用给当前角色
        $('#phone_ui_apply_to_char').on('click', function () {
            const ctx = SillyTavern.getContext();
            const charName = ctx.name2 || '';
            if (!charName) {
                if (typeof toastr !== 'undefined') toastr.warning('请先选择一个角色', 'Phone UI');
                return;
            }
            withSelectedTheme(settings, info => {
                settings.char_themes[charName] = info.css;
                ctx.saveSettingsDebounced();
                $('#phone_ui_char_theme_css').val(info.css);
                loadThemeForCurrentCharacter();
                if (typeof toastr !== 'undefined') toastr.success(`已将「${info.name}」应用给「${charName}」！`, 'Phone UI');
            });
        });

        // 快捷应用为全局默认
        $('#phone_ui_apply_to_global').on('click', function () {
            const ctx = SillyTavern.getContext();
            withSelectedTheme(settings, info => {
                settings.global_theme_css = info.css;
                ctx.saveSettingsDebounced();
                $('#phone_ui_global_theme_css').val(info.css);
                loadThemeForCurrentCharacter();
                if (typeof toastr !== 'undefined') toastr.success(`已将「${info.name}」设为全局默认主题！`, 'Phone UI');
            });
        });

        // 载入代码到编辑框
        $('#phone_ui_load_to_editor').on('click', function () {
            withSelectedTheme(settings, info => {
                $('#phone_ui_char_theme_css').val(info.css);
                if (typeof toastr !== 'undefined') toastr.info(`已载入「${info.name}」的代码到角色专属框，可直接修改编辑`, 'Phone UI');
            });
        });

        // 删除选中主题
        $('#phone_ui_delete_theme').on('click', function () {
            const selection = $('#phone_ui_theme_select').val() || '';
            if (!selection.startsWith('custom:')) {
                if (typeof toastr !== 'undefined') toastr.info('官方预设受系统保护，不可删除哦~', 'Phone UI');
                return;
            }
            const name = selection.slice('custom:'.length);
            const confirmed = confirm(`确定要从主题库中彻底删除「${name}」吗？\n删除后不可恢复。`);
            if (!confirmed) return;

            cancelPendingThemeLoad();
            delete settings.custom_themes[name];
            const ctx = SillyTavern.getContext();
            ctx.saveSettingsDebounced();
            updateThemeLibraryUI(settings, 'builtin:wechat');
            if (typeof toastr !== 'undefined') toastr.success(`已删除主题「${name}」`, 'Phone UI');
        });

        // 存入主题库逻辑
        function saveCssToLibrary(sourceSelector, defaultName) {
            const ctx = SillyTavern.getContext();
            const css = $(sourceSelector).val().trim();
            if (!css) {
                if (typeof toastr !== 'undefined') toastr.warning('输入框中没有 CSS 代码，请先粘贴或输入主题样式！', 'Phone UI');
                return;
            }
            const enteredName = prompt('请输入新主题的名称（如：赛博朋克、夏日海滩、黑金）：', defaultName || '');
            if (enteredName === null) return;
            const themeName = enteredName.trim();
            if (!themeName) {
                if (typeof toastr !== 'undefined') toastr.warning('主题名称不能为空！', 'Phone UI');
                return;
            }
            const lowerName = themeName.toLowerCase();
            if (PhoneThemes.isBuiltin(lowerName)) {
                if (typeof toastr !== 'undefined') toastr.warning('该名称与官方预设重名，请换一个个性名称哦~', 'Phone UI');
                return;
            }
            if (settings.custom_themes && settings.custom_themes[themeName]) {
                const overwrite = confirm(`已存在同名主题「${themeName}」，是否覆盖原有内容？`);
                if (!overwrite) return;
            }
            if (!settings.custom_themes) settings.custom_themes = {};
            settings.custom_themes[themeName] = css;
            ctx.saveSettingsDebounced();
            updateThemeLibraryUI(settings, `custom:${themeName}`);
            if (typeof toastr !== 'undefined') toastr.success(`主题「${themeName}」已存入主题库！只要不删除就永久保存。`, 'Phone UI');
        }

        $('#phone_ui_save_to_library_char').on('click', function () {
            const ctx = SillyTavern.getContext();
            const charName = ctx.name2 ? `${ctx.name2}专属` : '个性主题';
            saveCssToLibrary('#phone_ui_char_theme_css', charName);
        });

        $('#phone_ui_save_to_library_global').on('click', function () {
            saveCssToLibrary('#phone_ui_global_theme_css', '全局定制主题');
        });

        // 角色专属主题
        $('#phone_ui_save_char_theme').on('click', function () {
            const ctx = SillyTavern.getContext();
            const charName = ctx.name2 || '';
            if (!charName) {
                if (typeof toastr !== 'undefined') toastr.warning('请先选择一个角色', 'Phone UI');
                return;
            }
            const css = $('#phone_ui_char_theme_css').val().trim();
            settings.char_themes[charName] = css;
            ctx.saveSettingsDebounced();
            loadThemeForCurrentCharacter();
            if (typeof toastr !== 'undefined') toastr.success(`「${charName}」的主题已保存！`, 'Phone UI');
        });

        $('#phone_ui_export_char_theme').on('click', async function () {
            try {
                const ctx = SillyTavern.getContext();
                const charName = ctx.name2 || '';
                if (!charName) {
                    if (typeof toastr !== 'undefined') toastr.warning("请先选择一个角色", "Phone UI");
                    return;
                }
                const css = $('#phone_ui_char_theme_css').val().trim();
                if (!css) {
                    if (typeof toastr !== 'undefined') toastr.warning("没有可导出的主题代码", "Phone UI");
                    return;
                }
                await ctx.writeExtensionField(ctx.characterId, 'phone_theme_css', css);
                if (typeof toastr !== 'undefined') toastr.success(`已写入「${charName}」的角色卡\n导出角色卡时会自带这套主题`, "Phone UI");
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error("写入失败: " + e.message, "Phone UI");
            }
        });

        $('#phone_ui_save_global_theme').on('click', function () {
            const ctx = SillyTavern.getContext();
            const css = $('#phone_ui_global_theme_css').val().trim();
            settings.global_theme_css = css;
            ctx.saveSettingsDebounced();
            loadThemeForCurrentCharacter();
            if (typeof toastr !== 'undefined') toastr.success('全局主题已保存！', 'Phone UI');
        });

        $('#phone_ui_reset_theme').on('click', function () {
            const ctx = SillyTavern.getContext();
            settings.global_theme_css = '';
            ctx.saveSettingsDebounced();
            loadThemeForCurrentCharacter();
            if (typeof toastr !== 'undefined') toastr.info('全局主题已清空，恢复默认', 'Phone UI');
        });
    }

    function setThemeLoading(loading) {
        themeLoadPending = loading;
        $('#phone_ui_apply_to_char, #phone_ui_apply_to_global, #phone_ui_load_to_editor')
            .attr('aria-disabled', String(loading))
            .css('opacity', loading ? '0.6' : '');
        $('#phone_ui_theme_status').text(loading ? '正在读取主题…' : '').toggle(loading);
    }

    function cancelPendingThemeLoad() {
        themeLoadVersion++;
        setThemeLoading(false);
    }

    async function withSelectedTheme(settings, applySelection) {
        if (themeLoadPending) return;
        const selection = $('#phone_ui_theme_select').val() || '';
        const ctx = SillyTavern.getContext();
        const characterId = ctx.characterId;
        const characterName = ctx.name2;
        const version = ++themeLoadVersion;
        setThemeLoading(true);
        try {
            const info = await PhoneThemes.loadTheme(selection, settings.custom_themes || {});
            if (version !== themeLoadVersion || selection !== $('#phone_ui_theme_select').val()) return;
            const currentContext = SillyTavern.getContext();
            if (currentContext.characterId !== characterId || currentContext.name2 !== characterName) return;
            if (!info.css) {
                if (typeof toastr !== 'undefined') toastr.warning('选中的主题内容为空', 'Phone UI');
                return;
            }
            applySelection(info);
        } catch (error) {
            if (version === themeLoadVersion) {
                console.warn('[Phone UI] 主题读取失败:', error);
                if (typeof toastr !== 'undefined') toastr.error('主题读取失败，请重试。已保存的主题未更改。', 'Phone UI');
            }
        } finally {
            if (version === themeLoadVersion) setThemeLoading(false);
        }
    }

    function updateDeleteButtonState() {
        const val = $('#phone_ui_theme_select').val() || '';
        const $delBtn = $('#phone_ui_delete_theme');
        if (val.startsWith('custom:')) {
            $delBtn.css({ opacity: '1', cursor: 'pointer' });
        } else {
            $delBtn.css({ opacity: '0.5', cursor: 'not-allowed' });
        }
    }

    function updateThemeLibraryUI(settings, selectKeyToSelect) {
        const $select = $('#phone_ui_theme_select');
        if (!$select.length) return;

        const currentVal = selectKeyToSelect || $select.val() || 'builtin:wechat';
        const $builtinGroup = $('#phone_ui_builtin_themes_group');
        $builtinGroup.empty();
        for (const theme of PhoneThemes.listBuiltins()) {
            $builtinGroup.append($('<option>').val(`builtin:${theme.id}`).text(theme.name));
        }
        const $customGroup = $('#phone_ui_custom_themes_group');
        $customGroup.empty();

        const customThemes = settings.custom_themes || {};
        const customKeys = Object.keys(customThemes);

        if (customKeys.length > 0) {
            for (const name of customKeys) {
                $customGroup.append($('<option>').val(`custom:${name}`).text(name));
            }
        } else {
            $customGroup.append(`<option value="" disabled>(暂无自定义主题，可在下方保存)</option>`);
        }

        if (selectKeyToSelect) {
            $select.val(selectKeyToSelect);
        } else if (currentVal && $select.find('option').toArray().some(option => option.value === currentVal)) {
            $select.val(currentVal);
        } else {
            $select.val('builtin:wechat');
        }

        updateDeleteButtonState();
    }

    // ========== 主题加载 ==========
    function loadThemeForCurrentCharacter() {
        cancelPendingThemeLoad();
        try {
            const ctx = SillyTavern.getContext();
            const settings = ctx.extensionSettings[MODULE_NAME];
            const charName = ctx.name2 || '';

            const character = ctx.characters?.[ctx.characterId];
            const cssToApply = PhoneThemes.resolveCss(settings, charName, character);
            PhoneThemes.applyCss(cssToApply);

            if (typeof PhoneComposer !== 'undefined' && PhoneComposer.updateTheme) {
                PhoneComposer.updateTheme();
            }

            // 更新文本框
            $('#phone_ui_global_theme_css').val(settings.global_theme_css || '');
            if (charName) {
                $('#phone_ui_char_theme_css').val(settings.char_themes[charName] || '');
            } else {
                $('#phone_ui_char_theme_css').val('');
            }

            // 同步刷新主题库下拉列表
            updateThemeLibraryUI(settings);
        } catch (e) {
            console.warn('[Phone UI] 主题加载失败:', e);
        }
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

            // 3. 全局表情包 (若为空则自动预载内置 stickers.json)
            let globalStickerMap = settings.global_stickers || {};
            if (!Object.keys(globalStickerMap).length) {
                try {
                    const extensionFolderPath = `scripts/extensions/third-party/${FOLDER_NAME}`;
                    $.getJSON(`${extensionFolderPath}/stickers.json`, (data) => {
                        if (data && typeof data === 'object') {
                            settings.global_stickers = data;
                            if (typeof PhoneInteractions !== 'undefined') {
                                PhoneInteractions.setStickers(charStickers, data);
                            }
                            updateStickerUI(charName, charStickers, data);
                        }
                    });
                } catch (e) { }
            }

            // 4. 头像和背景配置
            const charAvatar = settings.char_avatars[charName] || '';
            // 用户头像：设置 > 酒馆默认persona头像 > 空
            let userAvatar = (settings.user_avatars && settings.user_avatars[charName]) || '';
            if (!userAvatar) {
                try {
                    const personaAvatar = document.querySelector('.mes[is_user="true"] .avatar img');
                    if (personaAvatar && personaAvatar.src) userAvatar = personaAvatar.src;
                } catch (e) { }
            }
            const chatBackground = settings.chat_backgrounds[charName] || '';

            // 设置到 PhoneInteractions
            if (typeof PhoneInteractions !== 'undefined') {
                PhoneInteractions.setStickers(charStickers, globalStickerMap);
                const charAvatarMap = (settings.char_avatar_map && settings.char_avatar_map[charName]) || {};
                PhoneInteractions.setConfig({ charAvatar, userAvatar, chatBackground, charAvatarMap });
            }

            // 更新设置面板 UI
            updateStickerUI(charName, charStickers, globalStickerMap);
            updateConfigUI(charName, charAvatar, userAvatar, chatBackground);
            updateAvatarMapUI(charName, settings);
        } catch (e) {
            console.warn('[Phone UI] 配置加载失败:', e);
        }
    }

    function updateAvatarMapUI(charName, settings) {
        const $area = $('#phone_ui_avatar_map');
        if (!$area.length) return;
        const map = (settings.char_avatar_map && settings.char_avatar_map[charName]) || {};
        $area.val(Object.keys(map).length ? JSON.stringify(map, null, 2) : '');
    }

    function updateConfigUI(charName, charAvatar, userAvatar, chatBackground) {
        $('#phone_ui_char_avatar').val(charAvatar);
        $('#phone_ui_user_avatar').val(userAvatar);
        $('#phone_ui_chat_bg').val(chatBackground);
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

    function hideMessageBlocks(mesTextEl, hasPhoneBlocks, hasLiveBlocks) {
        const textNodes = [];
        let text = '';
        const walker = document.createTreeWalker(mesTextEl, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return node.parentElement.closest('.st-phone-hidden, .st-phone[data-phone-id], .st-phone[data-live-id], script, style')
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT;
            },
        });
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push({ node, start: text.length, end: text.length + node.textContent.length });
            text += node.textContent;
        }

        const blockRegex = /(?:\[|&#91;)(phone|live)(?::[^\]]*?)?(?:\]|&#93;)[\s\S]*?(?:\[|&#91;)\/\1(?:\]|&#93;)/gi;
        const matches = [...text.matchAll(blockRegex)];
        for (const match of matches.reverse()) {
            const isPhone = match[1].toLowerCase() === 'phone';
            if (isPhone ? !hasPhoneBlocks : !hasLiveBlocks) continue;
            const startOffset = match.index;
            const endOffset = startOffset + match[0].length;
            const startNode = textNodes.find(entry => entry.end > startOffset);
            const endNode = textNodes.find(entry => entry.end >= endOffset);
            const range = document.createRange();
            range.setStart(startNode.node, startOffset - startNode.start);
            range.setEnd(endNode.node, endOffset - endNode.start);
            range.deleteContents();

            const placeholder = document.createElement('span');
            placeholder.className = 'st-phone-hidden';
            placeholder.hidden = true;
            placeholder.textContent = isPhone ? '[手机记录已渲染]' : '[直播间已渲染]';
            range.insertNode(placeholder);
        }
    }

    // ========== 消息渲染钩子 ==========
    function onMessageRendered(msgIndex) {
        const ctx = SillyTavern.getContext();
        const settings = ctx.extensionSettings[MODULE_NAME];

        if (settings && !settings.enabled) return;

        const chatMsg = ctx.chat[msgIndex];
        if (!chatMsg) return;

        // 预防报错：确认大脑已上线
        if (typeof PhoneParser === 'undefined') return;

        // 检查有没有 [phone] 块与 [live] 直播块
        const blocks = PhoneParser.extractPhoneBlocks(chatMsg.mes);
        const liveBlocks = PhoneParser.extractLiveBlocks ? PhoneParser.extractLiveBlocks(chatMsg.mes) : [];

        const mesEl = document.querySelector(`.mes[mesid="${msgIndex}"]`);
        if (!mesEl) return;
        const mesTextEl = mesEl.querySelector('.mes_text');
        if (!mesTextEl) return;

        const renderedPhones = mesTextEl.querySelectorAll(':scope > .st-phone[data-phone-id], :scope > .st-phone[data-live-id]');
        if (!blocks.length && !liveBlocks.length) {
            renderedPhones.forEach(element => element.remove());
            mesTextEl.querySelectorAll('.st-phone-hidden').forEach(element => element.remove());
            return;
        }

        console.log(`[Phone UI] 成功在第 ${msgIndex} 条消息抓取到手机/直播记录！`, { blocks, liveBlocks });

        let injectedPhonesHtml = '';

        // 3. 渲染 [phone] 即时通讯界面
        if (blocks.length > 0) {
            let savedActions = {};
            try {
                savedActions = ctx.chatMetadata.phone_actions || {};
            } catch (e) { }

            const mergedBlocks = new Map();
            for (const block of blocks) {
                const pov = PhoneAggregator.normalizePov(block.pov);
                const key = JSON.stringify([block.contact, pov]);
                const messages = block.messages.map(message => ({ ...message, pov }));
                if (mergedBlocks.has(key)) {
                    mergedBlocks.get(key).messages.push(...messages);
                } else {
                    mergedBlocks.set(key, { contact: block.contact, pov, messages });
                }
            }

            for (const [sessionKey, merged] of mergedBlocks) {
                const contactName = merged.contact;
                let phoneData;
                if (settings && settings.aggregate) {
                    phoneData = PhoneAggregator.aggregate(ctx.chat, msgIndex, contactName, merged.pov);
                } else {
                    phoneData = { contact: contactName, messages: merged.messages, actions: savedActions };
                }

                const phoneId = `p_${msgIndex}_${encodeURIComponent(sessionKey).replace(/'/g, '%27')}`;
                injectedPhonesHtml += PhoneRenderer.render(phoneData, phoneId);
            }
        }

        // 4. 渲染 [live] 沉浸式互动直播间界面 (复用手机伴侣完全一致的精致UI)
        if (liveBlocks.length > 0 && typeof PhoneRenderer !== 'undefined' && PhoneRenderer.renderLive) {
            for (let i = 0; i < liveBlocks.length; i++) {
                const liveData = liveBlocks[i];
                const liveId = `live_${msgIndex}_${i}`;
                injectedPhonesHtml += PhoneRenderer.renderLive(liveData, liveId);

                // 自动同步签名与开播状态至小手机伴侣，实现正文与伴侣两端实时对齐
                if (typeof PhoneComposer !== 'undefined') {
                    PhoneComposer.updateLiveState({
                        isLive: liveData.isLive,
                        time: liveData.time,
                        scene: liveData.scene,
                        talk: liveData.talk,
                        bio: liveData.bio,
                        viewers: liveData.viewers,
                        streamer: liveData.streamer,
                        sc: liveData.sc,
                    });
                }
            }
        }

        renderedPhones.forEach(element => element.remove());
        hideMessageBlocks(mesTextEl, blocks.length > 0, liveBlocks.length > 0);
        mesTextEl.insertAdjacentHTML('beforeend', injectedPhonesHtml);

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
        loadThemeForCurrentCharacter();
        if (typeof PhoneComposer !== 'undefined') {
            if (PhoneComposer.updateTheme) PhoneComposer.updateTheme();
            if (PhoneComposer.syncLiveStreamer) PhoneComposer.syncLiveStreamer('');
            if (PhoneComposer.updateContact) PhoneComposer.updateContact();
            if (PhoneComposer.clearDraft) PhoneComposer.clearDraft(false);
        }
        setTimeout(renderAllExistingMessages, 200);
    }

    // ========== generate_interceptor ==========
    globalThis.phoneUIInterceptor = async function (chat, contextSize, abort, type) {
        if (typeof PhoneInteractions === 'undefined') return;

        // 检查注入开关
        try {
            const ctx = SillyTavern.getContext();
            const settings = ctx.extensionSettings[MODULE_NAME];
            if (settings && settings.inject === false) return;
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
