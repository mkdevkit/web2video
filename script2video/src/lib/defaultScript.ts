export { DEFAULT_STAGE_HTML, stageHtmlOf } from "./stage";

export const DEFAULT_CODE = `// 用口播 id 取时长，不要写死秒数。
// speech.s("hook") = 这一句的总时长（随语言 TTS 变）
// 入场用固定秒（各语言一样快）；holdS(id, fade) = 该句总长 − fade，画面停到这句说完。
// 暂停可写多次：每次 speech.sleepS(n) 都加进全长。totalS = bodyS + Σ sleepS。
// 不要在口播表里填毫秒。startS / endS 仍是口播轴（不含暂停）。

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
`;
