import { ImageResponse } from "next/og";
import { isVerdict } from "@/lib/review/types";
import { verdictMeta } from "@/lib/review/verdict";
import { loadOgFonts, OG_TAGLINE } from "@/lib/og/font";

// satori/resvg は Node ランタイムで動かす
export const runtime = "nodejs";

// OG画像は固定のダーク(ink)基調。ブランドは teal 一本、
// 判定色は機能色だが「枠線のみ」で使い、朱の面積を最小化する。
const INK = "#0e1116";
const SURFACE = "#151a21";
const TEAL = "#5ea8b3";
const TEXT = "#e6e9ed";
const MUTED = "#9aa3ae";
const RULE = "#2a313b";

// 通貨ペアは英数とスラッシュのみ・短く制限(URL由来の描画物を安全側に倒す)
function sanitizePair(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9/]/g, "");
  if (!cleaned) return null;
  return cleaned.slice(0, 12);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const v = searchParams.get("v");
  const pair = sanitizePair(searchParams.get("pair"));

  if (!isVerdict(v)) {
    return new Response("invalid verdict", { status: 400 });
  }

  const meta = verdictMeta(v);

  let fonts;
  try {
    fonts = await loadOgFonts();
  } catch {
    return new Response("failed to load fonts", { status: 500 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: INK,
          padding: "72px 80px",
          fontFamily: "Noto Sans JP",
          position: "relative",
        }}
      >
        {/* 上辺のブランドライン */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: TEXT,
            }}
          >
            <span>ポジ</span>
            <span style={{ color: TEAL }}>ミル</span>
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.28em",
              color: MUTED,
            }}
          >
            AI TRADE REVIEW
          </div>
        </div>

        {/* 中央:判定チップ(機能色は枠線のみ) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: "20px",
              padding: "18px 30px",
              borderRadius: 999,
              border: `2px solid ${meta.hex}`,
              backgroundColor: SURFACE,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.24em",
                color: meta.hex,
              }}
            >
              {meta.en}
            </span>
            <span
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: TEXT,
              }}
            >
              {v}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "34px",
              fontSize: 30,
              lineHeight: 1.5,
              color: MUTED,
              maxWidth: "820px",
            }}
          >
            {meta.headline}
          </div>
        </div>

        {/* 下辺:タグライン + 任意の通貨ペア */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: `1px solid ${RULE}`,
            paddingTop: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              color: TEXT,
            }}
          >
            {OG_TAGLINE}
          </div>
          {pair && (
            <div
              style={{
                fontSize: 20,
                letterSpacing: "0.14em",
                color: MUTED,
              }}
            >
              {pair}
            </div>
          )}
        </div>

        {/* teal のアクセントバー(ブランド一本) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "10px",
            backgroundColor: TEAL,
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}
