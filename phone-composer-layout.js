const PhoneComposerLayout = (() => {
    let dragDisposers = [];
    let viewportCheckTimer = null;

    function init({ triggerSelector, panelSelector, panelHandleSelector, isPanelOpen }) {
        destroy();
        dragDisposers = [
            makeDraggable(triggerSelector, triggerSelector, 'st_phone_trigger_pos'),
            makeDraggable(panelSelector, panelHandleSelector, 'st_phone_panel_pos'),
        ].filter(Boolean);

        const checkViewport = () => {
            clampToViewport(triggerSelector);
            if (isPanelOpen()) {
                clampToViewport(panelSelector);
            }
        };

        $(window).on('resize.pu_draggables orientationchange.pu_draggables', checkViewport);
        viewportCheckTimer = setTimeout(() => {
            viewportCheckTimer = null;
            checkViewport();
        }, 200);
    }

    function destroy() {
        clearTimeout(viewportCheckTimer);
        viewportCheckTimer = null;
        $(window).off('.pu_draggables');
        $(document).off('.pu_drag');
        dragDisposers.forEach(dispose => dispose());
        dragDisposers = [];
    }

    function shouldSuppressClick(element) {
        return !!element && (element._pu_drag_prevent_click || element.classList.contains('dragging'));
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
            pH = isMobile ? Math.min(620, Math.round(screenH * 0.85)) : 600;
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

        let preventClickTimer = null;
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

        $handle.on('mousedown.pu_draggables touchstart.pu_draggables', function (e) {
            if ($(e.target).closest('button, input, select, textarea, .composer-clock-chip, .composer-contact-chip, .composer-dynamic-island, .composer-power-btn, .nav-back, .home-app-item').length) {
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
                clearTimeout(preventClickTimer);
                preventClickTimer = setTimeout(() => {
                    preventClickTimer = null;
                    el._pu_drag_prevent_click = false;
                }, 300);
            } else {
                el._pu_drag_prevent_click = false;
            }
        }

        return () => {
            isDragging = false;
            $handle.off('.pu_draggables');
            $el.removeClass('dragging');
            clearTimeout(preventClickTimer);
            el._pu_drag_prevent_click = false;
        };
    }

    return {
        init,
        destroy,
        positionPanelNearTrigger,
        clampToViewport,
        shouldSuppressClick,
    };
})();

if (typeof window !== 'undefined') {
    window.PhoneComposerLayout = PhoneComposerLayout;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PhoneComposerLayout = PhoneComposerLayout;
}
