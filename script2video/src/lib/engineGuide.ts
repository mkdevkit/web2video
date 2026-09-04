import type { EngineId } from "../types";

export const SPEECH_API = [
  { name: `speech.s("hook")`, meaning: "这一句配音有多长（秒）。这一段画面的总时长用它，不要写死 3。" },
  { name: `speech.ms("hook")`, meaning: "同上，毫秒。" },
  { name: `speech.startS("hook")`, meaning: "这一句口播从哪一秒开始。口播驱动＝列表时钟（含延时行）；脚本驱动＝上次 play 的位置。" },
  { name: `speech.endS("hook")`, meaning: "这一句口播哪一秒结束。" },
  {
    name: `speech.play("hook")`,
    meaning:
      "脚本驱动：把这句排到口播轴上，返回开始秒，可当 GSAP position。可写 speech.play(\"hook\", 1.2) 指定时刻。同一 id 第一次生效。口播驱动：等于 startS，不改列表顺序。",
  },
  {
    name: `speech.holdS("hook", 0.48)`,
    meaning:
      "这一句画面分两段：入场 0.48s（fade 等，各语言一样长）+ 停住。holdS = s(\"hook\") − 0.48。停住这段吃掉多出来的口播，两段加起来刚好说到这句结束。换语言只变停住多久，入场不要改。",
  },
  { name: `speech.bodyS()`, meaning: "各句口播之和，不含延时行 / sleepS。" },
  { name: `speech.sleepS(0.4)`, meaning: "暂停（秒）。口播驱动：加在列表时钟之后（片尾）。脚本驱动：推进 play 光标，插在两次 play 之间。不要用它代替口播表延时行。" },
  { name: `speech.totalS()`, meaning: "本脚本全长。口播驱动 = 列表（含延时）+ 片尾 sleepS；脚本驱动 = play 光标。" },
  { name: `speech.text("hook")`, meaning: "当前预览语言的口播文案。" },
  { name: `stage.text("title")`, meaning: "当前预览语言的画面文案（文本页），不是口播。" },
  { name: `speech.ids()`, meaning: "有文案的口播 id（不含延时行）。" },
];

export const CLOCK_LAYERS = [
  { layer: "语义", store: "第几句、句内 0–1、元件 id", varies: "否" },
  { layer: "口播", store: "TTS 每句真实毫秒（或按字数估算）", varies: "是" },
  { layer: "延时", store: "口播表延时行，或脚本驱动的 speech.play / sleepS", varies: "否" },
  { layer: "演出", store: "入场 fade 等固定毫秒", varies: "否" },
];

export const SCRIPT_DRIVE_EXAMPLE = `// 口播页切到「脚本驱动」
const fade = 0.48;
const t0 = speech.play("hook");
timeline.fromTo("#title", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: fade }, t0);
timeline.to("#title", { duration: speech.holdS("hook", fade) }, t0 + fade);
speech.sleepS(0.4);
const t1 = speech.play("fact");
timeline.fromTo("#stat", { opacity: 0 }, { opacity: 1, duration: 0.42 }, t1);
timeline.to("#stat", { duration: speech.holdS("fact", 0.42) }, t1 + 0.42);
`;

export const DONT = [
  "整条时间轴按「新时长 / 旧时长」做 timeScale",
  "CSS animation-duration: 8s 或 Remotion durationInFrames={150} 当口播时钟",
  "用英文字幕时间轴驱动中文画面（字幕可以共用时间轴，动画不行）",
  "调用 timeline.play()（预览和 HyperFrames 都是 seek 暂停轴）。口播用 speech.play，不是 timeline.play",
  "把 KaTeX / Three.js 当成独立引擎；它们是 TS 工具里的库，时长仍跟 speech 走",
  "口播驱动下用 sleepS 做句间留白（sleepS 加在片尾）；句间静音用口播表「加延时」",
  "脚本驱动下指望口播表顺序自动播；必须 speech.play(id)",
];

export interface EngineGuide {
  id: EngineId;
  label: string;
  summary: string;
  duration: string;
  rules: string[];
  exampleTitle: string;
  example: string;
}

export const ENGINE_GUIDES: Record<EngineId, EngineGuide> = {
  gsap: {
    id: "gsap",
    label: "GSAP",
    summary: "工作台默认引擎。每个脚本自己的舞台 HTML；画幅/字体/全局 CSS 在工程外观里。本脚本写 paused timeline。预览和导出走 seek，不要 timeline.play()。",
    duration: "speech.s(id) 是该句配音总秒数。入场写死 fade（各语言相同）；holdS(id, fade) = 该句总长 − fade，用来把画面停到这句说完。",
    rules: [
      "timeline 必须 { paused: true }（工作台已建好，直接往上 add tween）",
      "每一段的 duration 之和应对齐 speech.s(id)，不要另写 3 秒",
      "画面字用 stage.text(id)（文本页）；口播用 speech.text(id)。预览会按 previewLang 覆盖 DOM",
      "公式用 KaTeX、三维用 Three.js（见下方附加库），不要另开一个工具",
      "暂停：口播驱动用列表延时行；脚本驱动用 speech.play + sleepS。不要 timeline.play()",
      "换预览语言只换 TTS，这段代码不用改",
    ],
    exampleTitle: "标题入场 0.48s，其余时间停住",
    example: `const fade = 0.48;

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
`,
  },
  hyperframes: {
    id: "hyperframes",
    label: "HyperFrames",
    summary: "HTML 合成 + GSAP。每个脚本自己的舞台 HTML，和 GSAP 同一套 speech。差别是成片由 HyperFrames 来 seek 这条暂停轴。",
    duration: "与 GSAP 相同：speech.s / speech.holdS / speech.startS。也可把 toClockJson 写进 data-duration。",
    rules: [
      "不要 timeline.play()，框架会按帧 seek",
      "data-duration（或构图时长）= speech.totalS()（口播 + 所有 sleepS），随语言变",
      "公式 / 三维与 GSAP 相同：KaTeX、Three.js，seek 这条轴，不要 play()",
      "适配见 engines/hyperframes/bind-gsap.ts",
    ],
    exampleTitle: "paused timeline，时长交给构图",
    example: `// HyperFrames 会 seek 这条轴
const fade = 0.48;
timeline.fromTo("#title", { opacity: 0 }, { opacity: 1, duration: fade }, speech.startS("hook"));
timeline.to("#title", { duration: speech.holdS("hook", fade) }, speech.startS("hook") + fade);
const pauseA = speech.sleepS(0.25);
const pauseB = speech.sleepS(0.4);
timeline.to({}, { duration: pauseA }, speech.bodyS());
timeline.to({}, { duration: pauseB }, speech.bodyS() + pauseA);

// 构图时长（秒）= 口播 + 所有暂停，不要写死 8
root.dataset.duration = String(speech.totalS());
`,
  },
  remotion: {
    id: "remotion",
    label: "Remotion",
    summary: "工作台里预览/导出是节拍卡（时长与配音对齐）。完整画面拷到 Remotion 项目，用 engines/remotion/NarratedScene.ts。",
    duration: "durationInFrames = round(本脚本口播秒数 × fps)。当前帧换成毫秒后查节拍，不要写死 150 帧。",
    rules: [
      "durationInFrames 必须来自 TTS / speech.totalS()（口播 + 所有 sleepS），随语言重算",
      "入场用固定帧数；多出来的口播帧用来停住（opacity 保持 1）",
      "公式用 @remotion/katex 或 katex；三维用 Three / R3F，用当前帧驱动，不要独立 rAF 循环",
      "不要用 interpolate 把整段 8s 动画拉伸成 5s",
    ],
    exampleTitle: "构图时长和播放头都跟口播走",
    example: `import { useCurrentFrame, useVideoConfig } from "remotion";
import { durationInFrames, remotionClock } from "./engines/remotion/NarratedScene";

// Root：
//   durationInFrames={durationInFrames(script, audio, fps)}

const { fps } = useVideoConfig();
const frame = useCurrentFrame();
const { localMs } = remotionClock(script, audio, frame, fps);

const fadeS = 0.48;
const hookS = audio.beatMs.hook / 1000; // 或 speech.s("hook")
const fadeFrames = Math.round(fadeS * fps);
const pauseA = 0.25;
const pauseB = 0.4;
// 与多次 speech.sleepS 相同；clock.sleep_ms 是合计
// durationInFrames = round((bodyS + pauseA + pauseB) * fps)
// 入场 fadeFrames；后面一直停到该句结束
`,
  },
  manim: {
    id: "manim",
    label: "Manim",
    summary: "工作台里预览/导出是节拍卡。完整画面用 Python 渲：读 clock.json（toClockJson），见 engines/manim/narrated_scene.py。",
    duration: "beats[].ms 是该句毫秒。FadeIn 固定 run_time；剩下的秒数 self.wait()。",
    rules: [
      "每种语言一份 clock.json + 一份配音，不要共用英语时钟去播中文",
      "不要 scene 整体 set_time / 线性拉伸",
      "事件也可用 clock['events'] 的 start_ms / end_ms",
      "暂停在对应位置 self.wait(n)，与多次 speech.sleepS 对齐；clock.sleep_ms 是合计",
    ],
    exampleTitle: "固定 FadeIn，多余口播 wait",
    example: `clock = load_clock()  # toClockJson 写出的 JSON
beats = {b["id"]: b for b in clock["beats"]}
hook = beats["hook"]

fade = 0.48
hold = max(0.0, hook["ms"] / 1000 - fade)

self.play(FadeIn(title), run_time=fade)
self.wait(hold)
self.wait(0.25)  # 与 speech.sleepS(0.25) 对应，可多次
self.wait(0.4)
# clock["sleep_ms"] 是这些暂停的合计，给 duration 用
`,
  },
};

/** Libraries used inside TS engines — not separate tools. */
export const TS_ENGINE_IDS: EngineId[] = ["gsap", "hyperframes", "remotion"];

export const MANIM_INSTEAD =
  "Manim 不用 KaTeX / Three.js：公式用 MathTex / Tex，三维用 ThreeDScene。时长同样读 clock.json 的 beats[].ms，FadeIn 固定、多余 wait()。";

export interface ExtraGuide {
  id: "katex" | "three";
  label: string;
  summary: string;
  duration: string;
  rules: string[];
  htmlTitle: string;
  html: string;
  remotionTitle: string;
  remotion: string;
}

export const EXTRA_GUIDES: ExtraGuide[] = [
  {
    id: "katex",
    label: "KaTeX",
    summary:
      "公式排版库，挂在 GSAP / HyperFrames / Remotion 上用。不是独立工具。舞台里放一个空节点，把 TeX 渲进去，再用口播 id 做入场和停留。",
    duration: "公式出现多久 = speech.s(id)。入场固定 fade；停留 speech.holdS(id, fade)。不要按公式有多长来估时。",
    rules: [
      "TeX 源可以写死（物理常量），也可以用 speech.text(id)（该句文案就是公式）",
      "GSAP / HyperFrames：先 katex.render，再对节点做 fromTo；轴保持 paused",
      "Remotion：@remotion/katex 或 katex.renderToString，用当前帧决定显隐，不要 CSS 动画秒数",
      "工作台 GSAP 沙箱若未注入 katex，把这段拷到 HyperFrames 页或 Remotion 构图，并 import katex 与样式",
      "KaTeX 自带公式字体（KaTeX_*）是 SIL OFL，免费可商用",
    ],
    htmlTitle: "GSAP / HyperFrames：渲公式，再按口播 seek",
    html: `// 舞台 HTML：<div id="eq"></div>
import katex from "katex";
import "katex/dist/katex.min.css";

const el = root.querySelector("#eq");
katex.render("E = mc^2", el, { throwOnError: false, displayMode: true });

const fade = 0.4;
timeline.fromTo(
  "#eq",
  { opacity: 0, y: 8 },
  { opacity: 1, y: 0, duration: fade },
  speech.startS("fact"),
);
timeline.to("#eq", { duration: speech.holdS("fact", fade) }, speech.startS("fact") + fade);
`,
    remotionTitle: "Remotion：公式跟帧走",
    remotion: `import katex from "katex";
import "katex/dist/katex.min.css";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { remotionClock } from "./engines/remotion/NarratedScene";

const { fps } = useVideoConfig();
const { localMs } = remotionClock(script, audio, useCurrentFrame(), fps);
const start = /* speech.startMs("fact") */ 0;
const fadeMs = 400;
const html = katex.renderToString("E = mc^2", { throwOnError: false, displayMode: true });
const opacity = localMs < start ? 0 : Math.min(1, (localMs - start) / fadeMs);
// <div style={{ opacity }} dangerouslySetInnerHTML={{ __html: html }} />
`,
  },
  {
    id: "three",
    label: "Three.js",
    summary:
      "WebGL 三维，同样挂在 GSAP / HyperFrames / Remotion 上。不是独立工具。播放头必须驱动渲染：GSAP 用 tween onUpdate；Remotion 用 useCurrentFrame。不要自己 requestAnimationFrame 空转。",
    duration: "一圈旋转、一次爆炸的时间 = 该句 speech.s(id)。换语言只换口播，圈数和入场角度保持不变。",
    rules: [
      "GSAP / HyperFrames：用 { paused: true } 的 timeline 改 mesh 状态，onUpdate 里 renderer.render",
      "不要 renderer.setAnimationLoop / rAF；否则预览 seek 和导出截帧会对不上口播",
      "卸载时 renderer.dispose()，避免切脚本泄漏 WebGL 上下文",
      "Remotion：每帧按 localMs 设 rotation，或 @react-three/fiber + useCurrentFrame",
    ],
    htmlTitle: "GSAP / HyperFrames：tween 驱动渲染",
    html: `// 舞台 HTML：<canvas id="view" width="1920" height="1080"></canvas>
import * as THREE from "three";

const canvas = root.querySelector("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
camera.position.z = 2.4;
const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), new THREE.MeshNormalMaterial());
scene.add(mesh);

const spin = { t: 0 };
timeline.to(spin, {
  t: 1,
  duration: speech.s("hook"),
  ease: "none",
  onUpdate: () => {
    mesh.rotation.y = spin.t * Math.PI * 2;
    renderer.render(scene, camera);
  },
}, speech.startS("hook"));

// 切脚本时：renderer.dispose();
`,
    remotionTitle: "Remotion：当前帧写进三维",
    remotion: `import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { remotionClock } from "./engines/remotion/NarratedScene";

const { fps } = useVideoConfig();
const { localMs } = remotionClock(script, audio, useCurrentFrame(), fps);
const hookS = audio.beatMs.hook / 1000;
const t = Math.min(1, localMs / 1000 / hookS);
mesh.rotation.y = t * Math.PI * 2;
renderer.render(scene, camera);
// 或 R3F：<mesh rotation-y={t * Math.PI * 2} />
`,
  },
];

