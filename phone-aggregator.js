/**
 * SillyTavern Phone UI Extension — 跨层聚合器
 * 扫描 chat[] 数组，将多层消息中同一联系人的手机消息聚合
 * 支持 [phone] 语法与自然语言短标记 〖...〗 的全量双向聚合
 */

const PhoneAggregator = (() => {

    /**
     * 判断 POV 是否属于用户自己
     */
    function isUserPov(pov) {
        if (!pov) return true;
        const p = pov.trim().toLowerCase();
        if (p === '我' || p === 'user' || p === 'me' || p === '{{user}}') return true;
        try {
            const ctx = SillyTavern.getContext();
            if (ctx && ctx.name1 && ctx.name1.toLowerCase() === p) return true;
        } catch (e) { }
        return false;
    }

    /**
     * 聚合从 chat[0] 到 chat[upToIndex] 中所有同一 contact 的手机消息
     * @param {Array} chatArray - SillyTavern 的 chat 数组
     * @param {number} upToIndex - 聚合到哪一层（含）
     * @param {string} targetContact - 目标联系人名（如果为空则聚合所有）
     * @param {string} [targetPov] - 目标 POV（默认为空，代表仅聚合玩家自己的主手机；若指定则聚合对应 NPC 视角）
     * @returns {object} { contact, messages, actions }
     */
    function aggregate(chatArray, upToIndex, targetContact, targetPov = null) {
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
                    // 如果指定了 targetContact，严格只聚合匹配同一联系人的手机块
                    if (targetContact && block.contact !== targetContact) continue;

                    // POV 视角严格隔离：
                    // a) 如果显式指定了 targetPov，必须精准匹配该 POV
                    // b) 如果未指定 targetPov (玩家查看自己的手机)，严格排除所有非用户 POV 的 NPC 手机块 (如 pov=小蓝)
                    if (targetPov) {
                        if (block.pov !== targetPov) continue;
                    } else {
                        if (block.pov && !isUserPov(block.pov)) continue;
                    }

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
                        if (!m.time && msg.send_date) {
                            m.sendDate = msg.send_date;
                        }
                        allMessages.push(m);
                    }
                }
            } else if (isUser) {
                // 若正在聚合某个特定 NPC 的手机视角 (targetPov 为 NPC)，跳过用户的普通手机短代码
                if (targetPov && !isUserPov(targetPov)) continue;

                // 2. 仅当是用户消息且没有 [phone] 块时，才提取自然语言短括号 〖...〗
                // 绝不提取 AI 消息中的 〖...〗，彻底避免与状态栏、好感度、内心独白等括号冲突
                const humanMsgs = PhoneParser.extractHumanBlocks(msg.mes, {
                    isMe: true,
                    contact: contact || 'Me',
                });
                if (humanMsgs.length > 0) {
                    for (const hm of humanMsgs) {
                        // 目标联系人精确过滤：
                        // a) 若短标记显式指定了 @联系人，严格比对 targetContact
                        if (hm.hasExplicitContact && targetContact) {
                            if (hm.targetContact !== targetContact) continue;
                        } else if (targetContact) {
                            // b) 若未显式指定 @联系人，通过上下文（后序/前序 AI 手机回复）进行归属推断兜底
                            const inferred = findNearbyPhoneContact(chatArray, i);
                            if (inferred && inferred !== targetContact) continue;
                        }
                        if (!hm.time && msg.send_date) {
                            hm.sendDate = msg.send_date;
                        }
                        allMessages.push(hm);
                    }
                }
            }
        }

        return { contact: contact || '手机聊天', messages: allMessages, actions };
    }

    /**
     * 辅助推断未显式指定 @联系人 的用户短标记归属
     * 优先查看紧随其后（本轮）是哪个 AI 角色用手机进行了回复，兜底查看前序最近的手机联系人
     */
    function findNearbyPhoneContact(chatArray, userMsgIndex) {
        // 1. 优先向后查看：本轮是哪个 AI 角色用手机回复了消息（最多向后查 6 条，跳过用户连发）
        const maxScan = Math.min(chatArray.length, userMsgIndex + 6);
        for (let k = userMsgIndex + 1; k < maxScan; k++) {
            const m = chatArray[k];
            if (!m || !m.mes || m.is_user) continue;
            const blocks = PhoneParser.extractPhoneBlocks(m.mes);
            if (blocks.length > 0) {
                for (const b of blocks) {
                    if (b.contact && b.contact !== '未知') return b.contact;
                }
            }
        }
        // 2. 兜底向前查看：此前最近一次是在和谁手机聊天
        const minScan = Math.max(0, userMsgIndex - 6);
        for (let k = userMsgIndex - 1; k >= minScan; k--) {
            const m = chatArray[k];
            if (!m || !m.mes || m.is_user) continue;
            const blocks = PhoneParser.extractPhoneBlocks(m.mes);
            if (blocks.length > 0) {
                for (let b = blocks.length - 1; b >= 0; b--) {
                    if (blocks[b].contact && blocks[b].contact !== '未知') return blocks[b].contact;
                }
            }
        }
        return null;
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhoneAggregator;
}
