/**
 * SillyTavern Phone UI Extension — 跨层聚合器
 * 扫描 chat[] 数组，将多层消息中同一联系人的手机消息聚合
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

        // 读取 chatMetadata 中的操作记录
        try {
            const ctx = SillyTavern.getContext();
            actions = ctx.chatMetadata.phone_actions || {};
        } catch (e) {
            // 非 ST 环境
        }

        for (let i = 0; i <= upToIndex && i < chatArray.length; i++) {
            const msg = chatArray[i];
            if (!msg || !msg.mes) continue;

            const blocks = PhoneParser.extractPhoneBlocks(msg.mes);
            for (const block of blocks) {
                // 如果指定了 targetContact，只聚合匹配的
                if (targetContact && block.contact !== targetContact) continue;

                // 取第一个 block 的 contact 作为联系人名
                if (!contact) contact = block.contact;

                allMessages.push(...block.messages);
            }
        }

        return { contact, messages: allMessages, actions };
    }

    /**
     * 获取最后一个 phone block 的 contact 名
     */
    function getLatestContact(chatArray, atIndex) {
        for (let i = atIndex; i >= 0; i--) {
            const msg = chatArray[i];
            if (!msg || !msg.mes) continue;
            const blocks = PhoneParser.extractPhoneBlocks(msg.mes);
            if (blocks.length > 0) {
                return blocks[blocks.length - 1].contact;
            }
        }
        return null;
    }

    return { aggregate, getLatestContact };
})();

if (typeof window !== 'undefined') {
    window.PhoneAggregator = PhoneAggregator;
}
