# Web2Video 参考

## 版面 `layout`

| id | 用途 |
| --- | --- |
| `cover` | 封面：大标题 + 副标题 |
| `splitLeft` / `splitRight` | 图文左右 |
| `bullets` | 要点列表，填 `items` |
| `quote` | 金句 + 署名 |
| `steps` | 步骤条 |
| `fullImage` | 全幅图 + 底栏 |
| `compare` | 左右对比 |
| `bigStat` | 大数字 |
| `chapter` | 章节过场 |
| `overlay` | 图上叠字 |
| `threeCol` | 三栏卡片 |
| `qa` | 问答 |
| `cards` | 宫格卡片 |
| `dialogue` | 对话窗，必填 `dialogue:[{side,name,text}]`，左右交替 |
| `custom` | 自由摆放 |

## 元件 `manage_blocks` `type`

`title` `subtitle` `body` `caption` `quote` `author` `number` `list` `dialogue` `image` `video` `gif` `shape` `play` `katex` `three`

- `play`：配置驱动下排期口播，`settings.playTarget` 为口播 id
- `katex`：`settings.tex`、`displayMode`（默认 true）
- `three`：`settings.threeSrc`；可用 `THREE` / `scene` / `camera`；`return function update({ t, localMs })`；`t` 为元件窗口 0–1

三维默认几何即可，不要编造 `.glb` / 贴图 URL。

## 场景字段（`update_scene` / `apply_storyboard`）

常用：`name` `layout` `bg` `bgFit` `bgDim` `holdMs` `drive` `title` `subtitle` `body` `caption` `quote` `author` `number` `items` `dialogue` `speaks`

- `drive`：`narration` | `config`
- `speaks`：字符串数组，顺序即播放顺序；优先用这个，不要再拆开场/结束口播
- `narration` / `narrationClose` / `speak`：兼容旧字段

## 片级 `set_project`

- 画幅：`16:9` `9:16` `1:1`
- 字体：`fontId` `titleFontId` `subtitleFontId` `quoteFontId` `captionFontId`（id 以 `list_catalog.fonts` 为准）
- `showCaptions` 默认关，只影响预览；烧录在导出窗勾选（默认也不勾）
- `showTopProgress`：画布进度条，会进导出（工作区底部全片条不是这个）

## 字体约束

目录与打包字体均为 **SIL OFL**，免费可商用，随工具打包，不走 Google Fonts / 系统字体。

| 位置 | 字段 | 默认 |
| --- | --- | --- |
| 正文、列表 | `fontId` | `noto-sans` |
| 标题、数字 | `titleFontId` | `noto-serif` |
| 副标题、署名 | `subtitleFontId` | `noto-sans` |
| 金句 | `quoteFontId` | `noto-serif` |
| 口播字幕条 | `captionFontId` | `noto-sans` |
| 公式 | KaTeX_* | 随库，SIL OFL |

不要写 `Arial`、微软雅黑、PingFang、`system-ui`、`sans-serif`。不要用目录外的 id。OFL：可嵌进成片，勿单独售卖字体文件。

## 画面文案

源语言用 `update_scene` 的 `title` / `items` / `dialogue`。其它语言用 `set_visual_text`（`kind` + 可选 `itemId` + `lang` + `text`）。用户在属性「口播」下面的「文本」里翻译。KaTeX `tex` 不走画面翻译。

## 工程文件

`project.json` 片级设置；`scene.json` 各场；`aisession.json` 应用内 AI 会话。打开工程文件夹会加载会话。没有向量记忆，恢复即选回 `aisession.json` 里那条对话。

## MCP 链路

页面 `src/lib/mcpBridge.ts` → Vite `/__mcp` → `mcp/server.mjs` stdio。`WEB2VIDEO_MCP_URL` 默认 `http://127.0.0.1:5173`。
