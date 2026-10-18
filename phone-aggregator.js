/**
 * SillyTavern Phone UI Extension — 跨层聚合器
 * 扫描 chat[] 数组，将多层消息中同一联系人的手机消息聚合
 * 支持 [phone] 语法与自然语言短标记 〖...〗 的全量双向聚合
 */

const PhoneAggregator = (() => {

    /**
     * 聚合从 chat[0] 到 chat[upToIndex] 中所有同一 contact 的手机消息
     * @param {Array} chatArray - SillyTavern 的 chat 数组
     * @param {number} upToIndex - 聚合到哪一层（含）
     * @param {string} targetContact - 目标联系人名（如果为空则聚合所有）
     * @returns {object} { contact, messages, actions }
     */
    function aggregate(chatArray, upToIndex, targetContact) {
        const allMessages = [];
        let contact = targetContact || '';
        let actions = {};

        // 读取 chatMetadata 中的操作记录与当前角色名
        try {
            const ctx = SillyTavern.getContext();
            actions = ctx.chatMetadata?.phone_actions || {};
            if (!contact && ctx.name2) {
                contact = ctx.name2;
            }
        } catch (e) {
            // 非 ST 环境
        }

        for (let i = 0; i <= upToIndex && i < chatArray.length; i++) {
            const msg = chatArray[i];
            if (!msg || !msg.mes) continue;
            const isUser = !!msg.is_user;

            // 1. 尝试提取标准的 [phone] 块
            const blocks = PhoneParser.extractPhoneBlocks(msg.mes);
            if (blocks.length > 0) {
                for (const block of blocks) {
                    // 如果指定了 targetContact，只聚合匹配的（'未知' 也宽松接受）
                    if (targetContact && block.contact !== targetContact && block.contact !== '未知') continue;

                    // 取第一个有效 contact 作为联系人名
                    if (!contact && block.contact && block.contact !== '未知') {
                        contact = block.contact;
                    }

                    for (const m of block.messages) {
                        // 向下兼容：完整保留旧聊天记录中的 from=me 气泡
                        // 仅当 AI 紧随其后复述了与上一条完全相同的用户消息内容时，才做去重跳过
                        if (!isUser && m.isMe && allMessages.length > 0) {
                            const lastMsg = allMessages[allMessages.length - 1];
                            if (lastMsg && lastMsg.isMe && lastMsg.content && m.content && lastMsg.content.trim() === m.content.trim()) {
                                continue;
                            }
                        }
                        allMessages.push(m);
                    }
                }
            } else if (isUser) {
                // 2. 仅当是用户消息且没有 [phone] 块时，才提取自然语言短括号 〖...〗
                // 绝不提取 AI 消息中的 〖...〗，彻底避免与状态栏、好感度、内心独白等括号冲突
                const humanMsgs = PhoneParser.extractHumanBlocks(msg.mes, {
                    isMe: true,
                    contact: contact || 'Me',
                });
                if (humanMsgs.length > 0) {
                    allMessages.push(...humanMsgs);
                }
            }
        }

        return { contact: contact || '手机聊天', messages: allMessages, actions };
    }

    /**
     * 获取最后一个 phone block 的 contact 名，兜底使用当前角色名
     */
    function getLatestContact(chatArray, atIndex) {
        for (let i = atIndex; i >= 0; i--) {
            const msg = chatArray[i];
            if (!msg || !msg.mes) continue;
            const blocks = PhoneParser.extractPhoneBlocks(msg.mes);
            if (blocks.length > 0 && blocks[blocks.length - 1].contact !== '未知') {
                return blocks[blocks.length - 1].contact;
            }
        }
        try {
            const ctx = SillyTavern.getContext();
            if (ctx.name2) return ctx.name2;
        } catch (e) { }
        return '手机聊天';
    }

    return { aggregate, getLatestContact };
})();

if (typeof window !== 'undefined') {
    window.PhoneAggregator = PhoneAggregator;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PhoneAggregator = PhoneAggregator;
}


