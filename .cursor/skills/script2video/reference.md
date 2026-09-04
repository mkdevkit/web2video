# Script2Video 参考

## speech API

| API | 含义 |
| --- | --- |
| `speech.s("hook")` | 这句配音秒数。这一段画面总时长用它 |
| `speech.ms("hook")` | 同上，毫秒 |
| `speech.startS("hook")` | 起点。口播驱动＝列表时钟；脚本驱动＝`play` 的位置 |
| `speech.endS("hook")` | 终点 |
| `speech.play("hook")` | 脚本驱动：排期并返回开始秒。口播驱动：等于 `startS` |
| `speech.holdS("hook", 0.48)` | `s("hook") − 0.48`。入场固定 + 停住到说完 |
| `speech.bodyS()` | 各句口播之和，不含延时 / sleepS |
| `speech.sleepS(0.4)` | 暂停。口播驱动加在片尾；脚本驱动推进 play 光标 |
| `speech.totalS()` | 本脚本全长 |
| `speech.text("hook")` | 当前预览语言口播文案 |
| `stage.text("title")` | 当前预览语言画面文案（文本页），不是口播 |
| `speech.ids()` | 有文案的 id（不含延时行） |

## GSAP（默认）

每个脚本自己的舞台 HTML。`timeline` 保持 paused。不要 `timeline.play()`。

口播驱动：

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

root.querySelector("#title").textContent = stage.text("title");

const pauseA = speech.sleepS(0.25);
timeline.to({}, { duration: pauseA }, speech.bodyS());
```

脚本驱动：

```js
const fade = 0.48;
const t0 = speech.play("hook");
timeline.fromTo("#title", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: fade }, t0);
timeline.to("#title", { duration: speech.holdS("hook", fade) }, t0 + fade);
speech.sleepS(0.4);
const t1 = speech.play("fact");
timeline.fromTo("#stat", { opacity: 0 }, { opacity: 1, duration: 0.42 }, t1);
timeline.to("#stat", { duration: speech.holdS("fact", 0.42) }, t1 + 0.42);
```

## 引擎

| 引擎 | 工作台 | 成片 |
| --- | --- | --- |
| GSAP | 本脚本 HTML + paused timeline | 本机录舞台 |
| HyperFrames | 同上，seek 暂停轴 | 本机录舞台 |
| Remotion | 节拍卡；完整画面拷到 Remotion 项目 | `durationInFrames` 来自口播 |
| Manim | 节拍卡；读 `clock.json` | `FadeIn` 固定 `run_time`，多余口播 `wait()` |

KaTeX / Three.js 是 GSAP 脚本里的库，时长仍跟 `speech` 走。

## beats

```json
{ "id": "hook", "kind": "speech", "text": "黑洞不是一个坑。" }
{ "id": "gap1", "kind": "gap", "gapMs": 400 }
```

`id` 字母开头、勿空格。`roleId` 来自工程 voices。`manage_beats` 的 `replace` 会标配音过期。

## 应用内 AI 约定

改现有工程先 `get_project` / `get_script`。整片重做 `apply_scripts mode=replace`，每条给出 `stageHtml` 与 GSAP `code`。加一段用 `append`。`drive`：`narration` | `script`。画面字用 `manage_stage_texts`（`sync` / `set_text`），不要代劳机翻。
