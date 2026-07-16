import { NextResponse } from "next/server";
import { parseKarteFeedback, parseKarteResult } from "./dto";
import { verifyAccessFromRequest } from "./reviewHandler";
import type { RunStore } from "./store";

// 結果の後入力(§12)と構造化フィードバック(§13)の中核。
// deps に Anthropic クライアントを持たない構造により、結果入力・
// フィードバックでAIを再実行しないことを保証する(RESULT-002)。
// karte の新規作成・run の追加も行わない(RESULT-003)。

export interface KarteDeps {
  store: RunStore;
  /** Supabaseセッションからuser_idを取得(本文からは受け取らない) */
  getUserId(request: Request): Promise<string | null>;
  /** アクセスCookieの検証(注入可能にしてテスト容易化) */
  verifyAccess?(request: Request): Promise<boolean>;
}

type Guarded =
  | { ok: true; userId: string; body: unknown }
  | { ok: false; response: NextResponse };

/** アクセスCookie→セッション→JSON本文の共通ガード */
async function guard(deps: KarteDeps, request: Request): Promise<Guarded> {
  const accessOk = await (deps.verifyAccess ?? verifyAccessFromRequest)(
    request,
  );
  if (!accessOk) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "アクセスコードが必要です" },
        { status: 403 },
      ),
    };
  }

  const userId = await deps.getUserId(request);
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "認証が必要です" }, { status: 401 }),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "不正なリクエスト" },
        { status: 400 },
      ),
    };
  }
  return { ok: true, userId, body };
}

const NOT_FOUND = () =>
  NextResponse.json({ error: "対象のカルテが見つかりません" }, { status: 404 });

export async function handleKarteResult(
  deps: KarteDeps,
  request: Request,
  karteId: string,
): Promise<NextResponse> {
  const g = await guard(deps, request);
  if (!g.ok) return g.response;

  const dto = parseKarteResult(g.body);
  if (!dto.ok) {
    return NextResponse.json({ error: dto.message }, { status: 400 });
  }

  // 所有者確認込みで結果列のみ更新(assessment等の監査結果は不変)
  const saved = await deps.store.setResult(karteId, g.userId, dto.value);
  if (!saved) return NOT_FOUND();
  return NextResponse.json({ karte_id: karteId, result: dto.value });
}

export async function handleKarteFeedback(
  deps: KarteDeps,
  request: Request,
  karteId: string,
): Promise<NextResponse> {
  const g = await guard(deps, request);
  if (!g.ok) return g.response;

  const dto = parseKarteFeedback(g.body);
  if (!dto.ok) {
    return NextResponse.json({ error: dto.message }, { status: 400 });
  }

  const saved = await deps.store.setFeedback(karteId, g.userId, dto.value);
  if (!saved) return NOT_FOUND();
  return NextResponse.json({ karte_id: karteId, feedback: dto.value });
}
