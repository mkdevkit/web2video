import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { edgeTtsPlugin } from "./vite-plugin-edge-tts";
import { llmProxyPlugin } from "./vite-plugin-llm-proxy";

const edgeProxy = {
  "/__edge_translate": {
    target: "https://edge.microsoft.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/__edge_translate/, "/translate"),
  },
};

export default defineConfig({
  plugins: [react(), edgeTtsPlugin(), llmProxyPlugin()],
  clearScreen: false,
  server: { port: 5174, strictPort: true, proxy: edgeProxy },
  preview: { proxy: edgeProxy },
});
