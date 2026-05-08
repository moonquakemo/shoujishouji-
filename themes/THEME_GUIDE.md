# Phone UI 主题制作指南

> 本文件是给 **AI 助手** 使用的参考文档。用户可以把这个文件发给任意 AI，让 AI 帮你生成一套新主题。

## 如何制作主题？

1. 复制下方的 **变量模板**
2. 修改其中的颜色值
3. 保存为 `.css` 文件，放到 `themes/` 目录下
4. 在扩展设置中选择该主题

## 变量模板

```css
/* 主题名称: [你的主题名]
   描述: [简短描述] */

:root {
  /* ===== 手机外壳 ===== */
  --phone-bg: #0a0a0f;                  /* 手机边框/外壳背景色 */
  --phone-border: rgba(255,255,255,0.06); /* 手机外边框颜色 */
  --phone-chat-bg: #f5f5f7;             /* 聊天区域背景色 */
  --phone-width: 360px;                 /* 手机宽度 */
  --phone-radius: 32px;                 /* 手机圆角 */

  /* ===== 状态栏 & 导航栏 ===== */
  --navbar-bg: #1a1a2e;                 /* 顶部导航栏背景色 */
  --navbar-text: #fff;                  /* 导航栏文字颜色 */
  --navbar-icon-fill: #fff;             /* 导航栏图标颜色 */

  /* ===== 聊天气泡 ===== */
  --bubble-other-bg: #ffffff;           /* 对方消息气泡背景 */
  --bubble-other-text: #1a1a1a;         /* 对方消息文字颜色 */
  --bubble-me-bg: linear-gradient(135deg, #95ec69, #69d946); /* 我的消息气泡背景（支持渐变） */
  --bubble-me-text: #1a1a1a;            /* 我的消息文字颜色 */
  --bubble-radius: 20px;                /* 气泡圆角大小 */

  /* ===== 头像 ===== */
  --avatar-other-bg: linear-gradient(135deg, #667eea, #764ba2); /* 对方头像默认背景（支持渐变） */
  --avatar-me-bg: linear-gradient(135deg, #07c160, #34d058);    /* 我的头像默认背景 */
  --avatar-text: #fff;                  /* 头像文字颜色（显示首字母时） */
  --avatar-size: 36px;                  /* 头像大小 */

  /* ===== 强调色 ===== */
  --accent-blue: #576b95;               /* 蓝色强调（链接、引用等） */
  --accent-green: #07c160;              /* 绿色强调（发送按钮等） */
  --accent-orange: #ee7b30;             /* 橙色强调（转账金额等） */
  --accent-red: #fa5151;                /* 红色强调（定位图标等） */
  --accent-purple: #8b5cf6;             /* 紫色强调 */

  /* ===== 输入栏 ===== */
  --inputbar-bg: #f7f7f8;              /* 输入栏区域背景 */
  --inputbar-border-top: rgba(0,0,0,0.06); /* 输入栏上边框 */
  --input-bg: #fff;                     /* 输入框背景 */
  --input-border: rgba(0,0,0,0.08);     /* 输入框边框 */
  --input-text: #333;                   /* 输入框文字颜色 */
  --input-placeholder: #ccc;            /* 输入框占位符颜色 */
  --input-icon-fill: #333;              /* 输入栏图标颜色 */
  --input-radius: 20px;                 /* 输入框圆角 */

  /* ===== 转账卡片 ===== */
  --transfer-bg: linear-gradient(135deg, #fff3e0, #ffe8cc); /* 转账卡片背景 */
  --transfer-border: rgba(238,123,48,0.15); /* 转账卡片边框 */
  --transfer-label-color: #8a6a3a;      /* 转账标签文字颜色 */

  /* ===== 表情包 & 媒体卡片 ===== */
  --media-bg: linear-gradient(135deg, #fff3e0, #ffe8cc); /* 图片/视频/表情包卡片背景 */
  --media-border: rgba(238,123,48,0.15); /* 媒体卡片边框 */
  --media-desc-color: #555;             /* 媒体描述文字颜色 */
  --media-scrollbar: rgba(238,123,48,0.3); /* 媒体描述滚动条颜色 */

  /* ===== 位置卡片 ===== */
  --location-bg: #fff;                  /* 位置卡片背景 */
  --location-map-bg: linear-gradient(135deg, #e8f5e9, #c8e6c9); /* 地图区域背景 */
  --location-name-color: #1a1a1a;       /* 地点名称颜色 */
  --location-addr-color: #999;          /* 地址文字颜色 */

  /* ===== 时间分隔线 ===== */
  --time-sep-bg: rgba(0,0,0,0.06);      /* 时间标签背景 */
  --time-sep-text: #999;                /* 时间标签文字 */

  /* ===== 其他文字颜色 ===== */
  --msg-time-color: #bbb;              /* 消息时间戳颜色 */
  --quote-bg: rgba(0,0,0,0.08);         /* 引用消息背景 */
  --quote-text: #888;                   /* 引用消息文字 */
  --recall-text: #bbb;                  /* 撤回提示文字 */
  --voice-wave-color: rgba(0,0,0,0.25); /* 语音波形颜色 */
  --voice-duration-color: rgba(0,0,0,0.45); /* 语音时长文字 */

  /* ===== 发送按钮 ===== */
  --send-buffer-bg: #e0e0e0;            /* →暂存按钮背景 */
  --send-buffer-text: #555;             /* →暂存按钮文字 */
  --send-final-bg: var(--accent-green); /* ↑发送按钮背景 */
  --send-final-text: #fff;              /* ↑发送按钮文字 */
  --preview-opacity: 0.55;              /* 预览气泡透明度 */
  --preview-border: rgba(7,193,96,0.4); /* 预览气泡边框 */
  --sent-border: rgba(7,193,96,0.3);    /* 已发送气泡边框 */

  /* ===== 字体 ===== */
  --font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 10px;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;

  /* ===== 阴影 ===== */
  --shadow-phone: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
  --shadow-card: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-bubble: 0 1px 3px rgba(0,0,0,0.04);
}
```

## 示例：快速改色

想把微信绿改成 LINE 绿？只需要改这几个变量：
```css
--bubble-me-bg: #00B900;
--accent-green: #00B900;
--avatar-me-bg: #00B900;
--send-final-bg: #00B900;
```

想做暗黑模式？重点改这些：
```css
--phone-chat-bg: #1a1a1a;
--bubble-other-bg: #2a2a2a;
--bubble-other-text: #e0e0e0;
--inputbar-bg: #222;
--input-bg: #333;
--input-text: #eee;
--navbar-bg: #111;
```
