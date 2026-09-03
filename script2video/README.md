# Script2Video

口播脚本工作台：管脚本、管多语言口播、机翻、千问配音，再把画面事件绑在**节拍**上而不是绝对秒。同一套 UI 可跑在浏览器（Vite）或桌面（Tauri）。渲染可接 HyperFrames + GSAP、Remotion、Manim。

和 [`web2video`](../web2video) 的差别：那边是「网页场景编辑器」；这边是「脚本 / 节拍 / 引擎」管线。翻译、配音、密钥代理与 web2video 同一套（Edge 机翻 + 千问 TTS）。

## 怎么跑

**浏览器（开发）**

```bash
cd script2video
npm install
npm run dev
```

打开 http://localhost:5174 。必须用 `npm run dev`：本机 Vite 插件会代理千问 TTS、DeepSeek（LLM）和 Edge 翻译。

**桌面（Tauri）**

需本机已装 [Rust](https://rustup.rs/)（含 `cargo`）。

```bash
cd script2video
npm install
npm run tauri:dev     # 开发：嵌同一套前端
npm run tauri:build   # 安装包
```

| | Web | Tauri |
| --- | --- | --- |
| UI | 同一套 React | 同一套 React |
| 翻译 / TTS / LLM 开发期 | Vite 插件 `/__edge_translate`、`/__tts/qwen`、`/__llm/chat` | 同样走 Vite（`tauri dev`） |
| 翻译 / TTS 打包后 | 仍需本机预览服务器，或以后接后端 | Rust 命令直连 Edge / DashScope |
| 工程文件 | 浏览器下载 JSON；可选目录 | 原生打开 / 保存 `project.json` + `media/` |

密钥只存在本机（`script2video.tts-secrets`、`script2video.llm-secrets`），不进工程文件。

## 字体

全部为 **SIL Open Font License**，免费可商用。不随工具分发专有字体。`system-ui` 只是系统回落。

| 用在哪 | 字体 | 许可 |
| --- | --- | --- |
| 工作台界面 | DM Sans、Noto Sans SC | SIL OFL |
| 舞台正文 | 外观 → 正文字体（默认 Noto Sans） | SIL OFL |
| 舞台标题 | 外观 → 标题字体（默认 Noto Serif） | SIL OFL |
| 字幕条（预览与烧录）、节拍卡 | 外观 → 字幕字体（默认 Noto Sans） | SIL OFL |
| 中日文缺字回落 | Noto Sans/Serif SC、JP；IBM Plex 日文走 IBM Plex Sans JP | SIL OFL |
| HyperFrames 示例页 | Noto Sans SC | SIL OFL |

成片可选字体（外观里下拉，均为 SIL OFL）：Noto Sans / Noto Serif、Source Sans 3 / Source Serif 4、IBM Plex Sans、PT Sans、Nunito Sans、Inter、Literata、DM Sans。若脚本引入 KaTeX 样式，其公式字体 KaTeX_* 同样是 SIL OFL。工作台「用法」页有同一张表。

## 用例

### 1. 用 AI 生成口播脚本（DeepSeek）

顶栏 **AI** 配置接口（默认 DeepSeek Flash / Pro，也可 OpenAI 兼容网关），再打开中间 **AI** 页用自然语言生成或改脚本。模型和 web2video 一样走 Chat Completions + 本地工具：

读：`get_project`、`get_script`、`list_catalog`  
写：`apply_scripts`（整片生成/追加）、`update_script`、`manage_scripts`、`manage_beats`、`set_project`

例如：「三句口播讲黑洞不是洞，GSAP 跟节拍走」。改完可切口播页改文案、脚本页改 timeline、右侧预览。

## 用例

### 2. 写一集口播，拆成节拍

新建脚本 → 按句加 beat（钩子 / 事实 / 收束）。每句各语言一份文案。画面事件不要写死秒数。在脚本里用口播 id：

```js
speech.s("hook")           // 这一句配音有多长（秒）
speech.holdS("hook", 0.48) // = s("hook") - 0.48：入场后还要停多久，直到这句说完
speech.sleepS(0.4)          // 暂停（可多次，每次加进全长）
speech.totalS()            // 全片 = bodyS + 所有 sleepS
```

入场用固定秒；**这一段代码的总时长 = `speech.s(id)`**。换语言只换 TTS，代码不用改。

舞台 HTML 写在**每个脚本**上（DOM，不是 canvas）。画幅、字体、底色、全局 CSS 在顶栏「外观」。舞台与字幕字体均为 SIL OFL（免费可商用）；烧录字幕条用「字幕字体」。中日文不足会回落 Noto CJK。每个脚本自己选引擎，导出按左侧列表顺序拼成一条片子。口播时长怎么取、各工具怎么写：工作台「用法」页，或下文 [工具用法](#工具用法)。

适合：科普、产品介绍、课程片头——同一套分镜要出很多语种。

### 3. 一键翻译空缺语言

源语言写完中文（或英语）→ 口播页九语言表 →「一键翻译空缺」或「全部重译」（Edge 机翻：中、英、日、法、德、俄、西、葡、意）。「翻译后合成语音」默认关闭。配音窗口可勾选要合成的语言。

### 4. 按语言生成口播，并对齐画面

「配音」里填千问 API Key、加角色并指定音色。按**当前脚本 × 所选语言**逐句合成（一句一条，得到真实 `beatMs`），再拼成整段音频。改了某句文案会标记该语言音频过期。

入场用固定毫秒（各语言一样快）；停留跟该句口播拉长/缩短。不要整条时间轴 `timeScale`。

### 5. 切语言预览：同一套事件，不同时长

预览语言切到英语：`speech.s("hook")` 变短，标题 fade 仍是 0.48s，停留用 `holdS` 吃掉差额。右侧表列出每个口播 id 的秒数。

### 6. 导出视频与多语言字幕

顶栏「导出」：

1. **每种语言各一段视频**：该语言配音 + 时间轴；可选烧录字幕条；可另存该语言 SRT/VTT（每条 cue 的起止 = 该句 `speech.s(id)`）。
2. **一段视频 + 多语言字幕**：只录视频语言；多种字幕文件**共用这段口播时间轴**，只换文案。勾选「附带视频语言」时，其它语言文件为两行双语、同一时间标记。

烧录字幕跟当前口播句对齐；字体在顶栏「外观」的「字幕字体」；双语主行是配音语言，副行是第二语言。

### 7. 每个脚本一个引擎，导出按顺序合并

左侧列表顺序 = 成片顺序（可上移/下移）。每个脚本选一种引擎：

| 引擎 | 工作台里 | 成片这一段 |
| --- | --- | --- |
| GSAP | 本脚本 HTML + paused timeline，预览 seek | 本机录制舞台 |
| HyperFrames | 同上（框架 seek，不要 `play()`） | 本机录制舞台 |
| Remotion | 编辑构图草稿；预览为节拍卡 | 本机按口播时长录节拍卡；完整画面用 Remotion 渲该段再替换 |
| Manim | 编辑 Python 草稿；预览为节拍卡 | 本机按口播时长录节拍卡；完整画面用 Manim 渲该段再替换 |

时钟 JSON（`toClockJson`）仍是 Remotion / Manim 的时间轴：`durationInFrames` / `run_time` 来自口播，不要写死秒数。

### 8. 工程以目录为单位

和 web2video 一样：选一个上级目录，工程写在「项目名」子文件夹里。

- `project.json`：口播、脚本、外观、配音元数据
- `media/{lang}/{scriptId}.wav`：该句拼好的配音

打开时可选项目文件夹，或包含它的上级目录。Chrome / Edge 用目录选择器；没有该 API 时退回下载/打开 JSON（不含音频）。桌面（Tauri）同样选文件夹。Ctrl+S 保存到已绑定目录。换机器带上整个文件夹即可。

## 工具用法

工作台中间有「用法」页，与本节相同。画面跟口播节拍走，不要写死秒数。口播页给每句一个 id（如 `hook`）；脚本页选工具。

### 怎么取口播时长

| 层 | 存什么 | 随语言变吗 |
| --- | --- | --- |
| 语义 | 第几句、句内 0–1、元件 id | 否 |
| 口播 | TTS 每句真实毫秒（尚未配音时按字数估算） | 是 |
| 演出 | 入场 fade 等固定毫秒 | 否 |

工作台注入的 `speech`（GSAP / HyperFrames）：

| API | 含义 |
| --- | --- |
| `speech.s("hook")` | 这一句配音有多长（秒）。这一段画面的总时长用它 |
| `speech.ms("hook")` | 同上，毫秒 |
| `speech.startS("hook")` | 这一句口播从哪一秒开始（不含暂停） |
| `speech.endS("hook")` | 这一句口播哪一秒结束（不含暂停） |
| `speech.holdS("hook", 0.48)` | `s("hook") − 0.48`。画面分两段：入场固定 0.48s（各语言相同）+ 停住到这句配音结束。换语言只变停住多久 |
| `speech.bodyS()` | 各句口播之和，不含暂停 |
| `speech.sleepS(0.4)` | 暂停。每次调用把这段时间加进全长并返回该值；可多次。不要在口播表填毫秒 |
| `speech.totalS()` | 本脚本全长 = `bodyS` + 所有 `sleepS` |
| `speech.text("hook")` | 当前预览语言的口播文案 |
| `speech.ids()` | 有文案的口播 id，按播放顺序 |

入场用固定秒（各语言一样快）；**这一段总时长 = `speech.s(id)`**。多出来的时间用 hold 停住。右侧预览表列出每个 id 的秒数。

Remotion / Manim 不跑 `speech` 对象：用同一套时钟（`toClockJson` / `sceneDurationMs` / `audio.beatMs`）。

### GSAP

工作台默认引擎。每个脚本自己的舞台 HTML；画幅 / 字体 / 全局 CSS 在顶栏「外观」。本脚本只写 paused timeline。预览和导出走 seek，不要 `play()`。

```js
const fade = 0.48;

timeline.fromTo(
  "#title",
  { opacity: 0, y: 16 },
  { opacity: 1, y: 0, duration: fade, ease: "power2.out" },
  speech.startS("hook"),
);
timeline.to(
  "#title",
  { duration: speech.holdS("hook", fade) },
  speech.startS("hook") + fade,
);

root.querySelector("#title").textContent = speech.text("hook");

const pauseA = speech.sleepS(0.25);
const pauseB = speech.sleepS(0.4);
timeline.to({}, { duration: pauseA }, speech.bodyS());
timeline.to({}, { duration: pauseB }, speech.bodyS() + pauseA);
```

### HyperFrames

和 GSAP 一样：每个脚本自己的舞台 HTML、同一套 `speech`。成片由 HyperFrames seek 这条暂停轴（`engines/hyperframes/bind-gsap.ts`）。构图时长 = `speech.totalS()`，随语言变。

```js
const fade = 0.48;
timeline.fromTo("#title", { opacity: 0 }, { opacity: 1, duration: fade }, speech.startS("hook"));
timeline.to("#title", { duration: speech.holdS("hook", fade) }, speech.startS("hook") + fade);
const pauseA = speech.sleepS(0.25);
const pauseB = speech.sleepS(0.4);
timeline.to({}, { duration: pauseA }, speech.bodyS());
timeline.to({}, { duration: pauseB }, speech.bodyS() + pauseA);
root.dataset.duration = String(speech.totalS());
```

### Remotion

工作台里预览/导出是节拍卡（时长与配音对齐）。完整画面拷到 Remotion 项目，用 `engines/remotion/NarratedScene.ts`。

`durationInFrames` 必须来自口播，不要写死 150。入场用固定帧数，多出来的口播帧用来停住。

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion";
import { durationInFrames, remotionClock } from "./engines/remotion/NarratedScene";

// Root：durationInFrames={durationInFrames(script, audio, fps)}

const { fps } = useVideoConfig();
const frame = useCurrentFrame();
const { localMs } = remotionClock(script, audio, frame, fps);
const fadeS = 0.48;
const hookS = audio.beatMs.hook / 1000;
const pauseA = 0.25;
const pauseB = 0.4; // 与多次 speech.sleepS 相同；clock.sleep_ms 是合计
```

### Manim

工作台里同样是节拍卡。完整画面读 `toClockJson` 写出的 `clock.json`（`engines/manim/narrated_scene.py`）。`FadeIn` 固定 `run_time`，多余口播 `wait()`。每种语言一份时钟 + 一份配音。

```python
clock = load_clock()
beats = {b["id"]: b for b in clock["beats"]}
hook = beats["hook"]

fade = 0.48
hold = max(0.0, hook["ms"] / 1000 - fade)

self.play(FadeIn(title), run_time=fade)
self.wait(hold)
self.wait(0.25)  # 与 speech.sleepS(0.25) 对应，可多次
self.wait(0.4)
# clock["sleep_ms"] 是这些暂停的合计
```

### 不要做的

- 整条时间轴按「新时长 / 旧时长」做 `timeScale`
- CSS `animation-duration: 8s` 或 Remotion `durationInFrames={150}` 当口播时钟
- 用英文字幕时间轴驱动中文画面（字幕可以共用时间轴，**动画不行**）
- 调用 `timeline.play()`（预览和 HyperFrames 都是 seek 暂停轴）
- 在口播表填暂停毫秒；暂停写在脚本里：`speech.sleepS` 可多次，`clock.sleep_ms` 是合计

## 目录

```
src/                 共用前端（Web + Tauri WebView）
  components/        脚本列表、口播、脚本、AI（DeepSeek）、用法、配音、预览
  lib/clock.ts       节拍 → 毫秒
  lib/engineGuide.ts 用法页 / 各引擎取时长说明
  lib/platform.ts    Web / Tauri 分支（文件、翻译、TTS）
src-tauri/           桌面：文件系统 + 打包后的翻译/TTS 代理
engines/hyperframes  HTML 合成 + GSAP
engines/remotion     Remotion 时钟适配
engines/manim        Manim 场景
```
