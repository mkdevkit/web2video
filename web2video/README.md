# Web2Video

把口播做成网页场景：版面元件、多语言文案、千问 TTS、时间轴动画，再按语言导出视频（可选字幕文件）。

建议 **Chrome 或 Edge**（依赖 File System Access、MediaRecorder、IndexedDB）。

```bash
npm install
npm run dev
```

开发时必须用 `npm run dev`：本机 Vite 插件会代理千问 TTS、LLM 和 Edge 翻译，避免浏览器跨域。

## 功能

- 视频 / GIF 元件（跟场景时间走，导出时按当前帧画进画面）
- 公式（KaTeX）与三维（Three.js）元件：公式写 TeX；三维脚本跟播放头 seek，导出时画进画面
- 多种版面：封面、图文、要点、金句、步骤、对话窗、自定义等
- 场景底色 / 背景图、口播字幕条（字体与样式可配，烧录到画面）、画布进度条（样式可配，画在舞台上会进导出）
- 每场独立口播表（id、只读时长、角色、九种语言同一行）；口播驱动或配置驱动
- 元件可配多条动效：起点/终点分口播、场景锚点、固定时间；终点也可设时长。缓推缩放等
- 配置驱动用「播放口播」元件排期；开场/结束空白只在此模式下生效
- 工作区底部只有全片进度条；画布进度条（`showTopProgress`）会进导出
- 点舞台元件显示该元件属性（含动效）；点空白回到场景属性
- 千问 TTS：合成 / AI 配置 / 配音角色 / 音色管理；各语言可指定默认角色
- 「翻译后合成语音」默认关闭
- 生成式 AI 分镜（DeepSeek 等 Chat Completions + 本地工具调用）
- 一键机翻：中、英、日、法、德、俄、西班牙、葡萄牙、意大利
- 导出 WebM（VP8/VP9）或 MP4（H.264，视浏览器而定）；分辨率 / 帧率 / 码率可配
- 默认不烧录字幕；可另存 SRT / VTT；也可只出一段视频、配多语言字幕（同一时间轴）
- 工程写入所选目录下的「项目名」子文件夹：`project.json` + `media/`

## 字体

全部为 **SIL Open Font License**，免费可商用。不随工具分发专有字体。`system-ui` 只是系统回落。

| 用在哪 | 字体 | 许可 |
| --- | --- | --- |
| 工作台界面（按钮、表单、检视） | DM Sans、Noto Sans SC | SIL OFL |
| 工作台标题（顶栏品牌、对话框标题） | Fraunces、Noto Serif SC | SIL OFL |
| 画面正文、列表 | 配置 → 字体 → 正文 / 列表（默认 Noto Sans） | SIL OFL |
| 画面标题、数字 | 配置 → 字体 → 标题 / 数字（默认 Noto Serif） | SIL OFL |
| 副标题、署名 | 配置 → 字体 → 副标题 / 署名（默认 Noto Sans） | SIL OFL |
| 金句 | 配置 → 字体 → 金句（默认 Noto Serif） | SIL OFL |
| 口播字幕条（预览与烧录到画面） | 配置 → 字体 → 口播字幕（默认 Noto Sans） | SIL OFL |
| 画布进度条场次名 | 配置 → 字体 → 进度条场次名（可回落字幕字体） | SIL OFL |
| 公式元件 | KaTeX 自带（KaTeX_*） | SIL OFL |
| 单个元件覆盖 | 检视里可选；缺省跟该类型全局字体 | SIL OFL |
| 中日文缺字回落 | Noto Sans/Serif SC、JP；IBM Plex 日文走 IBM Plex Sans JP | SIL OFL |

成片可选字体（配置里下拉，均为 SIL OFL）：Noto Sans / Noto Serif、Source Sans 3 / Source Serif 4、IBM Plex Sans、PT Sans、Nunito Sans、Inter、Literata、DM Sans。工作台「配置 → 字体」与「?」帮助里分「用在哪」「每种字体」两页表。

## 技术方案

纯前端单页应用，不自建后端。密钥只存在本机 `localStorage`，不进工程文件。

### 栈

| 层 | 选用 |
| --- | --- |
| 构建 | Vite 6 + TypeScript + `@vitejs/plugin-react-swc` |
| UI | React 18、Tailwind CSS、lucide-react |
| 公式 / 三维 | KaTeX、Three.js（元件内 seek 渲染，无独立 rAF） |
| 状态 | Zustand（工程、播放头、撤销栈、对话框） |
| 配音 | 阿里云百炼 / 千问 TTS（设计 `qwen-voice-design`、复刻 `qwen-voice-enrollment`、合成 `qwen3-tts-vd` / `qwen3-tts-vc`） |
| 分镜 AI | OpenAI 兼容 Chat Completions（默认 DeepSeek），function calling |
| 翻译 | Microsoft Edge 翻译接口（Vite 反代 `/__edge_translate`） |
| 导出画面 | `html-to-image` 逐帧截舞台 → `canvas.captureStream` + `MediaRecorder`；视频/GIF/三维先画到 2D canvas 再截 |
| 导出音频 | Web Audio API 按场景时钟切片对齐口播 |
| 工程磁盘 | File System Access API（目录句柄存 IndexedDB） |
| 口播缓存 | IndexedDB（`web2video-audio`） |

### 工程模型

`src/types.ts` 里的 `Project` 是唯一真相：画幅、字体、字幕/进度条样式、导出规格、场景列表。

- `drive`：`narration`（默认，列表即时钟，可加延时行）或 `config`（播放元件排期）
- `speaks`：本场口播（id、多语言文本、角色）；时长只读，来自合成 `beatMs` 或字数估计；延时为 `kind: "gap"`
- `slots`：画面文案（含列表、对话窗）
- `cues`：旧入场绑定（无 `effects` 时仍可读）
- `blocks`：元件几何、样式、多条 `effects`；`TimeRef.kind` 为 `speak` / `scene` / `fixed`，终点也可只用 `durationMs`；`play` 元件只排期口播
- `audioByLang`：各语言配音元数据（时长、`beatMs`、是否过期）

时间轴在 `src/lib/timeline.ts` + `calendar.ts`：口播驱动按 `speaks` 列表（含延时）+ 停留；配置驱动按播放元件与动效窗口，全部结束后切场。换语言用各句实际时长，不再把画面按 0–1 拉伸。工作区底部进度条是全片一条，可点各场分段。

### 配音

合成入口 `src/lib/synthProject.ts`：按句合成后写入 `beatMs`。口播驱动按列表拼接（延时插入静音）；配置驱动按播放元件开始时刻混音。

浏览器不能直连 DashScope，开发服务器插件把请求转到 `/__tts/qwen`、`/__tts/qwen-voice`。API Key 在请求头里带上，存在 `web2video.tts-secrets`。音色库在 `web2video.voice-library`，可跨工程复用。配音窗口四个标签：合成、AI 配置、配音角色、音色管理（设计 / 复刻 / 从千问同步 / 试听）。

### 分镜 AI

`src/lib/ai/agent.ts` 循环调用 Chat Completions，把 `src/lib/ai/tools.ts` 里的工具交给模型：读工程、写分镜、改场景/元件/动效锚点、改片级外观与导出规格。密钥在 `web2video.llm-secrets`。跨域由 `vite-plugin-llm-proxy.ts` 的 `/__llm/chat` 转发（只允许 https 或本机 http）。工具约定见该文件 `SYSTEM_PROMPT` 与 `AI_TOOLS`。

### 导出

隐藏的 `#export-stage` 按画幅像素渲染。`src/lib/exportVideo.ts` 用 `html-to-image` 按帧率截图画到 canvas，`MediaRecorder` 混入按 `sceneClock` 切片的 TTS。规格在 `exportSettings`（格式、1080/720/480、帧率、音视频码率）。

字幕文件由 `src/lib/subtitles.ts` 把各场口播 beat 映射到全片时间轴，写成 SRT 或 VTT。烧录字幕条是舞台上的 DOM，字体用工程的 `captionFontId`（SIL OFL），与字幕文件独立。

### 目录结构（逻辑）

```
src/
  components/     顶栏、舞台、时间轴、检视、各对话框
  layouts/        舞台渲染 StageView
  lib/            时间轴、口播、TTS、导出、工程目录、AI
  store/          Zustand 编辑器
  types.ts        工程与版面类型
vite-plugin-*.ts  开发期 TTS / LLM / 翻译代理
```

## 快捷键

| 按键 | 作用 |
| --- | --- |
| 空格 | 播放 / 暂停 |
| Ctrl+S | 保存（选上级目录，写入「项目名」子文件夹） |
| Ctrl+E | 导出 |
| Ctrl+Z / Y | 撤销 / 重做 |
| ? | 帮助 |
