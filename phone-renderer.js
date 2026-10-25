/**
 * SillyTavern Phone UI Extension — HTML 渲染器
 * 将解析后的结构化数据渲染为手机 UI HTML
 */

const PhoneRenderer = (() => {

    // SVG 图标常量 — iOS 风格
    const ICONS = {
        back: '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
        search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
        // iOS 风格信号格 (4 bars)
        signal: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="18" width="3" height="4" rx="0.8"/><rect x="7" y="14" width="3" height="8" rx="0.8"/><rect x="12" y="9" width="3" height="13" rx="0.8"/><rect x="17" y="4" width="3" height="18" rx="0.8"/></svg>',
        // iOS 风格 WiFi
        wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5.07 12.5a10 10 0 0 1 13.86 0"/><path d="M8.72 16a5 5 0 0 1 6.56 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/></svg>',
        // iOS 风格电池 (横向圆角 + 正极凸起)
        battery: '<svg viewBox="0 0 28 14" fill="currentColor"><rect x="0.5" y="0.5" width="23" height="13" rx="2.5" ry="2.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="3" y="3" width="18" height="8" rx="1"/><path d="M24.5 4.5 C26 4.5 26 9.5 24.5 9.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
        volume: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
        dollar: '<svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
        location: '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>',
        emoji: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
        plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    };

    function escapeHtml(text) {
        if (!text) return '';
        if (typeof document !== 'undefined' && document.createElement) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatUrl(url) {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image') || url.startsWith('/')) {
            return url;
        }
        // 如果像是 domain.com/path 或 sub.domain.com/path 这样的短链，自动补全 https://
        if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\//.test(url)) {
            return 'https://' + url;
        }
        return null;
    }

    /**
     * 渲染头像（支持多角色名字匹配）
     * @param {string} name - 显示名，如 "Me" 或角色名
     * @param {boolean} isMe - 是否是用户自己
     * @param {string} [senderName] - 消息实际发送者名字（用于多角色匹配）
     */
    function renderAvatar(name, isMe, senderName) {
        const cfg = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getConfig) ? PhoneInteractions.getConfig() : {};
        let url = '';
        if (isMe) {
            url = cfg.userAvatar || '';
        } else {
            // 优先级: 多角色映射表(精确匹配) → 用户填写的单个charAvatar → ST角色列表自动匹配
            const avatarMap = cfg.charAvatarMap || {};
            const lookupName = senderName || name;
            if (lookupName && avatarMap[lookupName]) {
                url = avatarMap[lookupName];
            } else if (cfg.charAvatar) {
                url = cfg.charAvatar;
            } else if (lookupName) {
                // 尝试从 SillyTavern 角色列表自动匹配
                url = tryMatchSTAvatar(lookupName) || '';
            }
        }
        const letter = escapeHtml(name ? name.charAt(0) : '?');
        
        if (url) {
            // 自动补全可能缺失协议的短链 (支持子域名)
            if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\//.test(url)) {
                url = 'https://' + url;
            }
            return `<div class="st-phone-avatar"><img src="${escapeHtml(url)}" alt="${letter}" onerror="this.remove()"><span class="avatar-fallback">${letter}</span></div>`;
        }
        return `<div class="st-phone-avatar">${letter}</div>`;
    }

    /**
     * 尝试从 SillyTavern 角色列表中按名字匹配头像
     */
    function tryMatchSTAvatar(name) {
        try {
            const ctx = SillyTavern.getContext();
            if (!ctx.characters) return null;
            for (const char of ctx.characters) {
                if (char.name === name && char.avatar) {
                    return `/characters/${char.avatar}`;
                }
            }
        } catch (e) { }
        return null;
    }

    /**
     * 渲染完整手机 UI
     * @param {object} phoneData - { contact, messages, actions }
     * @param {string} phoneId - 唯一标识
     */
    function render(phoneData, phoneId) {
        const { contact, messages, actions = {} } = phoneData;
        const id = phoneId || `phone_${Date.now()}`;
        const cfg = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getConfig) ? PhoneInteractions.getConfig() : {};
        const bgStyle = cfg.chatBackground ? `background-image:url('${escapeHtml(cfg.chatBackground)}');background-size:cover;` : '';

        const processedMessages = clusterMessagesWithTimeSeparators(messages, cfg);

        return `
<div class="st-phone" data-phone-id="${id}">
  ${renderStatusBar()}
  ${renderNavBar(contact, id)}
  ${renderSearchBar(id)}
  <div class="st-phone-chat" id="chat_${id}" style="${bgStyle}">
    <div class="st-phone-chat-spacer"></div>
    ${processedMessages.map((msg, i) => renderMessage(msg, contact, actions, id, i)).join('\n')}
  </div>
  ${renderInputBar(id)}
  <div class="st-phone-bottom-safe"></div>
</div>`;
    }

    /**
     * 智能时间聚类处理 (仿真微信会话集与大跨段整合，解决连续输入产生药丸千层饼的问题)
     * @param {Array} rawMessages 
     * @param {object} [options] - 配置 { sessionGapMinutes: 20 }
     * @returns {Array}
     */
    function clusterMessagesWithTimeSeparators(rawMessages, options = {}) {
        if (!rawMessages || !rawMessages.length) return [];

        const parser = (typeof PhoneParser !== 'undefined')
            ? PhoneParser
            : (typeof globalThis !== 'undefined' && globalThis.PhoneParser)
                ? globalThis.PhoneParser
                : (typeof window !== 'undefined' && window.PhoneParser)
                    ? window.PhoneParser
                    : null;

        const getTimeInfo = (parser && parser.parseTimeInfo)
            ? parser.parseTimeInfo
            : (t) => ({ dateKey: t, displayDate: t, timeOfDay: t, minuteStamp: null, raw: t });

        // 读取配置中的大跨段阈值 (默认 20 分钟：连续对话集合内药丸自动吞并吸收，超 20 分钟视为下一场对话)
        const cfg = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getConfig) ? PhoneInteractions.getConfig() : {};
        const sessionGapMinutes = Number(options.sessionGapMinutes || cfg.sessionGapMinutes || 20);

        // 确定故事参考年份、首个日期锚点与最新日期锚点（链式基准推导，杜绝跨年与 fallback 污染）
        let referenceYear = new Date().getFullYear();
        let initialBaseDate = null;
        let latestDateObj = null;
        let hasAnyExplicitTime = false;
        let curBase = null;

        for (let i = 0; i < rawMessages.length; i++) {
            const m = rawMessages[i];
            if (m && m.time) {
                hasAnyExplicitTime = true;
                const info = getTimeInfo(m.time, curBase);
                if (info && info.dateObj) {
                    curBase = info.dateObj;
                    if (info.hasYear && info.year) {
                        referenceYear = info.year;
                    }
                    if (info.hasDate && !initialBaseDate) {
                        initialBaseDate = new Date(info.dateObj.getTime());
                    }
                    if (!latestDateObj || info.dateObj.getTime() > latestDateObj.getTime()) {
                        latestDateObj = new Date(info.dateObj.getTime());
                    }
                }
            }
        }
        if (!initialBaseDate) {
            initialBaseDate = new Date();
        }
        if (!latestDateObj) {
            latestDateObj = initialBaseDate;
        }

        const result = [];
        let lastDateKey = null;
        let lastSessionTimeMs = null;
        let lastFullTime = '';
        let lastDateObj = null;

        for (let i = 0; i < rawMessages.length; i++) {
            const msg = rawMessages[i];
            if (!msg) continue;

            // 1. 如果原本就是显式的 time-sep (例如世界书输出的或短代码〖时间：...〗)
            if (msg.type === 'time-sep') {
                const rawT = (msg.time || msg.content || '').trim();
                const info = getTimeInfo(rawT, lastDateObj || initialBaseDate);
                if (info.dateObj) {
                    lastDateObj = info.dateObj;
                    lastSessionTimeMs = info.dateObj.getTime();
                }
                lastDateKey = info.dateKey || (info.dateObj ? `${info.dateObj.getFullYear()}-${String(info.dateObj.getMonth() + 1).padStart(2, '0')}-${String(info.dateObj.getDate()).padStart(2, '0')}` : lastDateKey || 'today');
                lastFullTime = rawT;

                if (parser && parser.formatWeChatPill && info.dateObj) {
                    const formatted = parser.formatWeChatPill(info.dateObj, referenceYear, true, { referenceDate: latestDateObj, hasExplicitDate: info.hasDate });
                    if (formatted) {
                        msg.time = formatted;
                        msg.content = formatted;
                    }
                }
                result.push(msg);
                continue;
            }

            // 2. 提取或继承消息的时间 (若未标注且非剧情时间，尝试从酒馆消息实际发送时间 sendDate 兜底；否则继承上一条已知时间)
            let timeStr = (msg.time || '').trim();
            if (!timeStr && !hasAnyExplicitTime && msg.sendDate) {
                try {
                    const normDateStr = String(msg.sendDate).replace(/([0-9])([ap]m)/i, '$1 $2');
                    const parsedD = new Date(normDateStr);
                    if (!isNaN(parsedD.getTime())) {
                        const Y = parsedD.getFullYear();
                        const M = parsedD.getMonth() + 1;
                        const D = parsedD.getDate();
                        const hh = String(parsedD.getHours()).padStart(2, '0');
                        const mm = String(parsedD.getMinutes()).padStart(2, '0');
                        timeStr = `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')} ${hh}:${mm}`;
                        msg.time = `${hh}:${mm}`;
                    }
                } catch (e) { }
            }

            if (!timeStr) {
                timeStr = lastFullTime || '';
                msg.time = timeStr;
            } else {
                lastFullTime = timeStr;
            }

            const info = getTimeInfo(timeStr, lastDateObj || initialBaseDate);
            if (info && info.dateObj) {
                lastDateObj = info.dateObj;
            }

            const curTimeMs = (info && info.dateObj) ? info.dateObj.getTime() : null;
            const curDateKey = info.dateKey || (info.dateObj ? `${info.dateObj.getFullYear()}-${String(info.dateObj.getMonth() + 1).padStart(2, '0')}-${String(info.dateObj.getDate()).padStart(2, '0')}` : 'today');

            const isFirst = (lastDateKey === null && lastSessionTimeMs === null);
            const isDateChanged = Boolean(curDateKey && lastDateKey && (curDateKey !== lastDateKey));

            // 微信大跨段判定：只有时间差超过阈值（如 20 分钟），才判定为进入下一轮新对话
            const isMajorGap = Boolean(
                curTimeMs !== null && 
                lastSessionTimeMs !== null && 
                (curTimeMs - lastSessionTimeMs >= sessionGapMinutes * 60 * 1000 || curTimeMs < lastSessionTimeMs)
            );

            if (isFirst || isDateChanged) {
                // 跨天、跨周或整个对话第一条：展示带日期的微信原生胶囊 (当年隐年，跨年显年，支持昨天)
                let pillText = '';
                if (parser && parser.formatWeChatPill && info.dateObj) {
                    pillText = parser.formatWeChatPill(info.dateObj, referenceYear, true, { referenceDate: latestDateObj, hasExplicitDate: info.hasDate });
                } else if (info.displayDate) {
                    pillText = info.timeOfDay ? `${info.displayDate} ${info.timeOfDay}` : info.displayDate;
                } else if (info.timeOfDay) {
                    pillText = info.timeOfDay;
                } else {
                    pillText = info.raw || timeStr;
                }
                if (pillText) {
                    result.push({
                        type: 'time-sep',
                        time: pillText,
                        content: pillText,
                    });
                }
                lastDateKey = curDateKey;
                lastSessionTimeMs = curTimeMs;
            } else if (isMajorGap) {
                // 同一天内的下一个大跨段：插入该时段药丸 (如 "晚上 19:30")
                let pillText = '';
                if (parser && parser.formatWeChatPill && info.dateObj) {
                    pillText = parser.formatWeChatPill(info.dateObj, referenceYear, false, { referenceDate: latestDateObj });
                } else {
                    pillText = info.timeOfDay || timeStr;
                }
                if (pillText) {
                    result.push({
                        type: 'time-sep',
                        time: pillText,
                        content: pillText,
                    });
                }
                lastSessionTimeMs = curTimeMs;
            } else {
                // 属于同一连续对话集（连续输入）：
                // 药丸自然吞并/隐藏！保持气泡连续流淌！
                if (curTimeMs !== null) {
                    lastSessionTimeMs = curTimeMs;
                }
            }

            result.push(msg);
        }

        return result;
    }

    function renderStatusBar() {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return `
<div class="st-phone-statusbar">
  <span class="status-left">${timeStr}</span>
  <div class="status-right">${ICONS.signal}${ICONS.wifi}${ICONS.battery}</div>
</div>`;
    }

    function renderNavBar(contact, id) {
        return `
<div class="st-phone-navbar">
  <div class="nav-back">${ICONS.back}</div>
  <div class="nav-title">${escapeHtml(contact)}</div>
  <div class="nav-search-btn" onclick="PhoneInteractions.toggleSearch('${id}')">${ICONS.search}</div>
</div>`;
    }

    function renderSearchBar(id) {
        return `
<div class="st-phone-search" id="search_${id}">
  <input type="text" placeholder="搜索聊天记录..." oninput="PhoneInteractions.handleSearch('${id}', this.value)">
  <span class="search-close" onclick="PhoneInteractions.toggleSearch('${id}')">取消</span>
</div>`;
    }

    function renderInputBar(phoneId) {
        return `
<div class="st-phone-inputbar">
  <div class="input-voice-btn" onclick="PhoneInteractions.showForm('${phoneId}','voice')" title="发送语音">${ICONS.mic}</div>
  <input type="text" class="input-field-real" id="input_${phoneId}" placeholder="输入消息..."
    onfocus="PhoneInteractions.onInputFocus('${phoneId}',true)"
    onblur="PhoneInteractions.onInputFocus('${phoneId}',false)"
    onkeydown="PhoneInteractions.handleInputKeydown('${phoneId}', event)">
  <div class="input-actions" id="input_default_${phoneId}">
    <div class="input-action-btn" onclick="PhoneInteractions.toggleStickerPicker('${phoneId}')" title="表情包">${ICONS.emoji}</div>
    <div class="input-action-btn" onclick="PhoneInteractions.toggleActionPanel('${phoneId}')" title="更多">${ICONS.plus}</div>
  </div>
  <div class="input-actions" id="input_send_${phoneId}" style="display:none;">
    <div class="input-send-btn buffer" onclick="PhoneInteractions.splitSend('${phoneId}')" title="暂存这条，继续打下一条">→</div>
    <div class="input-send-btn final" onclick="PhoneInteractions.batchSend('${phoneId}')" title="发送全部">↑</div>
  </div>
</div>`;
    }

    /**
     * 解析并规范化消息的上下文与视角（支持 NPC POV 左右气泡与持机人反转）
     */
    function resolveMessageContext(msg, contact) {
        if (!msg) return;
        if (msg.pov) {
            const p = msg.pov.trim();
            const pLower = p.toLowerCase();
            const isUser = (pLower === '我' || pLower === 'user' || pLower === 'me' || pLower === '{{user}}');
            if (!isUser) {
                const from = msg.from || contact;
                if (from === p || from === '我' || from === 'Me') {
                    msg.isMe = true;
                    msg._npcPovMe = true;
                } else {
                    msg.isMe = false;
                    msg._npcPovMe = false;
                }
            }
        }
    }

    /**
     * 渲染单条消息
     */
    function renderMessage(msg, contact, actions, phoneId, index) {
        resolveMessageContext(msg, contact);
        switch (msg.type) {
            case 'msg': return renderTextMsg(msg, contact, phoneId);
            case 'voice': return renderVoiceMsg(msg, contact, phoneId);
            case 'sticker': return renderStickerMsg(msg, contact);
            case 'transfer': return renderTransferMsg(msg, contact, actions, phoneId);
            case 'location': return renderLocationMsg(msg, contact);
            case 'recall': return renderRecallMsg(msg, contact, phoneId, index);
            case 'image': return renderImageMsg(msg, contact);
            case 'video': return renderVideoMsg(msg, contact);
            case 'time-sep': return renderTimeSep(msg);
            default: return '';
        }
    }

    function renderTextMsg(msg, contact, phoneId) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const from = msg.from || contact;
        const avatarName = (msg.isMe && !msg._npcPovMe) ? 'Me' : from;

        let quoteHtml = '';
        if (msg.quote) {
            const qSide = msg.isMe ? 'quote-right' : 'quote-left';
            quoteHtml = `<div class="st-phone-quote ${qSide}"><span class="quote-from">${escapeHtml(msg.quoteFrom || from)}:</span> ${escapeHtml(msg.quote)}</div>`;
        }

        let transHtml = '';
        if (msg.trans) {
            transHtml = `
<div class="st-phone-translation">
  <div class="st-phone-trans-toggle" onclick="PhoneInteractions.toggleTranslation(this)">🌐 查看翻译</div>
  <div class="st-phone-trans-content">${escapeHtml(msg.trans)}</div>
</div>`;
        }

        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        return `${quoteHtml}
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe, from)}
  <div>
    <div class="st-phone-bubble">${escapeHtml(msg.content)}${transHtml}</div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderVoiceMsg(msg, contact, phoneId) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const from = msg.from || contact;
        const avatarName = (msg.isMe && !msg._npcPovMe) ? 'Me' : from;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe, from)}
  <div>
    <div class="st-phone-bubble">
      <div class="st-phone-voice">
        <div class="voice-icon">${ICONS.volume}</div>
        <div class="voice-waves"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <span class="voice-duration">${escapeHtml(msg.duration)}</span>
      </div>
      <div class="st-phone-voice-toggle" onclick="PhoneInteractions.toggleVoiceText(this)">📝 转文字</div>
      <div class="st-phone-voice-text">${escapeHtml(msg.content)}</div>
    </div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderStickerMsg(msg, contact) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const from = msg.from || contact;
        const avatarName = (msg.isMe && !msg._npcPovMe) ? 'Me' : from;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        // 表情包解析：key → URL（角色专属 → 全局 → 回退）
        let imgSrc = null;
        if (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.resolveSticker) {
            imgSrc = PhoneInteractions.resolveSticker(msg.src);
        } else {
            const formatted = formatUrl(msg.src);
            if (formatted) imgSrc = formatted;
        }

        const fallbackText = msg.content || '😊';
        const stickerInner = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(msg.content)}" onerror="this.outerHTML='<span class=st-phone-sticker-fallback>${escapeHtml(fallbackText)}</span>'">`
            : `<span class="st-phone-sticker-fallback">${escapeHtml(fallbackText)}</span>`;

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe, from)}
  <div>
    <div class="st-phone-sticker">${stickerInner}</div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderTransferMsg(msg, contact, actions, phoneId) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const from = msg.from || contact;
        const avatarName = (msg.isMe && !msg._npcPovMe) ? 'Me' : from;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';
        const transferId = msg.id;

        // 检查是否已有操作（来自标记的 status 或 chatMetadata）
        const status = msg.status || (actions[transferId] || '');
        let statusClass = '';
        let statusHtml = '';
        let actionsHtml = '';

        if (status === 'accepted') {
            statusClass = 'accepted';
            statusHtml = '<div class="transfer-status">✅ 已领取</div>';
        } else if (status === 'declined') {
            statusClass = 'declined';
            statusHtml = '<div class="transfer-status">已退回</div>';
        } else if (!msg.isMe) {
            // 只有别人发给你的转账才有领取/退回按钮
            actionsHtml = `
<div class="transfer-actions">
  <div class="transfer-btn accept" onclick="PhoneInteractions.handleTransfer('${phoneId}','${transferId}','accept','${escapeHtml(msg.from || contact)}')">领取</div>
  <div class="transfer-btn decline" onclick="PhoneInteractions.handleTransfer('${phoneId}','${transferId}','decline','${escapeHtml(msg.from || contact)}')">退回</div>
</div>`;
            statusHtml = '<div class="transfer-status"></div>';
        }

        let noticeHtml = '';
        if (status === 'accepted') {
            noticeHtml = `<div class="st-phone-time-sep"><span>你已领取${escapeHtml(msg.from || contact)}的转账</span></div>`;
        } else if (status === 'declined') {
            noticeHtml = `<div class="st-phone-time-sep"><span>你已退回${escapeHtml(msg.from || contact)}的转账</span></div>`;
        }

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe, from)}
  <div>
    <div class="st-phone-transfer ${statusClass}" data-transfer-id="${transferId}">
      <div class="transfer-header">
        <div class="transfer-icon">${ICONS.dollar}</div>
        <span class="transfer-label">转账</span>
      </div>
      <div class="transfer-amount">${escapeHtml(msg.amount)}</div>
      <div class="transfer-note">${escapeHtml(msg.note)}</div>
      ${actionsHtml}
      ${statusHtml}
    </div>
    ${timeHtml}
  </div>
</div>
${noticeHtml}`;
    }

    function renderLocationMsg(msg, contact) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const from = msg.from || contact;
        const avatarName = (msg.isMe && !msg._npcPovMe) ? 'Me' : from;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe, from)}
  <div>
    <div class="st-phone-location">
      <div class="location-map">${ICONS.location}</div>
      <div class="location-info">
        <div class="location-name">${escapeHtml(msg.name)}</div>
        <div class="location-addr">${escapeHtml(msg.addr)}</div>
      </div>
    </div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderRecallMsg(msg, contact, phoneId, index) {
        const from = msg.from || contact;
        return `
<div class="st-phone-recall-group">
  <div class="st-phone-recall">
    <span class="recall-text">"${escapeHtml(from)}" 撤回了一条消息</span>
    <span class="recall-view" onclick="PhoneInteractions.toggleRecall(this)">查看</span>
  </div>
  <div class="st-phone-recall-revealed">
    <div class="recall-bubble">
      <div class="recall-label">已撤回的消息</div>
      <div class="recall-original">${escapeHtml(msg.content)}</div>
    </div>
  </div>
</div>`;
    }

    function renderImageMsg(msg, contact) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const from = msg.from || contact;
        const avatarName = (msg.isMe && !msg._npcPovMe) ? 'Me' : from;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';
        const desc = msg.content || '';

        let inner;
        const formattedSrc = formatUrl(msg.src);
        if (formattedSrc) {
            inner = `<img class="phone-media-img" src="${escapeHtml(formattedSrc)}" alt="${escapeHtml(desc)}" onerror="this.outerHTML='<div class=phone-media-desc>🖼️ '+this.alt+'</div>'">`;
        } else {
            inner = `<div class="phone-media-desc">🖼️ ${escapeHtml(desc || '图片')}</div>`;
        }

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe, from)}
  <div>
    <div class="st-phone-media">${inner}</div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderVideoMsg(msg, contact) {
        const side = msg.isMe ? 'msg-me' : 'msg-other';
        const from = msg.from || contact;
        const avatarName = (msg.isMe && !msg._npcPovMe) ? 'Me' : from;
        const timeHtml = msg.time ? `<div class="st-phone-msg-time">${escapeHtml(msg.time)}</div>` : '';
        const desc = msg.content || '视频';

        return `
<div class="st-phone-msg-row ${side}" data-searchable>
  ${renderAvatar(avatarName, msg.isMe, from)}
  <div>
    <div class="st-phone-media st-phone-video">
      <div class="phone-media-desc">🎬 ${escapeHtml(desc)}</div>
      <div class="phone-video-play">▶</div>
    </div>
    ${timeHtml}
  </div>
</div>`;
    }

    function renderTimeSep(msg) {
        return `<div class="st-phone-time-sep"><span>${escapeHtml(msg.time)}</span></div>`;
    }

    /**
     * 渲染正文内的 RLive 沉浸式互动直播间
     * 复用手机伴侣完全一致的视图结构与 CSS 样式
     */
    function renderLive(liveData, liveId) {
        const id = liveId || `live_${Date.now()}`;
        const rawStreamer = liveData.streamer || '主播';
        const streamerDisplay = (typeof PhoneComposer !== 'undefined' && PhoneComposer.getCharacterLiveId)
            ? PhoneComposer.getCharacterLiveId(rawStreamer)
            : rawStreamer;
        const userLiveId = (typeof PhoneComposer !== 'undefined' && PhoneComposer.getUserLiveId)
            ? PhoneComposer.getUserLiveId()
            : '热心观众';

        const isLive = liveData.isLive !== false;
        const statusText = isLive ? 'LIVE' : '未开播';
        const statusClass = isLive ? '' : 'offline';
        const timerText = isLive ? '00:00' : '未开播';
        const viewers = liveData.viewers || (isLive ? '1.2w' : '--');
        const bio = liveData.bio || (typeof PhoneComposer !== 'undefined' ? PhoneComposer.getCharacterLiveBio(rawStreamer) : '');
        const scene = liveData.scene || (isLive ? '主播正在直播中...' : '主播未开播');
        const sc = liveData.sc;
        const danmuList = liveData.danmu || [];
        const gift = liveData.gift;

        // 头像匹配 (支持按原角色名或艺名匹配)
        const cfg = (typeof PhoneInteractions !== 'undefined' && PhoneInteractions.getConfig) ? PhoneInteractions.getConfig() : {};
        const avatarMap = cfg.charAvatarMap || {};
        const avatarUrl = avatarMap[rawStreamer] || avatarMap[streamerDisplay] || cfg.charAvatar || tryMatchSTAvatar(rawStreamer) || tryMatchSTAvatar(streamerDisplay) || '';
        const avatarLetter = escapeHtml(streamerDisplay.charAt(0) || '主');
        const avatarStyle = avatarUrl ? `background-image:url('${escapeHtml(avatarUrl)}');background-size:cover;background-position:center;` : '';

        const bioHtml = bio ? `
            <div class="live-stream-desc-container">
                <div class="live-stream-desc">${escapeHtml(bio)} · </div>
            </div>
        ` : '';

        const scHtml = sc ? `
            <div class="live-sc-container" style="display: block;">
                <div class="live-sc-card">
                    <div class="sc-card-header">
                        <div class="sc-badge-group">
                            <span class="sc-price-pill">SC ${escapeHtml(sc.price || '￥520')}</span>
                            <span class="sc-sender-name">${escapeHtml(sc.sender || '')}</span>
                        </div>
                        <span class="sc-status-pill"><i class="fa-regular fa-clock"></i> 置顶中</span>
                    </div>
                    <div class="sc-card-content">${escapeHtml(sc.content || '')}</div>
                </div>
            </div>
        ` : '';

        const giftHtml = gift ? `
            <div class="live-gift-banner" style="display: flex;">
                <span class="gift-banner-icon">🎁</span>
                <div class="gift-banner-text">
                    <div class="gift-banner-user">${escapeHtml(gift.user || userLiveId)} 送出了</div>
                    <div class="gift-banner-name">${escapeHtml(gift.name || '心意礼物')}</div>
                </div>
            </div>
        ` : '';

        const danmuItemsHtml = danmuList.map(d => {
            const isMe = d.isMe;
            const meClass = isMe ? 'danmu-me' : '';
            const meSenderClass = isMe ? 'danmu-me-sender' : '';
            const sender = d.sender || (isMe ? userLiveId : '观众');
            return `
                <div class="danmu-item ${meClass}">
                    <span class="danmu-sender ${meSenderClass}">${escapeHtml(sender)}:</span>
                    <span class="danmu-text">${escapeHtml(d.text || d.content || '')}</span>
                </div>
            `;
        }).join('');

        return `
<div class="st-phone st-phone-live-wrapper" data-live-id="${id}">
    ${renderStatusBar()}
    <div class="composer-view-live st-phone-msg-live" style="display: flex;">
        <div class="live-stream-header">
            <div class="live-streamer-info">
                <div class="live-streamer-avatar" style="${avatarStyle}">
                    ${avatarUrl ? '' : `<span class="live-streamer-avatar-text">${avatarLetter}</span>`}
                </div>
                <div class="live-streamer-meta">
                    <div class="live-streamer-name-row">
                        <span class="live-streamer-name">${escapeHtml(streamerDisplay)}</span>
                        <span class="live-stream-live-pill ${statusClass}">${statusText}</span>
                    </div>
                    ${bioHtml}
                </div>
            </div>
            <div class="live-header-actions">
                <div class="live-viewers-pill" title="当前在线观看人数">
                    <i class="fa-solid fa-fire"></i> <span>${escapeHtml(viewers)}</span>
                </div>
            </div>
        </div>

        <div class="live-stage-container">
            <div class="live-ambient-glow"></div>
            <div class="live-stage-canvas">
                <div class="live-narration-card">
                    <div class="live-narration-header">
                        <span class="narration-tag"><i class="fa-solid fa-video"></i> 直播画面</span>
                        <span class="live-timer ${statusClass}">${escapeHtml(timerText)}</span>
                    </div>
                    <div class="live-narration-body">
                        ${escapeHtml(scene)}
                    </div>
                </div>
            </div>

            ${scHtml}

            <div class="live-danmu-stream">
                ${danmuItemsHtml}
            </div>

            ${giftHtml}
        </div>

        <div class="live-bottom-bar st-live-msg-bottom">
            <div class="live-user-id-pill" onclick="if(window.PhoneComposer) PhoneComposer.toggleComposer(true)" title="我的直播间昵称 (可在伴侣中修改)">
                <span class="live-user-id-prefix"><i class="fa-regular fa-user"></i></span>
                <span class="live-user-name-val">${escapeHtml(userLiveId)}</span>
            </div>
            <div class="live-danmu-input-pill" onclick="if(window.PhoneComposer) PhoneComposer.toggleComposer(true)" title="点击打开小手机伴侣互动" style="cursor: pointer;">
                <span style="font-size: 11px; color: rgba(255,255,255,0.45); display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-paper-plane" style="font-size: 10px;"></i> 点击右侧悬浮伴侣发送弹幕/心动礼物...
                </span>
            </div>
        </div>
    </div>
    <div class="st-phone-bottom-safe"></div>
</div>`;
    }

    return { render, renderLive, renderMessage, renderAvatar, renderTimeSep, clusterMessagesWithTimeSeparators, escapeHtml };
})();

if (typeof window !== 'undefined') {
    window.PhoneRenderer = PhoneRenderer;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PhoneRenderer = PhoneRenderer;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhoneRenderer;
}
