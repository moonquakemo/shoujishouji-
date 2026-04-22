/**
 * SillyTavern Phone UI Extension — 标记语法解析器
 * 解析 [phone]...[/phone] 块内的所有消息标记
 */

const PhoneParser = (() => {

  /**
   * 从原始文本中提取所有 [phone] 块
   * @param {string} text 
   * @returns {Array<{contact: string, avatar: string, messages: Array}>}
   */
  function extractPhoneBlocks(text) {
    const blocks = [];
    const phoneRegex = /\[phone(?::([^\]]*))?\]([\s\S]*?)\[\/phone\]/gi;
    let match;

    while ((match = phoneRegex.exec(text)) !== null) {
      const attrs = parseAttributes(match[1] || '');
      const innerText = match[2];
      const messages = parseMessages(innerText);

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
   * 解析 key=value|key2=value2 格式的属性
   */
  function parseAttributes(attrString) {
    const attrs = {};
    if (!attrString) return attrs;
    const pairs = attrString.split('|');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        const key = pair.substring(0, eqIdx).trim();
        const value = pair.substring(eqIdx + 1).trim();
        attrs[key] = value;
      }
    }
    return attrs;
  }

  /**
   * 解析 phone 块内的所有消息
   */
  function parseMessages(innerText) {
    const messages = [];
    // 统一正则：匹配所有消息类型
    const tokenRegex = /\[(msg|voice|sticker|transfer|location|recall|time-sep)(?::([^\]]*))?\](?:([\s\S]*?)\[\/\1\])?/gi;
    let m;

    while ((m = tokenRegex.exec(innerText)) !== null) {
      const type = m[1].toLowerCase();
      const attrs = parseAttributes(m[2] || '');
      const content = (m[3] || '').trim();

      const msg = { type, ...attrs, content };

      // 特殊处理
      if (type === 'msg') {
        msg.isMe = (attrs.from || '').toLowerCase() === 'me';
        if (attrs.quote) msg.quote = attrs.quote;
        if (attrs.quoteFrom) msg.quoteFrom = attrs.quoteFrom;
        if (attrs.lang) msg.lang = attrs.lang;
        if (attrs.trans) msg.trans = attrs.trans;
      } else if (type === 'voice') {
        msg.isMe = (attrs.from || '').toLowerCase() === 'me';
        msg.duration = attrs.duration || '0:00';
      } else if (type === 'sticker') {
        msg.isMe = (attrs.from || '').toLowerCase() === 'me';
        msg.src = attrs.src || '';
      } else if (type === 'transfer') {
        msg.isMe = (attrs.from || '').toLowerCase() === 'me';
        msg.amount = attrs.amount || '0';
        msg.note = attrs.note || '';
        msg.id = attrs.id || `t_${Date.now()}`;
        msg.status = attrs.status || '';
      } else if (type === 'location') {
        msg.isMe = (attrs.from || '').toLowerCase() === 'me';
        msg.name = attrs.name || '';
        msg.addr = attrs.addr || '';
      } else if (type === 'recall') {
        msg.isMe = (attrs.from || '').toLowerCase() === 'me';
      } else if (type === 'time-sep') {
        msg.time = attrs[''] || m[2] || '';
        // time-sep is self-closing: [time-sep:14:30]
        // re-parse: the "attribute" is just the time value
        if (!msg.time && m[2]) {
          msg.time = m[2].trim();
        }
      }

      messages.push(msg);
    }

    return messages;
  }

  return { extractPhoneBlocks, parseAttributes, parseMessages };
})();

// Export for use in extension
if (typeof window !== 'undefined') {
  window.PhoneParser = PhoneParser;
}
