"""Manim adapter: run_time comes from the shared clock JSON, never from hardcoded seconds.

After TTS, write clock.json:

{
  "duration_ms": 8400,
  "events": [
    {"id": "title-in", "start_ms": 0, "end_ms": 480},
    {"id": "title-hold", "start_ms": 0, "end_ms": 2800}
  ]
}

Then:

    python -m manim engines/manim/narrated_scene.py NarratedScene

Each language is a different clock.json + a different voiceover file.
Do NOT linearly stretch the whole scene: FadeIn keeps a fixed run_time;
Wait() absorbs the extra speech.
"""

from __future__ import annotations

import json
from pathlib import Path

from typing import Optional

from manim import FadeIn, Scene, Text


def load_clock(path: Optional[str] = None) -> dict:
    clock_path = Path(path) if path else Path(__file__).with_name("clock.json")
    return json.loads(clock_path.read_text(encoding="utf-8"))


class NarratedScene(Scene):
    def construct(self) -> None:
        clock = load_clock()
        events = {e["id"]: e for e in clock["events"]}
        title = Text("黑洞不是洞")

        fade = events["title-in"]
        hold = events["title-hold"]
        fade_s = (fade["end_ms"] - fade["start_ms"]) / 1000
        hold_s = max(0.0, (hold["end_ms"] - fade["end_ms"]) / 1000)

        self.play(FadeIn(title), run_time=fade_s)
        self.wait(hold_s)
        # sleep_ms = Σ speech.sleepS；暂停写在对应位置。若都在片尾，可一次 wait 合计。
        self.wait(float(clock.get("sleep_ms", clock.get("tail_ms", 0))) / 1000)
