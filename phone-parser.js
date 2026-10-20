/**
 * SillyTavern Phone UI Extension — 标记与自然语言语法解析器
 * 1. 支持 [phone]...[/phone] 块及子标签 ([msg], [voice], [transfer], etc.)
 * 2. 支持 Prompt 中说明的行前缀语法 (> 我: xxx, > 对方: [transfer] 520)
 * 3. 支持自然语言短括号 〖...〗（〖表情：摸头〗、〖转账：520元〗、〖语音：3秒〗等）
 */

const PhoneParser = (() => {

  /**
   * 格式化时长（秒数转 0:00 格式）
   */
  function formatDuration(val) {
    if (!val) return '0:01';
    val = String(val).trim();
    if (val.includes(':')) return val;
    // 匹配如 "12秒" 或 "12s" 或纯数字 "12"
    const m = val.match(/(\d+)/);
    if (!m) return '0:01';
    const totalSec = parseInt(m[1], 10);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  /**
   * 判断发送者属性是否代表当前用户 (me, user, 我, {{user}}, 以及角色卡设定的用户名字)
   */
  function isUserFrom(fromAttr) {
    if (!fromAttr) return false;
    const f = String(fromAttr).trim().toLowerCase();
    if (f === 'me' || f === 'user' || f === '我' || f === '{{user}}') return true;
    try {
      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      if (ctx && ctx.name1 && ctx.name1.toLowerCase() === f) return true;
    } catch (e) { }
    return false;
  }

  /**
   * 解析 key=value|key2=value2 格式的属性
   * 兼容简写: [phone:小红] 或 [phone:小红|http://avatar.jpg]
   */
  function parseAttributes(attrString) {
    const attrs = {};
    if (!attrString) return attrs;
    const trimmed = attrString.trim();

    // 如果完全不含 =，支持 [phone:联系人] 或 [phone:联系人|头像链接]
    if (!trimmed.includes('=')) {
      const parts = trimmed.split('|');
      attrs.contact = parts[0].trim();
      if (parts[1]) attrs.avatar = parts[1].trim();
      return attrs;
    }

    const pairs = trimmed.split(/[|,，]/);
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        const key = pair.substring(0, eqIdx).trim();
        const value = pair.substring(eqIdx + 1).trim();
        attrs[key] = value;
      } else if (!attrs.contact) {
        // 第一段没有 = 时，默认为 contact 名
        attrs.contact = pair.trim();
      }
    }
    return attrs;
  }

  /**
   * 从原始文本中提取所有 [phone] 块
   * @param {string} text 
   * @returns {Array<{contact: string, avatar: string, messages: Array}>}
   */
  function extractPhoneBlocks(text) {
    if (!text) return [];
    const blocks = [];
    const phoneRegex = /(?:\[|&#91;)phone(?::([^\]&#]*))?(?:\]|&#93;)([\s\S]*?)(?:\[|&#91;)\/phone(?:\]|&#93;)/gi;
    let match;

    while ((match = phoneRegex.exec(text)) !== null) {
      const attrs = parseAttributes(match[1] || '');
      const innerText = match[2] || '';
      const messages = parseMessages(innerText, attrs.contact || '未知');

      blocks.push({
        contact: attrs.contact || '未知',
        avatar: attrs.avatar || '',
        messages,
        raw: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return blocks;
  }

  /**
   * 解析 phone 块内的所有消息
   * 兼容：
   * 1. 结构化标记 [msg:from=me]内容[/msg]
   * 2. 行前缀格式: > 我: 内容 / > 其他人: [transfer] 520
   */
  function parseMessages(innerText, defaultContact = '未知') {
    const messages = [];
    if (!innerText) return messages;

    const trimmed = innerText.trim();
    // 判定是否属于行前缀格式 (例如 `> 我: ...` 或 `小红: ...`)，同时排查结构化 [msg] 标签
    const hasLinePrefixes = /(?:^|\n)\s*>?\s*[^:\n[\]]+[:：]/.test(trimmed) && !/\[msg(?::|\])/i.test(trimmed);

    if (!hasLinePrefixes) {
      // 逐个匹配起始标签 [tag:attrs] 或 [tag]，区分自闭合与带内容闭合标签
      const tagRegex = /\[(msg|voice|sticker|transfer|location|recall|image|video|time-sep)(?::([^\]]*))?\]/gi;
      const selfClosing = ['transfer', 'location', 'time-sep', 'sticker'];
      let match;

      while ((match = tagRegex.exec(innerText)) !== null) {
        const type = match[1].toLowerCase();
        const attrs = parseAttributes(match[2] || '');
        const afterTagIndex = tagRegex.lastIndex;
        let content = '';

        if (selfClosing.includes(type)) {
          // 自闭合标签：绝不向后贪婪查找闭合；但若紧随其后有旧版遗留的 [/tag]（如 [sticker:...]描述[/sticker]），顺手将其吸收为 content
          const rest = innerText.substring(afterTagIndex);
          const legacyCloseRegex = new RegExp('^([^\\[\\n]*?)\\[\\/' + type + '\\]', 'i');
          const closeMatch = rest.match(legacyCloseRegex);
          if (closeMatch) {
            content = closeMatch[1].trim();
            tagRegex.lastIndex = afterTagIndex + closeMatch[0].length;
          }
        } else {
          // 闭合标签：必须寻找对应的 [tag]...[/tag]
          const rest = innerText.substring(afterTagIndex);
          const closeTag = '[/' + type + ']';
          const closeIdx = rest.toLowerCase().indexOf(closeTag);
          if (closeIdx !== -1) {
            content = rest.substring(0, closeIdx).trim();
            tagRegex.lastIndex = afterTagIndex + closeIdx + closeTag.length;
          }
        }

        const msg = { type, ...attrs, content };

        if (type === 'msg') {
          msg.isMe = isUserFrom(attrs.from);
          if (attrs.quote) msg.quote = attrs.quote;
          if (attrs.quoteFrom) msg.quoteFrom = attrs.quoteFrom;
          if (attrs.lang) msg.lang = attrs.lang;
          if (attrs.trans) msg.trans = attrs.trans;
        } else if (type === 'voice') {
          msg.isMe = isUserFrom(attrs.from);
          msg.duration = formatDuration(attrs.duration || '0:03');
        } else if (type === 'sticker') {
          msg.isMe = isUserFrom(attrs.from);
          msg.src = attrs.src || attrs.key || content || '';
        } else if (type === 'transfer') {
          msg.isMe = isUserFrom(attrs.from);
          msg.amount = attrs.amount || content || '0';
          msg.note = attrs.note || '';
          msg.id = attrs.id || `t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          msg.status = attrs.status || '';
        } else if (type === 'location') {
          msg.isMe = isUserFrom(attrs.from);
          msg.name = attrs.name || content || '位置';
          msg.addr = attrs.addr || '';
        } else if (type === 'recall') {
          msg.isMe = isUserFrom(attrs.from);
        } else if (type === 'image') {
          msg.isMe = isUserFrom(attrs.from);
          msg.src = attrs.src || '';
        } else if (type === 'video') {
          msg.isMe = isUserFrom(attrs.from);
        } else if (type === 'time-sep') {
          msg.time = attrs[''] || match[2] || '';
          if (!msg.time && match[2]) msg.time = match[2].trim();
        }

        messages.push(msg);
      }

      if (messages.length > 0) {
        return messages;
      }
    }

    // 兜底：如果不是 [msg] 标签，解析行前缀格式 (如 `> 我: 内容` 或 `> 其他人: [image] ...`)
    const lines = innerText.split('\n');
    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      // 去掉 markdown 引用符号 `>`
      if (line.startsWith('>')) {
        line = line.substring(1).trim();
      }
      if (!line) continue;

      // 匹配发送者前缀: "发送者: 内容" 或 "发送者：内容"
      const colonIdx = line.search(/[:：]/);
      if (colonIdx === -1) {
        // 无冒号行，作为普通文字
        messages.push({ type: 'msg', isMe: false, from: defaultContact, content: line });
        continue;
      }

      const sender = line.substring(0, colonIdx).trim();
      const body = line.substring(colonIdx + 1).trim();
      const isMe = /^(我|User|me|{{user}})$/i.test(sender);
      const from = isMe ? 'Me' : (sender || defaultContact);

      // 检查 body 是否含有行内类型指令: [image], [video], [voice], [transfer], [location], [recall], [sticker]
      const inlineMatch = body.match(/^\[(image|video|voice|transfer|location|recall|sticker)\]\s*(.*)$/i);
      if (inlineMatch) {
        const subType = inlineMatch[1].toLowerCase();
        const subPayload = inlineMatch[2].trim();

        if (subType === 'image') {
          const parts = subPayload.split('|');
          messages.push({ type: 'image', isMe, from, src: parts[0]?.trim() || '', content: parts[1]?.trim() || '' });
        } else if (subType === 'video') {
          const parts = subPayload.split('|');
          messages.push({ type: 'video', isMe, from, src: parts[0]?.trim() || '', content: parts[1]?.trim() || '' });
        } else if (subType === 'voice') {
          messages.push({ type: 'voice', isMe, from, duration: formatDuration(subPayload || '3'), content: '语音消息' });
        } else if (subType === 'transfer') {
          const parts = subPayload.split('|');
          const amt = parts[0]?.replace(/[^\d.]/g, '') || '0';
          const note = parts[1]?.trim() || '';
          messages.push({ type: 'transfer', isMe, from, amount: amt, note, id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` });
        } else if (subType === 'location') {
          const parts = subPayload.split('|');
          messages.push({ type: 'location', isMe, from, name: parts[0]?.trim() || '未知地点', addr: parts[1]?.trim() || '' });
        } else if (subType === 'recall') {
          messages.push({ type: 'recall', isMe, from, content: subPayload || '(对方撤回了一条消息)' });
        } else if (subType === 'sticker') {
          messages.push({ type: 'sticker', isMe, from, src: subPayload, content: subPayload });
        }
      } else {
        // 普通文本
        messages.push({ type: 'msg', isMe, from, content: body });
      }
    }

    return messages;
  }

  /**
   * 智能时间解析器与日历基准构建
   * 解析各种格式：2024-10-19 14:27, 10-19 14:27, 一周后 14:00, 第二天 09:30, 14:27 等
   * @param {string} raw - 原始时间字符串
   * @param {Date|object} [fallbackBaseDate] - 继承参考日期
   * @returns {object} { year, month, day, hour, minute, hasYear, hasDate, dateKey, displayDate, timeOfDay, minuteStamp, dateObj, raw }
   */
  function parseTimeInfo(raw, fallbackBaseDate) {
    const base = (fallbackBaseDate instanceof Date && !isNaN(fallbackBaseDate.getTime()))
      ? new Date(fallbackBaseDate.getTime())
      : new Date();

    if (!raw) {
      const Y = base.getFullYear();
      const M = base.getMonth() + 1;
      const D = base.getDate();
      const h = base.getHours();
      const m = base.getMinutes();
      return {
        year: Y, month: M, day: D,
        hour: h, minute: m,
        hasYear: false, hasDate: false,
        dateKey: `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`,
        displayDate: null,
        timeOfDay: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        minuteStamp: h * 60 + m,
        dateObj: base,
        raw: ''
      };
    }
    const str = String(raw).trim();

    // 1. 相对叙事推移词 (如: 明天 14:00, 第二天 09:30, 一天后 09:00, 一周后 14:00, 3天后 18:00)
    const relMatch = str.match(/^((?:明天|后天|大后天|昨天|前天|次日|第二天|第三天|一天后|两天后|三天后|三天前|1天后|2天后|3天后|几天后|一周后|一个星期后|1周后|下周|半个月后))\s*(\d{1,2}:\d{2})?$/i);
    if (relMatch) {
      const relDay = relMatch[1];
      const timeOfDay = relMatch[2] || '09:00';
      const [h, m] = timeOfDay.split(':').map(Number);

      const d = new Date(base.getTime());
      if (['第二天', '次日', '明天', '一天后', '1天后'].includes(relDay)) {
        d.setDate(d.getDate() + 1);
      } else if (['第三天', '后天', '两天后', '2天后'].includes(relDay)) {
        d.setDate(d.getDate() + 2);
      } else if (['大后天', '几天后', '三天后', '3天后'].includes(relDay)) {
        d.setDate(d.getDate() + 3);
      } else if (relDay === '昨天') {
        d.setDate(d.getDate() - 1);
      } else if (relDay === '前天') {
        d.setDate(d.getDate() - 2);
      } else if (relDay === '三天前') {
        d.setDate(d.getDate() - 3);
      } else if (['一周后', '一个星期后', '1周后', '下周'].includes(relDay)) {
        d.setDate(d.getDate() + 7);
      } else if (relDay === '半个月后') {
        d.setDate(d.getDate() + 15);
      }
      d.setHours(h || 9, m || 0, 0, 0);

      const Y = d.getFullYear();
      const M = d.getMonth() + 1;
      const D = d.getDate();

      return {
        year: Y,
        month: M,
        day: D,
        hour: h || 9,
        minute: m || 0,
        hasYear: false,
        hasDate: true,
        dateKey: `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`,
        displayDate: relDay,
        timeOfDay: `${String(h || 9).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`,
        minuteStamp: (h || 9) * 60 + (m || 0),
        dateObj: d,
        raw: str,
      };
    }

    // 2. 年-月-日 (时:分 可选，如 2024-10-19 14:27 或 2024-10-19)
    const fullDateMatch = str.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?(?:\s+(\d{1,2}:\d{2}))?$/);
    if (fullDateMatch) {
      const year = Number(fullDateMatch[1]);
      const month = Number(fullDateMatch[2]);
      const day = Number(fullDateMatch[3]);
      const timeOfDay = fullDateMatch[4] || `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;
      const [h, m] = timeOfDay.split(':').map(Number);
      const d = new Date(year, month - 1, day, h, m, 0, 0);

      return {
        year,
        month,
        day,
        hour: h,
        minute: m,
        hasYear: true,
        hasDate: true,
        dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        displayDate: `${year}年${month}月${day}日`,
        timeOfDay,
        minuteStamp: h * 60 + m,
        dateObj: d,
        raw: str,
      };
    }

    // 3. 月-日 (时:分 可选，如 10-19 14:27 或 10-19)
    const monthDayMatch = str.match(/^(\d{1,2})[-/月](\d{1,2})日?(?:\s+(\d{1,2}:\d{2}))?$/);
    if (monthDayMatch) {
      const year = base.getFullYear();
      const month = Number(monthDayMatch[1]);
      const day = Number(monthDayMatch[2]);
      const timeOfDay = monthDayMatch[3] || `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;
      const [h, m] = timeOfDay.split(':').map(Number);
      const d = new Date(year, month - 1, day, h, m, 0, 0);

      return {
        year,
        month,
        day,
        hour: h,
        minute: m,
        hasYear: false,
        hasDate: true,
        dateKey: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        displayDate: `${month}月${day}日`,
        timeOfDay,
        minuteStamp: h * 60 + m,
        dateObj: d,
        raw: str,
      };
    }

    // 4. 纯时分 (如 14:27, 9:05)
    const timeMatch = str.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const h = Number(timeMatch[1]);
      const m = Number(timeMatch[2]);
      const timeOfDay = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);

      return {
        year: base.getFullYear(),
        month: base.getMonth() + 1,
        day: base.getDate(),
        hour: h,
        minute: m,
        hasYear: false,
        hasDate: false,
        dateKey: null, // 继承前序日期
        displayDate: null,
        timeOfDay,
        minuteStamp: h * 60 + m,
        dateObj: d,
        raw: str,
      };
    }

    // 兜底其它文本
    return {
      year: base.getFullYear(),
      month: base.getMonth() + 1,
      day: base.getDate(),
      hour: base.getHours(),
      minute: base.getMinutes(),
      hasYear: false,
      hasDate: false,
      dateKey: str,
      displayDate: str,
      timeOfDay: '',
      minuteStamp: null,
      dateObj: base,
      raw: str,
    };
  }

  /**
   * 将 Date 格式化为标准传输/写入 Token 字符串
   * @param {Date} date - JS Date 实例
   * @param {boolean} hasYear - 是否带年份 (如 2024-10-19 14:00)
   * @param {boolean} hasDate - 是否带日期 (如 false 则仅输出 14:00)
   * @returns {string}
   */
  function formatDateToCanonical(date, hasYear = false, hasDate = true) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '14:00';
    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');

    if (!hasDate) {
      return `${hh}:${mm}`;
    }
    if (hasYear) {
      return `${Y}-${M}-${D} ${hh}:${mm}`;
    }
    return `${M}-${D} ${hh}:${mm}`;
  }

  /**
   * 微信级智能时间胶囊渲染格式化器
   * 规则：当年隐年，跨年显年，同日纯时分
   * @param {Date} date - 消息时间
   * @param {number} referenceYear - 故事最新年份 (如 2024)
   * @param {boolean} isDateChanged - 是否跨天/首次展示
   * @returns {string} 微信胶囊文字 (如 "10月19日 14:00" 或 "2024年10月19日 14:00" 或 "14:00")
   */
  function formatWeChatPill(date, referenceYear, isDateChanged) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    const Y = date.getFullYear();
    const M = date.getMonth() + 1;
    const D = date.getDate();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');

    if (!isDateChanged) {
      // 同一天内超过 5 分钟：仅显示纯时分
      return `${hh}:${mm}`;
    }

    // 跨天情况：
    // 若消息年份 < 故事最新基准年份 (跨年旧消息)，完整显示年份
    if (referenceYear && Y < referenceYear) {
      return `${Y}年${M}月${D}日 ${hh}:${mm}`;
    }
    // 否则在当前自然年内，优雅隐藏年份
    return `${M}月${D}日 ${hh}:${mm}`;
  }

  /**
   * 解析单条自然语言短标记 (〖...〗内部内容)
   * @param {string} raw - 括号内的文本
   * @param {boolean} isMe - 是否为用户发送
   * @param {string} contact - 联系人名
   * @returns {object|null}
   */
  function parseSingleHumanToken(raw, isMe = true, contact = '未知') {
    if (!raw) return null;
    let text = raw.trim();
    if (!text) return null;

    // 排除常见的非手机标识，防止在正文写的旁白、OOC、系统提示、好感度等被误当成短信
    if (/^(?:OOC|ooc|旁白|系统提示|系统说明|系统|心声|内心独白|动作|心理|提示|状态|好感度|场景)[：:\s]/i.test(text)) {
      return null;
    }

    const from = isMe ? 'Me' : contact;

    // 0. 时间分割线: 〖时间：2024-10-19 14:27】 / 【时间: 一周后 14:00】 / 【时间: 次日 09:30】
    const explicitTimeMatch = text.match(/^(?:时间|时间线)[：:\s]+([\s\S]+)$/i);
    if (explicitTimeMatch) {
      const tVal = explicitTimeMatch[1].trim();
      return {
        type: 'time-sep',
        time: tVal,
        content: tVal,
      };
    }

    // 检测是否带有前置时间戳 (如: 【14:30 今晚去哪吃】 / 【10-26 14:00 好久不见】 / 【一周后 14:00 最近怎样】)
    let extractedTime = '';
    const timePrefixRegex = /^(?:(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?\s+\d{1,2}:\d{2})|(\d{1,2}[-/月]\d{1,2}日?\s+\d{1,2}:\d{2})|((?:明天|后天|大后天|昨天|前天|次日|第二天|第三天|一天后|两天后|三天后|三天前|1天后|2天后|3天后|几天后|一周后|一个星期后|1周后|下周|半个月后)(?:\s+\d{1,2}:\d{2})?)|(\d{1,2}:\d{2}))[\s|，,]+([\s\S]+)$/i;
    const prefixMatch = text.match(timePrefixRegex);
    if (prefixMatch) {
      extractedTime = (prefixMatch[1] || prefixMatch[2] || prefixMatch[3] || prefixMatch[4] || '').trim();
      text = (prefixMatch[5] || '').trim();
    }

    let parsedMsg = null;

    // 1. 表情包: 【表情：流泪】 / 【表情:流泪】 / 【表情包：摸头】
    const stickerMatch = text.match(/^(?:表情|表情包)[：:\s]+([\s\S]+)$/i);
    if (stickerMatch) {
      const key = stickerMatch[1].trim();
      parsedMsg = {
        type: 'sticker',
        isMe,
        from,
        src: key,
        content: key,
      };
    }

    // 2. 转账: 【转账：520元（备注：奶茶）】 / 【转账: 520元 | 备注】 / 【转账: 520】
    if (!parsedMsg) {
      const transferMatch = text.match(/^转账[：:\s]+(?:[¥￥])?\s*(\d+(?:\.\d+)?)\s*(?:元)?(?:\s*(?:[（\(](?:备注[：:\s]*)?(.*?)[）\)]|\|(?:\s*备注[：:\s]*)?(.*?)))?$/i);
      if (transferMatch) {
        const amount = transferMatch[1];
        const note = (transferMatch[2] || transferMatch[3] || '').trim();
        parsedMsg = {
          type: 'transfer',
          isMe,
          from,
          amount,
          note,
          id: `t_user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          status: isMe ? 'sent' : '',
        };
      }
    }

    // 3. 语音: 【语音：3秒（转文字：你在哪）】 / 【语音: 15秒】 / 【语音: 0:15】
    if (!parsedMsg) {
      const voiceMatch = text.match(/^语音[：:\s]+(?:(\d+(?:\.\d+)?)(?:秒|s)?|(\d+:\d+))(?:\s*(?:[（\(](?:转文字[：:\s]*)?(.*?)[）\)]|\|(?:\s*转文字[：:\s]*)?(.*?)))?$/i);
      if (voiceMatch) {
        const rawSec = voiceMatch[1] || voiceMatch[2] || '3';
        const duration = formatDuration(rawSec);
        const content = (voiceMatch[3] || voiceMatch[4] || '').trim() || `${rawSec}秒语音`;
        parsedMsg = {
          type: 'voice',
          isMe,
          from,
          duration,
          content,
        };
      }
    }

    // 4. 图片: 【图片：自拍照】 / 【图片: http://...|自拍照】
    if (!parsedMsg) {
      const imgMatch = text.match(/^图片[：:\s]+([\s\S]+)$/i);
      if (imgMatch) {
        const payload = imgMatch[1].trim();
        let src = '';
        let desc = payload;
        if (payload.includes('|')) {
          const parts = payload.split('|');
          src = parts[0].trim();
          desc = parts[1].trim();
        } else if (payload.startsWith('http://') || payload.startsWith('https://')) {
          src = payload;
          desc = '图片';
        }
        parsedMsg = {
          type: 'image',
          isMe,
          from,
          src,
          content: desc,
        };
      }
    }

    // 5. 视频: 【视频：旅行记录】 / 【视频: http://...|旅行记录】
    if (!parsedMsg) {
      const videoMatch = text.match(/^视频[：:\s]+([\s\S]+)$/i);
      if (videoMatch) {
        const payload = videoMatch[1].trim();
        let src = '';
        let desc = payload;
        if (payload.includes('|')) {
          const parts = payload.split('|');
          src = parts[0].trim();
          desc = parts[1].trim();
        } else if (payload.startsWith('http://') || payload.startsWith('https://')) {
          src = payload;
          desc = '视频';
        }
        parsedMsg = {
          type: 'video',
          isMe,
          from,
          src,
          content: desc,
        };
      }
    }

    // 6. 位置: 【位置：万达广场（地址：建设路88号）】 / 【位置: 万达广场】
    if (!parsedMsg) {
      const locMatch = text.match(/^位置[：:\s]+([^(（|]+)(?:\s*(?:[（\(](?:地址[：:\s]*)?(.*?)[）\)]|\|(?:\s*地址[：:\s]*)?(.*?)))?$/i);
      if (locMatch) {
        const name = locMatch[1].trim();
        const addr = (locMatch[2] || locMatch[3] || '').trim();
        parsedMsg = {
          type: 'location',
          isMe,
          from,
          name,
          addr,
        };
      }
    }

    // 7. 撤回: 【撤回了一[条条]消息】 / 【撤回：原消息内容】
    if (!parsedMsg) {
      const recallMatch = text.match(/^撤回(?:了一[条条]消息)?[：:\s]*(.*)$/i);
      if (recallMatch) {
        parsedMsg = {
          type: 'recall',
          isMe,
          from,
          content: recallMatch[1]?.trim() || '(消息已撤回)',
        };
      }
    }

    // 8. 默认情况：作为普通文字消息
    if (!parsedMsg) {
      parsedMsg = {
        type: 'msg',
        isMe,
        from,
        content: text,
      };
    }

    // 若提取到了前置时间戳，赋予消息对象
    if (extractedTime) {
      parsedMsg.time = extractedTime;
    }

    return parsedMsg;
  }

  /**
   * 提取文本中的所有自然语言短标记 〖...〗
   * @param {string} text 
   * @param {object} options - { isMe, contact }
   * @returns {Array} 消息列表
   */
  function extractHumanBlocks(text, options = {}) {
    if (!text) return [];
    const isMe = options.isMe !== undefined ? options.isMe : true;
    const contact = options.contact || '未知';
    const messages = [];

    // 匹配 〖...〗 形式的所有文本块 (空心方头括号，与普通【】彻底隔离)
    const bracketRegex = /〖([\s\S]*?)〗/g;
    let match;

    while ((match = bracketRegex.exec(text)) !== null) {
      const raw = match[1].trim();
      if (!raw) continue;
      const msg = parseSingleHumanToken(raw, isMe, contact);
      if (msg) messages.push(msg);
    }

    return messages;
  }

  /**
   * 判断一段文本中是否包含任何手机内容（[phone] 或 〖...〗）
   */
  function hasPhoneContent(text) {
    if (!text) return false;
    return /(?:\[|&#91;)phone/i.test(text) || /〖[\s\S]+?〗/.test(text);
  }

  return {
    extractPhoneBlocks,
    extractHumanBlocks,
    parseAttributes,
    parseMessages,
    parseSingleHumanToken,
    formatDuration,
    hasPhoneContent,
    parseTimeInfo,
    formatDateToCanonical,
    formatWeChatPill,
  };
})();

// Export for use in extension & environments
if (typeof window !== 'undefined') {
  window.PhoneParser = PhoneParser;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PhoneParser = PhoneParser;
}

