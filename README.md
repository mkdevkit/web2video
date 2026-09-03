# videocreator

口播网页转视频工具集。

| 目录 | 说明 |
| --- | --- |
| [`web2video`](./web2video) | 把口播做成网页场景，配 TTS 与时间轴，再按语言导出视频 |
| [`script2video`](./script2video) | Script2Video：脚本与口播工作台（Web / Tauri）：DeepSeek 生成、翻译、千问配音、画面跟节拍走 |

```bash
cd web2video       # 网页场景编辑器
# 或
cd script2video    # 脚本 / 口播 / 翻译 / 配音
npm install
npm run dev        # 浏览器
# npm run tauri:dev  # 桌面（需 Rust）
```

建议 **Chrome 或 Edge**。开发时必须用 `npm run dev`，本机 Vite 插件会代理千问 TTS、LLM 和 Edge 翻译。密钥只存在本机 `localStorage`，不进工程文件。

两个工具的界面与成片字体均为 **SIL OFL（免费可商用）**，明细见 [`web2video/README.md`](./web2video/README.md#字体) 与 [`script2video/README.md`](./script2video/README.md#字体)。
