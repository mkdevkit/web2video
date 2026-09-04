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
- `showCaptions` 默认关，只影响预览；烧录在导出窗勾选
- `showTopProgress`：画布进度条，会进导出（工作区底部全片条不是这个）

## MCP 链路

页面 `src/lib/mcpBridge.ts` → Vite `/__mcp` → `mcp/server.mjs` stdio。`WEB2VIDEO_MCP_URL` 默认 `http://127.0.0.1:5173`。
