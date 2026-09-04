---
name: web2video
description: >-
  用 Web2Video 场景编辑器做口播网页转视频：版面元件、口播表、KaTeX/Three.js、动效 TimeRef。
  Use when the user mentions web2video、网页场景、分镜元件、katex/three 元件，
  或要用 Cursor MCP 改正在打开的 Web2Video 工程。
---

# Web2Video 使用

可视化场景编辑器。改的是**正在打开的工程**（Zustand），不是磁盘上另一份。密钥、翻译、配音合成不要代劳。

和 Script2Video 的差别：这边是一场一场摆元件；那边是脚本 + `speech.*` 节拍。不要把 web2video 的 `scene.json` 当成 script2video 工程打开。

工程目录：`project.json` 片级，`scene.json` 场景，`aisession.json` AI 会话。旧版场景仍可能在 `project.json` 里。

## 前置

1. `cd web2video && npm run dev`（或 `tauri:dev`），打开编辑器。开发服默认 `http://127.0.0.1:5173`。
2. Cursor 启用 MCP `web2video`（仓库根 `.cursor/mcp.json` → `web2video/mcp/server.mjs`）。
3. 先 `GetDynamicTools` 查 namespace `web2video`，再调用工具。编辑器未开时 `/__mcp/call` 为 503。

应用内也可用同一套工具：顶栏「AI」配接口，右侧「AI」页。

## 工作流

1. `get_project`：画幅、语言、角色、场景列表。
2. `list_catalog`：版面、元件、字体。版面与元件表见 [reference.md](reference.md)。
3. 改现有场：`get_scene` → `update_scene` / `manage_blocks`。
4. 整片重做：`apply_storyboard` `mode=replace`。加场：`append` 或 `manage_scenes add`。
5. 片级外观（字体、字幕条、画布进度条、导出规格）：`set_project`。

用中文简短说明做了什么。

## 工具

| 工具 | 作用 |
| --- | --- |
| `get_project` | 片级概要、场景列表 |
| `get_scene` | 一场文案、口播、画面 visual i18n、元件、动效 |
| `list_catalog` | 版面、元件（含 katex / three）、字体 |
| `set_project` | 画幅、字体、字幕/进度条、导出规格 |
| `apply_storyboard` | 整片 replace / append |
| `update_scene` | 改一场（源语言画面 + 口播） |
| `manage_scenes` | 增删复制调序选中 |
| `manage_blocks` | 增删改元件 |
| `set_visual_text` | 写画面文案某一语言（不是口播） |
| `set_cue` | 兼容旧入场窗口；新片优先元件 `effects` |

## 规则

- **口播驱动**（默认）：`speaks` 列表即时钟。句间留白用 `kind: "gap"` 延时行。时长只读。
- **配置驱动**：口播是台词库；用 `play` 元件排期。开场/结束空白只在此模式生效。
- 每场：画面文案 + `speaks`（口语化，一句一事）。列表用 `items`；对话场 `layout=dialogue` 填 `dialogue:[{side,name,text}]`。画面字不要写进口播。
- 源语言画面用 `update_scene`；其它语言用 `set_visual_text`。预览/导出走 `previewLang`。用户在属性「口播」下面的「文本」里翻译。
- 公式：`katex`，`settings.tex`。三维：`three`，`settings.threeSrc`，`update({ t, localMs })` 跟播放头，**不要 rAF**。
- 不要编造图片 / 视频 / GIF / 模型 / 贴图 URL。媒体让用户在检视里选本地文件。
- 动效跟口播 id 或场景锚点，不要按主体 0–1 拉伸。`set_cue` 的 `at`/`until` 仅兼容旧片。
- 字体 id 来自 `list_catalog`（SIL OFL）。

## 不要做的

- 为 Script2Video 写 `speech.s` / GSAP timeline（那是另一个工具）
- 把 web2video 的 `scene.json` 当 script2video 工程打开
- 代劳配音窗口（合成 / 角色 / 音色）或 Edge 翻译
