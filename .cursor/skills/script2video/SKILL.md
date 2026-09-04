---
name: script2video
description: >-
  用 Script2Video 脚本工作台做口播转视频：beats 节拍、口播驱动/脚本驱动、GSAP/HyperFrames/Remotion/Manim、speech.* 时长。
  Use when the user mentions script2video、口播脚本、节拍、speech.s/holdS/play、GSAP timeline，
  或要写跟配音走的画面代码。不要与 web2video 场景元件混用。
---

# Script2Video 使用

脚本 / 节拍工作台。画面跟口播 id 走，**不要写死秒数**。密钥、翻译、配音合成不要代劳。

**没有 Cursor stdio MCP。** 不能直接改正在打开的工程。帮助方式：

- 写出 beats + 舞台 HTML + paused GSAP，让用户粘贴到口播页 / 脚本页；或
- 让用户在工作台中间「AI」页用同一套工具（`src/lib/ai/tools.ts`）应用。

和 Web2Video 的差别：这边是脚本 + `speech.*`；那边是场景元件。两边的 `project.json` 不能互换。不要改既有双模式（口播驱动 / 脚本驱动），除非用户明确要求。

## 前置

```bash
cd script2video
npm install
npm run dev          # http://localhost:5174
# 或 npm run tauri:dev
```

必须用开发服：Vite 代理 TTS / LLM / 翻译。

## 工作流

1. 先弄清当前是 **口播驱动** 还是 **脚本驱动**（口播页切换）。未说明则按口播驱动写。
2. 每句一个稳定 id（`hook` / `fact` / `close` 或英文短词），口语化，一句一事。
3. 舞台 HTML 写在**该脚本**上（DOM，不是 canvas）。画幅 / 字体 / 底色 / 全局 CSS 是工程级。有字的节点在 **文本** 页翻译，预览/导出走预览语言。脚本里可用 `stage.text("id")`。
4. GSAP：paused timeline；入场固定秒；总时长 = `speech.s(id)`；多出来的用 `holdS`。
5. 整片结构、引擎约定与反例见 [reference.md](reference.md)。

用中文简短说明建议用户在工作台里点哪里。

## 工作台内工具（仅应用内 AI）

| 工具 | 作用 |
| --- | --- |
| `get_project` | 片级概要、脚本列表 |
| `get_script` | 一条的 beats、引擎、源码、stageTexts |
| `list_catalog` | 引擎、`speech.*`、写法 |
| `set_project` | 名称、画幅、舞台外观、字幕 |
| `apply_scripts` | 整片 replace / append |
| `update_script` | 改名称、引擎、`drive`、code、stageHtml |
| `manage_scripts` | 增删调序选中 |
| `manage_beats` | 改口播表 |
| `manage_stage_texts` | 舞台画面文案（sync / set_text），不是口播 |

口播时长只读。画面跟 `speech.s` / `holdS` / `play`。KaTeX / Three.js 是 GSAP 脚本里的库，不是独立引擎。

## 时钟

口播驱动（默认）：列表顺序即时钟。句间留白用 `kind: "gap"` 延时行。不要用 `sleepS` 当句间停顿（它加在片尾）。

脚本驱动：列表是台词库。必须 `speech.play("hook")` 才会出声；返回开始秒，可当 GSAP position。`sleepS` 插在两次 `play` 之间。

```js
speech.s("hook")           // 这句配音有多长（秒）
speech.holdS("hook", 0.48) // = s("hook") - 0.48
speech.startS("hook")      // 口播驱动：列表时钟起点
speech.play("hook")        // 脚本驱动：排期并返回起点
speech.sleepS(0.4)          // 口播驱动＝片尾；脚本驱动＝两次 play 之间
speech.text("hook")         // 当前预览语言口播文案
stage.text("title")         // 当前预览语言画面文案（文本页）
```

入场用固定秒（各语言一样快）。换语言只换 TTS，代码不用改。

## 不要做的

- 假装已有 Cursor MCP，或去改正在打开的 Zustand 工程
- `timeline.play()`（预览是 seek 暂停轴）。口播用 `speech.play`
- 整条时间轴 `timeScale`；CSS `animation-duration: 8s`；Remotion `durationInFrames={150}`
- 用英文字幕时间轴驱动中文画面（字幕可以共用轴，动画不行）
- 把 web2video 的场景元件 / `manage_blocks` 用到这边
- 代劳配音窗口或 Edge 翻译
