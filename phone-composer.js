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
    let currentContact = '';
    let isContactManuallyCustomized = false;
    let pendingDrafts = [];
    let currentAppView = 'chat'; // 'home' | 'chat' | 'live'

    // SVG / 图标库 (与 PhoneRenderer 保持 1:1 原生一致)
    const ICONS = {
        power: '<i class="fa-solid fa-power-off"></i>',
        rchat: '<i class="fa-solid fa-comment-dots"></i>',
        rlive: '<i class="fa-solid fa-tower-broadcast"></i>',
        signal: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="18" width="3" height="4" rx="0.8"/><rect x="7" y="14" width="3" height="8" rx="0.8"/><rect x="12" y="9" width="3" height="13" rx="0.8"/><rect x="17" y="4" width="3" height="18" rx="0.8"/></svg>',
        wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5.07 12.5a10 10 0 0 1 13.86 0"/><path d="M8.72 16a5 5 0 0 1 6.56 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/></svg>',
        battery: '<svg viewBox="0 0 28 14" fill="currentColor"><rect x="0.5" y="0.5" width="23" height="13" rx="2.5" ry="2.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="3" y="3" width="18" height="8" rx="1"/><path d="M24.5 4.5 C26 4.5 26 9.5 24.5 9.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
        back: '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
        mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>',
        emoji: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
        plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
        transfer: '<svg viewBox="0 0 24 24"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>',
        image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>',
        video: '<svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
        location: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
    };

    // 桌面 App 注册表 (解耦图标、标题与跳转逻辑，方便外部主题、CSS变量或JS插件自由定制与换肤)
    const APP_REGISTRY = {
        rchat: {
            id: 'rchat',
            title: 'RChat',
            view: 'chat',
            iconHtml: ICONS.rchat,
            desc: '即时通讯与互动',
        },
        rlive: {
            id: 'rlive',
            title: 'RLive',
            view: 'live',
            iconHtml: ICONS.rlive,
            desc: '沉浸式角色互动直播间',
        }
    };

    // RLive 直播间专属心意礼物配置库 (女性向/沉浸式高甜与排面礼物)
    const LIVE_GIFTS = [
        { id: 'milktea', name: '草莓波波奶茶', emoji: '🧋', price: '6钻', desc: '甜度超标 · 暖心陪伴' },
        { id: 'glowstick', name: '星光应援棒', emoji: '🪄', price: '18钻', desc: '星海闪烁 · 为你挥舞' },
        { id: 'rose', name: '心动纯白玫瑰', emoji: '🌹', price: '52钻', desc: '浪漫私语 · 钟情于你' },
        { id: 'galaxy', name: '星河之誓', emoji: '🌌', price: '520钻', desc: '浩瀚银河 · 唯你璀璨' },
        { id: 'castle', name: '梦幻告白城堡', emoji: '🏰', price: '1314钻', desc: '童话之境 · 全服见证' },
        { id: 'blackcard', name: '无限额黑卡', emoji: '💳', price: '9999钻', desc: '无限宠溺 · 随心所欲' }
    ];

    let selectedLiveGiftId = null;
    let isLiveActive = false; // 是否处于开播状态 (默认主播未开播)
    const characterLiveBios = {}; // 记录各角色的直播间签名 (持久化记录直到切换角色)
    const characterLiveIds = {};  // 记录各角色的直播间艺名/ID (持久化记录直到切换角色)
    const characterLiveViewers = {}; // 记录各角色场次的在线人数 (持久化记录)
    const characterLiveTimes = {};   // 记录各角色场次的时间/场次标识 (持久化记录直到新开播)
    let currentLiveSessionKey = '';  // 当前场次唯一键 (streamer + time)，用于区分场次并避免串档
    let currentUserLiveId = '';   // 用户在直播间的专属昵称/观众ID (拒绝实名制上网)

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

    <!-- 手机输入伴侣主面板 (完整拟真全屏手机UI，顶部含状态栏与灵动岛) -->
    <div id="st_phone_composer_panel" class="st-phone-composer-panel" style="display: none;">
        <!-- 顶部全功能状态栏 (含虚拟时间、iOS灵动岛、电量/信号、锁屏电源键) -->
        <div class="composer-statusbar st-phone-statusbar" id="composer_statusbar" title="按住可拖拽悬浮窗">
            <span class="status-left" id="composer_status_time">14:00</span>
            <!-- 灵动岛 (Dynamic Island): 纯黑无字胶囊，点击返回主桌面 -->
            <div class="composer-dynamic-island" id="composer_dynamic_island" title="灵动岛 (点击返回主桌面)">
                <span class="island-lens"></span>
            </div>
            <div class="status-right">
                ${ICONS.signal}
                ${ICONS.wifi}
                ${ICONS.battery}
                <button type="button" class="composer-power-btn" id="composer_power_btn" title="锁屏收起 (退回酒馆)">
                    ${ICONS.power}
                </button>
            </div>
        </div>

        <!-- 屏幕主视口容器 -->
        <div class="composer-screen-body" id="composer_screen_body">

            <!-- 视图 1：主桌面 (Home View) -->
            <div class="composer-view-home" id="composer_view_home" style="display: none;">
                <!-- 桌面时间日历小组件 (Widget) -->
                <div class="home-widget-clock">
                    <div class="home-widget-time" id="home_widget_time">14:00</div>
                    <div class="home-widget-date" id="home_widget_date">10月25日 星期六</div>
                </div>

                <!-- 桌面 App 网格 (解耦支持动态替换图标与标题) -->
                <div class="home-app-grid">
                    <!-- App 1: RChat -->
                    <div class="home-app-item" id="home_app_chat" data-app="rchat" title="打开 RChat">
                        <div class="home-app-icon" data-app="rchat">
                            <div class="home-app-icon-custom"></div>
                            <div class="home-app-icon-glyph">
                                ${APP_REGISTRY.rchat.iconHtml}
                            </div>
                            <span class="home-app-badge" id="home_chat_badge" style="display: none;">1</span>
                        </div>
                        <span class="home-app-label">${APP_REGISTRY.rchat.title}</span>
                    </div>

                    <!-- App 2: RLive -->
                    <div class="home-app-item" id="home_app_live" data-app="rlive" title="打开 RLive">
                        <div class="home-app-icon" data-app="rlive">
                            <div class="home-app-icon-custom"></div>
                            <div class="home-app-icon-glyph">
                                ${APP_REGISTRY.rlive.iconHtml}
                            </div>
                            <span class="home-app-live-tag">LIVE</span>
                        </div>
                        <span class="home-app-label">${APP_REGISTRY.rlive.title}</span>
                    </div>
                </div>
            </div>

            <!-- 视图 2：RChat 聊天 App (Chat View) -->
            <div class="composer-view-chat" id="composer_view_chat">
                <!-- 聊天导航栏 (< 留空预留给未来联系人列表) -->
                <div class="composer-header st-phone-navbar" title="按住可拖拽悬浮窗">
                    <div class="composer-title-group">
                        <div class="nav-back composer-nav-back" id="composer_nav_back_reserved" title="联系人列表 (预留)">${ICONS.back}</div>
                        <span class="composer-signal-dot"></span>
                        <div class="composer-contact-chip" id="composer_contact_chip" title="点击切换联络对象">
                            <span class="composer-contact-icon"><i class="fa-regular fa-user"></i></span>
                            <span class="composer-contact-name" id="composer_contact_val">联络中</span>
                            <span class="composer-contact-arrow">▾</span>
                        </div>
                        <div class="composer-clock-chip" id="composer_clock_chip" title="点击使用时间魔法（制造时间差）">
                            <span class="clock-icon"><i class="fa-regular fa-clock"></i></span>
                            <span class="clock-time-val" id="composer_clock_val">14:00</span>
                        </div>
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

                <!-- 原生复用手机底部输入栏 (st-phone-inputbar) -->
                <div class="st-phone-inputbar composer-inputbar">
                    <div class="input-voice-btn" id="composer_btn_voice" title="发送语音条">${ICONS.mic}</div>
                    <input type="text" id="composer_text_input" class="input-field-real" placeholder="输入消息..." autocomplete="off">
                    <div class="input-action-btn" id="composer_btn_emoji" title="表情包">${ICONS.emoji}</div>
                    <div class="input-action-btn" id="composer_btn_plus" title="更多功能">${ICONS.plus}</div>
                    <button type="button" class="composer-send-btn direct" id="composer_btn_send" title="发送" style="display: none;">发送</button>
                </div>
            </div>

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
                                <span class="live-streamer-name" id="live_streamer_name" title="点击修改主播直播间艺名/ID">主播</span>
                                <span class="live-edit-pencil-icon" id="live_streamer_name_edit" title="修改主播直播间艺名/ID"><i class="fa-solid fa-pen"></i></span>
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
                    <button type="button" class="live-action-circle-btn live-user-id-btn" id="live_user_id_btn" title="我的直播间观众昵称 (点击修改，拒绝实名制)">
                        <i class="fa-regular fa-user"></i>
                    </button>
                    <div class="live-danmu-input-pill">
                        <input type="text" class="live-input-field" id="live_danmu_input" placeholder="发条弹幕互动一下..." autocomplete="off">
                        <button type="button" class="live-danmu-send-btn" id="live_danmu_send_btn" title="发弹幕">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    <button type="button" class="live-action-circle-btn live-gift-btn" id="live_gift_btn" title="赠送心动礼物">
                        <i class="fa-solid fa-gift"></i>
                    </button>
                </div>

                <!-- 4. 礼物托盘抽屉 (半屏弹出) -->
                <div class="live-gift-drawer" id="live_gift_drawer" style="display: none;">
                    <div class="live-gift-drawer-header">
                        <div class="drawer-title-group">
                            <span class="drawer-title">🎁 专属心意礼物</span>
                            <span class="drawer-subtitle">选择心动礼物赠予主播</span>
                        </div>
                        <button type="button" class="live-gift-close-btn" id="live_gift_close_btn" title="收起"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="live-gift-grid" id="live_gift_grid">
                        ${LIVE_GIFTS.map(g => `
                            <div class="gift-card-item" data-gift-id="${g.id}">
                                <span class="gift-card-emoji">${g.emoji}</span>
                                <span class="gift-card-name">${g.name}</span>
                                <span class="gift-card-price">${g.price}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="live-gift-footer">
                        <div class="gift-selected-info" id="gift_selected_info">
                            请选择上方心动礼物
                        </div>
                        <button type="button" class="gift-send-btn" id="gift_send_action_btn" disabled>赠送</button>
                    </div>
                </div>
            </div>

        </div>

        <!-- 联系人选择与设定弹窗 -->
        <div class="composer-contact-popover" id="composer_contact_popover" style="display: none;">
            <div class="clock-popover-header">
                <div class="popover-title-group">
                    <span class="popover-title">👤 联络对象</span>
                    <span class="popover-current-badge" id="popover_current_contact">联络中</span>
                </div>
                <div class="popover-header-actions">
                    <button type="button" class="popover-reset-btn" id="composer_contact_sync_btn" title="对齐当前主角色"><i class="fa-solid fa-rotate-right"></i> 当前角色</button>
                    <button type="button" class="popover-done-btn" id="composer_contact_done_btn" title="完成设置">完成</button>
                </div>
            </div>

            <!-- 最近联络人列表 (从剧情中提取) -->
            <div class="clock-group-title">已存联络人 (点击切换)</div>
            <div class="clock-quick-pills" id="composer_recent_contacts_pills">
                <!-- 动态填充 -->
            </div>

            <!-- 自定义联系人 -->
            <div class="clock-group-title" style="margin-top: 10px;">添加联系人 (自动存入当前角色卡)</div>
            <div class="clock-anchor-row">
                <input type="text" class="clock-anchor-input" id="composer_contact_custom_input" placeholder="输入姓名或备注 (如: 班长 / 妈妈)...">
                <button type="button" class="clock-anchor-btn" id="composer_contact_set_btn">设定并存卡</button>
            </div>
            <div class="clock-popover-tip" style="margin-top: 6px;">
                <i class="fa-solid fa-circle-check"></i> 添加的联系人会自动保存在当前角色卡中，像专属表情包一样跟随角色卡。
            </div>
        </div>

        <!-- 时间魔法微调弹窗 (纯按钮点选 + 连续累加机制) -->
        <div class="composer-clock-popover" id="composer_clock_popover" style="display: none;">
            <div class="clock-popover-header">
                <div class="popover-title-group">
                    <span class="popover-title">✨ 时间魔法</span>
                    <span class="popover-current-badge" id="popover_current_clock">14:00</span>
                </div>
                <div class="popover-header-actions">
                    <button type="button" class="popover-reset-btn" id="composer_clock_sync_btn" title="重置为当前剧情最新时间"><i class="fa-solid fa-rotate-right"></i> 随剧情</button>
                    <button type="button" class="popover-done-btn" id="composer_clock_done_btn" title="完成设置">完成</button>
                </div>
            </div>

            <!-- 时间锚点 (自定义剧情基准) -->
            <div class="clock-group-title">定时间锚点 (自定义剧情起点)</div>
            <div class="clock-anchor-row">
                <input type="text" class="clock-anchor-input" id="composer_anchor_input" placeholder="如: 2024-10-19 14:00 或 10-19">
                <button type="button" class="clock-anchor-btn" id="composer_anchor_set_btn" title="设定为当前剧情时间锚点">定锚</button>
                <button type="button" class="clock-anchor-now-btn" id="composer_anchor_today_btn" title="对齐现实今天">今天</button>
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
    </div>
</div>
`;

        $('body').append(html);
        bindEvents();
        updateTheme();
        syncLatestTime();
        updateContact();
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

        // 顶部电源锁屏键 (收起手机回酒馆)
        $('#composer_power_btn, #composer_close_btn').on('click', function (e) {
            e.stopPropagation();
            toggleComposer(false);
        });

        // 灵动岛点击事件 (切回主桌面 / 进畅聊)
        $('#composer_dynamic_island').on('click', function (e) {
            e.stopPropagation();
            if (currentAppView === 'home') {
                switchAppView('chat');
            } else {
                switchAppView('home');
            }
        });

        // 桌面 App 点击
        $('#home_app_chat').on('click', function (e) {
            e.stopPropagation();
            switchAppView('chat');
        });

        $('#home_app_live').on('click', function (e) {
            e.stopPropagation();
            switchAppView('live');
        });

        $('#composer_stream_clear').on('click', function () {
            clearDraft(true);
        });

        // 2. 联系人弹窗与切换
        $('#composer_contact_chip').on('click', function (e) {
            e.stopPropagation();
            toggleContactPopover();
        });

        $('#composer_contact_done_btn').on('click', function () {
            toggleContactPopover(false);
        });

        $('#composer_contact_sync_btn').on('click', function () {
            isContactManuallyCustomized = false;
            updateContact('', true);
            toggleContactPopover(false);
        });

        $('#composer_contact_set_btn').on('click', function () {
            const customVal = $('#composer_contact_custom_input').val()?.trim();
            if (customVal) {
                saveCustomContact(customVal);
                isContactManuallyCustomized = true;
                updateContact(customVal, true);
                $('#composer_contact_custom_input').val('');
                renderContactPopover();
                toggleContactPopover(false);
            }
        });

        $('#composer_contact_custom_input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                $('#composer_contact_set_btn').click();
            }
        });

        $(document).on('click', '#composer_recent_contacts_pills .contact-pill', function (e) {
            if ($(e.target).closest('.contact-pill-del').length) return;
            const c = $(this).attr('data-contact');
            if (c) {
                isContactManuallyCustomized = true;
                updateContact(c, true);
                toggleContactPopover(false);
            }
        });

        $(document).on('click', '#composer_recent_contacts_pills .contact-pill-del', function (e) {
            e.stopPropagation();
            const toDel = $(this).attr('data-del');
            if (toDel) {
                removeCustomContact(toDel);
                renderContactPopover();
                if (currentContact === toDel) {
                    updateContact('', true);
                }
                if (typeof toastr !== 'undefined') {
                    toastr.info(`已从当前角色卡移除联系人: ${toDel}`, '小手机伴侣');
                }
            }
        });

        // 3. 虚拟时钟弹窗与调整
        $('#composer_clock_chip').on('click', function (e) {
            e.stopPropagation();
            toggleClockPopover();
        });

        $(document).on('click', '#st_phone_composer_root #composer_clock_popover .quick-pill', function () {
            const adj = $(this).data('adjust');
            adjustVirtualTime(adj);
        });

        $('#composer_clock_done_btn').on('click', function () {
            toggleClockPopover(false);
        });

        $('#composer_clock_sync_btn').on('click', function () {
            syncLatestTime();
        });

        // 定时间锚点：手动设定与对齐现实今天
        $('#composer_anchor_set_btn').on('click', function () {
            applyCustomAnchorTime();
        });
        $('#composer_anchor_input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCustomAnchorTime();
            }
        });
        $('#composer_anchor_today_btn').on('click', function () {
            const now = new Date();
            const Y = now.getFullYear();
            const M = String(now.getMonth() + 1).padStart(2, '0');
            const D = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const str = `${Y}-${M}-${D} ${hh}:${mm}`;
            $('#composer_anchor_input').val(str);
            applyCustomAnchorTime(str);
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

        // ----------------------------------------------------
        // RLive 直播间交互事件 (弹幕与礼物)
        // ----------------------------------------------------
        // 发送弹幕 (点击纸飞机或按 Enter)
        $('#live_danmu_send_btn').on('click', function (e) {
            e.stopPropagation();
            handleLiveDanmuSend();
        });

        $('#live_danmu_input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLiveDanmuSend();
            }
        });

        // 礼物抽屉唤起与收起
        $('#live_gift_btn').on('click', function (e) {
            e.stopPropagation();
            $('#live_gift_drawer').stop(true, true).fadeToggle(180);
        });

        $('#live_gift_close_btn').on('click', function (e) {
            e.stopPropagation();
            $('#live_gift_drawer').stop(true, true).fadeOut(180);
        });

        // 选择心动礼物
        $(document).on('click', '#st_phone_composer_panel .gift-card-item', function (e) {
            e.stopPropagation();
            const giftId = $(this).data('gift-id');
            selectedLiveGiftId = giftId;
            $('#st_phone_composer_panel .gift-card-item').removeClass('selected');
            $(this).addClass('selected');

            const gift = LIVE_GIFTS.find(g => g.id === giftId);
            if (gift) {
                $('#gift_selected_info').html(`已选：<strong>${gift.name}</strong> (${gift.price} · ${gift.desc})`);
                $('#gift_send_action_btn').prop('disabled', false);
            }
        });

        // 确认赠送礼物
        $('#gift_send_action_btn').on('click', function (e) {
            e.stopPropagation();
            handleLiveGiftSend();
        });

        // 修改主播直播间艺名/ID
        $(document).on('click', '#live_streamer_name, #live_streamer_name_edit', function (e) {
            e.stopPropagation();
            const targetChar = getTargetLiveCharacter() || '主播';
            const curId = getCharacterLiveId(targetChar);
            const newId = prompt(`修改主播【${targetChar}】的直播间艺名/ID：\n(拒绝实名制直播，如："夜航星", "晚风唱片机")`, curId);
            if (newId !== null) {
                saveCharacterLiveId(targetChar, newId.trim());
                if (typeof toastr !== 'undefined') toastr.success(`主播艺名已修改为: ${getCharacterLiveId(targetChar)}`, 'RLive');
            }
        });

        // 点击用户观众ID按钮 (弹出式修改昵称，拒绝实名制上网)
        $(document).on('click', '#live_user_id_btn', function (e) {
            e.stopPropagation();
            const curNick = getUserLiveId();
            const newNick = prompt(`当前直播间观众昵称：【${curNick}】\n\n请输入新的直播间网名：\n(拒绝实名制上网，如："草莓汽水不加糖", "星夜漫游者")`, curNick);
            if (newNick !== null && newNick.trim()) {
                saveUserLiveId(newNick.trim());
                $('#live_user_id_btn').attr('title', `我的直播间昵称: ${getUserLiveId()} (点击修改)`);
                if (typeof toastr !== 'undefined') toastr.success(`你的直播间昵称已更新为: ${getUserLiveId()}`, 'RLive');
            }
        });

        // 修改当前直播间在线人数
        $(document).on('click', '.live-viewers-pill', function (e) {
            e.stopPropagation();
            const targetChar = getTargetLiveCharacter() || '主播';
            const curCount = getCharacterLiveViewers(targetChar);
            const newCount = prompt(`修改主播【${getCharacterLiveId(targetChar)}】直播间的在线人数：\n(如："3.5w", "12580")`, curCount);
            if (newCount !== null && newCount.trim()) {
                saveCharacterLiveViewers(targetChar, newCount.trim());
                if (typeof toastr !== 'undefined') toastr.success(`直播间在线人数已更新为: ${newCount.trim()}`, 'RLive');
            }
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

    /**
     * 初始化悬浮按钮和悬浮窗的拖拽功能
     */
    function initDraggables() {
        makeDraggable('#st_phone_composer_trigger', '#st_phone_composer_trigger', 'st_phone_trigger_pos');
        makeDraggable('#st_phone_composer_panel', '#st_phone_composer_panel .composer-statusbar, #st_phone_composer_panel .composer-header', 'st_phone_panel_pos');

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
                setTimeout(() => {
                    el._pu_drag_prevent_click = false;
                }, 300);
            } else {
                el._pu_drag_prevent_click = false;
            }
        }
    }

    /**
     * 切换手机伴侣内的 App 视图 ('home' | 'chat' | 'live')
     */
    function switchAppView(viewName) {
        currentAppView = viewName || 'chat';
        const $home = $('#composer_view_home');
        const $chat = $('#composer_view_chat');
        const $live = $('#composer_view_live');

        // 关闭浮动弹窗与抽屉
        toggleClockPopover(false);
        toggleContactPopover(false);

        if (viewName === 'home') {
            $chat.hide();
            $live.hide();
            $home.stop(true, true).fadeIn(140);
            updateClockDisplay();
        } else if (viewName === 'chat') {
            $home.hide();
            $live.hide();
            $chat.stop(true, true).fadeIn(140);
        } else if (viewName === 'live') {
            $home.hide();
            $chat.hide();
            $live.stop(true, true).fadeIn(140);
            syncLiveStreamer();
            setTimeout(() => {
                const $stream = $('#live_danmu_stream');
                if ($stream.length) {
                    $stream.scrollTop($stream[0].scrollHeight);
                }
            }, 60);
        }
    }

    /**
     * 获取当前直播间绑定的目标角色名
     */
    function getTargetLiveCharacter(overrideName) {
        if (overrideName && typeof overrideName === 'string' && overrideName.trim()) {
            return overrideName.trim();
        }
        if (currentContact && currentContact !== '未知') {
            return currentContact;
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
     * 获取角色专属的直播间艺名/ID (拒绝实名制直播)
     */
    function getCharacterLiveId(charName) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return '主播';

        // 1. 内存高速缓存
        if (characterLiveIds[targetChar]) {
            return characterLiveIds[targetChar];
        }

        // 2. SillyTavern 插件扩展设置
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const settings = ctx.extensionSettings?.['phone_ui'];
                if (settings?.char_live_ids && settings.char_live_ids[targetChar]) {
                    characterLiveIds[targetChar] = String(settings.char_live_ids[targetChar]).trim();
                    return characterLiveIds[targetChar];
                }
                // 3. 角色卡扩展字段
                if (ctx.characterId && ctx.characters?.[ctx.characterId]) {
                    const cardId = ctx.characters[ctx.characterId]?.data?.extensions?.phone_live_id;
                    if (cardId && typeof cardId === 'string' && cardId.trim()) {
                        characterLiveIds[targetChar] = cardId.trim();
                        return characterLiveIds[targetChar];
                    }
                }
            }
        } catch (e) { }

        // 4. localStorage 兜底
        try {
            const localCharLiveId = localStorage.getItem('st_phone_live_char_id_' + encodeURIComponent(targetChar));
            if (localCharLiveId && localCharLiveId.trim()) {
                characterLiveIds[targetChar] = localCharLiveId.trim();
                return characterLiveIds[targetChar];
            }
        } catch (e) { }

        // 默认回退为当前角色名
        return targetChar;
    }

    /**
     * 保存角色专属的直播间艺名/ID
     */
    function saveCharacterLiveId(charName, newId) {
        const targetChar = getTargetLiveCharacter(charName);
        if (!targetChar) return;
        const cleanId = String(newId || '').trim() || targetChar;

        characterLiveIds[targetChar] = cleanId;

        try {
            localStorage.setItem('st_phone_live_char_id_' + encodeURIComponent(targetChar), cleanId);
        } catch (e) { }

        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const settings = ctx.extensionSettings?.['phone_ui'];
                if (settings) {
                    if (!settings.char_live_ids) settings.char_live_ids = {};
                    settings.char_live_ids[targetChar] = cleanId;
                    if (ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
                }
                if (ctx.characterId && ctx.writeExtensionField) {
                    ctx.writeExtensionField(ctx.characterId, 'phone_live_id', cleanId);
                }
            }
        } catch (e) { }

        $('#live_streamer_name').text(cleanId);
        $('#live_streamer_avatar_text').text(cleanId.charAt(0) || '主');
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
     * 同步直播间主播信息 (头像、艺名、用户观众ID、签名、在线人数)
     */
    function syncLiveStreamer() {
        const targetChar = getTargetLiveCharacter() || '主播';
        const streamerLiveId = getCharacterLiveId(targetChar);
        const userLiveId = getUserLiveId();
        const viewers = getCharacterLiveViewers(targetChar);

        $('#live_streamer_name').text(streamerLiveId);
        $('#live_streamer_avatar_text').text(streamerLiveId.charAt(0) || '主');
        $('#live_user_id_btn').attr('title', `我的直播间观众昵称: ${userLiveId} (点击修改)`);
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

    /**
     * 赠送直播间心意礼物 (拒绝实名制)
     */
    function handleLiveGiftSend() {
        if (!selectedLiveGiftId) return;
        const gift = LIVE_GIFTS.find(g => g.id === selectedLiveGiftId);
        if (!gift) return;

        const targetChar = getTargetLiveCharacter() || '主播';
        const streamerLiveId = getCharacterLiveId(targetChar);
        const userLiveId = getUserLiveId();

        // 1. 播放全屏礼物飘屏动画
        $('#gift_banner_icon').text(gift.emoji);
        $('#gift_banner_name').text(`${gift.name} × 1`);
        $('.gift-banner-user').text(`${userLiveId} 送出了`);
        const $banner = $('#live_gift_banner');
        $banner.stop(true, true).show();
        setTimeout(() => {
            $banner.fadeOut(300);
        }, 2200);

        // 2. 弹幕区追加礼物通知 (纯净无牌子)
        const giftDanmuHtml = `
            <div class="danmu-item danmu-gift">
                <span class="danmu-text">🎉 <strong>【${escapeHtml(userLiveId)}】</strong> 送出了 <strong>【${escapeHtml(gift.name)}】</strong>！</span>
            </div>
        `;
        const $stream = $('#live_danmu_stream');
        $stream.append(giftDanmuHtml);
        $stream.stop().animate({ scrollTop: $stream[0].scrollHeight }, 200);

        // 3. 收起礼物抽屉
        $('#live_gift_drawer').fadeOut(180);

        // 4. 自动插入酒馆输入框 〖打赏：主播艺名 礼物名（来自：观众昵称）〗
        insertIntoSendTextarea(`〖打赏：${streamerLiveId} ${gift.name}（来自：${userLiveId}）〗`);
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
            if (!isContactManuallyCustomized) {
                updateContact();
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
            if (currentAppView === 'live') {
                startLiveDanmuTicker();
            }
        } else {
            $panel.stop(true, true).fadeOut(150);
            $trigger.removeClass('active');
            stopLiveDanmuTicker();
            closeDrawer();
            toggleClockPopover(false);
            toggleContactPopover(false);
        }
    }

    /**
     * 获取当前角色卡专属可用的联络人 (仅当前卡主角色、角色卡内已存联系人、当前会话中的联系人，绝不扫描全酒馆角色库)
     */
    function getAvailableContacts() {
        const list = [];
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const charName = ctx.name2 || '';

                // 1. 当前主角色名
                if (charName && !list.includes(charName)) {
                    list.push(charName);
                }

                // 2. 从当前角色卡内已持久化保存的联系人 (extension data: phone_contacts)
                try {
                    const charData = ctx.characters?.[ctx.characterId];
                    const cardContacts = charData?.data?.extensions?.phone_contacts;
                    if (Array.isArray(cardContacts)) {
                        for (const c of cardContacts) {
                            if (c && typeof c === 'string' && !list.includes(c)) {
                                list.push(c);
                            }
                        }
                    }
                } catch (e) { }

                // 3. 从扩展设置中当前角色保存的联系人 (settings.char_contacts[charName])
                const settings = ctx.extensionSettings?.['phone_ui'];
                if (settings?.char_contacts?.[charName] && Array.isArray(settings.char_contacts[charName])) {
                    for (const c of settings.char_contacts[charName]) {
                        if (c && typeof c === 'string' && !list.includes(c)) {
                            list.push(c);
                        }
                    }
                }

                // 4. 当前这场聊天中曾经出现过的手机联系人 (仅扫当前 chat，不扫其他卡)
                if (ctx.chat && Array.isArray(ctx.chat)) {
                    const maxScan = Math.max(0, ctx.chat.length - 40);
                    for (let i = ctx.chat.length - 1; i >= maxScan; i--) {
                        const m = ctx.chat[i];
                        if (!m || !m.mes) continue;
                        if (typeof PhoneParser !== 'undefined' && PhoneParser.extractPhoneBlocks) {
                            const blocks = PhoneParser.extractPhoneBlocks(m.mes);
                            for (const b of blocks) {
                                if (b.contact && b.contact !== '未知' && !list.includes(b.contact)) {
                                    list.push(b.contact);
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[PhoneComposer] getAvailableContacts error:', e);
        }
        return list;
    }

    /**
     * 将自定义联系人持久化存入当前角色设置与角色卡
     */
    function saveCustomContact(contactName) {
        if (!contactName) return;
        const name = String(contactName).trim();
        if (!name) return;

        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const charName = ctx.name2 || '';
                const settings = ctx.extensionSettings?.['phone_ui'];

                // 1. 存入扩展设置 (char_contacts[charName])
                if (settings && charName) {
                    if (!settings.char_contacts) settings.char_contacts = {};
                    if (!settings.char_contacts[charName]) settings.char_contacts[charName] = [];
                    if (!settings.char_contacts[charName].includes(name)) {
                        settings.char_contacts[charName].push(name);
                    }
                    if (ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
                }

                // 2. 写入角色卡 extension 字段 (phone_contacts，导出卡时自带)
                if (ctx.characterId && ctx.writeExtensionField && charName) {
                    const charData = ctx.characters?.[ctx.characterId];
                    let currentCardContacts = charData?.data?.extensions?.phone_contacts || [];
                    if (!Array.isArray(currentCardContacts)) currentCardContacts = [];
                    if (!currentCardContacts.includes(name)) {
                        currentCardContacts.push(name);
                        ctx.writeExtensionField(ctx.characterId, 'phone_contacts', currentCardContacts);
                    }
                }
            }
        } catch (e) {
            console.warn('[PhoneComposer] saveCustomContact error:', e);
        }
    }

    /**
     * 从当前角色设置与角色卡中移除联系人
     */
    function removeCustomContact(contactName) {
        if (!contactName) return;
        const name = String(contactName).trim();

        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const ctx = SillyTavern.getContext();
                const charName = ctx.name2 || '';
                const settings = ctx.extensionSettings?.['phone_ui'];

                if (settings?.char_contacts?.[charName]) {
                    settings.char_contacts[charName] = settings.char_contacts[charName].filter(c => c !== name);
                    if (ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
                }

                if (ctx.characterId && ctx.writeExtensionField && charName) {
                    const charData = ctx.characters?.[ctx.characterId];
                    let currentCardContacts = charData?.data?.extensions?.phone_contacts || [];
                    if (Array.isArray(currentCardContacts)) {
                        currentCardContacts = currentCardContacts.filter(c => c !== name);
                        ctx.writeExtensionField(ctx.characterId, 'phone_contacts', currentCardContacts);
                    }
                }
            }
        } catch (e) {
            console.warn('[PhoneComposer] removeCustomContact error:', e);
        }
    }

    /**
     * 更新当前选中的联络人
     */
    function updateContact(contactName, notify = false) {
        if (contactName !== undefined && contactName !== null && contactName !== '') {
            currentContact = String(contactName).trim();
        } else if (!isContactManuallyCustomized) {
            // 自动跟随酒馆当前聊天对象
            try {
                if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                    const ctx = SillyTavern.getContext();
                    if (ctx && ctx.name2) {
                        currentContact = ctx.name2;
                    }
                }
            } catch (e) { }
        }

        const displayVal = currentContact || '选择联系人';
        $('#composer_contact_val').text(displayVal);
        $('#popover_current_contact').text(displayVal);
        syncLiveStreamer();

        if (notify && typeof toastr !== 'undefined') {
            toastr.info(`当前联络对象: ${displayVal}`, '小手机伴侣', { timeOut: 1200 });
        }
    }

    /**
     * 渲染联系人抽屉/弹窗的药丸列表
     */
    function renderContactPopover() {
        const $pills = $('#composer_recent_contacts_pills');
        $pills.empty();
        const contacts = getAvailableContacts();

        let ctxCharName = '';
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                ctxCharName = SillyTavern.getContext().name2 || '';
            }
        } catch (e) { }

        if (contacts.length === 0) {
            $pills.html('<span style="font-size:11px;color:#999;padding:4px 0;">暂无联络人记录，请在下方添加</span>');
            return;
        }

        for (const c of contacts) {
            const isCur = c === currentContact;
            const isMainChar = c === ctxCharName;

            const $pill = $(`
                <div class="quick-pill contact-pill ${isCur ? 'active' : ''}" data-contact="${escapeAttr(c)}" title="${escapeAttr(c)}">
                    <span class="contact-pill-name">${escapeHtml(c)}${isMainChar ? ' (当前卡)' : ''}</span>
                    ${!isMainChar ? `<span class="contact-pill-del" data-del="${escapeAttr(c)}" title="从本卡移除此联系人">×</span>` : ''}
                </div>
            `);

            if (isCur) {
                $pill.css({ 'background': 'var(--accent-green, #07c160)', 'color': '#fff', 'border-color': 'var(--accent-green, #07c160)' });
            }

            $pills.append($pill);
        }
    }

    /**
     * 联系人弹窗开关
     */
    function toggleContactPopover(forceState) {
        const $pop = $('#composer_contact_popover');
        const show = forceState !== undefined ? forceState : !$pop.is(':visible');
        if (show) {
            closeDrawer();
            toggleClockPopover(false);
            if (pendingDrafts.length === 0) {
                $('#composer_idle_canvas').hide();
            }
            renderContactPopover();
            $pop.stop(true, true).slideDown(150, function () {
                clampToViewport('#st_phone_composer_panel');
            });
        } else {
            $pop.stop(true, true).slideUp(120, function () {
                if (pendingDrafts.length === 0 && !currentDrawer && !$('#composer_clock_popover').is(':visible')) {
                    $('#composer_idle_canvas').fadeIn(120);
                }
                clampToViewport('#st_phone_composer_panel');
            });
        }
    }

    /**
     * 时间魔法弹窗切换
     */
    function toggleClockPopover(forceState) {
        const $pop = $('#composer_clock_popover');
        const show = forceState !== undefined ? forceState : !$pop.is(':visible');
        if (show) {
            closeDrawer();
            toggleContactPopover(false);
            if (pendingDrafts.length === 0) {
                $('#composer_idle_canvas').hide();
            }
            if (isTimeCustomized && currentVirtualTime) {
                $('#composer_anchor_input').val(currentVirtualTime);
            }
            $pop.stop(true, true).slideDown(150, function () {
                clampToViewport('#st_phone_composer_panel');
            });
        } else {
            $pop.stop(true, true).slideUp(120, function () {
                if (pendingDrafts.length === 0 && !currentDrawer && !$('#composer_contact_popover').is(':visible')) {
                    $('#composer_idle_canvas').fadeIn(120);
                }
                clampToViewport('#st_phone_composer_panel');
            });
        }
    }

    /**
     * 设定自定义时间锚点（作为当前剧情起点）
     */
    function applyCustomAnchorTime(explicitStr) {
        const raw = explicitStr || $('#composer_anchor_input').val()?.trim();
        if (!raw) {
            if (typeof toastr !== 'undefined') toastr.warning('请输入时间，如: 2024-10-19 14:00', '时间魔法');
            return;
        }

        const info = (typeof PhoneParser !== 'undefined' && PhoneParser.parseTimeInfo)
            ? PhoneParser.parseTimeInfo(raw, new Date())
            : null;

        if (!info || !info.dateObj || isNaN(info.dateObj.getTime())) {
            if (typeof toastr !== 'undefined') toastr.error('时间格式无法识别，请使用如: 2024-10-19 14:00', '时间魔法');
            return;
        }

        currentVirtualDate = new Date(info.dateObj.getTime());
        virtualHasYear = info.hasYear || (info.year !== new Date().getFullYear());
        virtualHasDate = true;

        if (typeof PhoneParser !== 'undefined' && PhoneParser.formatDateToCanonical) {
            currentVirtualTime = PhoneParser.formatDateToCanonical(currentVirtualDate, virtualHasYear, virtualHasDate);
        } else {
            currentVirtualTime = raw;
        }

        isTimeCustomized = true;
        updateClockDisplay();

        if (typeof toastr !== 'undefined') {
            toastr.success(`已设定时间锚点: ${currentVirtualTime}`, '✨ 时间魔法');
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
                    $('#composer_anchor_input').val('');
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
        $('#composer_anchor_input').val('');
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

        // 同步顶部状态栏时间与主桌面时钟小组件
        const timeMatch = currentVirtualTime.match(/\b\d{1,2}:\d{2}\b/);
        const timeOnly = timeMatch ? timeMatch[0] : currentVirtualTime;
        $('#composer_status_time').text(timeOnly);
        $('#home_widget_time').text(timeOnly);

        if (currentVirtualDate && !isNaN(currentVirtualDate.getTime())) {
            const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const m = months[currentVirtualDate.getMonth()];
            const d = `${currentVirtualDate.getDate()}日`;
            const w = days[currentVirtualDate.getDay()];
            $('#home_widget_date').text(`${m}${d} ${w}`);
        }
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
            const $home = $('#composer_view_home');
            if (cfg.chatBackground) {
                const bgCss = {
                    'background-image': `url("${cfg.chatBackground}")`,
                    'background-size': 'cover',
                    'background-position': 'center',
                };
                $display.css(bgCss);
                $home.css(bgCss);
            } else {
                $display.css({
                    'background-image': '',
                    'background-size': '',
                    'background-position': '',
                });
                $home.css({
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
        toggleClockPopover(false);
        toggleContactPopover(false);
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
     * 派发 Token：将短标记插入酒馆输入框 (支持通过绑定 [@联系人] 会话头与制造时间差)
     * @param {string} rawToken - 构造好的短标记（如 〖表情：流泪〗）
     */
    function dispatchToken(rawToken) {
        if (!rawToken) return;

        let inner = rawToken.trim();
        if (inner.startsWith('〖') && inner.endsWith('〗')) {
            inner = inner.slice(1, -1).trim();
        }

        // 1. 检查是否在 token 内部已显式手打了 @联系人
        let hasExplicitContact = false;
        if (typeof PhoneParser !== 'undefined' && PhoneParser.parseSingleHumanToken) {
            const testParse = PhoneParser.parseSingleHumanToken(inner, true, currentContact || '未知');
            hasExplicitContact = !!(testParse && testParse.hasExplicitContact);
        } else {
            hasExplicitContact = /^(?:@|给|发给|对|to[:：\s]?|To[:：\s]?)/i.test(inner);
        }

        // 2. 注入时间差 (若用户微调过时钟)
        if (isTimeCustomized && currentVirtualTime) {
            inner = `${currentVirtualTime} ${inner}`;
            isTimeCustomized = false;
            $('#composer_clock_chip').removeClass('customized');
        }

        const tokenToSend = `〖${inner}〗`;

        // 3. 会话头绑定机制：
        // 若当前选定了联系人，且 token 内部未单独 @，在输入框前置绑定 [@联系人]
        let headerToPrepend = '';
        if (!hasExplicitContact && currentContact) {
            const textarea = document.getElementById('send_textarea');
            const curVal = textarea ? textarea.value : '';
            const headerTag = `[@${currentContact}]`;

            // 检查当前输入框中是否已以此联系人会话头结尾/处于该联系人作用域
            const lastDraft = pendingDrafts.length > 0 ? pendingDrafts[pendingDrafts.length - 1] : null;
            const isSameContactAsLast = lastDraft && lastDraft.contact === currentContact;

            if (!isSameContactAsLast || !curVal.includes(headerTag)) {
                headerToPrepend = headerTag;
            }
        }

        insertIntoSendTextarea(tokenToSend, headerToPrepend);
        addPendingBubble(tokenToSend, headerToPrepend, currentContact);

        if (typeof toastr !== 'undefined') {
            toastr.success(`已插入: ${tokenToSend}`, '小手机伴侣', { timeOut: 1500 });
        }
    }

    /**
     * 实时拟真上屏：把发送的消息渲染进伴侣小手机屏幕
     */
    function addPendingBubble(tokenToSend, headerTag = '', contact = '') {
        if (!tokenToSend) return;

        let inner = tokenToSend;
        if (tokenToSend.startsWith('〖') && tokenToSend.endsWith('〗')) {
            inner = tokenToSend.slice(1, -1);
        }

        const parsedMsg = (typeof PhoneParser !== 'undefined' && PhoneParser.parseSingleHumanToken)
            ? PhoneParser.parseSingleHumanToken(inner, true, contact || currentContact || 'Me')
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

        pendingDrafts.push({ token: tokenToSend, header: headerTag, contact: contact || currentContact, msg: parsedMsg });

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
                    if (item.header) {
                        val = val.replace(item.header, '');
                    }
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

        if (!currentDrawer && !$('#composer_clock_popover').is(':visible') && !$('#composer_contact_popover').is(':visible')) {
            $('#composer_idle_canvas').fadeIn(150);
        }
    }

    /**
     * 插入到酒馆的 #send_textarea
     */
    function insertIntoSendTextarea(textToInsert, headerToPrepend = '') {
        const textarea = document.getElementById('send_textarea');
        if (!textarea) return;

        let fullInsert = textToInsert;
        if (headerToPrepend) {
            fullInsert = `${headerToPrepend}\n${textToInsert}`;
        }

        const curVal = textarea.value;
        if (!curVal.trim()) {
            textarea.value = fullInsert;
        } else {
            textarea.value = curVal.trimEnd() + '\n' + fullInsert;
        }

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    }

    /**
     * 动态配置或替换桌面 App 图标、背景与标题 (供主题、CSS变量注入或JS插件调用)
     * @param {'rchat'|'rlive'} appId - 目标 App 标识
     * @param {Object} options - { title?: string, iconHtml?: string, imgUrl?: string, bg?: string }
     */
    function setAppConfig(appId, options = {}) {
        const app = APP_REGISTRY[appId];
        if (!app) return;
        if (options.title) {
            app.title = options.title;
            $(`.home-app-item[data-app="${appId}"] .home-app-label`).text(options.title);
            $(`.home-app-item[data-app="${appId}"]`).attr('title', `打开 ${options.title}`);
        }
        if (options.iconHtml) {
            app.iconHtml = options.iconHtml;
            $(`.home-app-icon[data-app="${appId}"] .home-app-icon-glyph`).html(options.iconHtml);
        }
        if (options.imgUrl !== undefined) {
            const $custom = $(`.home-app-icon[data-app="${appId}"] .home-app-icon-custom`);
            if (options.imgUrl) {
                $custom.css('background-image', `url("${options.imgUrl}")`);
                $(`.home-app-icon[data-app="${appId}"] .home-app-icon-glyph`).hide();
            } else {
                $custom.css('background-image', 'none');
                $(`.home-app-icon[data-app="${appId}"] .home-app-icon-glyph`).show();
            }
        }
        if (options.bg) {
            $(`.home-app-icon[data-app="${appId}"]`).css('background', options.bg);
        }
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
        updateContact: (c) => updateContact(c, false),
        getContact: () => currentContact,
        insertIntoSendTextarea,
        switchAppView,
        setAppConfig,
        getAppConfig: (appId) => APP_REGISTRY[appId],
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
        saveCharacterLiveId,
        appendLiveDanmu,
        showLiveSc,
        syncLiveStreamer,
    };
})();

// 导出
if (typeof window !== 'undefined') {
    window.PhoneComposer = PhoneComposer;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PhoneComposer = PhoneComposer;
}
