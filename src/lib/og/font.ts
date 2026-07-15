import { VERDICTS } from "@/lib/review/types";

// OG画像で描画しうる和文グリフの上限集合。ここに含まれる文字だけを
// Google Fonts のサブセット機能で取得する(バンドルを小さく保つため)。
export const OG_TAGLINE = "そのポジは、エッジか衝動か。";
export const OG_WORDMARK = "ポジミル";
const OG_MISC = "この判定を共有 診断 通貨ペア 無料で試す";

function glyphSuperset(): string {
  const all = OG_WORDMARK + OG_TAGLINE + OG_MISC + VERDICTS.join("");
  // 重複を除去(取得URLを安定させる)
  return Array.from(new Set(Array.from(all))).join("");
}

type FontSpec = {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 700;
  style: "normal";
};

// モジュールスコープでキャッシュ。ウォーム後はネットワークアクセスなし。
let cache: FontSpec[] | null = null;
let inflight: Promise<FontSpec[]> | null = null;

// Google Fonts の CSS API は、ブラウザUA以外からのリクエストに truetype/opentype を
// 返す。satori は ttf/otf/woff のみ対応(woff2不可)なので、この経路で ttf を得る。
async function fetchGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer> {
  const url =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}`;
  const cssRes = await fetch(url, {
    headers: {
      // 明示的に非ブラウザUAにして ttf/otf を確実に受け取る
      "User-Agent": "Mozilla/5.0 (compatible; pojimiru-og/1.0)",
    },
  });
  if (!cssRes.ok) {
    throw new Error(`font css fetch failed: ${cssRes.status}`);
  }
  const css = await cssRes.text();
  const match = css.match(
    /src:\s*url\((https:\/\/[^)]+)\)\s*format\('(?:opentype|truetype)'\)/,
  );
  if (!match) {
    throw new Error("font url not found in css");
  }
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) {
    throw new Error(`font data fetch failed: ${fontRes.status}`);
  }
  return fontRes.arrayBuffer();
}

/**
 * OG画像用フォント(Noto Sans JP)を取得。和文サブセットを実行時に取得し、
 * モジュールスコープでキャッシュする。失敗時は例外を投げ、呼び出し側で500に握る。
 */
export async function loadOgFonts(): Promise<FontSpec[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  const text = glyphSuperset();
  inflight = (async () => {
    const [regular, bold] = await Promise.all([
      fetchGoogleFont("Noto Sans JP", 500, text),
      fetchGoogleFont("Noto Sans JP", 700, text),
    ]);
    const fonts: FontSpec[] = [
      { name: "Noto Sans JP", data: regular, weight: 500, style: "normal" },
      { name: "Noto Sans JP", data: bold, weight: 700, style: "normal" },
    ];
    cache = fonts;
    return fonts;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
