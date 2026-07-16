// ブラインド画像処理(機能設計書 v3.3 §5.1)。
// 中核はピクセル配列に対する純関数として実装し、pixel単位の自動テストを
// 可能にする(IMG-003/005/006/007)。ブラウザではCanvasで縮小・JPEG化する。
// 元画像・クロップ画像はどこにも保存しない(§5.3)。

export const MAX_LONG_EDGE = 1280;
export const JPEG_QUALITY = 0.85;
export const MIN_CUT_X = 40;
export const ENTRY_LINE_WIDTH = 3;
/** #5EA8B3 */
export const ENTRY_LINE_RGB: readonly [number, number, number] = [
  0x5e, 0xa8, 0xb3,
];

/** RGBA ピクセル配列(ImageData互換の最小形) */
export interface PixelImage {
  width: number;
  height: number;
  /** RGBA、長さ = width * height * 4 */
  data: Uint8ClampedArray;
}

/** 長辺を MAX_LONG_EDGE 以下へ縮小したサイズを返す(拡大はしない) */
export function computeResizedSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= MAX_LONG_EDGE) return { width, height };
  const scale = MAX_LONG_EDGE / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * タップ位置(画像幅に対する割合 frac)からクロップ位置を求める。
 * cutX = Math.max(40, Math.round(width * frac))。追加マージンは入れない。
 */
export function computeCutX(width: number, frac: number): number {
  const clamped = Math.min(Math.max(frac, 0), 1);
  return Math.min(width, Math.max(MIN_CUT_X, Math.round(width * clamped)));
}

/**
 * cutX より右を完全に削除し、右端に #5EA8B3・幅3px の縦線を描画した
 * 新しいピクセル配列を返す(純関数)。
 */
export function applyCropWithEntryLine(
  src: PixelImage,
  cutX: number,
): PixelImage {
  const width = Math.min(Math.max(cutX, 1), src.width);
  const height = src.height;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = y * src.width * 4;
    const outRow = y * width * 4;
    out.set(src.data.subarray(srcRow, srcRow + width * 4), outRow);
  }
  const lineStart = Math.max(0, width - ENTRY_LINE_WIDTH);
  for (let y = 0; y < height; y++) {
    for (let x = lineStart; x < width; x++) {
      const i = (y * width + x) * 4;
      out[i] = ENTRY_LINE_RGB[0];
      out[i + 1] = ENTRY_LINE_RGB[1];
      out[i + 2] = ENTRY_LINE_RGB[2];
      out[i + 3] = 255;
    }
  }
  return { width, height, data: out };
}

export interface CropResult {
  /** AIへ送る唯一の画像。image/jpeg quality 0.85 の data URL */
  dataUrl: string;
  width: number;
  height: number;
  cutX: number;
}

/**
 * ブラウザ用パイプライン: 縮小 → cutXで切除+エントリー線 → JPEG(0.85)。
 * エントリー位置(fracX)が未指定の場合は呼び出し側で実行不可にすること
 * (IMG-004)。戻り値はメモリ上のみで扱い、保存しない。
 */
export function cropImageForReview(
  image: CanvasImageSource & { width: number; height: number },
  fracX: number,
): CropResult {
  if (typeof document === "undefined") {
    throw new Error("cropImageForReview はブラウザ専用です");
  }
  const resized = computeResizedSize(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = resized.width;
  canvas.height = resized.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D contextを取得できません");
  ctx.drawImage(image, 0, 0, resized.width, resized.height);

  const cutX = computeCutX(resized.width, fracX);
  const srcPixels = ctx.getImageData(0, 0, resized.width, resized.height);
  const cropped = applyCropWithEntryLine(
    { width: srcPixels.width, height: srcPixels.height, data: srcPixels.data },
    cutX,
  );

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cropped.width;
  outCanvas.height = cropped.height;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D contextを取得できません");
  // ImageData は ArrayBuffer 裏付けの配列を要求するためコピーする
  const outData = new Uint8ClampedArray(cropped.data.length);
  outData.set(cropped.data);
  outCtx.putImageData(new ImageData(outData, cropped.width, cropped.height), 0, 0);
  return {
    dataUrl: outCanvas.toDataURL("image/jpeg", JPEG_QUALITY),
    width: cropped.width,
    height: cropped.height,
    cutX,
  };
}
