export { DEFAULT_STAGE_HTML, stageHtmlOf } from "./stage";

export const DEFAULT_CODE = `// 用口播 id 取时长，不要写死秒数。
// 口播驱动：列表顺序即时钟，句间留白用口播表「加延时」。
//   speech.startS("hook") / speech.s("hook") / speech.holdS("hook", fade)
// 脚本驱动：台词库 + speech.play("hook") 排期（返回开始秒，可当 GSAP position）。
//   speech.sleepS(0.4) 插在两次 play 之间。不要 timeline.play()。
// 入场用固定秒；holdS(id, fade) = 该句总长 − fade。

const fade = 0.48;

timeline.fromTo("#title", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: fade, ease: "power2.out" }, speech.startS("hook"));
timeline.to("#title", { duration: speech.holdS("hook", fade) }, speech.startS("hook") + fade);

timeline.fromTo("#stat", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42 }, speech.startS("fact"));
timeline.to("#stat", { duration: speech.holdS("fact", 0.42) }, speech.startS("fact") + 0.42);

timeline.fromTo("#ring", { opacity: 0, scale: 0.6 }, { opacity: 0.85, scale: 1, duration: 0.5 }, speech.startS("close"));
timeline.to("#ring", { duration: speech.holdS("close", 0.5) }, speech.startS("close") + 0.5);

const pauseA = speech.sleepS(0.25);
const pauseB = speech.sleepS(0.4);
timeline.to({}, { duration: pauseA }, speech.bodyS());
timeline.to({}, { duration: pauseB }, speech.bodyS() + pauseA);

// 画面文案可跟口播：root.querySelector("#title").textContent = speech.text("hook");
// 脚本驱动示例：
// const t = speech.play("hook");
// timeline.fromTo("#title", { opacity: 0 }, { opacity: 1, duration: fade }, t);
`;
