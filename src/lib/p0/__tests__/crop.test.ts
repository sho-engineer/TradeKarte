import { describe, expect, it } from "vitest";
import {
  applyCropWithEntryLine,
  computeCutX,
  computeResizedSize,
  ENTRY_LINE_RGB,
  ENTRY_LINE_WIDTH,
  JPEG_QUALITY,
  MAX_LONG_EDGE,
  MIN_CUT_X,
  type PixelImage,
} from "../crop";

/** 全ピクセルを (x % 251, y % 251, 7) で塗った検証用画像 */
function makeImage(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x % 251;
      data[i + 1] = y % 251;
      data[i + 2] = 7;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("ブラインド画像処理(§5.1 / 必須テスト5章)", () => {
  it("IMG-003: 長辺2000pxは1280px以下へ縮小される(quality定数=0.85)", () => {
    const r = computeResizedSize(2000, 1000);
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(MAX_LONG_EDGE);
    expect(r.width).toBe(1280);
    expect(r.height).toBe(640);
    // 縦長も同様
    const r2 = computeResizedSize(900, 2000);
    expect(r2.height).toBe(1280);
    // 小さい画像は拡大しない
    const r3 = computeResizedSize(800, 600);
    expect(r3).toEqual({ width: 800, height: 600 });
    expect(JPEG_QUALITY).toBe(0.85);
    expect(MAX_LONG_EDGE).toBe(1280);
  });

  it("IMG-005: 幅1000でx=600指定 → 出力幅600・右側画素なし・余白なし", () => {
    const src = makeImage(1000, 20);
    const cutX = computeCutX(1000, 0.6);
    expect(cutX).toBe(600);
    const out = applyCropWithEntryLine(src, cutX);
    expect(out.width).toBe(600);
    expect(out.height).toBe(20);
    // +2%等の追加余白がない(幅がcutXそのもの)
    expect(out.width).toBe(cutX);
    // エントリー線より左は元画像と同一 = x>600の画素が混入していない
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width - ENTRY_LINE_WIDTH; x++) {
        const i = (y * out.width + x) * 4;
        expect(out.data[i]).toBe(x % 251);
        expect(out.data[i + 1]).toBe(y % 251);
        expect(out.data[i + 2]).toBe(7);
      }
    }
  });

  it("IMG-006: タップ位置が40px未満なら cutX=40", () => {
    expect(computeCutX(1000, 0.01)).toBe(MIN_CUT_X); // 10px相当 → 40
    expect(computeCutX(1000, 0)).toBe(MIN_CUT_X);
    expect(computeCutX(1000, 0.04)).toBe(MIN_CUT_X); // ちょうど40
    expect(computeCutX(1000, 0.05)).toBe(50);
    // 端の丸めとクランプ
    expect(computeCutX(1000, 1)).toBe(1000);
    expect(computeCutX(1000, 1.5)).toBe(1000);
  });

  it("IMG-007: 右端に #5EA8B3・幅3px の縦線", () => {
    const src = makeImage(500, 10);
    const out = applyCropWithEntryLine(src, 300);
    expect(ENTRY_LINE_RGB).toEqual([0x5e, 0xa8, 0xb3]);
    for (let y = 0; y < out.height; y++) {
      // 右端3px は teal
      for (let x = out.width - ENTRY_LINE_WIDTH; x < out.width; x++) {
        const i = (y * out.width + x) * 4;
        expect(out.data[i]).toBe(0x5e);
        expect(out.data[i + 1]).toBe(0xa8);
        expect(out.data[i + 2]).toBe(0xb3);
        expect(out.data[i + 3]).toBe(255);
      }
      // その1px左は teal ではない(線幅がちょうど3px)
      const j = (y * out.width + (out.width - ENTRY_LINE_WIDTH - 1)) * 4;
      expect([out.data[j], out.data[j + 1], out.data[j + 2]]).not.toEqual([
        0x5e, 0xa8, 0xb3,
      ]);
    }
  });
});
