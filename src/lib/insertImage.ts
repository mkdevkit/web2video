const MAX_BYTES = 24 * 1024 * 1024;

export function pickMediaFile(accept: string, maxBytes = MAX_BYTES): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > maxBytes) {
        window.alert(`文件超过 ${Math.round(maxBytes / 1024 / 1024)}MB，请换更短或压缩后的素材`);
        return resolve(null);
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export function pickImageFile(): Promise<string | null> {
  return pickMediaFile("image/*");
}

export function pickGifFile(): Promise<string | null> {
  return pickMediaFile("image/gif,.gif");
}

export function pickVideoFile(): Promise<string | null> {
  return pickMediaFile("video/mp4,video/webm,video/quicktime,video/*");
}

export function isGifSrc(src: string): boolean {
  return /^data:image\/gif/i.test(src) || /\.gif(?:$|\?)/i.test(src);
}

export function mediaSrcOf(block: { type: string; settings?: { src?: string } }, slotImage?: string): string {
  const own = block.settings?.src?.trim();
  if (own) return own;
  if (block.type === "image") return (slotImage ?? "").trim();
  return "";
}
