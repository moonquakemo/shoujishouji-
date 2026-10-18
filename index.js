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

            const extensionFolderPath = `scripts/extensions/third-party/${FOLDER_NAME}`;

            // 🚀 主动加载五个核心组件
            try {
                await $.getScript(`${extensionFolderPath}/phone-parser.js`);
                await $.getScript(`${extensionFolderPath}/phone-renderer.js`);
                await $.getScript(`${extensionFolderPath}/phone-aggregator.js`);
                await $.getScript(`${extensionFolderPath}/phone-interactions.js`);
                await $.getScript(`${extensionFolderPath}/phone-composer.js`);
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
                PhoneComposer.init();
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
            updateDeleteButtonState();
        });

        // 快捷应用给当前角色
        $('#phone_ui_apply_to_char').on('click', function () {
            const ctx = SillyTavern.getContext();
            const charName = ctx.name2 || '';
            if (!charName) {
                if (typeof toastr !== 'undefined') toastr.warning('请先选择一个角色', 'Phone UI');
                return;
            }
            const info = getSelectedThemeInfo(settings);
            if (!info.css) {
                if (typeof toastr !== 'undefined') toastr.warning('选中的主题内容为空', 'Phone UI');
                return;
            }
            settings.char_themes[charName] = info.css;
            ctx.saveSettingsDebounced();
            $('#phone_ui_char_theme_css').val(info.css);
            loadThemeForCurrentCharacter();
            if (typeof toastr !== 'undefined') toastr.success(`已将「${info.name}」应用给「${charName}」！`, 'Phone UI');
        });

        // 快捷应用为全局默认
        $('#phone_ui_apply_to_global').on('click', function () {
            const ctx = SillyTavern.getContext();
            const info = getSelectedThemeInfo(settings);
            if (!info.css) {
                if (typeof toastr !== 'undefined') toastr.warning('选中的主题内容为空', 'Phone UI');
                return;
            }
            settings.global_theme_css = info.css;
            ctx.saveSettingsDebounced();
            $('#phone_ui_global_theme_css').val(info.css);
            loadThemeForCurrentCharacter();
            if (typeof toastr !== 'undefined') toastr.success(`已将「${info.name}」设为全局默认主题！`, 'Phone UI');
        });

        // 载入代码到编辑框
        $('#phone_ui_load_to_editor').on('click', function () {
            const info = getSelectedThemeInfo(settings);
            if (!info.css) {
                if (typeof toastr !== 'undefined') toastr.warning('选中的主题内容为空', 'Phone UI');
                return;
            }
            $('#phone_ui_char_theme_css').val(info.css);
            if (typeof toastr !== 'undefined') toastr.info(`已载入「${info.name}」的代码到角色专属框，可直接修改编辑`, 'Phone UI');
        });

        // 删除选中主题
        $('#phone_ui_delete_theme').on('click', function () {
            const info = getSelectedThemeInfo(settings);
            if (!info.isCustom) {
                if (typeof toastr !== 'undefined') toastr.info('官方预设受系统保护，不可删除哦~', 'Phone UI');
                return;
            }
            const confirmed = confirm(`确定要从主题库中彻底删除「${info.name}」吗？\n删除后不可恢复。`);
            if (!confirmed) return;

            delete settings.custom_themes[info.name];
            const ctx = SillyTavern.getContext();
            ctx.saveSettingsDebounced();
            updateThemeLibraryUI(settings, 'builtin:wechat');
            if (typeof toastr !== 'undefined') toastr.success(`已删除主题「${info.name}」`, 'Phone UI');
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
            if (BUILTIN_THEMES[lowerName] || ['wechat', 'sakura', 'kakaotalk', 'whatsapp'].includes(lowerName)) {
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

    // ========== 内置官方预设主题 ==========
    const BUILTIN_THEMES = {
        'wechat': {
            name: 'WeChat (微信风格)',
            css: `:root {
  /* Phone Shell */
  --phone-bg: #0a0a0f;
  --phone-border: rgba(255, 255, 255, 0.06);
  --phone-chat-bg: #f5f5f7;

  /* Navbar */
  --navbar-bg: #1a1a2e;
  --navbar-text: #fff;
  --navbar-icon-fill: #fff;

  /* Bubbles */
  --bubble-other-bg: #ffffff;
  --bubble-other-text: #1a1a1a;
  --bubble-me-bg: linear-gradient(135deg, #95ec69, #69d946);
  --bubble-me-text: #1a1a1a;
  --bubble-radius: 20px;

  /* Avatar */
  --avatar-other-bg: linear-gradient(135deg, #667eea, #764ba2);
  --avatar-me-bg: linear-gradient(135deg, #07c160, #34d058);
  --avatar-text: #fff;
  --avatar-size: 36px;

  /* Accent */
  --accent-blue: #576b95;
  --accent-green: #07c160;
  --accent-orange: #ee7b30;
  --accent-red: #fa5151;

  /* Input Bar */
  --inputbar-bg: #f7f7f8;
  --inputbar-border-top: rgba(0, 0, 0, 0.06);
  --input-bg: #fff;
  --input-border: rgba(0, 0, 0, 0.08);
  --input-text: #333;
  --input-placeholder: #ccc;
  --input-icon-fill: #333;
  --input-radius: 20px;

  /* Cards */
  --transfer-bg: linear-gradient(135deg, #fff3e0, #ffe8cc);
  --transfer-border: rgba(238, 123, 48, 0.15);
  --transfer-label-color: #8a6a3a;
  --media-bg: linear-gradient(135deg, #fff3e0, #ffe8cc);
  --media-border: rgba(238, 123, 48, 0.15);
  --media-desc-color: #555;
  --location-bg: #fff;
  --location-map-bg: linear-gradient(135deg, #e8f5e9, #c8e6c9);

  /* Typography */
  --font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
}`
        },
        'sakura': {
            name: 'Sakura Breeze (樱花粉)',
            css: `:root {
  /* ===== 手机外壳 ===== */
  --phone-bg: #fff0f5;
  --phone-border: rgba(255, 183, 197, 0.4);
  --phone-chat-bg: #fff0f5;
  --phone-radius: 32px;

  /* ===== 状态栏 & 导航栏 ===== */
  --navbar-bg: #ffcdd2;
  --navbar-text: #5a4a4d;
  --navbar-icon-fill: #5a4a4d;

  /* ===== 聊天气泡 ===== */
  --bubble-other-bg: #f3e8ff;
  --bubble-other-text: #4a3f4e;
  --bubble-me-bg: #ffe4e1;
  --bubble-me-text: #5a4a4d;
  --bubble-radius: 20px;

  /* ===== 头像 ===== */
  --avatar-other-bg: linear-gradient(135deg, #d8b4e2, #a87eb6); 
  --avatar-me-bg: linear-gradient(135deg, #ff9eaf, #ffb7c5);    
  --avatar-text: #fff;
  --avatar-size: 36px;

  /* ===== 强调色 ===== */
  --accent-blue: #9370db;               
  --accent-green: #ffb7c5;              
  --accent-orange: #ffb6b9;
  --accent-red: #ff7e82;

  /* ===== 输入栏 ===== */
  --inputbar-bg: #ffcdd2;
  --inputbar-border-top: transparent; 
  --input-bg: #fff0f5;
  --input-border: transparent;          
  --input-text: #5a4a4d;
  --input-placeholder: #bbaeb0;
  --input-icon-fill: #5a4a4d;
  --input-radius: 20px;

  /* ===== 转账卡片 ===== */
  --transfer-bg: #ffffff;
  --transfer-border: rgba(255, 183, 197, 0.5);
  --transfer-label-color: #ff9eaf;

  /* ===== 位置卡片 ===== */
  --location-bg: #fff;
  --location-map-bg: linear-gradient(135deg, #fff0f5, #f3e8ff);
  --location-name-color: #5a4a4d;
  --location-addr-color: #999;

  /* ===== 时间分隔线 ===== */
  --time-sep-bg: rgba(255, 183, 197, 0.2); 
  --time-sep-text: #a89498;

  /* ===== 其他文字颜色 ===== */
  --msg-time-color: #bbaeb0;               
  --quote-bg: rgba(255, 255, 255, 0.5);
  --quote-text: #887a7d;
  --recall-text: #bbaeb0;
  --voice-wave-color: rgba(255, 183, 197, 0.8);
  --voice-duration-color: #a89498;

  /* ===== 发送按钮 ===== */
  --send-buffer-bg: #fff0f5;
  --send-buffer-text: #ff9eaf;
  --send-final-bg: #ffb7c5;
  --send-final-text: #ffffff;           
  --preview-opacity: 0.7;
  --preview-border: rgba(255, 183, 197, 0.6);
  --sent-border: rgba(255, 183, 197, 0.4);
}`
        },
        'kakaotalk': {
            name: 'KakaoTalk (经典黄)',
            css: `:root {
  /* ===== 手机外壳 ===== */
  --phone-bg: #000000;
  --phone-border: rgba(255,255,255,0.08);
  --phone-chat-bg: #b2c7d9;
  --phone-radius: 32px;

  /* ===== 状态栏 & 导航栏 ===== */
  --navbar-bg: #b2c7d9;
  --navbar-text: #1a1a1a;
  --navbar-icon-fill: #1a1a1a;

  /* ===== 聊天气泡 ===== */
  --bubble-other-bg: #ffffff;
  --bubble-other-text: #1a1a1a;
  --bubble-me-bg: #fee500;
  --bubble-me-text: #1a1a1a;
  --bubble-radius: 12px;

  /* ===== 头像 ===== */
  --avatar-other-bg: linear-gradient(135deg, #a8a8a8, #888888); 
  --avatar-me-bg: linear-gradient(135deg, #fee500, #f1d900);    
  --avatar-text: #fff;
  --avatar-size: 36px;

  /* ===== 强调色 ===== */
  --accent-blue: #4a88ce;
  --accent-green: #fee500;
  --accent-orange: #f4a100;
  --accent-red: #ff3b30;

  /* ===== 输入栏 ===== */
  --inputbar-bg: #ffffff;
  --inputbar-border-top: rgba(0,0,0,0.06); 
  --input-bg: #f5f5f5;
  --input-border: transparent;
  --input-text: #333;
  --input-placeholder: #aaa;
  --input-icon-fill: #555;
  --input-radius: 20px;

  /* ===== 转账卡片 ===== */
  --transfer-bg: #ffffff;
  --transfer-border: rgba(0,0,0,0.06);
  --transfer-label-color: #f4a100;

  /* ===== 表情包 & 媒体卡片 ===== */
  --media-bg: #ffffff;
  --media-border: rgba(0,0,0,0.06);
  --media-desc-color: #555;
  --media-scrollbar: rgba(0,0,0,0.15);

  /* ===== 位置卡片 ===== */
  --location-bg: #fff;
  --location-map-bg: linear-gradient(135deg, #f0f0f0, #e0e0e0);
  --location-name-color: #1a1a1a;
  --location-addr-color: #999;

  /* ===== 时间分隔线 ===== */
  --time-sep-bg: rgba(0,0,0,0.12);
  --time-sep-text: #ffffff;

  /* ===== 其他文字颜色 ===== */
  --msg-time-color: #666;
  --quote-bg: rgba(0,0,0,0.05);
  --quote-text: #777;
  --recall-text: #888;
  --voice-wave-color: rgba(0,0,0,0.3);
  --voice-duration-color: rgba(0,0,0,0.6);

  /* ===== 发送按钮 ===== */
  --send-buffer-bg: #e0e0e0;
  --send-buffer-text: #555;
  --send-final-bg: #fee500;
  --send-final-text: #1a1a1a;
  --preview-opacity: 0.6;
  --preview-border: rgba(254, 229, 0, 0.6);
  --sent-border: rgba(254, 229, 0, 0.4);
}`
        },
        'whatsapp': {
            name: 'WhatsApp (绿白风格)',
            css: `:root {
  /* ===== 手机外壳 ===== */
  --phone-bg: #ece5dd;
  --phone-border: rgba(0,0,0,0.1);
  --phone-chat-bg: #ece5dd;
  --phone-radius: 32px;

  /* ===== 状态栏 & 导航栏 ===== */
  --navbar-bg: #075e54;
  --navbar-text: #ffffff;
  --navbar-icon-fill: #ffffff;

  /* ===== 聊天气泡 ===== */
  --bubble-other-bg: #ffffff;
  --bubble-other-text: #303030;
  --bubble-me-bg: #dcf8c6;
  --bubble-me-text: #303030;
  --bubble-radius: 8px;

  /* ===== 头像 ===== */
  --avatar-other-bg: linear-gradient(135deg, #a8a8a8, #888888); 
  --avatar-me-bg: linear-gradient(135deg, #25d366, #128c7e);    
  --avatar-text: #fff;
  --avatar-size: 36px;

  /* ===== 强调色 ===== */
  --accent-blue: #34b7f1;
  --accent-green: #25d366;
  --accent-orange: #f4a100;
  --accent-red: #ff3b30;

  /* ===== 输入栏 ===== */
  --inputbar-bg: #f0f0f0;
  --inputbar-border-top: transparent; 
  --input-bg: #ffffff;
  --input-border: transparent;          
  --input-text: #333;
  --input-placeholder: #999;
  --input-icon-fill: #858e92;
  --input-radius: 24px;

  /* ===== 转账卡片 ===== */
  --transfer-bg: #ffffff;
  --transfer-border: rgba(0,0,0,0.06);
  --transfer-label-color: #075e54;

  /* ===== 位置卡片 ===== */
  --location-bg: #fff;
  --location-map-bg: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  --location-name-color: #1a1a1a;
  --location-addr-color: #999;

  /* ===== 时间分隔线 ===== */
  --time-sep-bg: rgba(225, 243, 251, 0.8);
  --time-sep-text: #556269;

  /* ===== 其他文字颜色 ===== */
  --msg-time-color: #999;               
  --quote-bg: rgba(0,0,0,0.05);
  --quote-text: #777;
  --recall-text: #888;
  --voice-wave-color: rgba(0,0,0,0.3);
  --voice-duration-color: rgba(0,0,0,0.6);

  /* ===== 发送按钮 ===== */
  --send-buffer-bg: #e0e0e0;
  --send-buffer-text: #555;
  --send-final-bg: #128c7e;
  --send-final-text: #ffffff;           
  --preview-opacity: 0.6;
  --preview-border: rgba(18, 140, 126, 0.6);
  --sent-border: rgba(18, 140, 126, 0.4);
}

.st-phone-chat {
  background-image: radial-gradient(rgba(0, 0, 0, 0.04) 2px, transparent 2px), radial-gradient(rgba(0, 0, 0, 0.04) 2px, transparent 2px);
  background-size: 32px 32px;
  background-position: 0 0, 16px 16px;
}

.st-phone-avatar {
  display: none !important;
}

.st-phone-bubble {
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  padding: 8px 12px;
}

.msg-other .st-phone-bubble {
  border-top-left-radius: 0;
  margin-left: 8px;
}

.msg-me .st-phone-bubble {
  border-top-right-radius: 0;
  margin-right: 8px;
}

.st-phone-msg-time {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.msg-other .st-phone-msg-time {
  margin-left: 10px;
}

.msg-me .st-phone-msg-time {
  margin-right: 10px;
}

.msg-me .st-phone-msg-time::after {
  content: '✓✓';
  color: #34b7f1;
  font-weight: 700;
  font-size: 12px;
  margin-left: 4px;
  letter-spacing: -3px;
  display: inline-block;
  transform: translateY(1px);
}

.st-phone-inputbar {
  padding: 8px;
}

.input-field-real {
  padding: 10px 14px !important;
}

.input-send-btn {
  width: 40px;
  height: 40px;
}`
        }
    };

    function getSelectedThemeInfo(settings) {
        const val = $('#phone_ui_theme_select').val() || '';
        if (val.startsWith('builtin:')) {
            const key = val.replace('builtin:', '');
            const item = BUILTIN_THEMES[key];
            return {
                isCustom: false,
                name: item ? item.name : key,
                rawName: key,
                css: item ? item.css : '',
            };
        } else if (val.startsWith('custom:')) {
            const name = val.replace('custom:', '');
            const css = (settings.custom_themes && settings.custom_themes[name]) || '';
            return {
                isCustom: true,
                name: name,
                rawName: name,
                css: css,
            };
        }
        return { isCustom: false, name: '', rawName: '', css: '' };
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
        const $customGroup = $('#phone_ui_custom_themes_group');
        $customGroup.empty();

        const customThemes = settings.custom_themes || {};
        const customKeys = Object.keys(customThemes);

        if (customKeys.length > 0) {
            for (const name of customKeys) {
                $customGroup.append(`<option value="custom:${name}">${name}</option>`);
            }
        } else {
            $customGroup.append(`<option value="" disabled>(暂无自定义主题，可在下方保存)</option>`);
        }

        if (selectKeyToSelect) {
            $select.val(selectKeyToSelect);
        } else if (currentVal && $select.find(`option[value="${currentVal}"]`).length) {
            $select.val(currentVal);
        } else {
            $select.val('builtin:wechat');
        }

        updateDeleteButtonState();
    }

    function applyThemeCSS(css) {
        removeThemeCSS();
        const style = document.createElement('style');
        style.id = 'phone-ui-custom-theme';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function removeThemeCSS() {
        const existing = document.getElementById('phone-ui-custom-theme');
        if (existing) existing.remove();
    }

    // ========== 主题加载 ==========
    function loadThemeForCurrentCharacter() {
        try {
            const ctx = SillyTavern.getContext();
            const settings = ctx.extensionSettings[MODULE_NAME];
            const charName = ctx.name2 || '';

            let cssToApply = settings.global_theme_css || '';

            if (charName) {
                // 1. 优先从角色卡的 extension data 读取
                try {
                    const charData = ctx.characters[ctx.characterId];
                    if (charData?.data?.extensions?.phone_theme_css) {
                        cssToApply = charData.data.extensions.phone_theme_css;
                    }
                } catch (e) { }

                // 2. 扩展设置中的角色配置覆盖角色卡数据
                if (settings.char_themes[charName]) {
                    cssToApply = settings.char_themes[charName];
                }
            }

            // 更新 UI 和页面样式
            if (cssToApply) {
                applyThemeCSS(cssToApply);
            } else {
                removeThemeCSS();
            }

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

        // 按联系人去重合并：AI 经常输出多个同 contact 的 [phone] 块，合并成一个
        const mergedBlocks = new Map();
        for (const block of blocks) {
            const key = block.contact;
            if (mergedBlocks.has(key)) {
                mergedBlocks.get(key).messages.push(...block.messages);
            } else {
                mergedBlocks.set(key, { contact: block.contact, messages: [...block.messages] });
            }
        }

        for (const [contactName, merged] of mergedBlocks) {
            let phoneData;
            if (settings && settings.aggregate) {
                phoneData = PhoneAggregator.aggregate(ctx.chat, msgIndex, contactName);
            } else {
                phoneData = { contact: contactName, messages: merged.messages, actions: savedActions };
            }

            const phoneId = `p_${msgIndex}_${contactName.replace(/\s/g, '_')}`;
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
        loadThemeForCurrentCharacter();
        if (typeof PhoneComposer !== 'undefined') {
            if (PhoneComposer.updateTheme) PhoneComposer.updateTheme();
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