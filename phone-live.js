const PhoneLive = (() => {
    let getContact = () => '';
    let insertIntoSendTextarea;

    // RLive 直播间专属心意礼物配置库 (女性向/沉浸式高甜与排面礼物)
    const LIVE_GIFTS = [
        { id: 'milktea', name: '草莓波波奶茶', emoji: '🧋', price: 6, desc: '甜度超标 · 暖心陪伴' },
        { id: 'glowstick', name: '星光应援棒', emoji: '🪄', price: 18, desc: '星海闪烁 · 为你挥舞' },
        { id: 'rose', name: '心动纯白玫瑰', emoji: '🌹', price: 52, desc: '浪漫私语 · 钟情于你' },
        { id: 'galaxy', name: '星河之誓', emoji: '🌌', price: 520, desc: '浩瀚银河 · 唯你璀璨' },
        { id: 'castle', name: '梦幻告白城堡', emoji: '🏰', price: 1314, desc: '童话之境 · 全服见证' },
        { id: 'blackcard', name: '无限额黑卡', emoji: '💳', price: 9999, desc: '无限宠溺 · 随心所欲' }
    ];

    let selectedLiveGiftId = null;
    let isLiveActive = false; // 是否处于开播状态 (默认主播未开播)
    const characterLiveBios = {}; // 记录各角色的直播间签名 (持久化记录直到切换角色)
    let currentLiveStreamer = '';
    const characterLiveViewers = {}; // 记录各角色场次的在线人数 (持久化记录)
    const characterLiveTimes = {};   // 记录各角色场次的时间/场次标识 (持久化记录直到新开播)
    let currentLiveSessionKey = '';  // 当前场次唯一键 (streamer + time)，用于区分场次并避免串档
    let currentUserLiveId = '';   // 用户在直播间的专属昵称/观众ID (拒绝实名制上网)

    function renderView() {
        return `
            <!-- 视图 3：RLive 沉浸式互动直播间 (Live View) -->
            <div class="composer-view-live" id="composer_view_live" style="display: none;">
                <!-- 1. 直播顶部信息栏 (主播头像、姓名、自适应匹配签名、在线人数) -->
                <div class="live-stream-header">
                    <div class="live-streamer-info">
                        <div class="live-streamer-avatar" id="live_streamer_avatar">
                            <span class="live-streamer-avatar-text" id="live_streamer_avatar_text">主</span>
                        </div>
                        <div class="live-streamer-meta">
                            <div class="live-streamer-name-row">
                                <span class="live-streamer-name" id="live_streamer_name">主播</span>
                                <span class="live-stream-live-pill offline" id="live_status_badge">未开播</span>
                            </div>
                            <div class="live-stream-desc-container" id="live_stream_desc_container" style="display: none;">
                                <div class="live-stream-desc" id="live_stream_desc"></div>
                            </div>
                        </div>
                    </div>
                    <div class="live-header-actions">
                        <div class="live-viewers-pill" title="当前在线观看人数">
                            <i class="fa-solid fa-fire"></i> <span id="live_viewers_count">--</span>
                        </div>
                    </div>
                </div>

                <!-- 2. 直播主舞台视口 (直播画面 + 悬浮 SC + 弹幕瀑布流 + 礼物全屏特效) -->
                <div class="live-stage-container" id="live_stage_container">
                    <!-- 2.1 动态光晕与直播画面卡片 (默认主播未开播) -->
                    <div class="live-ambient-glow"></div>
                    <div class="live-stage-canvas" id="live_stage_canvas">
                        <div class="live-narration-card" id="live_narration_card">
                            <div class="live-narration-header">
                                <span class="narration-tag"><i class="fa-solid fa-video"></i> 直播画面</span>
                                <span class="live-timer offline" id="live_stage_timer"><i class="fa-regular fa-clock"></i> 未开播</span>
                            </div>
                            <div class="live-narration-body" id="live_narration_body">
                                主播未开播
                            </div>
                        </div>

                        <!-- 2.1.2 主播开麦原声实时字幕卡片 -->
                        <div class="live-talk-card" id="live_talk_card" style="display: none;">
                            <div class="live-talk-header">
                                <span class="talk-tag"><i class="fa-solid fa-microphone-lines"></i> <span id="live_talk_streamer_tag">主播开麦</span></span>
                                <div class="talk-wave-anim"><span></span><span></span><span></span><span></span></div>
                            </div>
                            <div class="live-talk-body" id="live_talk_body"></div>
                        </div>
                    </div>

                    <!-- 2.2 醒目留言 SC 置顶卡片 (默认未开播/无SC时隐藏) -->
                    <div class="live-sc-container" id="live_sc_container" style="display: none;">
                        <div class="live-sc-card" id="live_sc_card">
                            <div class="sc-card-header">
                                <div class="sc-badge-group">
                                    <span class="sc-price-pill" id="live_sc_price">SC ￥520</span>
                                    <span class="sc-sender-name" id="live_sc_sender"></span>
                                </div>
                                <span class="sc-status-pill"><i class="fa-regular fa-clock"></i> 置顶中</span>
                            </div>
                            <div class="sc-card-content" id="live_sc_content"></div>
                        </div>
                    </div>

                    <!-- 2.3 弹幕流 (真实弹幕流，默认完全空置) -->
                    <div class="live-danmu-stream" id="live_danmu_stream"></div>

                    <!-- 2.4 礼物全屏特效横幅 (送出礼物时横穿屏幕) -->
                    <div class="live-gift-banner" id="live_gift_banner" style="display: none;">
                        <span class="gift-banner-icon" id="gift_banner_icon">🏰</span>
                        <div class="gift-banner-text">
                            <div class="gift-banner-user">你 送出了</div>
                            <div class="gift-banner-name" id="gift_banner_name">梦幻告白城堡 × 1</div>
                        </div>
                    </div>
                </div>

                <!-- 3. 底部互动栏 (我的观众ID按钮 + 弹幕输入框 + 礼物按钮) -->
                <div class="live-bottom-bar">
                    <button type="button" class="live-action-circle-btn live-user-id-btn" id="live_user_id_btn" title="我的直播间观众昵称">
                        <i class="fa-regular fa-user"></i>
                    </button>
                    <div class="live-danmu-input-pill">
                        <input type="text" class="live-input-field" id="live_danmu_input" placeholder="发条弹幕..." autocomplete="off">
                        <button type="button" class="live-danmu-send-btn" id="live_danmu_send_btn" title="发弹幕">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    <button type="button" class="live-action-circle-btn live-gift-btn" id="live_gift_btn" title="礼物与 SC 留言">
                        <i class="fa-solid fa-gift"></i>
                    </button>
                </div>

                <!-- 4. 礼物托盘抽屉 (半屏弹出) -->
                <div class="live-gift-drawer" id="live_gift_drawer" style="display: none;">
                    <div class="live-gift-drawer-header">
                        <div class="drawer-title-group">
                            <span class="drawer-title">🎁 心意互动</span>
                            <span class="drawer-subtitle" id="live_support_subtitle">选择心动礼物赠予主播</span>
                        </div>
                        <button type="button" class="live-gift-close-btn" id="live_gift_close_btn" title="收起"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="live-support-tabs" role="group" aria-label="互动方式">
                        <button type="button" class="live-support-tab active" id="live_support_gift_tab" aria-pressed="true" aria-controls="live_gift_panel">心意礼物</button>
                        <button type="button" class="live-support-tab" id="live_support_sc_tab" aria-pressed="false" aria-controls="live_sc_panel">SC 留言</button>
                    </div>
                    <div id="live_gift_panel">
                        <div class="live-gift-grid" id="live_gift_grid">
                            ${LIVE_GIFTS.map(gift => `
                                <div class="gift-card-item" data-gift-id="${gift.id}">
                                    <span class="gift-card-emoji">${gift.emoji}</span>
                                    <span class="gift-card-name">${gift.name}</span>
                                    <span class="gift-card-price">${gift.price}钻</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="live-gift-footer">
                            <div class="gift-selected-info" id="gift_selected_info">请选择上方心动礼物</div>
                            <div class="live-gift-quantity" role="group" aria-label="礼物数量">
                                <button type="button" id="live_gift_quantity_minus" aria-label="减少礼物数量" disabled>−</button>
                                <input type="number" id="live_gift_quantity" aria-label="礼物数量" min="1" max="9999" step="1" value="1" inputmode="numeric" required disabled>
                                <button type="button" id="live_gift_quantity_plus" aria-label="增加礼物数量" disabled>+</button>
                            </div>
                            <span class="live-gift-total" id="live_gift_total" aria-live="polite">合计 0 钻</span>
                            <button type="button" class="gift-send-btn" id="gift_send_action_btn" disabled>赠送</button>
                        </div>
                    </div>
                    <div class="live-sc-form" id="live_sc_panel" style="display: none;">
                        <label class="live-sc-label" for="live_sc_amount">留言金额</label>
                        <div class="live-sc-amount-field">
                            <span aria-hidden="true">￥</span>
                            <input type="number" id="live_sc_amount" aria-label="留言金额" min="0.01" max="999999.99" step="0.01" inputmode="decimal" placeholder="输入金额" required>
                        </div>
                        <label class="live-sc-label" for="live_sc_message">想对主播说的话</label>
                        <textarea id="live_sc_message" rows="3" placeholder="写下你的醒目留言…" required></textarea>
                        <div class="live-sc-actions">
                            <span class="drawer-subtitle">以你的观众昵称署名</span>
                            <button type="button" class="gift-send-btn" id="live_sc_send_btn" disabled>发送 SC</button>
                        </div>
                    </div>
                </div>
            </div>
`;
    }

    function init({ getContact: resolveContact, insertIntoSendTextarea: insertText }) {
        getContact = resolveContact;
        insertIntoSendTextarea = insertText;
        selectedLiveGiftId = null;
        bindEvents();
        updateLiveGiftSelection();
        updateLiveScSendButton();
    }

    function bindEvents() {
        const $view = $('#composer_view_live');
        $view.off('.phoneLive');
        // 发送弹幕 (点击纸飞机或按 Enter)
        $view.on('click.phoneLive', '#live_danmu_send_btn', function (e) {
            e.stopPropagation();
            handleLiveDanmuSend();
        });

        $view.on('keydown.phoneLive', '#live_danmu_input', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLiveDanmuSend();
            }
        });

        // 礼物抽屉唤起与收起
        $view.on('click.phoneLive', '#live_gift_btn', function (e) {
            e.stopPropagation();
            $('#live_gift_drawer').stop(true, true).fadeToggle(180);
        });

        $view.on('click.phoneLive', '#live_gift_close_btn', function (e) {
            e.stopPropagation();
            $('#live_gift_drawer').stop(true, true).fadeOut(180);
        });

        // 选择心动礼物
        $view.on('click.phoneLive', '.gift-card-item', function (e) {
            e.stopPropagation();
            const giftId = $(this).data('gift-id');
            selectedLiveGiftId = giftId;
            $view.find('.gift-card-item').removeClass('selected');
            $(this).addClass('selected');

            updateLiveGiftSelection();
        });

        $view.on('input.phoneLive change.phoneLive', '#live_gift_quantity', updateLiveGiftSelection);
        $view.on('click.phoneLive', '#live_gift_quantity_minus, #live_gift_quantity_plus', function (event) {
            event.stopPropagation();
            const adjustment = this.id === 'live_gift_quantity_plus' ? 1 : -1;
            const quantity = getLiveGiftQuantity() || 1;
            $('#live_gift_quantity').val(Math.max(1, Math.min(9999, quantity + adjustment)));
            updateLiveGiftSelection();
        });

        $view.on('click.phoneLive', '#live_support_gift_tab, #live_support_sc_tab', function (event) {
            event.stopPropagation();
            const isSc = this.id === 'live_support_sc_tab';
            $('#live_support_gift_tab').toggleClass('active', !isSc).attr('aria-pressed', String(!isSc));
            $('#live_support_sc_tab').toggleClass('active', isSc).attr('aria-pressed', String(isSc));
            $('#live_gift_panel').toggle(!isSc);
            $('#live_sc_panel').toggle(isSc);
            $('#live_support_subtitle').text(isSc ? '让想说的话被看见' : '选择心动礼物赠予主播');
        });

        $view.on('input.phoneLive change.phoneLive', '#live_sc_amount, #live_sc_message', updateLiveScSendButton);
        $view.on('click.phoneLive', '#live_sc_send_btn', function (event) {
            event.stopPropagation();
            handleLiveScSend();
        });

        // 确认赠送礼物
        $view.on('click.phoneLive', '#gift_send_action_btn', function (e) {
            e.stopPropagation();
            handleLiveGiftSend();
        });

        // 点击用户观众ID按钮 (弹出式修改昵称，拒绝实名制上网)
        $view.on('click.phoneLive', '#live_user_id_btn', function (e) {
            e.stopPropagation();
            const curNick = getUserLiveId();
            const newNick = prompt(`当前直播间观众昵称：【${curNick}】\n\n请输入新的直播间网名：`, curNick);
            if (newNick !== null && newNick.trim()) {
                saveUserLiveId(newNick.trim());
                $('#live_user_id_btn').attr('title', `我的直播间昵称: ${getUserLiveId()}`);
                if (typeof toastr !== 'undefined') toastr.success(`你的直播间昵称已更新为: ${getUserLiveId()}`, 'RLive');
            }
        });

        // 修改当前直播间在线人数
        $(document).off('click.phoneLive', '.live-viewers-pill').on('click.phoneLive', '.live-viewers-pill', function (e) {
            e.stopPropagation();
            const targetChar = getTargetLiveCharacter() || '主播';
            const curCount = getCharacterLiveViewers(targetChar);
            const newCount = prompt(`修改主播【${getCharacterLiveId(targetChar)}】直播间的在线人数：`, curCount);
            if (newCount !== null && newCount.trim()) {
                saveCharacterLiveViewers(targetChar, newCount.trim());
                if (typeof toastr !== 'undefined') toastr.success(`直播间在线人数已更新为: ${newCount.trim()}`, 'RLive');
            }
        });
    }

    function onOpen() {
        syncLiveStreamer();
        setTimeout(() => {
            const $stream = $('#live_danmu_stream');
            if ($stream.length) {
                $stream.scrollTop($stream[0].scrollHeight);
            }
        }, 60);
    }

    /**
     * 获取当前直播间绑定的目标角色名
     */
    function getTargetLiveCharacter(overrideName) {
        if (overrideName && typeof overrideName === 'string' && overrideName.trim()) {
            return overrideName.trim();
        }
        if (currentLiveStreamer) {
            return currentLiveStreamer;
        }
        const contact = getContact();
        if (contact && contact !== '未知') {
            return contact;
        }
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                if (ctx && ctx.name2) return ctx.name2;
            }
        } catch (e) { }
        return '';
    }

    /**
     * 获取指定角色的直播间专属签名 (自动匹配当前角色，持久化记录直到切换角色)
     * 若未设置则返回空字符串 (不使用占位符，由 AI 在 RP 中填充)
     */
    function getCharacterLiveBio(charName) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return '';

        // 1. 内存高速缓存
        if (characterLiveBios[targetChar] !== undefined) {
            return characterLiveBios[targetChar];
        }

        // 2. SillyTavern 插件扩展设置
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const settings = ctx.extensionSettings?.['phone_ui'];
                if (settings?.char_live_bio && settings.char_live_bio[targetChar]) {
                    characterLiveBios[targetChar] = String(settings.char_live_bio[targetChar]).trim();
                    return characterLiveBios[targetChar];
                }
                // 3. 角色卡内置扩展字段 (导出卡片时自带)
                if (ctx.characterId && ctx.characters?.[ctx.characterId]) {
                    const cardBio = ctx.characters[ctx.characterId]?.data?.extensions?.phone_live_bio;
                    if (cardBio && typeof cardBio === 'string') {
                        characterLiveBios[targetChar] = cardBio.trim();
                        return characterLiveBios[targetChar];
                    }
                }
            }
        } catch (e) { }

        // 4. 本地 localStorage 兜底
        try {
            const localBio = localStorage.getItem('st_phone_live_bio_' + encodeURIComponent(targetChar));
            if (localBio) {
                characterLiveBios[targetChar] = String(localBio).trim();
                return characterLiveBios[targetChar];
            }
        } catch (e) { }

        return '';
    }

    /**
     * 保存指定角色的直播间专属签名 (持久化记录直到换角色)
     */
    function saveCharacterLiveBio(charName, bio) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return;
        const cleanBio = String(bio || '').trim();

        // 1. 内存同步
        characterLiveBios[targetChar] = cleanBio;

        // 2. localStorage 同步
        try {
            if (cleanBio) {
                localStorage.setItem('st_phone_live_bio_' + encodeURIComponent(targetChar), cleanBio);
            } else {
                localStorage.removeItem('st_phone_live_bio_' + encodeURIComponent(targetChar));
            }
        } catch (e) { }

        // 3. SillyTavern 设置及角色卡同步
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const settings = ctx.extensionSettings?.['phone_ui'];
                if (settings) {
                    if (!settings.char_live_bio) settings.char_live_bio = {};
                    settings.char_live_bio[targetChar] = cleanBio;
                    if (ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
                }
                if (ctx.characterId && ctx.writeExtensionField) {
                    ctx.writeExtensionField(ctx.characterId, 'phone_live_bio', cleanBio);
                }
            }
        } catch (e) { }
    }

    /**
     * 获取用户在直播间的专属昵称/ID (拒绝实名制上网)
     */
    function getUserLiveId() {
        if (currentUserLiveId) return currentUserLiveId;

        // 1. SillyTavern 插件扩展设置
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const settings = ctx.extensionSettings?.['phone_ui'];
                if (settings?.user_live_id && typeof settings.user_live_id === 'string' && settings.user_live_id.trim()) {
                    currentUserLiveId = settings.user_live_id.trim();
                    return currentUserLiveId;
                }
            }
        } catch (e) { }

        // 2. localStorage 兜底
        try {
            const localUserLiveId = localStorage.getItem('st_phone_user_live_id');
            if (localUserLiveId && localUserLiveId.trim()) {
                currentUserLiveId = localUserLiveId.trim();
                return currentUserLiveId;
            }
        } catch (e) { }

        // 3. 默认回退昵称 (拒绝实名)
        return '热心观众';
    }

    /**
     * 保存用户直播间昵称/ID
     */
    function saveUserLiveId(newId) {
        const cleanId = String(newId || '').trim();
        currentUserLiveId = cleanId || '热心观众';

        try {
            localStorage.setItem('st_phone_user_live_id', currentUserLiveId);
        } catch (e) { }

        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const settings = ctx.extensionSettings?.['phone_ui'];
                if (settings) {
                    settings.user_live_id = currentUserLiveId;
                    if (ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
                }
            }
        } catch (e) { }

        $('#live_user_name_val').text(currentUserLiveId);
    }

    /**
     * 获取 AI 输出匹配的直播间主播名
     */
    function getCharacterLiveId(charName) {
        return getTargetLiveCharacter(charName) || '主播';
    }

    /**
     * 获取角色当前直播场次的人数
     */
    function getCharacterLiveViewers(charName) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return '1.2w';
        if (characterLiveViewers[targetChar] !== undefined) {
            return characterLiveViewers[targetChar];
        }
        try {
            const local = localStorage.getItem('st_phone_live_viewers_' + encodeURIComponent(targetChar));
            if (local && local.trim()) {
                characterLiveViewers[targetChar] = local.trim();
                return characterLiveViewers[targetChar];
            }
        } catch (e) { }
        return '1.2w';
    }

    /**
     * 保存角色直播场次的人数
     */
    function saveCharacterLiveViewers(charName, count) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return;
        const clean = String(count || '').trim() || '1.2w';
        characterLiveViewers[targetChar] = clean;
        try {
            localStorage.setItem('st_phone_live_viewers_' + encodeURIComponent(targetChar), clean);
        } catch (e) { }
        $('#live_viewers_count').text(clean);
    }

    /**
     * 获取角色当前直播场次的时间/场次标识 (持久化记录)
     */
    function getCharacterLiveTime(charName) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return '';
        if (characterLiveTimes[targetChar] !== undefined) {
            return characterLiveTimes[targetChar];
        }
        try {
            const local = localStorage.getItem('st_phone_live_time_' + encodeURIComponent(targetChar));
            if (local && local.trim()) {
                characterLiveTimes[targetChar] = local.trim();
                return characterLiveTimes[targetChar];
            }
        } catch (e) { }
        return '';
    }

    /**
     * 保存角色直播场次的时间/场次标识
     */
    function saveCharacterLiveTime(charName, timeStr) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return;
        const clean = String(timeStr || '').trim();
        characterLiveTimes[targetChar] = clean;
        try {
            localStorage.setItem('st_phone_live_time_' + encodeURIComponent(targetChar), clean);
        } catch (e) { }
    }

    /**
     * 同步直播间主播信息 (头像、主播名、用户观众ID、签名、在线人数)
     */
    function syncLiveStreamer(streamerName) {
        if (typeof streamerName === 'string') {
            currentLiveStreamer = streamerName.trim();
        }
        const targetChar = getTargetLiveCharacter() || '主播';
        const streamerLiveId = getCharacterLiveId(targetChar);
        const userLiveId = getUserLiveId();
        const viewers = getCharacterLiveViewers(targetChar);

        $('#live_streamer_name').text(streamerLiveId);
        $('#live_streamer_avatar_text').text(streamerLiveId.charAt(0) || '主');
        $('#live_user_id_btn').attr('title', `我的直播间观众昵称: ${userLiveId}`);
        if (isLiveActive) {
            $('#live_viewers_count').text(viewers);
        }

        // 尝试自动匹配角色头像图片
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                if (ctx && ctx.characterId && ctx.characters?.[ctx.characterId]) {
                    const charData = ctx.characters[ctx.characterId];
                    if (charData.avatar) {
                        const avatarUrl = `/characters/${encodeURIComponent(charData.avatar)}`;
                        $('#live_streamer_avatar').css({
                            'background-image': `url("${avatarUrl}")`,
                            'background-size': 'cover',
                            'background-position': 'center'
                        });
                        $('#live_streamer_avatar_text').hide();
                    } else {
                        $('#live_streamer_avatar').css('background-image', 'none');
                        $('#live_streamer_avatar_text').show();
                    }
                }
            }
        } catch (e) { }

        // 自动匹配并保留当前角色的签名直到角色更换
        const charBio = getCharacterLiveBio(targetChar);
        const $descContainer = $('#live_stream_desc_container');
        const $descText = $('#live_stream_desc');

        if (charBio) {
            $descText.text(`${charBio} · `);
            $descContainer.show();
        } else {
            // 空置，无需占位符，等待 AI 在 RP 中填充
            $descText.text('');
            $descContainer.hide();
        }
    }

    /**
     * 动态更新直播间状态 (支持 AI 在 RP 中或扩展系统调用更新)
     * @param {object} opts
     * @param {boolean} [opts.isLive] - 是否开播 (true: LIVE / false: 未开播)
     * @param {string} [opts.scene] - 直播画面叙述
     * @param {string} [opts.talk] - 主播开麦原声台词
     * @param {string} [opts.bio] - 主播签名简介 (自动持久化并绑定当前角色直到切换角色)
     * @param {string|number} [opts.viewers] - 在线人数
     * @param {string} [opts.time] - 直播场次/时间标识 (用于隔离场次，避免串档)
     * @param {object} [opts.sc] - { sender, content, price }
     */
    function updateLiveState(opts = {}) {
        const targetChar = getTargetLiveCharacter(opts.streamer) || '主播';
        const streamerLiveId = getCharacterLiveId(targetChar);

        // 场次时间标识与场次自然隔离 (避免不同场次串档)
        // 核心设计：仅在开播那一刻输出一次 time，后续同场直播互动无需重复输出！
        // 系统会自动持久化本场时间；直到下一次开播 AI 输出了一个全新的不同时间（如跨天 "次日 15:00"），才自动识别为新场次并自然分隔
        const passedTime = opts.time ? String(opts.time).trim() : '';
        const oldTime = getCharacterLiveTime(targetChar);

        if (passedTime && oldTime && oldTime !== passedTime) {
            // 💥 检测到全新的一场直播！时间与上一场不同，清空旧场次的残留弹幕与SC，自然分隔，绝不串档！
            $('#live_danmu_stream').empty();
            $('#live_sc_container').hide();
        }

        if (passedTime) {
            saveCharacterLiveTime(targetChar, passedTime);
        }

        const sessionTime = passedTime || oldTime;
        if (sessionTime) {
            currentLiveSessionKey = `${targetChar}_${sessionTime}`;
            if (isLiveActive) {
                $('#live_stage_timer').html(`<i class="fa-regular fa-clock"></i> ${escapeHtml(sessionTime)}`);
            }
        }

        if (opts.isLive !== undefined) {
            isLiveActive = !!opts.isLive;
            if (isLiveActive) {
                $('#live_status_badge').removeClass('offline').text('LIVE');
                if (!sessionTime) {
                    $('#live_stage_timer').removeClass('offline').html('<i class="fa-regular fa-clock"></i> 00:00');
                } else {
                    $('#live_stage_timer').removeClass('offline');
                }
                $('#live_viewers_count').text(getCharacterLiveViewers(targetChar));
            } else {
                $('#live_status_badge').addClass('offline').text('未开播');
                $('#live_stage_timer').addClass('offline').html('<i class="fa-regular fa-clock"></i> 未开播');
                $('#live_viewers_count').text('--');
                $('#live_narration_body').text('主播未开播');
                $('#live_talk_card').hide();
            }
        }

        if (opts.viewers !== undefined && opts.viewers) {
            saveCharacterLiveViewers(targetChar, opts.viewers);
            if (isLiveActive) {
                $('#live_viewers_count').text(opts.viewers);
            }
        }

        if (opts.scene !== undefined) {
            $('#live_narration_body').text(opts.scene || (isLiveActive ? '直播进行中...' : '主播未开播'));
        }

        // 主播开麦原声台词
        if (opts.talk !== undefined) {
            const talkText = String(opts.talk || '').trim();
            const $talkCard = $('#live_talk_card');
            if (talkText) {
                $('#live_talk_streamer_tag').text(`${streamerLiveId} 开麦`);
                $('#live_talk_body').text(talkText);
                $talkCard.stop(true, true).slideDown(180);
            } else {
                $talkCard.hide();
            }
        }

        if (opts.bio !== undefined) {
            const bioText = String(opts.bio).trim();
            saveCharacterLiveBio(targetChar, bioText);
            const $descContainer = $('#live_stream_desc_container');
            const $descText = $('#live_stream_desc');
            if (bioText) {
                $descText.text(`${bioText} · `);
                $descContainer.show();
            } else {
                $descText.text('');
                $descContainer.hide();
            }
        }

        if (opts.sc) {
            showLiveSc(opts.sc.sender || '热心观众', opts.sc.content, opts.sc.price || '￥520');
        }

        syncLiveStreamer(targetChar);
    }

    /**
     * 展示置顶 SC 卡片
     */
    function showLiveSc(sender, content, price = '￥520') {
        $('#live_sc_price').text(`SC ${price}`);
        $('#live_sc_sender').text(sender || '');
        $('#live_sc_content').text(content || '');
        $('#live_sc_container').stop(true, true).slideDown(200);
    }

    /**
     * 向直播间弹幕流中追加弹幕
     */
    function appendLiveDanmu({ sender, text, isMe }) {
        if (!text) return;
        const s = sender || (isMe ? getUserLiveId() : '观众');
        const meClass = isMe ? 'danmu-me' : '';
        const meSenderClass = isMe ? 'danmu-me-sender' : '';
        const danmuHtml = `
            <div class="danmu-item ${meClass}">
                <span class="danmu-sender ${meSenderClass}">${escapeHtml(s)}:</span>
                <span class="danmu-text">${escapeHtml(text)}</span>
            </div>
        `;
        const $stream = $('#live_danmu_stream');
        if (!$stream.length) return;
        $stream.append(danmuHtml);
        const $items = $stream.children('.danmu-item');
        if ($items.length > 50) {
            $items.slice(0, $items.length - 50).remove();
        }
        $stream.stop().animate({ scrollTop: $stream[0].scrollHeight }, 200);
    }

    /**
     * 发送直播间弹幕 (纯净无牌子格式，署名用户专属观众ID，拒绝实名制)
     */
    function handleLiveDanmuSend() {
        const $input = $('#live_danmu_input');
        const text = $input.val()?.trim();
        if (!text) return;

        const userLiveId = getUserLiveId();
        appendLiveDanmu({ sender: userLiveId, text, isMe: true });
        $input.val('');

        // 自动插入酒馆输入框 〖弹幕：网名：内容〗
        insertIntoSendTextarea(`〖弹幕：${userLiveId}：${text}〗`);
    }

    function getLiveGiftQuantity() {
        const input = $('#live_gift_quantity')[0];
        const quantity = Number(input?.value);
        return input?.validity.valid && Number.isInteger(quantity) && quantity >= 1 && quantity <= 9999 ? quantity : null;
    }

    function updateLiveGiftSelection() {
        const gift = LIVE_GIFTS.find(item => item.id === selectedLiveGiftId);
        const quantity = getLiveGiftQuantity();
        $('#live_gift_quantity').prop('disabled', !gift);
        $('#live_gift_quantity_minus').prop('disabled', !gift || quantity === 1);
        $('#live_gift_quantity_plus').prop('disabled', !gift || quantity === 9999);
        $('#gift_send_action_btn').prop('disabled', !gift || !quantity);
        $('#gift_selected_info').text(gift ? `已选：${gift.name}` : '请选择上方心动礼物').attr('title', gift?.desc || '');
        $('#live_gift_total').text(gift ? (quantity ? `合计 ${gift.price * quantity} 钻` : '请输入有效数量') : '合计 0 钻');
    }

    function getLiveScDraft() {
        const amountInput = $('#live_sc_amount')[0];
        const amount = Number(amountInput?.value);
        const content = String($('#live_sc_message').val() || '').trim();
        if (!amountInput?.validity.valid || !Number.isFinite(amount) || amount < 0.01 || amount > 999999.99 || !content) return null;
        return { price: `￥${amount.toFixed(2)}`, content };
    }

    function updateLiveScSendButton() {
        $('#live_sc_send_btn').prop('disabled', !getLiveScDraft());
    }

    function handleLiveScSend() {
        const draft = getLiveScDraft();
        if (!draft) return;
        const userLiveId = getUserLiveId();
        showLiveSc(userLiveId, draft.content, draft.price);
        insertIntoSendTextarea(`〖SC：${userLiveId}|${draft.price}|${draft.content}〗`);
        $('#live_sc_amount, #live_sc_message').val('');
        updateLiveScSendButton();
        $('#live_gift_drawer').stop(true, true).fadeOut(180);
    }

    /**
     * 赠送直播间心意礼物 (拒绝实名制)
     */
    function handleLiveGiftSend() {
        if (!selectedLiveGiftId) return;
        const gift = LIVE_GIFTS.find(g => g.id === selectedLiveGiftId);
        if (!gift) return;
        const quantity = getLiveGiftQuantity();
        if (!quantity) return;

        const targetChar = getTargetLiveCharacter() || '主播';
        const streamerLiveId = getCharacterLiveId(targetChar);
        const userLiveId = getUserLiveId();

        // 1. 播放全屏礼物飘屏动画
        $('#gift_banner_icon').text(gift.emoji);
        $('#gift_banner_name').text(`${gift.name} × ${quantity}`);
        $('.gift-banner-user').text(`${userLiveId} 送出了`);
        const $banner = $('#live_gift_banner');
        $banner.stop(true, true).show();
        setTimeout(() => {
            $banner.fadeOut(300);
        }, 2200);

        // 2. 弹幕区追加礼物通知 (纯净无牌子)
        const giftDanmuHtml = `
            <div class="danmu-item danmu-gift">
                <span class="danmu-text">🎉 <strong>【${escapeHtml(userLiveId)}】</strong> 送出了 <strong>【${escapeHtml(gift.name)} × ${quantity}】</strong>！</span>
            </div>
        `;
        const $stream = $('#live_danmu_stream');
        $stream.append(giftDanmuHtml);
        $stream.stop().animate({ scrollTop: $stream[0].scrollHeight }, 200);

        // 3. 收起礼物抽屉
        $('#live_gift_drawer').fadeOut(180);

        // 4. 自动插入酒馆输入框 〖打赏：主播艺名 礼物名（来自：观众昵称）〗
        insertIntoSendTextarea(`〖打赏：${streamerLiveId} ${gift.name} × ${quantity}（来自：${userLiveId}）〗`);
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    return {
        renderView,
        init,
        onOpen,
        updateLiveState,
        getCharacterLiveBio,
        saveCharacterLiveBio,
        getCharacterLiveViewers,
        saveCharacterLiveViewers,
        getCharacterLiveTime,
        saveCharacterLiveTime,
        getUserLiveId,
        saveUserLiveId,
        getCharacterLiveId,
        appendLiveDanmu,
        showLiveSc,
        syncLiveStreamer,
    };
})();

if (typeof window !== 'undefined') {
    window.PhoneLive = PhoneLive;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PhoneLive = PhoneLive;
}
