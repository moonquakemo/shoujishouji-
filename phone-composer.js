/**
 * SillyTavern Phone UI Extension — 输入端手机伴侣 (Phone Composer)
 * 拟真半截手机UI：复用手机原生输入条、微信/iOS风格底栏、原生功能抽屉与表情视觉搜索库
 * 包含虚拟电子时钟（支持自动同步剧情最新时间、一键 +30m / 第二天 / 一周后 制造时间差）
 * 主题全面继承主手机主题，所有操作转换为小说级中文短代码 〖...〗 自动插入酒馆输入框
 */

const PhoneComposer = (() => {
    let isOpen = false;
    let currentDrawer = null; // null | 'voice' | 'stickers' | 'more' | 'transfer' | 'image' | 'video' | 'location'
    let currentVirtualTime = '14:00';
    let currentVirtualDate = new Date();
    let virtualHasYear = false;
    let virtualHasDate = false;
    let isTimeCustomized = false;
    let pendingDrafts = [];

    // SVG 图标库 (与 PhoneRenderer 保持 1:1 原生一致)
    const ICONS = {
        mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>',
        emoji: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
        plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
        transfer: '<svg viewBox="0 0 24 24"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>',
        image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>',
        video: '<svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
        location: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
    };

    /**
     * 初始化挂载
     */
    function init() {
        $('#st_phone_composer_root').remove();

        const html = `
<div id="st_phone_composer_root">
    <!-- 悬浮唤醒胶囊按钮 (仅保留 📱，支持任意拖拽) -->
    <div id="st_phone_composer_trigger" class="st-phone-composer-trigger" title="打开 R-Phone (按住可拖动)">
        <span class="composer-trigger-icon">📱</span>
    </div>

    <!-- 手机输入伴侣主面板 (拟真半截手机UI，顶部支持拖拽) -->
    <div id="st_phone_composer_panel" class="st-phone-composer-panel" style="display: none;">
        <!-- 顶部导航栏 (含虚拟电子钟，按住可任意拖动悬浮窗) -->
        <div class="composer-header st-phone-navbar" title="按住可拖拽悬浮窗">
            <div class="composer-title-group">
                <span class="composer-signal-dot"></span>
                <span class="composer-nav-title">联络中</span>
                <div class="composer-clock-chip" id="composer_clock_chip" title="点击调整虚拟时间（模拟时间差）">
                    <span class="clock-icon"><i class="fa-regular fa-clock"></i></span>
                    <span class="clock-time-val" id="composer_clock_val">14:00</span>
                </div>
            </div>
            <div class="composer-header-actions">
                <button type="button" class="composer-close-btn" id="composer_close_btn" title="收起">✕</button>
            </div>
        </div>

        <!-- 虚拟时钟微调弹窗 (纯按钮点选 + 连续累加机制) -->
        <div class="composer-clock-popover" id="composer_clock_popover" style="display: none;">
            <div class="clock-popover-header">
                <div class="popover-title-group">
                    <span class="popover-title">虚拟时空</span>
                    <span class="popover-current-badge" id="popover_current_clock">14:00</span>
                </div>
                <div class="popover-header-actions">
                    <button type="button" class="popover-reset-btn" id="composer_clock_sync_btn" title="重置为当前剧情最新时间"><i class="fa-solid fa-rotate-right"></i> 随剧情</button>
                    <button type="button" class="popover-done-btn" id="composer_clock_done_btn" title="完成设置">完成</button>
                </div>
            </div>

            <!-- 时分微调 -->
            <div class="clock-group-title">时分推移</div>
            <div class="clock-quick-pills">
                <button type="button" class="quick-pill" data-adjust="+5m">+5分钟</button>
                <button type="button" class="quick-pill" data-adjust="+15m">+15分钟</button>
                <button type="button" class="quick-pill" data-adjust="+30m">+30分钟</button>
                <button type="button" class="quick-pill" data-adjust="+1h">+1小时</button>
                <button type="button" class="quick-pill" data-adjust="+2h">+2小时</button>
                <button type="button" class="quick-pill" data-adjust="+4h">+4小时</button>
            </div>

            <!-- 日历长周期 -->
            <div class="clock-group-title">日历跨度</div>
            <div class="clock-quick-pills">
                <button type="button" class="quick-pill" data-adjust="next-day">第二天</button>
                <button type="button" class="quick-pill" data-adjust="+2d">两天后</button>
                <button type="button" class="quick-pill" data-adjust="+3d">三天后</button>
                <button type="button" class="quick-pill" data-adjust="next-week">一周后</button>
                <button type="button" class="quick-pill" data-adjust="+15d">半个月后</button>
                <button type="button" class="quick-pill" data-adjust="+30d">一个月后</button>
            </div>

            <!-- 底部累加提示 -->
            <div class="clock-popover-tip">
                <i class="fa-solid fa-circle-info"></i> 点击按钮直接生效；连续点击会自动累加（如点两次“第二天”为后天，日历自动跨月）
            </div>
        </div>

        <!-- 屏幕中间展示区 (闲置提示 / 动态抽屉表单 / 实时气泡流) -->
        <div id="composer_display_area" class="composer-display-area">
            <!-- 闲置就绪提示 -->
            <div id="composer_idle_canvas" class="composer-idle-canvas">
                <div class="composer-idle-pill">
                    <span class="idle-dot"></span>
                    <span class="idle-text">手机联络伴侣已就绪</span>
                </div>
            </div>

            <!-- 实时拟真聊天气泡流 (本轮发送的消息实时上屏) -->
            <div id="composer_chat_stream" class="composer-chat-stream" style="display: none;">
                <div class="composer-stream-header">
                    <span class="stream-tip">本轮发送预览</span>
                    <button type="button" class="stream-clear-btn" id="composer_stream_clear" title="清空并撤回本轮手机消息"><i class="fa-regular fa-trash-can"></i> 撤回清空</button>
                </div>
                <div id="composer_stream_messages" class="composer-stream-messages"></div>
            </div>

            <!-- 动态抽屉表单区 -->
            <div id="composer_drawer_content" class="composer-drawer-content" style="display: none;"></div>
        </div>

        <!-- 原生复用手机底部输入条 (st-phone-inputbar) -->
        <div class="st-phone-inputbar composer-inputbar">
            <div class="input-voice-btn" id="composer_btn_voice" title="发送语音条">${ICONS.mic}</div>
            <input type="text" id="composer_text_input" class="input-field-real" placeholder="输入消息..." autocomplete="off">
            <div class="input-action-btn" id="composer_btn_emoji" title="表情包">${ICONS.emoji}</div>
            <div class="input-action-btn" id="composer_btn_plus" title="更多功能">${ICONS.plus}</div>
            <button type="button" class="composer-send-btn direct" id="composer_btn_send" title="发送" style="display: none;">发送</button>
        </div>
        <div class="st-phone-bottom-safe"></div>
    </div>
</div>
`;

        $('body').append(html);
        bindEvents();
        updateTheme();
        syncLatestTime();
        initDraggables();
    }

    /**
     * 绑定各类交互事件
     */
    function bindEvents() {
        // 1. 悬浮胶囊开合 (支持 touch 与 click，防拖拽误触与双重触发)
        let triggerLastTap = 0;
        $('#st_phone_composer_trigger').on('click touchend', function (e) {
            if (this._pu_drag_prevent_click) {
                e.stopImmediatePropagation();
                return;
            }
            const now = Date.now();
            if (now - triggerLastTap < 350) return;
            triggerLastTap = now;

            if (e.type === 'touchend') {
                e.preventDefault(); // 阻止后续合成的 ghost click 导致反复开合
            }
            toggleComposer();
        });

        $('#composer_close_btn').on('click', function () {
            toggleComposer(false);
        });

        $('#composer_stream_clear').on('click', function () {
            clearDraft(true);
        });

        // 2. 虚拟时钟弹窗与调整
        $('#composer_clock_chip').on('click', function (e) {
            e.stopPropagation();
            toggleClockPopover();
        });

        $(document).on('click', '#st_phone_composer_root .quick-pill', function () {
            const adj = $(this).data('adjust');
            adjustVirtualTime(adj);
        });

        $('#composer_clock_done_btn').on('click', function () {
            toggleClockPopover(false);
        });

        $('#composer_clock_sync_btn').on('click', function () {
            syncLatestTime();
        });

        // 3. 底栏图标按钮点击 (切换抽屉)
        $('#composer_btn_voice').on('click', function () {
            toggleDrawer('voice');
        });

        $('#composer_btn_emoji').on('click', function () {
            toggleDrawer('stickers');
        });

        $('#composer_btn_plus').on('click', function () {
            toggleDrawer('more');
        });

        // 4. 输入框键入监控 (有内容时 + 号自动平滑切换为唯一原生 发送 按钮)
        $('#composer_text_input').on('input', function () {
            const hasText = $(this).val().trim().length > 0;
            if (hasText) {
                $('#composer_btn_plus').hide();
                $('#composer_btn_send').show();
            } else {
                $('#composer_btn_send').hide();
                $('#composer_btn_plus').show();
            }
        });

        $('#composer_text_input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleTextSend();
            }
        });

        $('#composer_btn_send').on('click', function () {
            handleTextSend();
        });
    }

    /**
     * 计算并获取拖拽安全边界（适配移动端与桌面端，确保绝不被酒馆顶部/底部栏遮挡）
     */
    function getSafeBounds(elWidth, elHeight) {
        const isMobile = window.innerWidth <= 768;
        const minLeft = 8;
        const minTop = isMobile ? 50 : 8; // 避开移动端顶部栏
        const bottomSafe = isMobile ? 35 : 20; // 避开移动端底部打字栏和虚拟键盘/安全区
        const maxLeft = Math.max(minLeft, window.innerWidth - elWidth - 8);
        const maxTop = Math.max(minTop, window.innerHeight - elHeight - bottomSafe);
        return { minLeft, maxLeft, minTop, maxTop };
    }

    function getStorageKey(baseKey) {
        return window.innerWidth <= 768 ? `${baseKey}_mobile` : baseKey;
    }

    /**
     * 方案 1：伴侣屏幕展开位置随悬浮按钮，向屏幕中心方向展开，并在安全视口内防溢出
     */
    function positionPanelNearTrigger($panel, $trigger) {
        if (!$panel || !$panel.length || !$trigger || !$trigger.length) return;

        const isMobile = window.innerWidth <= 768;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        // 获取或预估面板尺寸 (防止 display:none 导致宽高为 0)
        let pW = $panel.outerWidth();
        let pH = $panel.outerHeight();
        if (!pW || pW < 100) {
            pW = isMobile ? Math.min(360, screenW - 20) : 360;
        }
        if (!pH || pH < 100) {
            pH = isMobile ? Math.min(500, Math.round(screenH * 0.72)) : 520;
        }

        const tRect = $trigger[0].getBoundingClientRect();
        const tCenterX = tRect.left + tRect.width / 2;
        const tCenterY = tRect.top + tRect.height / 2;
        const sCenterX = screenW / 2;
        const sCenterY = screenH / 2;

        // 安全视口边界
        const safeLeft = 10;
        const safeRight = 10;
        const safeTop = isMobile ? 50 : 12; // 避开移动端顶部栏
        const safeBottom = isMobile ? 25 : 15; // 避开移动端底部手势/安全区

        let targetLeft = 0;
        let targetTop = 0;
        let originX = 'right';
        let originY = 'bottom';

        // 1. 水平方向判定 (向屏幕中心展开)
        if (tCenterX >= sCenterX) {
            // 悬浮按钮在屏幕右半侧 -> 向左展开 (对齐按钮右边缘)
            originX = 'right';
            targetLeft = tRect.right - pW;
        } else {
            // 悬浮按钮在屏幕左半侧 -> 向右展开 (对齐按钮左边缘)
            originX = 'left';
            targetLeft = tRect.left;
        }

        // 2. 垂直方向判定 (向屏幕中心展开)
        if (tCenterY >= sCenterY) {
            // 悬浮按钮在屏幕下半侧 -> 向上展开 (面板底部停靠在按钮上方)
            originY = 'bottom';
            targetTop = tRect.top - pH - 10;
            // 若上方空间不够，尝试向下展开
            if (targetTop < safeTop) {
                if (tRect.bottom + 10 + pH <= screenH - safeBottom) {
                    targetTop = tRect.bottom + 10;
                    originY = 'top';
                } else {
                    targetTop = safeTop;
                }
            }
        } else {
            // 悬浮按钮在屏幕上半侧 -> 向下展开 (面板顶部停靠在按钮下方)
            originY = 'top';
            targetTop = tRect.bottom + 10;
            // 若下方空间不够，尝试向上展开
            if (targetTop + pH > screenH - safeBottom) {
                if (tRect.top - 10 - pH >= safeTop) {
                    targetTop = tRect.top - 10 - pH;
                    originY = 'bottom';
                } else {
                    targetTop = Math.max(safeTop, screenH - safeBottom - pH);
                }
            }
        }

        // 3. 安全夹紧保证绝不超屏
        const maxLeft = Math.max(safeLeft, screenW - pW - safeRight);
        const maxTop = Math.max(safeTop, screenH - pH - safeBottom);
        targetLeft = Math.min(Math.max(safeLeft, targetLeft), maxLeft);
        targetTop = Math.min(Math.max(safeTop, targetTop), maxTop);

        $panel.css({
            left: `${Math.round(targetLeft)}px`,
            top: `${Math.round(targetTop)}px`,
            right: 'auto',
            bottom: 'auto',
            margin: '0',
            transformOrigin: `${originY} ${originX}`
        });
    }

    /**
     * 初始化悬浮按钮和悬浮窗的拖拽功能
     */
    function initDraggables() {
        makeDraggable('#st_phone_composer_trigger', '#st_phone_composer_trigger', 'st_phone_trigger_pos');
        makeDraggable('#st_phone_composer_panel', '#st_phone_composer_panel .composer-header', 'st_phone_panel_pos');

        $(window).on('resize.pu_draggables orientationchange.pu_draggables', function () {
            clampToViewport('#st_phone_composer_trigger');
            if (isOpen) {
                clampToViewport('#st_phone_composer_panel');
            }
        });

        // 挂载完成后立即做一次安全视口检查，确保在小屏或旋转屏幕下永远处于安全区
        setTimeout(() => {
            clampToViewport('#st_phone_composer_trigger');
            if (isOpen) {
                clampToViewport('#st_phone_composer_panel');
            }
        }, 200);
    }

    function clampToViewport(selector) {
        const $el = $(selector);
        if (!$el.length || $el.css('display') === 'none') return;
        const rect = $el[0].getBoundingClientRect();
        const { minLeft, maxLeft, minTop, maxTop } = getSafeBounds(rect.width, rect.height);

        let curLeft = rect.left;
        let curTop = rect.top;
        let changed = false;

        if (curLeft > maxLeft) { curLeft = maxLeft; changed = true; }
        if (curLeft < minLeft) { curLeft = minLeft; changed = true; }
        if (curTop > maxTop) { curTop = maxTop; changed = true; }
        if (curTop < minTop) { curTop = minTop; changed = true; }

        if (changed) {
            $el.css({
                left: `${Math.round(curLeft)}px`,
                top: `${Math.round(curTop)}px`,
                right: 'auto',
                bottom: 'auto'
            });
        }
    }

    function makeDraggable(elementSelector, handleSelector, storageKey) {
        const $el = $(elementSelector);
        if (!$el.length) return;
        const el = $el[0];
        const $handle = handleSelector ? $(handleSelector) : $el;
        if (!$handle.length) return;

        const actualKey = getStorageKey(storageKey);

        try {
            const saved = localStorage.getItem(actualKey);
            if (saved) {
                const pos = JSON.parse(saved);
                if (typeof pos.left === 'number' && typeof pos.top === 'number') {
                    const elW = $el.outerWidth() || 48;
                    const elH = $el.outerHeight() || 48;
                    const { minLeft, maxLeft, minTop, maxTop } = getSafeBounds(elW, elH);
                    const clampLeft = Math.min(Math.max(minLeft, pos.left), maxLeft);
                    const clampTop = Math.min(Math.max(minTop, pos.top), maxTop);
                    $el.css({
                        left: `${Math.round(clampLeft)}px`,
                        top: `${Math.round(clampTop)}px`,
                        right: 'auto',
                        bottom: 'auto'
                    });
                }
            }
        } catch (e) { }

        let isDragging = false;
        let hasMoved = false;
        let isTouchDrag = false;
        let startX = 0, startY = 0;
        let initLeft = 0, initTop = 0;

        function getCoords(e) {
            if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length) {
                return { x: e.originalEvent.touches[0].clientX, y: e.originalEvent.touches[0].clientY };
            }
            if (e.touches && e.touches.length) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            if (e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches.length) {
                return { x: e.originalEvent.changedTouches[0].clientX, y: e.originalEvent.changedTouches[0].clientY };
            }
            if (e.changedTouches && e.changedTouches.length) {
                return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        }

        $handle.on('mousedown touchstart', function (e) {
            if ($(e.target).closest('button, input, select, textarea, .composer-clock-chip, .composer-header-actions').length) {
                return;
            }

            isTouchDrag = e.type === 'touchstart';
            const coords = getCoords(e);
            startX = coords.x;
            startY = coords.y;

            const rect = el.getBoundingClientRect();
            initLeft = rect.left;
            initTop = rect.top;

            isDragging = true;
            hasMoved = false;

            $(document).on('mousemove.pu_drag touchmove.pu_drag', onMove);
            $(document).on('mouseup.pu_drag touchend.pu_drag touchcancel.pu_drag', onUp);
        });

        function onMove(e) {
            if (!isDragging) return;
            const coords = getCoords(e);
            const dx = coords.x - startX;
            const dy = coords.y - startY;
            const threshold = isTouchDrag ? 12 : 5;

            if (!hasMoved && Math.hypot(dx, dy) > threshold) {
                hasMoved = true;
                $el.addClass('dragging');
            }

            if (hasMoved) {
                if (e.cancelable) {
                    e.preventDefault();
                }
                const elWidth = $el.outerWidth() || 48;
                const elHeight = $el.outerHeight() || 48;
                const { minLeft, maxLeft, minTop, maxTop } = getSafeBounds(elWidth, elHeight);

                let curLeft = initLeft + dx;
                let curTop = initTop + dy;

                curLeft = Math.min(Math.max(minLeft, curLeft), maxLeft);
                curTop = Math.min(Math.max(minTop, curTop), maxTop);

                $el.css({
                    left: `${Math.round(curLeft)}px`,
                    top: `${Math.round(curTop)}px`,
                    right: 'auto',
                    bottom: 'auto'
                });
            }
        }

        function onUp(e) {
            if (!isDragging) return;
            isDragging = false;
            $(document).off('.pu_drag');
            $el.removeClass('dragging');

            if (hasMoved) {
                try {
                    const rect = el.getBoundingClientRect();
                    const currentStorageKey = getStorageKey(storageKey);
                    localStorage.setItem(currentStorageKey, JSON.stringify({
                        left: Math.round(rect.left),
                        top: Math.round(rect.top)
                    }));
                } catch (err) { }

                el._pu_drag_prevent_click = true;
                setTimeout(() => {
                    el._pu_drag_prevent_click = false;
                }, 300);
            } else {
                el._pu_drag_prevent_click = false;
            }
        }
    }

    /**
     * 面板显示/折叠切换
     */
    function toggleComposer(forceState) {
        isOpen = forceState !== undefined ? forceState : !isOpen;
        const $panel = $('#st_phone_composer_panel');
        const $trigger = $('#st_phone_composer_trigger');

        if (isOpen) {
            updateTheme();
            if (!isTimeCustomized) {
                syncLatestTime();
            }

            const isMobile = window.innerWidth <= 768;

            // 方案 1：伴侣屏幕展开位置随悬浮按钮，向屏幕中心方向展开，并在安全视口内防溢出
            positionPanelNearTrigger($panel, $trigger);

            if (pendingDrafts.length > 0) {
                $('#composer_idle_canvas').hide();
                $('#composer_chat_stream').show();
            } else {
                $('#composer_chat_stream').hide();
                $('#composer_idle_canvas').show();
            }
            $panel.stop(true, true).css('display', 'flex').hide().fadeIn(180);
            $trigger.addClass('active');

            // 移动端严格取消自动聚焦，防止拉起虚拟键盘遮挡屏幕；仅桌面端自动聚焦
            if (!isMobile) {
                $('#composer_text_input').focus();
            }
        } else {
            $panel.stop(true, true).fadeOut(150);
            $trigger.removeClass('active');
            closeDrawer();
            toggleClockPopover(false);
        }
    }

    /**
     * 时钟设置弹窗切换
     */
    function toggleClockPopover(forceState) {
        const $pop = $('#composer_clock_popover');
        const show = forceState !== undefined ? forceState : !$pop.is(':visible');
        if (show) {
            $pop.stop(true, true).slideDown(150);
        } else {
            $pop.stop(true, true).slideUp(120);
        }
    }

    /**
     * 自动从聊天流拉取当前剧情最新消息的时间
     * 并扫描回溯历史，结合最近的日期/年份锚点，维护真实 Date 时钟
     */
    function syncLatestTime() {
        try {
            const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : {};
            const chat = ctx.chat || [];

            let foundTimeStr = '';
            let anchorYear = null;
            let anchorMonth = null;
            let anchorDay = null;

            // 倒序遍历聊天记录，寻找最新时间戳与历史中最近明确的日期/年份锚点
            for (let i = chat.length - 1; i >= 0; i--) {
                const msg = chat[i];
                if (!msg || !msg.mes) continue;

                // 1. 尝试从 [phone] 提取
                const blocks = (typeof PhoneParser !== 'undefined' && PhoneParser.extractPhoneBlocks)
                    ? PhoneParser.extractPhoneBlocks(msg.mes)
                    : [];
                for (const b of blocks) {
                    for (let j = b.messages.length - 1; j >= 0; j--) {
                        const m = b.messages[j];
                        if (m.time) {
                            if (!foundTimeStr) {
                                foundTimeStr = String(m.time).trim();
                            }
                            if (typeof PhoneParser !== 'undefined' && PhoneParser.parseTimeInfo) {
                                const parsed = PhoneParser.parseTimeInfo(m.time);
                                if (parsed.hasDate && anchorMonth === null) {
                                    anchorMonth = parsed.month;
                                    anchorDay = parsed.day;
                                }
                                if (parsed.hasYear && anchorYear === null) {
                                    anchorYear = parsed.year;
                                }
                            }
                            if (foundTimeStr && anchorYear !== null && anchorMonth !== null) break;
                        }
                    }
                    if (foundTimeStr && anchorYear !== null && anchorMonth !== null) break;
                }

                // 2. 尝试从用户消息的 〖...〗 提取
                if (msg.is_user) {
                    const humanMsgs = (typeof PhoneParser !== 'undefined' && PhoneParser.extractHumanBlocks)
                        ? PhoneParser.extractHumanBlocks(msg.mes, { isMe: true })
                        : [];
                    for (let j = humanMsgs.length - 1; j >= 0; j--) {
                        const hm = humanMsgs[j];
                        if (hm.time) {
                            if (!foundTimeStr) {
                                foundTimeStr = String(hm.time).trim();
                            }
                            if (typeof PhoneParser !== 'undefined' && PhoneParser.parseTimeInfo) {
                                const parsed = PhoneParser.parseTimeInfo(hm.time);
                                if (parsed.hasDate && anchorMonth === null) {
                                    anchorMonth = parsed.month;
                                    anchorDay = parsed.day;
                                }
                                if (parsed.hasYear && anchorYear === null) {
                                    anchorYear = parsed.year;
                                }
                            }
                            if (foundTimeStr && anchorYear !== null && anchorMonth !== null) break;
                        }
                    }
                }
                if (foundTimeStr && anchorYear !== null && anchorMonth !== null) break;
            }

            if (foundTimeStr) {
                const now = new Date();
                const baseYear = anchorYear || now.getFullYear();
                const baseMonth = anchorMonth !== null ? (anchorMonth - 1) : now.getMonth();
                const baseDay = anchorDay !== null ? anchorDay : now.getDate();
                const baseDate = new Date(baseYear, baseMonth, baseDay, 12, 0, 0, 0);

                const info = (typeof PhoneParser !== 'undefined' && PhoneParser.parseTimeInfo)
                    ? PhoneParser.parseTimeInfo(foundTimeStr, baseDate)
                    : null;

                if (info && info.dateObj) {
                    currentVirtualDate = new Date(info.dateObj.getTime());
                    virtualHasYear = info.hasYear || (anchorYear !== null);
                    virtualHasDate = info.hasDate;
                    currentVirtualTime = foundTimeStr;
                    isTimeCustomized = false;
                    updateClockDisplay();
                    return;
                }
            }
        } catch (e) {
            console.warn('[PhoneComposer] syncLatestTime error:', e);
        }

        // 兜底当前现实时间
        const now = new Date();
        currentVirtualDate = new Date(now.getTime());
        virtualHasYear = false;
        virtualHasDate = false;
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        currentVirtualTime = `${hh}:${mm}`;
        isTimeCustomized = false;
        updateClockDisplay();
    }

    /**
     * 调整虚拟时空（底层纯原生 Date 真实日历算法，自动处理闰年、月末跨月、跨年与连续叠加）
     */
    function adjustVirtualTime(action, customVal) {
        if (!currentVirtualDate || isNaN(currentVirtualDate.getTime())) {
            currentVirtualDate = new Date();
        }

        if (action === 'custom') {
            if (!customVal || !customVal.trim()) return;
            const str = customVal.trim();
            const info = (typeof PhoneParser !== 'undefined' && PhoneParser.parseTimeInfo)
                ? PhoneParser.parseTimeInfo(str, currentVirtualDate)
                : null;

            if (info && info.dateObj) {
                currentVirtualDate = new Date(info.dateObj.getTime());
                virtualHasYear = info.hasYear || virtualHasYear;
                virtualHasDate = info.hasDate;
                if (typeof PhoneParser !== 'undefined' && PhoneParser.formatDateToCanonical) {
                    currentVirtualTime = PhoneParser.formatDateToCanonical(currentVirtualDate, virtualHasYear, virtualHasDate);
                } else {
                    currentVirtualTime = str;
                }
            } else {
                currentVirtualTime = str;
            }
            isTimeCustomized = true;
            updateClockDisplay();
            return;
        }

        if (action === 'now') {
            syncLatestTime();
            return;
        }

        const d = new Date(currentVirtualDate.getTime());
        const startDay = d.getDate();

        if (action === '+5m') {
            d.setMinutes(d.getMinutes() + 5);
        } else if (action === '+15m') {
            d.setMinutes(d.getMinutes() + 15);
        } else if (action === '+30m') {
            d.setMinutes(d.getMinutes() + 30);
        } else if (action === '+1h') {
            d.setHours(d.getHours() + 1);
        } else if (action === '+2h') {
            d.setHours(d.getHours() + 2);
        } else if (action === '+4h') {
            d.setHours(d.getHours() + 4);
        } else if (action === 'next-day') {
            d.setDate(d.getDate() + 1);
            d.setHours(9, 0, 0, 0);
            virtualHasDate = true;
        } else if (action === '+2d') {
            d.setDate(d.getDate() + 2);
            d.setHours(9, 0, 0, 0);
            virtualHasDate = true;
        } else if (action === '+3d') {
            d.setDate(d.getDate() + 3);
            d.setHours(9, 0, 0, 0);
            virtualHasDate = true;
        } else if (action === 'next-week') {
            d.setDate(d.getDate() + 7);
            virtualHasDate = true;
        } else if (action === '+15d') {
            d.setDate(d.getDate() + 15);
            virtualHasDate = true;
        } else if (action === '+30d') {
            d.setDate(d.getDate() + 30);
            virtualHasDate = true;
        }

        // 跨日自动激活日期显示
        if (d.getDate() !== startDay) {
            virtualHasDate = true;
        }

        currentVirtualDate = d;
        isTimeCustomized = true;

        if (typeof PhoneParser !== 'undefined' && PhoneParser.formatDateToCanonical) {
            currentVirtualTime = PhoneParser.formatDateToCanonical(currentVirtualDate, virtualHasYear, virtualHasDate);
        } else {
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            currentVirtualTime = `${hh}:${mm}`;
        }

        updateClockDisplay();
    }

    function setVirtualTime(timeStr, isCustomized = false) {
        currentVirtualTime = timeStr || '14:00';
        isTimeCustomized = isCustomized;
        const info = (typeof PhoneParser !== 'undefined' && PhoneParser.parseTimeInfo)
            ? PhoneParser.parseTimeInfo(currentVirtualTime, currentVirtualDate)
            : null;
        if (info && info.dateObj) {
            currentVirtualDate = new Date(info.dateObj.getTime());
            virtualHasYear = info.hasYear || virtualHasYear;
            virtualHasDate = info.hasDate;
        }
        updateClockDisplay();
    }

    function updateClockDisplay() {
        $('#composer_clock_val').text(currentVirtualTime);
        $('#popover_current_clock').text(currentVirtualTime);
        $('#composer_clock_chip').toggleClass('customized', isTimeCustomized);
    }

    /**
     * 主题跟随同步 (背景图、主题样式自适应)
     */
    function updateTheme() {
        try {
            const cfg = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getConfig)
                ? PhoneInteractions.getConfig()
                : {};
            const $display = $('#composer_display_area');
            if (cfg.chatBackground) {
                $display.css({
                    'background-image': `url("${cfg.chatBackground}")`,
                    'background-size': 'cover',
                    'background-position': 'center',
                });
            } else {
                $display.css({
                    'background-image': '',
                    'background-size': '',
                    'background-position': '',
                });
            }
        } catch (e) { }
    }

    /**
     * 切换抽屉状态
     */
    function toggleDrawer(drawerType) {
        if (currentDrawer === drawerType) {
            closeDrawer();
        } else {
            openDrawer(drawerType);
        }
    }

    /**
     * 打开特定抽屉
     */
    function openDrawer(type) {
        currentDrawer = type;
        updateIconActiveStates();

        const $content = $('#composer_drawer_content');
        const $idle = $('#composer_idle_canvas');
        $content.empty();

        if (type === 'voice') {
            renderVoiceDrawer($content);
        } else if (type === 'stickers') {
            renderStickerPickerDrawer($content);
        } else if (type === 'more') {
            renderActionPanelDrawer($content);
        } else if (type === 'transfer') {
            renderTransferDrawer($content);
        } else if (type === 'image') {
            renderImageDrawer($content);
        } else if (type === 'video') {
            renderVideoDrawer($content);
        } else if (type === 'location') {
            renderLocationDrawer($content);
        }

        $idle.hide();
        $('#composer_chat_stream').hide();
        $content.stop(true, true).slideDown(180);
    }

    /**
     * 关闭当前抽屉，恢复闲置屏幕
     */
    function closeDrawer() {
        currentDrawer = null;
        updateIconActiveStates();
        const $content = $('#composer_drawer_content');
        const $idle = $('#composer_idle_canvas');

        $content.stop(true, true).slideUp(150, function () {
            $(this).empty();
            if (pendingDrafts.length > 0) {
                $('#composer_chat_stream').fadeIn(120);
                const $msgContainer = $('#composer_stream_messages');
                if ($msgContainer.length) {
                    $msgContainer.scrollTop($msgContainer[0].scrollHeight);
                }
            } else {
                $idle.fadeIn(120);
            }
        });
    }

    /**
     * 更新底栏按钮高亮状态
     */
    function updateIconActiveStates() {
        $('#composer_btn_voice').toggleClass('active', currentDrawer === 'voice');
        $('#composer_btn_emoji').toggleClass('active', currentDrawer === 'stickers');
        $('#composer_btn_plus').toggleClass('active', ['more', 'transfer', 'image', 'video', 'location'].includes(currentDrawer));
    }

    /**
     * 渲染拟真语音表单抽屉
     */
    function renderVoiceDrawer($container) {
        const html = `
<div class="composer-form-card voice-card">
    <div class="form-title">发送语音条</div>
    <div class="form-row">
        <label>预设时长 (秒)</label>
        <div class="voice-presets">
            <button type="button" class="preset-btn" data-sec="3">3秒</button>
            <button type="button" class="preset-btn" data-sec="5">5秒</button>
            <button type="button" class="preset-btn" data-sec="12">12秒</button>
            <button type="button" class="preset-btn" data-sec="30">30秒</button>
            <input type="number" id="cp_voice_sec" class="composer-form-input sec-input" value="3" min="1" max="60">
        </div>
    </div>
    <div class="form-row">
        <label>转文字内容 (选填，AI 能直接看懂)</label>
        <input type="text" id="cp_voice_text" class="composer-form-input" placeholder="如：到家了记得跟我说一声">
    </div>
    <div class="form-btn-group">
        <button type="button" class="form-btn append" id="cp_voice_append">发送</button>
    </div>
</div>
`;
        $container.html(html);

        $('.preset-btn').on('click', function () {
            $('#cp_voice_sec').val($(this).data('sec'));
        });

        $('#cp_voice_append').on('click', () => submitVoice());
    }

    function submitVoice() {
        const sec = $('#cp_voice_sec').val()?.trim() || '3';
        const text = $('#cp_voice_text').val()?.trim();
        const token = text ? `〖语音：${sec}秒（转文字：${text}）〗` : `〖语音：${sec}秒〗`;
        dispatchToken(token);
        closeDrawer();
    }

    /**
     * 渲染表情包视觉网格抽屉 (保留精巧的本地搜索功能)
     */
    function renderStickerPickerDrawer($container) {
        let allStickers = {};
        if (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getAllStickers) {
            allStickers = PhoneInteractions.getAllStickers();
        }

        const aliases = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getStickerAliases)
            ? PhoneInteractions.getStickerAliases()
            : {};

        const totalCount = Object.keys(allStickers).length;

        let searchHtml = `
<div class="composer-sticker-header">
    <input type="text" id="composer_sticker_search" class="composer-search-input" placeholder="🔍 搜索表情包 (如: 流泪, dog, 赞)...">
</div>
<div class="composer-sticker-grid" id="composer_sticker_grid">
`;

        if (!totalCount) {
            searchHtml += `
    <div class="composer-empty-tip">
        <span>还没有加载到表情包哦~</span>
        <small style="display:block;margin-top:4px;color:#888;">请在插件设置中保存或导入表情</small>
    </div>
</div>`;
            $container.html(searchHtml);
            return;
        }

        const items = Object.entries(allStickers).map(([key, url]) => {
            let displayLabel = key;
            for (const [cnName, targetKey] of Object.entries(aliases)) {
                if (targetKey === key) {
                    displayLabel = cnName;
                    break;
                }
            }
            return `
<div class="composer-sticker-item" data-key="${escapeAttr(key)}" data-label="${escapeAttr(displayLabel)}" title="${escapeAttr(displayLabel)} (${escapeAttr(key)})">
    <img src="${escapeAttr(url)}" alt="${escapeAttr(displayLabel)}" loading="lazy" onerror="this.outerHTML='<span class=fallback>${escapeAttr(displayLabel)}</span>'">
    <span class="sticker-name">${escapeHtml(displayLabel)}</span>
</div>`;
        }).join('');

        searchHtml += items + '</div>';
        $container.html(searchHtml);

        // 点击表情图片发送 (插入酒馆输入框)
        $container.find('.composer-sticker-item').on('click', function () {
            const label = $(this).data('label') || $(this).data('key');
            const token = `〖表情：${label}〗`;
            dispatchToken(token);
        });

        // 本地搜索过滤
        $('#composer_sticker_search').on('input', function () {
            const q = $(this).val().trim().toLowerCase();
            const $items = $('#composer_sticker_grid .composer-sticker-item');
            if (!q) {
                $items.show();
                return;
            }
            $items.each(function () {
                const k = ($(this).data('key') || '').toLowerCase();
                const l = ($(this).data('label') || '').toLowerCase();
                if (k.includes(q) || l.includes(q)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });
    }

    /**
     * 渲染原生复用功能面板 (转账 / 图片 / 视频 / 位置)
     */
    function renderActionPanelDrawer($container) {
        const html = `
<div class="st-phone-action-panel composer-action-panel">
    <div class="action-item" data-action="transfer">
        <div class="action-icon">${ICONS.transfer}</div>
        <span>转账</span>
    </div>
    <div class="action-item" data-action="image">
        <div class="action-icon">${ICONS.image}</div>
        <span>图片</span>
    </div>
    <div class="action-item" data-action="video">
        <div class="action-icon">${ICONS.video}</div>
        <span>视频</span>
    </div>
    <div class="action-item" data-action="location">
        <div class="action-icon">${ICONS.location}</div>
        <span>位置</span>
    </div>
</div>
`;
        $container.html(html);

        $container.find('.action-item').on('click', function () {
            const act = $(this).data('action');
            openDrawer(act);
        });
    }

    /**
     * 渲染转账表单抽屉
     */
    function renderTransferDrawer($container) {
        const html = `
<div class="composer-form-card transfer-card">
    <div class="form-title">
        <button type="button" class="form-back-btn" id="cp_back_to_more" title="返回功能菜单">‹ 返回</button>
        <span>发送转账</span>
    </div>
    <div class="form-row">
        <label>金额 (¥)</label>
        <input type="number" id="cp_transfer_amt" class="composer-form-input" placeholder="0.00" min="1" step="any">
    </div>
    <div class="form-row">
        <label>备注 (选填)</label>
        <input type="text" id="cp_transfer_note" class="composer-form-input" placeholder="如：请你喝奶茶 / 火锅基金">
    </div>
    <div class="form-btn-group">
        <button type="button" class="form-btn append" id="cp_transfer_append">发送</button>
    </div>
</div>
`;
        $container.html(html);

        $('#cp_back_to_more').on('click', () => openDrawer('more'));
        $('#cp_transfer_append').on('click', () => submitTransfer());
    }

    function submitTransfer() {
        const amt = $('#cp_transfer_amt').val()?.trim();
        const note = $('#cp_transfer_note').val()?.trim();
        if (!amt || isNaN(amt) || Number(amt) <= 0) {
            if (typeof toastr !== 'undefined') toastr.warning('请输入有效的转账金额', '小手机伴侣');
            return;
        }
        const token = note ? `〖转账：${amt}元（备注：${note}）〗` : `〖转账：${amt}元〗`;
        dispatchToken(token);
        closeDrawer();
    }

    /**
     * 渲染图片抽屉
     */
    function renderImageDrawer($container) {
        const html = `
<div class="composer-form-card">
    <div class="form-title">
        <button type="button" class="form-back-btn" id="cp_back_to_more" title="返回功能菜单">‹ 返回</button>
        <span>发送照片/图片</span>
    </div>
    <div class="form-row">
        <label>图片描述</label>
        <input type="text" id="cp_img_desc" class="composer-form-input" placeholder="如：发了一张自拍 / 刚才拍的晚霞">
    </div>
    <div class="form-btn-group">
        <button type="button" class="form-btn append" id="cp_img_append">发送</button>
    </div>
</div>
`;
        $container.html(html);

        $('#cp_back_to_more').on('click', () => openDrawer('more'));
        $('#cp_img_append').on('click', () => submitImage());
    }

    function submitImage() {
        const desc = $('#cp_img_desc').val()?.trim() || '照片';
        const token = `〖图片：${desc}〗`;
        dispatchToken(token);
        closeDrawer();
    }

    /**
     * 渲染视频抽屉
     */
    function renderVideoDrawer($container) {
        const html = `
<div class="composer-form-card">
    <div class="form-title">
        <button type="button" class="form-back-btn" id="cp_back_to_more" title="返回功能菜单">‹ 返回</button>
        <span>发送视频</span>
    </div>
    <div class="form-row">
        <label>视频描述</label>
        <input type="text" id="cp_video_desc" class="composer-form-input" placeholder="如：发了一段旅行vlog / 搞笑猫咪视频">
    </div>
    <div class="form-btn-group">
        <button type="button" class="form-btn append" id="cp_video_append">发送</button>
    </div>
</div>
`;
        $container.html(html);

        $('#cp_back_to_more').on('click', () => openDrawer('more'));
        $('#cp_video_append').on('click', () => submitVideo());
    }

    function submitVideo() {
        const desc = $('#cp_video_desc').val()?.trim() || '一段视频';
        const token = `〖视频：${desc}〗`;
        dispatchToken(token);
        closeDrawer();
    }

    /**
     * 渲染位置抽屉
     */
    function renderLocationDrawer($container) {
        const html = `
<div class="composer-form-card">
    <div class="form-title">
        <button type="button" class="form-back-btn" id="cp_back_to_more" title="返回功能菜单">‹ 返回</button>
        <span>发送位置定位</span>
    </div>
    <div class="form-row">
        <label>地点名称</label>
        <input type="text" id="cp_loc_name" class="composer-form-input" placeholder="如：人民广场 / 7-11便利店">
    </div>
    <div class="form-row">
        <label>详细地址 (选填)</label>
        <input type="text" id="cp_loc_addr" class="composer-form-input" placeholder="如：南京东路120号">
    </div>
    <div class="form-btn-group">
        <button type="button" class="form-btn append" id="cp_loc_append">发送</button>
    </div>
</div>
`;
        $container.html(html);

        $('#cp_back_to_more').on('click', () => openDrawer('more'));
        $('#cp_loc_append').on('click', () => submitLocation());
    }

    function submitLocation() {
        const name = $('#cp_loc_name').val()?.trim();
        if (!name) {
            if (typeof toastr !== 'undefined') toastr.warning('请输入地点名称', '小手机伴侣');
            return;
        }
        const addr = $('#cp_loc_addr').val()?.trim();
        const token = addr ? `〖位置：${name}（地址：${addr}）〗` : `〖位置：${name}〗`;
        dispatchToken(token);
        closeDrawer();
    }

    /**
     * 处理文字输入框发送 (一键插入酒馆输入框)
     */
    function handleTextSend() {
        const $input = $('#composer_text_input');
        const text = $input.val().trim();
        if (!text) return;

        const token = `〖${text}〗`;
        dispatchToken(token);
        $input.val('');

        // 恢复右侧 + 号按钮
        $('#composer_btn_send').hide();
        $('#composer_btn_plus').show();
    }

    /**
     * 派发 Token：将短标记插入酒馆输入框 (若手动调整过时间，自动附加前置时间以制造时间差)
     * @param {string} rawToken - 构造好的短标记（如 〖表情：流泪〗）
     */
    function dispatchToken(rawToken) {
        if (!rawToken) return;

        let tokenToSend = rawToken;
        if (isTimeCustomized && currentVirtualTime) {
            // 前置注入时间差
            if (rawToken.startsWith('〖') && rawToken.endsWith('〗')) {
                const inner = rawToken.slice(1, -1);
                tokenToSend = `〖${currentVirtualTime} ${inner}〗`;
            } else {
                tokenToSend = `〖${currentVirtualTime} ${rawToken}〗`;
            }
            // 消耗单次时间差，恢复跟随模式
            isTimeCustomized = false;
            $('#composer_clock_chip').removeClass('customized');
        }

        insertIntoSendTextarea(tokenToSend);
        addPendingBubble(tokenToSend);

        if (typeof toastr !== 'undefined') {
            toastr.success(`已插入: ${tokenToSend}`, '小手机伴侣', { timeOut: 1500 });
        }
    }

    /**
     * 实时拟真上屏：把发送的消息渲染进伴侣小手机屏幕
     */
    function addPendingBubble(tokenToSend) {
        if (!tokenToSend) return;

        let inner = tokenToSend;
        if (tokenToSend.startsWith('〖') && tokenToSend.endsWith('〗')) {
            inner = tokenToSend.slice(1, -1);
        }

        const parsedMsg = (typeof PhoneParser !== 'undefined' && PhoneParser.parseSingleHumanToken)
            ? PhoneParser.parseSingleHumanToken(inner, true, 'Me')
            : { type: 'msg', isMe: true, from: 'Me', content: inner };

        let html = '';
        if (parsedMsg.time) {
            let pillText = parsedMsg.time;
            if (typeof PhoneParser !== 'undefined' && PhoneParser.parseTimeInfo && PhoneParser.formatWeChatPill) {
                const tInfo = PhoneParser.parseTimeInfo(parsedMsg.time, currentVirtualDate);
                if (tInfo && tInfo.dateObj) {
                    pillText = PhoneParser.formatWeChatPill(tInfo.dateObj, currentVirtualDate ? currentVirtualDate.getFullYear() : null, tInfo.hasDate);
                }
            }
            html += `<div class="st-phone-time-sep composer-time-pill"><span>${escapeHtml(pillText || parsedMsg.time)}</span></div>`;
        }

        if (typeof PhoneRenderer !== 'undefined' && PhoneRenderer.renderMessage) {
            html += PhoneRenderer.renderMessage(parsedMsg, 'Me', {}, 'composer_live', pendingDrafts.length);
        } else {
            html += `<div class="st-phone-msg-row msg-me"><div><div class="st-phone-bubble">${escapeHtml(parsedMsg.content || inner)}</div></div></div>`;
        }

        pendingDrafts.push({ token: tokenToSend, msg: parsedMsg });

        const $stream = $('#composer_chat_stream');
        const $msgContainer = $('#composer_stream_messages');
        const $idle = $('#composer_idle_canvas');

        $idle.hide();
        $stream.show();
        $msgContainer.append(html);

        setTimeout(() => {
            if ($msgContainer.length && $msgContainer[0]) {
                $msgContainer.stop().animate({ scrollTop: $msgContainer[0].scrollHeight }, 200);
            }
        }, 50);
    }

    /**
     * 清空本轮草稿气泡 (当酒馆发送生成，或用户手动点击清空)
     * @param {boolean} removeFromTextarea - 是否同步从酒馆输入框剔除对应 token
     */
    function clearDraft(removeFromTextarea = false) {
        if (removeFromTextarea && pendingDrafts.length) {
            const textarea = document.getElementById('send_textarea');
            if (textarea && textarea.value) {
                let val = textarea.value;
                for (const item of pendingDrafts) {
                    val = val.replace(item.token, '');
                }
                val = val.split('\n').filter((l, i, arr) => l.trim() || (i > 0 && arr[i - 1].trim())).join('\n').trim();
                textarea.value = val;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (typeof toastr !== 'undefined') {
                toastr.info('已撤回本轮小手机草稿', '小手机伴侣');
            }
        }

        pendingDrafts = [];
        $('#composer_stream_messages').empty();
        $('#composer_chat_stream').hide();

        if (!currentDrawer) {
            $('#composer_idle_canvas').fadeIn(150);
        }
    }

    /**
     * 插入到酒馆的 #send_textarea
     */
    function insertIntoSendTextarea(textToInsert) {
        const textarea = document.getElementById('send_textarea');
        if (!textarea) return;

        const curVal = textarea.value;
        if (!curVal.trim()) {
            textarea.value = textToInsert;
        } else {
            textarea.value = curVal.trimEnd() + '\n' + textToInsert;
        }

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
    function escapeAttr(str) {
        return (str || '').replace(/"/g, '&quot;');
    }

    return {
        init,
        toggleComposer,
        updateTheme,
        syncLatestTime,
        adjustVirtualTime,
        setVirtualTime,
        getVirtualTime: () => currentVirtualTime,
        getVirtualDate: () => new Date(currentVirtualDate.getTime()),
        isTimeCustomized: () => isTimeCustomized,
        clearDraft,
        updateContact: () => {},
        insertIntoSendTextarea,
    };
})();

// 导出
if (typeof window !== 'undefined') {
    window.PhoneComposer = PhoneComposer;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PhoneComposer = PhoneComposer;
}
