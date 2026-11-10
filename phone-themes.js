const PhoneThemes = (() => {
    const builtinThemes = new Map([
        ['wechat', { name: 'WeChat (微信风格)', file: 'wechat.css' }],
        ['sakura', { name: 'Sakura Breeze (樱花粉)', file: 'sakura.css' }],
        ['kakaotalk', { name: 'KakaoTalk (经典黄)', file: 'kakaotalk.css' }],
        ['whatsapp', { name: 'WhatsApp (绿白风格)', file: 'whatsapp.css' }],
    ]);
    const presetRequests = new Map();
    const styleId = 'phone-ui-custom-theme';
    let extensionPath = '';

    function configure(path) {
        extensionPath = String(path || '').replace(/\/+$/, '');
    }

    function listBuiltins() {
        return Array.from(builtinThemes, ([id, theme]) => ({ id, name: theme.name }));
    }

    function isBuiltin(id) {
        return builtinThemes.has(id);
    }

    function loadPreset(id) {
        const theme = builtinThemes.get(id);
        if (!theme) return Promise.reject(new Error(`Unknown phone theme: ${id}`));
        if (!extensionPath) return Promise.reject(new Error('Phone theme path is not configured'));
        const url = `${extensionPath}/themes/${theme.file}`;
        if (!presetRequests.has(url)) {
            const request = Promise.resolve().then(async () => {
                const response = await fetch(url, { cache: 'no-cache' });
                if (!response.ok) throw new Error(`Unable to load ${id}: HTTP ${response.status}`);
                const css = await response.text();
                if (!css.trim() || /text\/html/i.test(response.headers.get('content-type') || '') || /^\s*(?:<!doctype\s+html|<html\b)/i.test(css)) {
                    throw new Error(`Invalid CSS response for ${id}`);
                }
                return css;
            }).catch(error => {
                presetRequests.delete(url);
                throw error;
            });
            presetRequests.set(url, request);
        }
        return presetRequests.get(url);
    }

    async function loadTheme(selection, customThemes = {}) {
        if (selection.startsWith('builtin:')) {
            const id = selection.slice('builtin:'.length);
            const css = await loadPreset(id);
            return { isCustom: false, name: builtinThemes.get(id).name, rawName: id, css };
        }
        if (selection.startsWith('custom:')) {
            const name = selection.slice('custom:'.length);
            const css = Object.prototype.hasOwnProperty.call(customThemes, name) ? customThemes[name] : '';
            return { isCustom: true, name, rawName: name, css };
        }
        return { isCustom: false, name: '', rawName: '', css: '' };
    }

    function resolveCss(settings, characterName = '', character = null) {
        if (characterName) {
            const characterCss = settings.char_themes?.[characterName];
            if (characterCss) return characterCss;
            const cardCss = character?.data?.extensions?.phone_theme_css;
            if (cardCss) return cardCss;
        }
        return settings.global_theme_css || '';
    }

    function removeCss() {
        document.getElementById(styleId)?.remove();
    }

    function applyCss(css) {
        removeCss();
        if (!css) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    return { configure, listBuiltins, isBuiltin, loadTheme, resolveCss, applyCss, removeCss };
})();

if (typeof window !== 'undefined') {
    window.PhoneThemes = PhoneThemes;
}
if (typeof globalThis !== 'undefined') {
    globalThis.PhoneThemes = PhoneThemes;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhoneThemes;
}
