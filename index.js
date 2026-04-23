(function () {
    const MODULE_NAME = 'phone_ui';
    
    // ✨ 【关键点】这里必须是你放到酒馆里时的文件夹名称！
    // 比如你放在 public/scripts/extensions/third-party/st-phone-ui
    // 这里就填 'st-phone-ui'
    const FOLDER_NAME = 'shoujishouji-'; 

    // ========== 初始化 ==========
    async function init() {
        try {
            const ctx = SillyTavern.getContext();
            const { eventSource, eventTypes } = ctx;

            // 1. 初始化或读取持久化设置
            if (!ctx.extensionSettings[MODULE_NAME]) {
                ctx.extensionSettings[MODULE_NAME] = {
                    enabled: true,       // 启用手机 UI
                    aggregate: true,     // 跨层聚合
                    inject: true,        // 交互操作注入
                    stickers: "{}"       // 默认空 JSON 字符串
                };
            }
            const settings = ctx.extensionSettings[MODULE_NAME];

            // 2. 将 settings.html 注入到 ST 的扩展面板中
            try {
                // 使用 ST 官方的渲染模板 API [1]
                const tplPath = `third-party/${FOLDER_NAME}`;
                const settingsHtml = await ctx.renderExtensionTemplateAsync(tplPath, 'settings');
                // 挂载到酒馆的设置侧边栏
                $('#extensions_settings').append(settingsHtml);
                
                // 3. 绑定设置界面和数据的逻辑
                bindSettingsUI(settings, ctx);
            } catch (htmlErr) {
                console.error('[Phone UI] 无法加载设置面板，请检查 FOLDER_NAME 是否和你的扩展文件夹名一致:', htmlErr);
            }

            // 4. 监听消息渲染事件
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
            eventSource.on(eventTypes.USER_MESSAGE_RENDERED, onMessageRendered);

            // 聊天切换时重置
            eventSource.on(eventTypes.CHAT_CHANGED, onChatChanged);

            // 初次加载：渲染已有消息
            renderAllExistingMessages();

            console.log('[Phone UI] Extension initialized successfully');
        } catch (e) {
            console.warn('[Phone UI] Not in SillyTavern environment, standalone mode', e);
        }
    }

    // ========== 设置面板 UI 绑定 ==========
    function bindSettingsUI(settings, ctx) {
        // 绑定"启用"开关
        const $enabled = $('#phone_ui_enabled');
        $enabled.prop('checked', settings.enabled);
        $enabled.on('change', function () {
            settings.enabled = !!$(this).prop('checked');
            ctx.saveSettingsDebounced();
            renderAllExistingMessages(); // 状态改变后尝试刷新画面
        });

        // 绑定"聚合"开关
        const $aggregate = $('#phone_ui_aggregate');
        $aggregate.prop('checked', settings.aggregate);
        $aggregate.on('change', function () {
            settings.aggregate = !!$(this).prop('checked');
            ctx.saveSettingsDebounced();
            renderAllExistingMessages();
        });

        // 绑定"注入"开关
        const $inject = $('#phone_ui_inject');
        $inject.prop('checked', settings.inject);
        $inject.on('change', function () {
            settings.inject = !!$(this).prop('checked');
            ctx.saveSettingsDebounced();
        });

        // 绑定"表情包"输入框和保存按钮
        const $stickers = $('#phone_ui_stickers');
        $stickers.val(settings.stickers || "");
        $('#phone_ui_save_stickers').on('click', function () {
            settings.stickers = $stickers.val();
            ctx.saveSettingsDebounced();
            // 调用酒馆原生的弹窗提示
            if (typeof toastr !== 'undefined') toastr.success("表情包配置已保存", "Phone UI");
        });
    }

    // ========== 消息渲染钩子 (这里帮你加了开关判定) ==========
    function onMessageRendered(msgIndex) {
        const ctx = SillyTavern.getContext();
        const settings = ctx.extensionSettings[MODULE_NAME];
        
        // 如果开关没开，直接跳过不渲染手机
        if (settings && !settings.enabled) return;

        const chatMsg = ctx.chat[msgIndex];
        if (!chatMsg || !chatMsg.mes) return;

        // ... 后面的代码保持原样 (从 "const blocks = PhoneParser..." 开始)
