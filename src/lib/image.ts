"use client";

/** 画像ファイルを長辺 maxEdge px 以内の JPEG data URL に変換(コスト制御のためクライアント側で縮小) */
export async function fileToResizedJpegDataUrl(
  file: File,
  maxEdge: number,
  quality = 0.85,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    // チャートの背景が透過PNGでも黒潰れしないよう白で塗る
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}

export const MAIN_IMAGE_MAX_EDGE = 1280;
export const THUMB_MAX_EDGE = 460;
